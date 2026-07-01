import type {
  ActiveModifier,
  CharacterBuild,
  CombatStats,
  DamageZone,
  ModifierDef,
} from '../types.js';
import {
  getCharacter,
  getCharacterTraceModifiers,
  getConstants,
  getLightCone,
  getRelicSet,
  resolveLightConeId,
  resolveRelicSetId,
} from '../data-loader.js';

function sumModifiers(
  mods: ModifierDef[],
  zone: DamageZone,
  tags: string[] = [],
): number {
  return mods.reduce((sum, m) => {
    if (!m.zones.includes(zone)) return sum;
    if (m.tagFilter) {
      if (tags.length === 0) return sum;
      if (!m.tagFilter.some((t) => tags.includes(t))) return sum;
    }
    return sum + m.value;
  }, 0);
}

function collectRelicModifiers(build: CharacterBuild): ModifierDef[] {
  const mods: ModifierDef[] = [];
  for (const relic of build.relicSets ?? []) {
    const setId = resolveRelicSetId(relic.setId);
    const set = getRelicSet(setId);
    if (relic.pieces >= 2 && set.pieces2) mods.push(...set.pieces2.modifiers);
    if (relic.pieces >= 4 && set.pieces4) mods.push(...set.pieces4.modifiers);
  }
  return mods;
}

export function aggregateStats(build: CharacterBuild): CombatStats {
  const char = getCharacter(build.characterId);
  const level = build.level ?? char.level;
  const lc = build.lightConeId
    ? getLightCone(resolveLightConeId(build.lightConeId))
    : null;

  const baseAtk = char.baseStats.atk + (lc?.baseStats.atk ?? 0);
  const baseSpeed = char.baseStats.speed;

  const relicMods = collectRelicModifiers(build);
  const lcMods = lc?.passive?.modifiers ?? [];
  const traceMods = getCharacterTraceModifiers(char);
  const allStatic = [...relicMods, ...lcMods, ...traceMods, ...(char.passives ?? [])];
  const overrides = build.statOverrides ?? {};

  const atkPercent =
    sumModifiers(allStatic, 'atk_percent') +
    (lc?.baseStats.atkPercent ?? 0) +
    (overrides.atkPercent ?? 0);
  const flatAtk = sumModifiers(allStatic, 'flat_atk') + (overrides.flatAtk ?? 0);
  const speedPercent =
    sumModifiers(allStatic, 'speed_percent') + (overrides.speedPercent ?? 0);
  const flatSpeed =
    sumModifiers(allStatic, 'flat_speed') +
    (lc?.baseStats.flatSpeed ?? 0) +
    (overrides.flatSpeed ?? 0);

  const c = getConstants();
  const critRate =
    (char.baseStats.critRate ?? c.base_crit_rate) +
    sumModifiers(allStatic, 'crit_rate') +
    (lc?.baseStats.critRate ?? 0) +
    (overrides.critRate ?? 0);
  const critDmg =
    (char.baseStats.critDmg ?? c.base_crit_dmg) +
    sumModifiers(allStatic, 'crit_dmg') +
    (lc?.baseStats.critDmg ?? 0) +
    (overrides.critDmg ?? 0);

  const atk = baseAtk * (1 + atkPercent) + flatAtk;
  const speed = baseSpeed * (1 + speedPercent) + flatSpeed;

  return {
    level,
    element: char.element,
    atk,
    speed,
    baseSpeed,
    critRate: Math.min(critRate, 1),
    critDmg,
    breakEffect:
      sumModifiers(allStatic, 'break_effect') +
      (lc?.baseStats.breakEffect ?? 0) +
      (overrides.breakEffect ?? 0),
    dmgBonus: sumModifiers(allStatic, 'dmg_bonus', [char.element]),
    vuln: sumModifiers(allStatic, 'vuln'),
    defPen: sumModifiers(allStatic, 'def_pen'),
    resPen: sumModifiers(allStatic, 'res_pen'),
  };
}

export function applyDynamicModifiers(
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
