import type { ActionEffect } from '../../effects/index.js';
import type { Element } from '../../types.js';
import type { ActionContext, ActionResult } from '../types.js';
import type { Character } from '../character.js';

/** 装备 reconcile 调用时机 */
export type EquipPhase =
  | 'attach'
  | 'battle_start'
  | 'before_action'
  | 'after_action'
  | 'turn_end';

export interface EquipContext {
  phase: EquipPhase;
  owner: Character;
  /** 与 ActionContext 同构；attach 阶段可为空 */
  battle?: ActionContext;
  action?: ActionContext;
  result?: ActionResult;
  turnResults?: ActionResult[];
  ownerElement: Element;
}

export interface EquipmentSource {
  readonly id: string;
  readonly kind: 'light_cone' | 'relic_set';
  reconcile(ctx: EquipContext): ActionEffect[];
}
