import { getCharacter, getConstants, getEnemy } from '../data-loader.js';
import { BuffState } from '../buff/state.js';
import { calcDamage } from '../damage/calc.js';
import { aggregateStats } from '../stat/aggregate.js';
import {
  actionAdvance,
  actionDelay,
  createUnit,
  effectiveSpeed,
  nextActor,
  timeToAction,
} from '../timeline/engine.js';
import type {
  BuildRequest,
  CharacterBuild,
  CombatLogEntry,
  CombatSimResult,
  EnemyData,
  RotationStep,
  TimelineUnit,
} from '../types.js';

interface CombatUnit extends TimelineUnit {
  energy: number;
  build: CharacterBuild;
}

interface CombatEnemyState {
  data: EnemyData;
  hp: number;
  broken: boolean;
  unit: TimelineUnit;
  aiIndex: number;
}

export interface CombatSimOptions {
  maxTurns?: number;
  rotation?: RotationStep[];
  pendingUlts?: string[];
}

function pushLog(
  entries: CombatLogEntry[],
  t: number,
  entry: Omit<CombatLogEntry, 'timestamp'>,
): void {
  entries.push({ ...entry, timestamp: t });
}

export function simulateCombat(
  request: BuildRequest,
  options: CombatSimOptions = {},
): CombatSimResult {
  if (!request.enemyId) {
    throw new Error('Combat mode requires enemyId');
  }

  const enemyData = getEnemy(request.enemyId);
  const c = getConstants();
  const members = request.team.members.slice(0, 4);
  const logEntries: CombatLogEntry[] = [];
  let globalAV = 0;
  let turns = 0;
  let totalDamage = 0;

  const allies: CombatUnit[] = members.map((m) => {
    const stats = aggregateStats(m);
    const char = getCharacter(m.characterId);
    return {
      ...createUnit(m.characterId, char.name, 'ally', stats.baseSpeed, stats.speed),
      energy: 0,
      build: m,
    };
  });

  const enemy: CombatEnemyState = {
    data: enemyData,
    hp: enemyData.hp,
    broken: request.enemyBroken ?? false,
    unit: createUnit(
      enemyData.id,
      enemyData.name,
      'enemy',
      enemyData.speed ?? 100,
    ),
    aiIndex: 0,
  };

  const buffs = new Map(members.map((m) => [m.characterId, new BuffState()]));
  const rotation = options.rotation ?? request.team.rotation ?? [];
  let rotIdx = 0;
  const maxTurns = options.maxTurns ?? 20;
  const ultQueue = [...(options.pendingUlts ?? [])];

  const allUnits = (): TimelineUnit[] => [...allies, enemy.unit];

  while (enemy.hp > 0 && turns < maxTurns) {
    while (ultQueue.length > 0 && enemy.hp > 0) {
      const ultId = ultQueue.shift()!;
      const ally = allies.find((a) => a.id === ultId);
      if (!ally || ally.energy < c.ult_energy_max) continue;

      ally.energy = 0;
      const char = getCharacter(ally.build.characterId);
      const skill = char.skills['ult'];
      const stats = aggregateStats(ally.build);
      const dmg = calcDamage({
        stats,
        skill,
        enemy: enemy.data,
        modifiers: buffs.get(ally.build.characterId)!.getAll(),
        enemyBroken: enemy.broken,
      });
      enemy.hp -= dmg.expected;
      totalDamage += dmg.expected;
      pushLog(logEntries, globalAV, {
        type: 'ult_insert',
        actor: ally.id,
        target: enemy.data.id,
        damage: dmg,
        enemyHp: enemy.hp,
        detail: `${char.name} 插入终结技`,
      });
    }

    if (enemy.hp <= 0) break;

    const actor = nextActor(allUnits());
    const dt = timeToAction(actor);
    globalAV += dt;
    turns++;

    for (const u of allUnits()) {
      if (u.id === actor.id) continue;
      u.distanceRemaining -= effectiveSpeed(u) * dt;
      if (u.distanceRemaining <= 0) {
        u.distanceRemaining = c.action_distance;
      }
    }
    actor.distanceRemaining = c.action_distance;

    if (actor.side === 'ally') {
      const ally = allies.find((a) => a.id === actor.id)!;
      const step: RotationStep = rotation[rotIdx] ?? {
        actorId: ally.id,
        skillId: ally.build.skillId ?? 'skill',
      };
      rotIdx++;

      const char = getCharacter(ally.build.characterId);
      const skill = char.skills[step.skillId] ?? char.skills['skill'];

      if (skill.type !== 'support') {
        const stats = aggregateStats(ally.build);
        const dmg = calcDamage({
          stats,
          skill,
          enemy: enemy.data,
          modifiers: buffs.get(ally.build.characterId)!.getAll(),
          enemyBroken: enemy.broken,
        });
        enemy.hp -= dmg.expected;
        totalDamage += dmg.expected;
        pushLog(logEntries, globalAV, {
          type: 'ally_action',
          actor: ally.id,
          target: enemy.data.id,
          damage: dmg,
          enemyHp: enemy.hp,
          detail: `${char.name} 使用 ${skill.name}`,
        });
      } else {
        for (const effect of skill.effects ?? []) {
          if (effect.type === 'action_advance') {
            const targets = effect.target === 'team' ? allies : [ally];
            for (const t of targets) {
              actionAdvance(t, effect.value);
            }
          }
        }
        pushLog(logEntries, globalAV, {
          type: 'ally_support',
          actor: ally.id,
          detail: `${char.name} 使用 ${skill.name}`,
        });
      }
    } else {
      const pattern = ['attack', 'attack', 'skill'];
      const action = pattern[enemy.aiIndex % pattern.length];
      enemy.aiIndex++;

      pushLog(logEntries, globalAV, {
        type: 'enemy_action',
        actor: enemy.data.id,
        detail: `敌人 ${action}`,
      });

      for (const ally of allies) {
        ally.energy = Math.min(
          c.ult_energy_max,
          ally.energy + c.ult_energy_on_hit_taken,
        );
        actionDelay(ally, 0.1);
      }
    }

    for (const b of buffs.values()) b.tick();
  }

  return {
    log: logEntries,
    victory: enemy.hp <= 0,
    turnsElapsed: turns,
    totalDamageDealt: totalDamage,
  };
}
