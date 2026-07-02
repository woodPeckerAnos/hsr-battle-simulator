import type { RelicSetData } from '../../types.js';
import type { ActionEffect } from '../../effects/index.js';
import { permanentBuffEffects } from './buff-from-defs.js';
import type { EquipmentSource, EquipContext } from './types.js';

export class RelicSetState {
  tier2Applied = false;
  tier4Applied = false;

  constructor(
    readonly setId: string,
    readonly pieceCount: number,
  ) {}
}

/** 套装机制：attach 时按件数挂永久 buff；其余时机读 result 扩展 */
export class RelicSetSource implements EquipmentSource {
  readonly kind = 'relic_set' as const;

  constructor(
    readonly id: string,
    readonly data: RelicSetData,
    readonly state: RelicSetState,
  ) {}

  reconcile(ctx: EquipContext): ActionEffect[] {
    if (ctx.phase === 'attach') {
      return this.reconcileAttach(ctx);
    }
    return [];
  }

  private reconcileAttach(ctx: EquipContext): ActionEffect[] {
    const effects: ActionEffect[] = [];

    if (
      this.state.pieceCount >= 2 &&
      !this.state.tier2Applied &&
      this.data.pieces2?.modifiers?.length
    ) {
      effects.push(
        ...permanentBuffEffects(
          ctx.owner.id,
          `relic-${this.id}-2pc`,
          this.data.pieces2.modifiers,
        ),
      );
      this.state.tier2Applied = true;
    }

    if (
      this.state.pieceCount >= 4 &&
      !this.state.tier4Applied &&
      this.data.pieces4?.modifiers?.length
    ) {
      effects.push(
        ...permanentBuffEffects(
          ctx.owner.id,
          `relic-${this.id}-4pc`,
          this.data.pieces4.modifiers,
        ),
      );
      this.state.tier4Applied = true;
    }

    return effects;
  }
}
