import type { ActionContext, ActionResult } from '../types.js';
import {
  ActionAdvanceEffect,
  BuffEffect,
  SkillPointEffect,
} from '../../effects/index.js';
import { modifierFromDef } from '../buff-container.js';
import type { Character } from '../character.js';
import { DefaultCharacter } from './default.js';

/** 花火：战技对指定队友拉条；buff 逻辑在子类中实现 */
export class Sparkle extends DefaultCharacter {
  skill(ctx: ActionContext): ActionResult {
    if (!this.canUseSkill(ctx)) {
      return {
        actorId: this.id,
        ability: 'skill',
        success: false,
        reason: 'Not enough skill points',
        effects: [],
        events: [],
        continueTurn: false,
      };
    }

    const target = this.resolveSkillTarget(ctx);
    const myStats = this.getStats({ phase: 'in_combat', skillTags: ['skill'] });

    return this.executeAbility('skill', ctx, () => [
      new SkillPointEffect(this.id, this.id, -1),
      new BuffEffect(
        this.id,
        target.id,
        modifierFromDef(
          {
            zones: ['crit_dmg'],
            value: myStats.critDmg * 0.24,
          },
          this.id,
          2,
        ),
      ),
      new ActionAdvanceEffect(this.id, target.id, 0.5),
    ]);
  }

  /** rotation 未指定 target 时，默认选第一个非自身队友 */
  private resolveSkillTarget(ctx: ActionContext): Character {
    if (ctx.targetIds?.[0]) {
      return this.requireAlly(ctx);
    }
    const other = this.team.getAllies().find((a) => a.id !== this.id);
    if (!other) {
      throw new Error('Sparkle skill requires another ally');
    }
    return other;
  }
}
