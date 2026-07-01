import { describe, it, expect } from 'vitest';
import { aggregateStats } from '../engine/stat/aggregate.js';
import { runSingleHit } from '../engine/pipeline.js';
import type { BuildRequest } from '../engine/types.js';

describe('L1 stat aggregation', () => {
  it('aggregates character + light cone base atk', () => {
    const stats = aggregateStats({
      characterId: 'jingliu',
      lightConeId: 'before-dawn',
    });
    expect(stats.atk).toBeGreaterThan(698);
    expect(stats.level).toBe(80);
  });
});

describe('Phase 1 pipeline', () => {
  it('single_hit mode returns damage range', () => {
    const request: BuildRequest = {
      mode: 'single_hit',
      enemyId: 'foi-95',
      team: {
        members: [
          {
            characterId: 'jingliu',
            skillId: 'basic',
            statOverrides: { flatAtk: 970 },
          },
        ],
      },
    };
    const result = runSingleHit(request);
    expect(result.min).toBeGreaterThan(0);
    expect(result.expected).toBeGreaterThanOrEqual(result.min);
    expect(result.max).toBeGreaterThanOrEqual(result.expected);
    expect(result.breakdown.length).toBeGreaterThan(0);
  });
});
