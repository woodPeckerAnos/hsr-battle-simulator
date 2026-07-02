import type { SkillScaling } from '../types.js';

/** 从 scaling 表按技能等级取倍率，无表时回退 fallback */
export function resolveScalingAtLevel(
  scaling: SkillScaling | undefined,
  level: number,
  fallback: number,
): number {
  const levels = scaling?.levels;
  if (!levels || Object.keys(levels).length === 0) {
    return fallback;
  }

  if (levels[level] != null) {
    return levels[level]!;
  }

  const sorted = Object.keys(levels)
    .map((k) => parseInt(k, 10))
    .filter((n) => !Number.isNaN(n))
    .sort((a, b) => a - b);

  if (!sorted.length) return fallback;

  let floor = sorted[0]!;
  for (const lv of sorted) {
    if (lv <= level) floor = lv;
    else break;
  }
  return levels[floor] ?? fallback;
}
