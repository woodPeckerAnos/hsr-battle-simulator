import type { EffectApplierContext } from './context.js';
import { TargetedEffect } from './base.js';

export class DelayAllAlliesEffect extends TargetedEffect {
  readonly percent: number;

  constructor(
    sourceId: string,
    percent: number,
    targets?: string | string[],
  ) {
    super(sourceId, targets ?? []);
    this.percent = percent;
  }

  apply(ctx: EffectApplierContext): void {
    const allies =
      this.targets.length > 0
        ? this.targets
            .map((id) => ctx.team.getMember(id))
            .filter((m): m is NonNullable<typeof m> => m != null)
        : ctx.team.members;

    for (const ally of allies) {
      ctx.timeline.applyDelay(ally.axis, this.percent);
    }
  }
}
