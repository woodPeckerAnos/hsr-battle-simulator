import type { CharacterBuild, Element, SkillDef } from '../types.js';
import { calcDamage } from '../damage/calc.js';
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

export function resolveHits(
  actor: CharacterRuntimeRef & { element: Element },
  skill: SkillDef,
  ctx: ActionContext,
): HitResult[] {
  const hit: HitRequest = {
    skill,
    tags: skill.tags as HitRequest['tags'],
    multiplier: skill.multiplier,
    stacks: skill.maxStacks ?? 1,
    hitCount: skill.hitCount ?? 1,
  };

  const stats = statBlockToCombatStats(
    actor.getStats({ phase: 'in_combat', skillTags: hit.tags }),
  );
  const combatStats = applyActiveModifiersToCombatStats(
    stats,
    actor.getActiveModifiers(),
    hit.tags,
  );

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

  return [
    {
      targetId: ctx.enemy.id,
      element: actor.element,
      tags: hit.tags,
      damage,
    },
  ];
}
