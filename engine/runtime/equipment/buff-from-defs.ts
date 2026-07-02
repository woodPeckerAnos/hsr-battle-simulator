import { BuffEffect } from '../../effects/index.js';
import { BuffEffect } from '../../effects/buff-effect.js';
import type { ActionEffect } from '../../effects/index.js';
import type { ModifierDef } from '../../types.js';
import { modifierFromDef } from '../buff-container.js';

/** 将 ModifierDef 转为对自身的永久 BuffEffect */
export function permanentBuffEffects(
  ownerId: string,
  source: string,
  defs: ModifierDef[],
): ActionEffect[] {
  return defs.map(
    (def) =>
      new BuffEffect(
        source,
        ownerId,
        modifierFromDef(def, source, undefined),
      ),
  );
}
