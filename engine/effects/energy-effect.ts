import { getConstants } from '../data-loader.js';
import type { EffectApplierContext } from './context.js';
import { TargetedEffect } from './base.js';

export class EnergyEffect extends TargetedEffect {
  constructor(
    sourceId: string,
    targets: string | string[],
    readonly delta: number,
  ) {
    super(sourceId, targets);
  }

  apply(ctx: EffectApplierContext): void {
    const max = getConstants().ult_energy_max;
    for (const targetId of this.targets) {
      const target = ctx.team.getMember(targetId);
      if (!target) continue;
      target.energy = Math.min(max, Math.max(0, target.energy + this.delta));
    }
  }
}
