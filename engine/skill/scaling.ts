import type {
  CharacterBuild,
  CharacterData,
  EidolonDef,
  SkillDef,
} from '../types.js';
import { resolveScalingAtLevel } from './scaling-table.js';

export const DEFAULT_SKILL_CAPS: Record<string, number> = {
  basic: 6,
  skill: 10,
  ult: 10,
  talent: 10,
};

const EIDOLON_SKILL_PATTERNS: Array<{
  pattern: RegExp;
  skillId: string;
}> = [
  { pattern: /普攻等级\+(\d+)/, skillId: 'basic' },
  { pattern: /战技等级\+(\d+)/, skillId: 'skill' },
  { pattern: /终结技等级\+(\d+)/, skillId: 'ult' },
  { pattern: /天赋等级\+(\d+)/, skillId: 'talent' },
];

export function parseEidolonSkillLevelBonus(
  effect: string,
): Partial<Record<string, number>> {
  const bonus: Partial<Record<string, number>> = {};
  for (const { pattern, skillId } of EIDOLON_SKILL_PATTERNS) {
    const match = effect.match(pattern);
    if (match) {
      bonus[skillId] = (bonus[skillId] ?? 0) + parseInt(match[1], 10);
    }
  }
  return bonus;
}

export function enrichEidolons(raw: EidolonDef[]): EidolonDef[] {
  return raw.map((e) => ({
    ...e,
    skillLevelBonus: parseEidolonSkillLevelBonus(e.effect),
  }));
}

export function sumEidolonSkillBonuses(
  eidolons: EidolonDef[] | undefined,
  eidolonLevel: number,
  skillId: string,
): number {
  if (!eidolons?.length || eidolonLevel <= 0) return 0;
  let sum = 0;
  for (const e of eidolons) {
    if (e.index > eidolonLevel) continue;
    sum += e.skillLevelBonus?.[skillId] ?? 0;
  }
  return sum;
}

export function getSkillLevelCap(
  catalog: CharacterData,
  skillId: string,
  eidolonLevel = 0,
): number {
  const baseCap = DEFAULT_SKILL_CAPS[skillId] ?? 10;
  const bonus = sumEidolonSkillBonuses(catalog.eidolons, eidolonLevel, skillId);
  const tableMax = catalog.skills[skillId]?.maxLevel ?? baseCap + bonus;
  return Math.min(baseCap + bonus, tableMax);
}

export function resolveSkillLevel(
  catalog: CharacterData,
  build: CharacterBuild,
  skillId: string,
): number {
  const eidolonLevel = build.eidolonLevel ?? 0;
  const cap = getSkillLevelCap(catalog, skillId, eidolonLevel);
  const requested = build.skillLevels?.[skillId];
  if (requested != null) {
    return Math.min(Math.max(1, requested), cap);
  }
  return cap;
}

/** 根据 build 解析最终用于伤害的技能快照（含主/副倍率） */
export function resolveSkillForBuild(
  catalog: CharacterData,
  build: CharacterBuild,
  skillId: string,
): SkillDef {
  const base = catalog.skills[skillId] ?? catalog.skills['skill'];
  if (!base) {
    throw new Error(`Skill not found: ${skillId}`);
  }
  const level = resolveSkillLevel(catalog, build, skillId);
  const multiplier = resolveScalingAtLevel(base.scaling, level, base.multiplier);
  const spreadMultiplier =
    base.spreadScaling != null
      ? resolveScalingAtLevel(
          base.spreadScaling,
          level,
          base.spreadMultiplier ?? 0,
        )
      : base.spreadMultiplier;

  return {
    ...base,
    multiplier,
    spreadMultiplier,
    level,
    targetMode: base.targetMode ?? (spreadMultiplier != null ? 'blast' : 'single'),
  };
}
