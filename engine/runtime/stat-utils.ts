import type { ActiveModifier, CombatStats } from '../types.js';
import type { StatBlock } from './types.js';

export function emptyStatBlock(
  element: StatBlock['element'],
  level = 80,
): StatBlock {
  return {
    level,
    element,
    atk: 0,
    hp: 0,
    def: 0,
    speed: 0,
    baseSpeed: 0,
    critRate: 0.05,
    critDmg: 0.5,
    breakEffect: 0,
    dmgBonus: 0,
    vuln: 0,
    defPen: 0,
    resPen: 0,
  };
}

export function statBlockToCombatStats(block: StatBlock): CombatStats {
  return {
    level: block.level,
    element: block.element,
    atk: block.atk,
    speed: block.speed,
    baseSpeed: block.baseSpeed,
    critRate: block.critRate,
    critDmg: block.critDmg,
    breakEffect: block.breakEffect,
    dmgBonus: block.dmgBonus,
    vuln: block.vuln,
    defPen: block.defPen,
    resPen: block.resPen,
  };
}

export function applyActiveModifiersToCombatStats(
  stats: CombatStats,
  modifiers: ActiveModifier[],
  skillTags: string[] = [],
): CombatStats {
  const clone = { ...stats };
  for (const m of modifiers) {
    if (m.tagFilter && !m.tagFilter.some((t) => skillTags.includes(t))) continue;
    for (const zone of m.zones) {
      switch (zone) {
        case 'dmg_bonus':
          clone.dmgBonus += m.value;
          break;
        case 'vuln':
          clone.vuln += m.value;
          break;
        case 'def_pen':
          clone.defPen += m.value;
          break;
        case 'res_pen':
          clone.resPen += m.value;
          break;
        case 'crit_rate':
          clone.critRate = Math.min(clone.critRate + m.value, 1);
          break;
        case 'crit_dmg':
          clone.critDmg += m.value;
          break;
        case 'atk_percent':
          clone.atk *= 1 + m.value;
          break;
        case 'flat_atk':
          clone.atk += m.value;
          break;
        default:
          break;
      }
    }
  }
  return clone;
}
