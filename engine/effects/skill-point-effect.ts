import type { EffectApplierContext } from './context.js';
import { TargetedEffect } from './base.js';

export class SkillPointEffect extends TargetedEffect {
  constructor(
    sourceId: string,
    targets: string | string[],
    readonly delta: number,
  ) {
    super(sourceId, targets);
  }

  apply(ctx: EffectApplierContext): void {
    if (this.delta < 0) {
      ctx.team.consumeSkillPoint(-this.delta);
    } else if (this.delta > 0) {
      ctx.team.gainSkillPoint(this.delta);
    }
  }
}
