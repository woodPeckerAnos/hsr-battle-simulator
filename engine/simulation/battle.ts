import { getCharacter, getConstants } from '../data-loader.js';
import type {
  ActionEvent,
  BattleRequest,
  CharacterBuild,
  CombatLogEntry,
  RotationStep,
} from '../types.js';
import { createTeamFromBuilds } from '../runtime/team-factory.js';
import { EnemyRuntime } from '../runtime/enemy-runtime.js';
import type { ActionContext, ActionResult } from '../runtime/types.js';
import type { Character } from '../runtime/character.js';
import {
  applyActionEffects,
  firstDamageFromEffects,
} from '../effects/index.js';
import type { TurnContext, TurnPhase } from '../runtime/turn-context.js';
import type { Participant } from './participant.js';
import type { TeamContext } from '../runtime/team-context.js';
import { Timeline } from '../timeline/timeline.js';
import { validateBattleRequest } from './validate.js';

export interface BattleRunOptions {
  maxTurn: number;
  rotation?: RotationStep[];
  pendingUlts?: string[];
  enemyBroken?: boolean;
}

export interface BattleResult {
  log: CombatLogEntry[];
  events: ActionEvent[];
  totalDamage: number;
  dpr: number;
  actionCounts: Record<string, number>;
  victory: boolean;
  turnsElapsed: number;
}

function findParticipant(
  participants: Participant[],
  axisId: string,
): Participant | undefined {
  return participants.find((p) => p.id === axisId || p.axis.id === axisId);
}

export class Battle {
  readonly team: TeamContext;
  readonly enemy: EnemyRuntime;

  constructor(builds: CharacterBuild[], enemyId: string) {
    if (!enemyId.trim()) {
      throw new Error('enemyId is required');
    }
    if (!builds.length) {
      throw new Error('team.members must contain at least one character');
    }
    this.team = createTeamFromBuilds(builds);
    this.enemy = EnemyRuntime.fromCatalog(enemyId);
  }

  get participants(): Participant[] {
    return [...this.team.members, this.enemy];
  }

  private initAxes(): void {
    for (const member of this.team.members) {
      member.syncAxisStats();
    }
  }

  run(options: BattleRunOptions): BattleResult {
    if (!Number.isInteger(options.maxTurn) || options.maxTurn <= 0) {
      throw new Error('maxTurn must be a positive integer');
    }

    this.initAxes();
    const c = getConstants();
    const timeline = new Timeline();
    const participants = this.participants;
    const units = participants.map((p) => p.axis);
    const rotation = options.rotation ?? [];
    const logEntries: CombatLogEntry[] = [];
    const events: ActionEvent[] = [];
    const actionCounts: Record<string, number> = {};
    let enemyHp = this.enemy.data.hp;
    let totalDamage = 0;
    let rotIdx = 0;
    let turns = 0;
    const maxTurn = options.maxTurn;
    const ultQueue = [...(options.pendingUlts ?? [])];
    const fallbackActor = this.team.members[0]!;
    const enemyBroken = options.enemyBroken ?? false;

    const battleStartCtx: ActionContext = {
      constants: c,
      team: this.team,
      enemy: this.enemy,
      globalAV: 0,
      roundIndex: 0,
      enemyBroken,
      actor: fallbackActor,
      evaluateOnly: false,
    };

    const pushLog = (entry: Omit<CombatLogEntry, 'timestamp'>): void => {
      logEntries.push({ ...entry, timestamp: timeline.globalAV });
    };

    const effectCtx = {
      team: this.team,
      enemy: this.enemy,
      participants,
      timeline,
      onEnemyDamage: (amount: number) => {
        enemyHp -= amount;
        totalDamage += amount;
      },
    };

    for (const member of this.team.members) {
      applyActionEffects(
        member.reconcileEquipment('battle_start', battleStartCtx),
        effectCtx,
      );
    }

    const runAllyTurn = (
      actor: Character,
      step: RotationStep,
      phase: TurnPhase = 'main',
    ): void => {
      const skillId = step.skillId ?? actor.build.skillId ?? 'skill';
      const actionResults: ActionResult[] = [];

      const turn: TurnContext = {
        phase,
        toActionContext: (overrides = {}) => ({
          constants: c,
          team: this.team,
          enemy: this.enemy,
          globalAV: timeline.globalAV,
          roundIndex: timeline.roundIndex,
          enemyBroken,
          actor,
          evaluateOnly: false,
          chosenSkillId: skillId,
          targetIds: step.target ? [step.target] : undefined,
          ...overrides,
        }),
        applyEffects: (effects) => {
          applyActionEffects(effects, effectCtx);
        },
        onActionComplete: (result) => {
          actionResults.push(result);
        },
        notifyTurnComplete: () => {},
      };

      actor.takeTurn(turn);

      actionCounts[actor.id] =
        (actionCounts[actor.id] ?? 0) + actionResults.length;

      const char = getCharacter(actor.build.characterId);
      const skill = char.skills[skillId] ?? char.skills['skill']!;
      const lastResult = actionResults[actionResults.length - 1];
      const damageFx = lastResult
        ? firstDamageFromEffects(lastResult.effects)
        : undefined;

      events.push({
        unitId: actor.id,
        globalAV: timeline.globalAV,
        roundIndex: timeline.roundIndex,
        actionType:
          skillId === 'ult' ? 'ult' : skillId === 'basic' ? 'normal' : 'skill',
        skillId,
        damage: damageFx?.damage,
      });

      if (damageFx) {
        pushLog({
          type: 'ally_action',
          actor: actor.id,
          target: this.enemy.id,
          damage: damageFx.damage,
          enemyHp,
          detail: `${char.name} 使用 ${skill.name}`,
        });
      } else if (skill.type === 'support') {
        pushLog({
          type: 'ally_support',
          actor: actor.id,
          detail: `${char.name} 使用 ${skill.name}`,
        });
      }
    };

    while (turns < maxTurn && enemyHp > 0) {
      while (ultQueue.length > 0 && enemyHp > 0) {
        const ultId = ultQueue.shift()!;
        const actor = this.team.getMember(ultId);
        if (!actor || actor.energy < c.ult_energy_max) continue;

        const step: RotationStep = { actorId: actor.id, skillId: 'ult' };
        runAllyTurn(actor, step, 'insert');

        const char = getCharacter(actor.build.characterId);
        pushLog({
          type: 'ult_insert',
          actor: actor.id,
          target: this.enemy.id,
          enemyHp,
          detail: `${char.name} 插入终结技`,
        });
      }

      if (enemyHp <= 0) break;

      const actorUnit = timeline.next(units);
      timeline.advanceTo(units, actorUnit);
      turns++;

      const participant = findParticipant(participants, actorUnit.id);
      if (!participant) continue;

      if (participant.side === 'ally') {
        const actor = participant as Character;
        const step: RotationStep = rotation[rotIdx] ?? {
          actorId: actor.id,
          skillId: actor.build.skillId ?? 'skill',
        };
        rotIdx++;

        runAllyTurn(actor, step);
      } else {
        const ctx: ActionContext = {
          constants: c,
          team: this.team,
          enemy: this.enemy,
          globalAV: timeline.globalAV,
          roundIndex: timeline.roundIndex,
          enemyBroken,
          actor: fallbackActor,
          evaluateOnly: false,
        };

        const result = this.enemy.action(ctx);
        if (result.noop) {
          for (const member of this.team.members) {
            member.tickBuffs();
          }
          turns--;
          continue;
        }

        applyActionEffects(result.effects, effectCtx);

        for (const event of result.events) {
          if (event.type === 'enemy_action') {
            pushLog({
              type: 'enemy_action',
              actor: this.enemy.id,
              detail: `敌人 ${event.payload.action}`,
            });
          }
        }
      }

      for (const member of this.team.members) {
        member.tickBuffs();
      }
    }

    const lastAV = events.length > 0 ? events[events.length - 1]!.globalAV : 1;
    const dpr = (totalDamage / lastAV) * 100;

    return {
      log: logEntries,
      events,
      totalDamage,
      dpr,
      actionCounts,
      victory: enemyHp <= 0,
      turnsElapsed: turns,
    };
  }
}

export function runBattle(request: BattleRequest): BattleResult {
  validateBattleRequest(request);
  const battle = new Battle(request.team.members, request.enemyId);
  return battle.run({
    maxTurn: request.maxTurn,
    rotation: request.team.rotation,
    enemyBroken: request.enemyBroken,
  });
}
