import type { ActionEffect } from '../effects/index.js';
import type { ActionContext, ActionResult } from './types.js';
import type { Character } from './character.js';

export type TurnPhase = 'main' | 'bonus' | 'insert';

/** Battle 在单个 Timeline 槽位内提供给角色的上下文 */
export interface TurnContext {
  readonly phase: TurnPhase;
  toActionContext(overrides?: Partial<ActionContext>): ActionContext;
  applyEffects(effects: ActionEffect[]): void;
  /** 每次 action 执行并 applyEffects 后回调 */
  onActionComplete?(result: ActionResult): void;
  notifyTurnComplete(actor: Character): void;
}
