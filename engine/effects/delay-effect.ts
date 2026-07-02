import type { EffectApplierContext } from './context.js';
import { TargetedEffect } from './base.js';

export class ActionDelayEffect extends TargetedEffect {
  constructor(
    sourceId: string,
    targets: string | string[],
    readonly percent: number,
  ) {
    super(sourceId, targets);
  }

  apply(ctx: EffectApplierContext): void {
    for (const targetId of this.targets) {
      const unit = ctx.participants.find((p) => p.id === targetId)?.axis;
      if (unit) ctx.timeline.applyDelay(unit, this.percent);
    }
  }
}
