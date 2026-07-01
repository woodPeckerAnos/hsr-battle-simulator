import type { RelicSetData } from '../../types.js';
import { createModifierPlugin } from './plugins/modifier-plugin.js';

export class RelicSetInstance {
  constructor(
    readonly data: RelicSetData,
    readonly equippedPieces: 2 | 4,
  ) {}

  toPlugins(): CombatPlugin[] {
    const plugins: CombatPlugin[] = [];
    if (this.equippedPieces >= 2 && this.data.pieces2?.modifiers.length) {
      plugins.push(
        createModifierPlugin(
          `relic-${this.data.id}-2pc`,
          'relic_set',
          this.data.pieces2.modifiers,
          'neutral',
        ),
      );
    }
    if (this.equippedPieces >= 4 && this.data.pieces4?.modifiers.length) {
      plugins.push(
        createModifierPlugin(
          `relic-${this.data.id}-4pc`,
          'relic_set',
          this.data.pieces4.modifiers,
          'neutral',
        ),
      );
    }
    return plugins;
  }
}
