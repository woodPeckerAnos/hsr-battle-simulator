import type { DamageResult, Element, SkillTag } from '../types.js';
import type { EffectApplierContext } from './context.js';
import { TargetedEffect } from './base.js';

export class DamageEffect extends TargetedEffect {
  constructor(
    sourceId: string,
    targets: string | string[],
    readonly element: Element,
    readonly tags: SkillTag[],
    readonly damage: DamageResult,
  ) {
    super(sourceId, targets);
  }

  apply(ctx: EffectApplierContext): void {
    for (const _targetId of this.targets) {
      ctx.onEnemyDamage?.(this.damage.expected);
    }
  }
}
