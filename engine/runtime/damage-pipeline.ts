import type { Element, SkillDef } from '../types.js';
import { calcDamage } from '../damage/calc.js';
import { planSkillHits } from '../skill/hits.js';
import {
  applyActiveModifiersToCombatStats,
  statBlockToCombatStats,
} from './stat-utils.js';
import type {
  ActionContext,
  CharacterRuntimeRef,
  HitRequest,
  HitResult,
} from './types.js';

export interface ResolveHitsOptions {
  blastAdjacentCount?: number;
}

export function resolveHits(
  actor: CharacterRuntimeRef & { element: Element },
  skill: SkillDef,
  ctx: ActionContext,
  options: ResolveHitsOptions = {},
): HitResult[] {
  const planned = planSkillHits(skill, {
    enemyId: ctx.enemy.id,
    targetIds: ctx.targetIds,
    blastAdjacentCount: options.blastAdjacentCount,
  });

  const stats = statBlockToCombatStats(
    actor.getStats({ phase: 'in_combat', skillTags: skill.tags }),
  );
  const combatStats = applyActiveModifiersToCombatStats(
    stats,
    actor.getActiveModifiers(),
    skill.tags,
  );

  return planned.map((plannedHit) => {
    const hit: HitRequest = {
      skill,
      tags: skill.tags as HitRequest['tags'],
      multiplier: plannedHit.multiplier,
      stacks: skill.maxStacks ?? 1,
      hitCount: skill.hitCount ?? 1,
    };

    const damage = calcDamage({
      stats: combatStats,
      skill: {
        ...skill,
        multiplier: hit.multiplier,
        hitCount: hit.hitCount,
      },
      enemy: ctx.enemy.data,
      enemyBroken: ctx.enemyBroken,
      stacks: hit.stacks,
    });

    return {
      targetId: plannedHit.targetId,
      element: actor.element,
      tags: hit.tags,
      role: plannedHit.role,
      damage,
    };
  });
}
