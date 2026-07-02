import type { CharacterBuild, Element, ModifierDef } from '../../types.js';
import {
  getLightCone,
  getRelicSet,
  resolveLightConeId,
  resolveRelicSetId,
} from '../../data-loader.js';
import type { ActionEffect } from '../../effects/index.js';
import { collectRelicPieceModifiers } from './relic-piece-stats.js';
import { LightConeSource } from './light-cone-source.js';
import { RelicSetSource, RelicSetState } from './relic-set-source.js';
import type { Character } from '../character.js';
import type { EquipmentSource, EquipContext, EquipPhase } from './types.js';

export class EquipLoadout {
  readonly sources: EquipmentSource[] = [];
  readonly pieceStatModifiers: ModifierDef[];

  private readonly lightCone?: LightConeSource;

  constructor(
    build: CharacterBuild,
    ownerElement: Element,
  ) {
    this.pieceStatModifiers = collectRelicPieceModifiers(build);

    if (build.lightConeId) {
      const data = getLightCone(resolveLightConeId(build.lightConeId));
      this.lightCone = new LightConeSource(
        data.id,
        data,
        build.lightConeSuperimposition ?? data.superimposition ?? 1,
      );
      this.sources.push(this.lightCone);
    }

    const setCounts = new Map<string, number>();
    for (const relic of build.relicSets ?? []) {
      const setId = resolveRelicSetId(relic.setId);
      setCounts.set(setId, (setCounts.get(setId) ?? 0) + relic.pieces);
    }

    for (const [setId, pieceCount] of setCounts) {
      const data = getRelicSet(setId);
      this.sources.push(
        new RelicSetSource(
          setId,
          data,
          new RelicSetState(setId, pieceCount),
        ),
      );
    }

    void ownerElement;
  }

  getLightConeWhiteAtk(): number {
    return this.lightCone?.whiteAtk ?? 0;
  }

  getLightConeCritDmg(): number {
    return this.lightCone?.baseCritDmg ?? 0;
  }

  reconcile(ctx: EquipContext): ActionEffect[] {
    const effects: ActionEffect[] = [];
    for (const source of this.sources) {
      effects.push(...source.reconcile(ctx));
    }
    return effects;
  }

  /** attach 阶段：装配时调用一次 */
  attach(owner: Character, element: Element): ActionEffect[] {
    return this.reconcile({
      phase: 'attach',
      owner,
      ownerElement: element,
    });
  }

  reconcilePhase(
    phase: EquipPhase,
    owner: Character,
    element: Element,
    extras: Partial<EquipContext> = {},
  ): ActionEffect[] {
    return this.reconcile({
      phase,
      owner,
      ownerElement: element,
      ...extras,
    });
  }
}

export function createEquipLoadout(
  build: CharacterBuild,
  element: Element,
): EquipLoadout {
  return new EquipLoadout(build, element);
}
