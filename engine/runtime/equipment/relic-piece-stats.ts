import type { CharacterBuild, ModifierDef, RelicBuild } from '../../types.js';

const SUB_STAT_TO_MODIFIER: Record<
  string,
  { zone: ModifierDef['zones'][number]; asFlat?: boolean }
> = {
  atkPercent: { zone: 'atk_percent' },
  flatAtk: { zone: 'flat_atk', asFlat: true },
  hpPercent: { zone: 'hp_percent' },
  defPercent: { zone: 'hp_percent' },
  critRate: { zone: 'crit_rate', asFlat: true },
  critDmg: { zone: 'crit_dmg', asFlat: true },
  speedPercent: { zone: 'speed_percent' },
  flatSpeed: { zone: 'flat_speed', asFlat: true },
  breakEffect: { zone: 'break_effect', asFlat: true },
  effectHit: { zone: 'break_effect', asFlat: true },
};

/** 汇总 build 中遗器主/副词条 → ModifierDef（仅数值，无机制） */
export function collectRelicPieceModifiers(
  build: CharacterBuild,
): ModifierDef[] {
  const mods: ModifierDef[] = [];

  for (const relic of build.relicSets ?? []) {
    appendStatRecord(mods, relic.mainStats);
    appendStatRecord(mods, relic.subStats);
  }

  return mods;
}

function appendStatRecord(
  mods: ModifierDef[],
  record?: Record<string, number>,
): void {
  if (!record) return;
  for (const [key, value] of Object.entries(record)) {
    const mapping = SUB_STAT_TO_MODIFIER[key];
    if (!mapping || value === 0) continue;
    mods.push({
      zones: [mapping.zone],
      value,
    });
  }
}
