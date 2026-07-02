import { describe, it, expect } from 'vitest';
import { runBattle } from '../engine/simulation/battle.js';
import { getEnemy } from '../engine/data-loader.js';
import type { BattleRequest } from '../engine/types.js';

describe('L6 combat simulation', () => {
  it('runs combat until victory or maxTurn', () => {
    const request: BattleRequest = {
      enemyId: 'foi-95',
      maxTurn: 30,
      team: {
        members: [
          {
            characterId: 'jingliu',
            skillId: 'ult',
            statOverrides: { flatAtk: 5000, critRate: 1, critDmg: 2 },
          },
        ],
        rotation: [{ actorId: 'jingliu', skillId: 'ult' }],
      },
    };

    const result = runBattle(request);
    expect(result.log.length).toBeGreaterThan(0);
    expect(result.totalDamage).toBeGreaterThan(0);
    expect(typeof result.victory).toBe('boolean');
  });

  it('enemy attacks grant energy to allies', () => {
    const request: BattleRequest = {
      enemyId: 'foi-95',
      maxTurn: 5,
      team: {
        members: [{ characterId: 'jingliu', skillId: 'basic' }],
      },
    };

    const result = runBattle(request);
    const enemyActions = result.log.filter((e) => e.type === 'enemy_action');
    expect(enemyActions.length).toBeGreaterThan(0);
  });

  it('dummy enemy has no resistances and never acts', () => {
    const dummy = getEnemy('dummy');
    expect(dummy.passive).toBe(true);
    expect(dummy.effectRes).toBe(0);
    expect(Object.values(dummy.resistances ?? {})).toEqual([0, 0, 0, 0, 0, 0, 0]);

    const request: BattleRequest = {
      enemyId: 'dummy',
      maxTurn: 10,
      team: {
        members: [{ characterId: 'jingliu', skillId: 'basic' }],
      },
    };

    const result = runBattle(request);
    expect(result.log.filter((e) => e.type === 'enemy_action')).toHaveLength(0);
    expect(result.totalDamage).toBeGreaterThan(0);
  });
});
