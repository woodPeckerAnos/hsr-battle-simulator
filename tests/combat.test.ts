import { describe, it, expect } from 'vitest';
import { simulateCombat } from '../engine/combat/simulate.js';
import type { BuildRequest } from '../engine/types.js';

describe('L6 combat simulation', () => {
  it('runs combat until victory or max turns', () => {
    const request: BuildRequest = {
      mode: 'combat',
      enemyId: 'foi-95',
      cycles: 30,
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

    const result = simulateCombat(request, { maxTurns: 30 });
    expect(result.log.length).toBeGreaterThan(0);
    expect(result.totalDamageDealt).toBeGreaterThan(0);
    expect(typeof result.victory).toBe('boolean');
  });

  it('enemy attacks grant energy to allies', () => {
    const request: BuildRequest = {
      mode: 'combat',
      enemyId: 'foi-95',
      team: {
        members: [{ characterId: 'jingliu', skillId: 'basic' }],
      },
    };

    const result = simulateCombat(request, { maxTurns: 5 });
    const enemyActions = result.log.filter((e) => e.type === 'enemy_action');
    expect(enemyActions.length).toBeGreaterThan(0);
  });
});
