import type { LightConeData } from '../../types.js';
import { createModifierPlugin } from './plugins/modifier-plugin.js';
import type { CombatPlugin } from '../types.js';

export class LightConeInstance {
  constructor(
    readonly data: LightConeData,
    readonly superimposition = 1,
  ) {}

  toPlugins(): CombatPlugin[] {
    const plugins: CombatPlugin[] = [];
    const element = 'physical'; // LC passives rarely element-tagged; neutral context

    if (this.data.passive?.modifiers?.length) {
      plugins.push(
        createModifierPlugin(
          `lc-${this.data.id}-passive`,
          'light_cone',
          this.data.passive.modifiers,
          element,
        ),
      );
    }

    const s1 = this.data.baseStats;
    const extraMods = [];
    if (s1.critRate)
      extraMods.push({ zones: ['crit_rate'] as const, value: s1.critRate });
    if (s1.critDmg)
      extraMods.push({ zones: ['crit_dmg'] as const, value: s1.critDmg });
    if (s1.atkPercent)
      extraMods.push({ zones: ['atk_percent'] as const, value: s1.atkPercent });
    if (extraMods.length) {
      plugins.push(
        createModifierPlugin(
          `lc-${this.data.id}-stats`,
          'light_cone',
          extraMods,
          element,
        ),
      );
    }

    return plugins;
  }

  get baseAtk(): number {
    return this.data.baseStats.atk ?? 0;
  }
}
