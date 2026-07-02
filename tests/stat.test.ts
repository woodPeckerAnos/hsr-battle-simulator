import { describe, it, expect } from 'vitest';
import { aggregateStats } from '../engine/pipeline.js';
import { evaluateCharacterDamage } from '../engine/damage/evaluate.js';

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

describe('Phase 1 damage evaluation', () => {
  it('evaluateCharacterDamage returns damage range', () => {
    const result = evaluateCharacterDamage(
      {
        characterId: 'jingliu',
        skillId: 'basic',
        statOverrides: { flatAtk: 970 },
      },
      'foi-95',
    );
    expect(result.min).toBeGreaterThan(0);
    expect(result.expected).toBeGreaterThanOrEqual(result.min);
    expect(result.max).toBeGreaterThanOrEqual(result.expected);
    expect(result.breakdown.length).toBeGreaterThan(0);
  });
});
