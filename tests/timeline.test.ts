import { describe, it, expect } from 'vitest';
import {
  actionAdvance,
  actionValue,
  createUnit,
  effectiveSpeed,
  simulateTimeline,
} from '../engine/timeline/engine.js';
import { getConstants } from '../engine/data-loader.js';

describe('L4 timeline', () => {
  it('action value = 10000 / speed', () => {
    expect(actionValue(134)).toBeCloseTo(74.626, 2);
  });

  it('134 speed achieves 2 actions in first cycle (150 AV)', () => {
    const unit = createUnit('a', 'A', 'ally', 134, 134);
    const ticks = simulateTimeline([unit], { maxAV: 150 });
    expect(ticks.length).toBeGreaterThanOrEqual(2);
  });

  it('拉条 reduces remaining distance capped at remaining', () => {
    const unit = createUnit('a', 'A', 'ally', 100, 100);
    unit.distanceRemaining = 1000;
    const applied = actionAdvance(unit, 0.5);
    expect(applied).toBe(1000);
    expect(unit.distanceRemaining).toBe(0);
  });

  it('speed buff applies to base speed', () => {
    const unit = createUnit('a', 'A', 'ally', 100, 125);
    const { action_distance } = getConstants();
    unit.speedBuffs.push({
      flatBonus: 0,
      percentBonus: 0.2,
      remainingDistance: action_distance,
    });
    expect(effectiveSpeed(unit)).toBe(145);
  });
});
