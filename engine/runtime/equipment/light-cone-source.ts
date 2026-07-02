import type { LightConeData } from '../../types.js';
import type { ActionEffect } from '../../effects/index.js';
import { permanentBuffEffects } from './buff-from-defs.js';
import type { EquipmentSource, EquipContext } from './types.js';

/** 光锥：白值 + attach 时挂被动 modifier */
export class LightConeSource implements EquipmentSource {
  readonly kind = 'light_cone' as const;
  passiveApplied = false;

  constructor(
    readonly id: string,
    readonly data: LightConeData,
    readonly superimposition: number,
  ) {}

  get whiteAtk(): number {
    return this.data.baseStats.atk ?? 0;
  }

  get baseCritDmg(): number {
    return this.data.baseStats.critDmg ?? 0;
  }

  reconcile(ctx: EquipContext): ActionEffect[] {
    if (ctx.phase !== 'attach') return [];
    if (this.passiveApplied) return [];
    const modifiers = this.data.passive?.modifiers;
    if (!modifiers?.length) return [];

    this.passiveApplied = true;
    return permanentBuffEffects(
      ctx.owner.id,
      `lc-${this.id}-passive`,
      modifiers,
    );
  }
}
