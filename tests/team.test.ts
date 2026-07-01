import { describe, it, expect } from 'vitest';
import { simulateTeam } from '../engine/team/simulate.js';
import { getEnemy } from '../engine/data-loader.js';
import type { TeamBuild } from '../engine/types.js';

describe('L5 team simulation', () => {
  it('simulates team actions and computes DPR', () => {
    const team: TeamBuild = {
      members: [
        { characterId: 'sparkle', skillId: 'skill' },
        { characterId: 'jingliu', skillId: 'skill', statOverrides: { flatAtk: 500 } },
      ],
      rotation: [
        { actorId: 'sparkle', skillId: 'skill' },
        { actorId: 'jingliu', skillId: 'skill' },
      ],
    };

    const result = simulateTeam(team, team.rotation!, {
      cycles: 2,
      enemy: getEnemy('foi-95'),
    });

    expect(result.events.length).toBeGreaterThan(0);
    expect(result.totalDamage).toBeGreaterThan(0);
    expect(result.dpr).toBeGreaterThan(0);
    expect(Object.keys(result.actionCounts).length).toBeGreaterThan(0);
  });
});
