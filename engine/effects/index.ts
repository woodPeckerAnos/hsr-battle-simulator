export { ActionEffect, TargetedEffect, normalizeTargets } from './base.js';
export type { EffectApplierContext } from './context.js';
export { DamageEffect } from './damage-effect.js';
export { BuffEffect } from './buff-effect.js';
export { ActionAdvanceEffect } from './advance-effect.js';
export { ActionDelayEffect } from './delay-effect.js';
export { SpeedBuffEffect } from './speed-buff-effect.js';
export { EnergyEffect } from './energy-effect.js';
export { SkillPointEffect } from './skill-point-effect.js';
export { GrantAllyEnergyEffect } from './grant-ally-energy-effect.js';
export { DelayAllAlliesEffect } from './delay-all-allies-effect.js';

import type { EffectApplierContext } from './context.js';
import type { ActionEffect } from './base.js';
import { DamageEffect } from './damage-effect.js';

export function sumDamageFromEffects(effects: ActionEffect[]): number {
  return effects
    .filter((e): e is DamageEffect => e instanceof DamageEffect)
    .reduce((sum, e) => sum + e.damage.expected, 0);
}

export function firstDamageFromEffects(
  effects: ActionEffect[],
): DamageEffect | undefined {
  return effects.find((e): e is DamageEffect => e instanceof DamageEffect);
}

export function applyActionEffects(
  effects: ActionEffect[],
  ctx: EffectApplierContext,
): void {
  for (const effect of effects) {
    effect.apply(ctx);
  }
}
