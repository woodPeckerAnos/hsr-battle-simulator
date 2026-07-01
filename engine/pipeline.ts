import { getCharacter, getEnemy } from './data-loader.js';
import { calcDamage } from './damage/calc.js';
import { simulateCombat } from './combat/simulate.js';
import { aggregateStats as legacyAggregateStats } from './stat/aggregate.js';
import { simulateTeam } from './team/simulate.js';
import {
  Battle,
  runSingleHitViaRuntime,
  runtimeAggregateStats,
} from './simulation/battle.js';
import type { BuildRequest, CharacterBuild, DamageResult } from './types.js';

/** @deprecated use Battle.evaluateSingleHit — kept for compatibility */
export function runSingleHit(request: BuildRequest): DamageResult {
  return runSingleHitViaRuntime(request);
}

export function aggregateStats(build: CharacterBuild) {
  return runtimeAggregateStats(build);
}

export function runPipeline(request: BuildRequest): unknown {
  switch (request.mode) {
    case 'single_hit':
      return runSingleHit(request);
    case 'timeline':
      return simulateTeam(request.team, request.team.rotation ?? [], {
        cycles: request.cycles ?? 2,
        enemy: request.enemyId ? getEnemy(request.enemyId) : undefined,
        enemyBroken: request.enemyBroken,
      });
    case 'combat':
      return simulateCombat(request, { maxTurns: request.cycles ?? 20 });
    default:
      throw new Error(`Unknown mode: ${request.mode}`);
  }
}

export {
  Battle,
  calcDamage,
  getCharacter,
  legacyAggregateStats,
  simulateCombat,
  simulateTeam,
};
export * from './types.js';
