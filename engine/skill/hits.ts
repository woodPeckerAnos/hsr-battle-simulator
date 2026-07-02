import type { CharacterBuild, SkillDef } from '../types.js';

export type SkillHitRole = 'primary' | 'secondary';

export interface PlannedSkillHit {
  role: SkillHitRole;
  targetId: string;
  multiplier: number;
}

export interface SkillHitPlanOptions {
  enemyId: string;
  targetIds?: string[];
  blastAdjacentCount?: number;
}

/** 根据技能 targetMode 规划各段 hit 的目标与倍率 */
export function planSkillHits(
  skill: SkillDef,
  options: SkillHitPlanOptions,
): PlannedSkillHit[] {
  const primaryId = options.targetIds?.[0] ?? options.enemyId;
  const hits: PlannedSkillHit[] = [
    {
      role: 'primary',
      targetId: primaryId,
      multiplier: skill.multiplier,
    },
  ];

  if (skill.targetMode === 'blast' && skill.spreadMultiplier != null) {
    const adjacent = options.blastAdjacentCount ?? 2;
    for (let i = 0; i < adjacent; i++) {
      hits.push({
        role: 'secondary',
        targetId: `${primaryId}:adj${i}`,
        multiplier: skill.spreadMultiplier,
      });
    }
  }

  return hits;
}

export function defaultBlastAdjacentCount(build: CharacterBuild): number {
  return build.blastAdjacentCount ?? 2;
}

export function sumDamageResults(
  results: Array<{ min: number; expected: number; max: number }>,
): { min: number; expected: number; max: number } {
  return results.reduce(
    (acc, d) => ({
      min: acc.min + d.min,
      expected: acc.expected + d.expected,
      max: acc.max + d.max,
    }),
    { min: 0, expected: 0, max: 0 },
  );
}
