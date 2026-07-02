import { sumDamageFromEffects } from '../../effects/index.js';
import type { ActionResult } from '../types.js';
import { abilityToSkillId } from '../types.js';

/** 从 ActionResult 提取常用触发条件 */
export function summarizeAction(result: ActionResult) {
  const skillId = abilityToSkillId(result.ability);
  const damageTotal = sumDamageFromEffects(result.effects);
  return {
    ability: result.ability,
    skillId,
    success: result.success,
    damageTotal,
    usedSkill: skillId === 'skill',
    usedUlt: skillId === 'ult',
    usedBasic: skillId === 'basic',
    dealtDamage: damageTotal > 0,
  };
}
