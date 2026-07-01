import { getConstants } from '../data-loader.js';
import type { BuildRequest, CharacterBuild, DamageResult } from '../types.js';
import { createTeamFromBuilds } from '../runtime/team-factory.js';
import { EnemyRuntime } from '../runtime/enemy-runtime.js';
import type { ActionContext, ActionResult, BattleContext } from '../runtime/types.js';
import { skillIdToAbility } from '../runtime/types.js';
import type { DefaultCharacterRuntime } from '../runtime/default-character.js';
import type { TeamContext } from '../runtime/team-context.js';

function buildActionContext(
  team: TeamContext,
  enemy: EnemyRuntime,
  actor: DefaultCharacterRuntime,
  options: { evaluateOnly: boolean; enemyBroken: boolean },
): ActionContext {
  const constants = getConstants();
  const battleCtx: BattleContext = {
    constants,
    team,
    enemy,
    globalAV: 0,
    roundIndex: 0,
    enemyBroken: options.enemyBroken,
  };
  return {
    ...battleCtx,
    actor,
    evaluateOnly: options.evaluateOnly,
  };
}

export class Battle {
  readonly team: TeamContext;
  readonly enemy: EnemyRuntime;

  constructor(builds: CharacterBuild[], enemyId: string) {
    this.team = createTeamFromBuilds(builds);
    this.enemy = EnemyRuntime.fromCatalog(enemyId);
  }

  static fromRequest(request: BuildRequest): Battle {
    const enemyId = request.enemyId ?? 'foi-95';
    return new Battle(request.team.members, enemyId);
  }

  evaluateSingleHit(request: BuildRequest): ActionResult {
    const member = request.team.members[0];
    if (!member) throw new Error('Team requires at least one member');

    const actor = this.team.members[0];
    if (!actor) throw new Error('No actor in team');

    const ability = skillIdToAbility(member.skillId ?? 'skill');
    const ctx = buildActionContext(this.team, this.enemy, actor, {
      evaluateOnly: true,
      enemyBroken: request.enemyBroken ?? false,
    });

    return actor.useAbility(ability, ctx);
  }
}

export function runSingleHitViaRuntime(request: BuildRequest): DamageResult {
  const battle = Battle.fromRequest(request);
  const result = battle.evaluateSingleHit(request);
  if (!result.success || result.hits.length === 0) {
    throw new Error(result.reason ?? 'No damage resolved');
  }
  return result.hits[0].damage;
}

import { statBlockToCombatStats } from '../runtime/stat-utils.js';

export function runtimeAggregateStats(build: CharacterBuild) {
  const team = createTeamFromBuilds([build]);
  const actor = team.members[0];
  if (!actor) throw new Error('Failed to create character runtime');
  return statBlockToCombatStats(actor.getStats());
}
