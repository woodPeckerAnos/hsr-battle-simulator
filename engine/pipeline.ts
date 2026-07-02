import { getCharacter } from './data-loader.js';
import { calcDamage } from './damage/calc.js';
import {
  evaluateCharacterDamage,
  evaluateDamageRequest,
  runtimeAggregateStats,
} from './damage/evaluate.js';
import { Battle, runBattle } from './simulation/battle.js';
import type { BattleRequest, CharacterBuild, DamageEvalRequest } from './types.js';

export function aggregateStats(build: CharacterBuild) {
  return runtimeAggregateStats(build);
}

export {
  Battle,
  calcDamage,
  evaluateCharacterDamage,
  evaluateDamageRequest,
  getCharacter,
  runBattle,
};
export * from './types.js';
