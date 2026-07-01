import { getCharacter, getConstants } from '../data-loader.js';
import { BuffState } from '../buff/state.js';
import { calcDamage } from '../damage/calc.js';
import { aggregateStats } from '../stat/aggregate.js';
import {
  actionAdvance,
  addSpeedBuff,
  createUnit,
  effectiveSpeed,
  simulateTimeline,
} from '../timeline/engine.js';
import type {
  ActionEvent,
  DamageResult,
  EnemyData,
  RotationStep,
  TeamBuild,
  TeamSimResult,
  TimelineUnit,
} from '../types.js';

export interface TeamSimOptions {
  cycles?: number;
  enemy?: EnemyData;
  enemyBroken?: boolean;
}

function applySkillEffects(
  actor: TimelineUnit,
  allies: TimelineUnit[],
  skillId: string,
  characterId: string,
): void {
  const char = getCharacter(characterId);
  const skill = char.skills[skillId];
  if (!skill?.effects) return;

  for (const effect of skill.effects) {
    if (effect.type === 'action_advance') {
      const targets = effect.target === 'team' ? allies : [actor];
      for (const u of targets) {
        actionAdvance(u, effect.value);
      }
    }
    if (effect.type === 'speed_buff') {
      addSpeedBuff(actor, effect.value, getConstants().action_distance);
    }
  }
}

export function simulateTeam(
  team: TeamBuild,
  rotation: RotationStep[],
  options: TeamSimOptions = {},
): TeamSimResult {
  const members = team.members.slice(0, 4);
  const statsMap = new Map(
    members.map((m) => [m.characterId, aggregateStats(m)]),
  );

  const units: TimelineUnit[] = members.map((m) => {
    const stats = statsMap.get(m.characterId)!;
    const char = getCharacter(m.characterId);
    return createUnit(m.characterId, char.name, 'ally', stats.baseSpeed, stats.speed);
  });

  const buffs = new Map(members.map((m) => [m.characterId, new BuffState()]));
  const events: ActionEvent[] = [];
  const actionCounts: Record<string, number> = {};
  let totalDamage = 0;

  const timelineTicks = simulateTimeline([...units], {
    maxAV:
      getConstants().first_cycle_av +
      getConstants().subsequent_cycle_av * (options.cycles ?? 2),
  });

  let rotIdx = 0;
  for (const tick of timelineTicks) {
    const build = members.find((m) => m.characterId === tick.actorId);
    if (!build) continue;

    const step: RotationStep = rotation[rotIdx] ?? {
      actorId: build.characterId,
      skillId: build.skillId ?? 'skill',
    };
    rotIdx++;

    const char = getCharacter(build.characterId);
    const skill = char.skills[step.skillId] ?? char.skills['skill'];
    const stats = statsMap.get(build.characterId)!;
    const unitBuffs = buffs.get(build.characterId)!.getAll();

    let damage: DamageResult | undefined;
    if (skill.type !== 'support' && options.enemy) {
      damage = calcDamage({
        stats,
        skill,
        enemy: options.enemy,
        modifiers: unitBuffs,
        enemyBroken: options.enemyBroken,
      });
      totalDamage += damage.expected;
    }

    applySkillEffects(
      units.find((u) => u.id === build.characterId)!,
      units,
      step.skillId,
      build.characterId,
    );

    actionCounts[build.characterId] = (actionCounts[build.characterId] ?? 0) + 1;
    events.push({
      unitId: build.characterId,
      globalAV: tick.globalAV,
      roundIndex: tick.roundIndex,
      actionType: step.skillId === 'ult' ? 'ult' : step.skillId === 'basic' ? 'normal' : 'skill',
      skillId: step.skillId,
      damage,
    });
  }

  const lastAV = events.length > 0 ? events[events.length - 1].globalAV : 1;
  const dpr = (totalDamage / lastAV) * 100;

  return { events, totalDamage, dpr, actionCounts };
}

export { effectiveSpeed };
