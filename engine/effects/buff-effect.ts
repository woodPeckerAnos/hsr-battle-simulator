import type { ActiveModifier } from '../types.js';
import type { EffectApplierContext } from './context.js';
import { TargetedEffect } from './base.js';

export class BuffEffect extends TargetedEffect {
  constructor(
    sourceId: string,
    targets: string | string[],
    readonly buff: ActiveModifier,
  ) {
    super(sourceId, targets);
  }

  apply(ctx: EffectApplierContext): void {
    for (const targetId of this.targets) {
      ctx.team.getMember(targetId)?.addBuff(this.buff);
    }
  }
}
