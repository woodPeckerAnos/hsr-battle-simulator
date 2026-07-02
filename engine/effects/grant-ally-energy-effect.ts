import { getConstants } from '../data-loader.js';
import type { EffectApplierContext } from './context.js';
import { ActionEffect, normalizeTargets } from './base.js';

export class GrantAllyEnergyEffect extends ActionEffect {
  readonly targets: string[];
  readonly amount: number;

  constructor(
    sourceId: string,
    amount: number,
    targets?: string | string[],
  ) {
    super(sourceId);
    this.amount = amount;
    this.targets = targets ? normalizeTargets(targets) : [];
  }

  apply(ctx: EffectApplierContext): void {
    const max = getConstants().ult_energy_max;
    const members =
      this.targets.length > 0
        ? this.targets
            .map((id) => ctx.team.getMember(id))
            .filter((m): m is NonNullable<typeof m> => m != null)
        : ctx.team.members;

    for (const ally of members) {
      ally.energy = Math.min(max, ally.energy + this.amount);
    }
  }
}
