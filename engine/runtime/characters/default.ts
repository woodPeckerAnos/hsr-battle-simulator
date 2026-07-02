import type { ActionContext, ActionResult } from '../types.js';
import { Character } from '../character.js';

/** 默认实现：按 catalog SkillDef 释放普攻/战技/终结技 */
export class DefaultCharacter extends Character {
  attack(ctx: ActionContext): ActionResult {
    return this.executeAbility('basic', ctx, (skill) =>
      this.buildDefaultAbilityEffects('basic', skill, ctx),
    );
  }

  skill(ctx: ActionContext): ActionResult {
    return this.executeAbility('skill', ctx, (skill) =>
      this.buildDefaultAbilityEffects('skill', skill, ctx),
    );
  }

  ultra(ctx: ActionContext): ActionResult {
    return this.executeAbility('ult', ctx, (skill) =>
      this.buildDefaultAbilityEffects('ult', skill, ctx),
    );
  }
}
