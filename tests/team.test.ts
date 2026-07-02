import { describe, it, expect } from 'vitest';
import { runBattle } from '../engine/simulation/battle.js';
import type { BattleRequest } from '../engine/types.js';

describe('L5 team simulation', () => {
  it('simulates team actions and computes DPR', () => {
    const request: BattleRequest = {
      enemyId: 'dummy',
      maxTurn: 40,
      team: {
        members: [
          { characterId: 'sparkle', skillId: 'skill' },
          { characterId: 'jingliu', skillId: 'skill', statOverrides: { flatAtk: 500 } },
        ],
        rotation: [
          { actorId: 'sparkle', skillId: 'skill' },
          { actorId: 'jingliu', skillId: 'skill' },
        ],
      },
    };

    const result = runBattle(request);

    expect(result.events.length).toBeGreaterThan(0);
    expect(result.totalDamage).toBeGreaterThan(0);
    expect(result.dpr).toBeGreaterThan(0);
    expect(Object.keys(result.actionCounts).length).toBeGreaterThan(0);
  });
});
