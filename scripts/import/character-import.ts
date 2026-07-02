/**
 * 从 bwiki-scraper 角色 JSON 解析技能倍率表、星魂与 L0 技能定义
 */

import type { SkillTargetMode } from '../../engine/types.js';

export type WikiScalingTable = {
  headers?: string[];
  rows?: Array<Record<string, string>>;
};

export type WikiSkillBlock = {
  kind?: string;
  name?: string;
  scaling_tables?: WikiScalingTable[];
};

export type WikiEidolon = {
  index: number;
  name: string;
  effect: string;
};

export type ImportedSkillScaling = {
  row: string;
  levels: Record<number, number>;
  maxLevel: number;
};

export type ImportedSkillSlot = {
  id: string;
  name: string;
  type: 'direct' | 'dot' | 'break' | 'support';
  tags: string[];
  targetMode: SkillTargetMode;
  scaling: ImportedSkillScaling;
  spreadScaling?: ImportedSkillScaling;
};

const BASIC_ROWS = ['普攻伤害', '普攻'];
const PRIMARY_ROWS = [
  '普攻伤害',
  '普攻',
  '单体伤害',
  '技能伤害',
  '战技伤害',
  '群攻伤害',
  '全体伤害',
];
const SPREAD_HINTS = ['扩散伤害', '扩散-扩散伤害', '强化-扩散伤害'];

export function parsePercent(value: unknown): number | null {
  if (value == null || value === '' || value === '-') return null;
  const text = String(value).trim();
  const match = text.match(/(\d+(?:\.\d+)?)\s*%/);
  if (!match) return null;
  return parseFloat(match[1]) / 100;
}

function lvColumns(headers: string[] | undefined): string[] {
  return (headers ?? []).filter((h) => /^LV\d+$/i.test(h.trim()));
}

function parseRowScaling(
  row: Record<string, string>,
  headers: string[],
): ImportedSkillScaling | null {
  const label = row['等级']?.trim();
  if (!label) return null;

  const levels: Record<number, number> = {};
  for (const col of lvColumns(headers)) {
    const lv = parseInt(col.replace(/^LV/i, ''), 10);
    const val = parsePercent(row[col]);
    if (val != null) levels[lv] = val;
  }

  const numericLevels = Object.keys(levels).map(Number);
  if (!numericLevels.length) return null;

  return {
    row: label,
    levels,
    maxLevel: Math.max(...numericLevels),
  };
}

function isTalentOrTraceTable(
  rows: Array<Record<string, string>>,
  headers: string[] | undefined,
): boolean {
  if (headers?.some((h) => h.includes('行迹属性加成'))) return true;
  const labels = rows.map((r) => r['等级'] ?? '');
  if (
    labels.some((l) => l.includes('暴击率提高')) &&
    labels.some((l) => l.includes('攻击'))
  ) {
    return true;
  }
  return false;
}

function pickDamageRow(
  rows: Array<Record<string, string>>,
  headers: string[],
  prefer: string[],
): ImportedSkillScaling | null {
  for (const pref of prefer) {
    const row = rows.find((r) => (r['等级'] ?? '').includes(pref));
    if (!row) continue;
    const scaling = parseRowScaling(row, headers);
    if (scaling) return scaling;
  }
  for (const row of rows) {
    const label = row['等级'] ?? '';
    if (
      label.includes('持续伤害') ||
      label.includes('原伤害比例') ||
      label.includes('暴击') ||
      label.includes('攻击') ||
      label.includes('附加伤害')
    ) {
      continue;
    }
    const scaling = parseRowScaling(row, headers);
    if (scaling) return scaling;
  }
  return null;
}

function pickSpreadRow(
  rows: Array<Record<string, string>>,
  headers: string[],
): ImportedSkillScaling | null {
  for (const row of rows) {
    const label = row['等级'] ?? '';
    if (!label.includes('扩散')) continue;
    if (label.includes('持续')) continue;
    if (!SPREAD_HINTS.some((h) => label.includes(h)) && label !== '扩散伤害') {
      continue;
    }
    const scaling = parseRowScaling(row, headers);
    if (scaling) return scaling;
  }
  for (const row of rows) {
    const label = row['等级'] ?? '';
    if (!label.includes('扩散') || label.includes('持续')) continue;
    const scaling = parseRowScaling(row, headers);
    if (scaling) return scaling;
  }
  return null;
}

type ParsedDamageTable = {
  primary: ImportedSkillScaling;
  spread: ImportedSkillScaling | null;
  targetMode: SkillTargetMode;
};

function parseDamageTable(
  rows: Array<Record<string, string>>,
  headers: string[] | undefined,
): ParsedDamageTable | null {
  if (isTalentOrTraceTable(rows, headers ?? [])) return null;

  const primary = pickDamageRow(rows, headers ?? [], PRIMARY_ROWS);
  if (!primary) return null;

  const spread = pickSpreadRow(rows, headers ?? []);
  let targetMode: SkillTargetMode = 'single';
  if (primary.row.includes('群攻') || primary.row.includes('全体')) {
    targetMode = 'aoe';
  } else if (spread) {
    targetMode = 'blast';
  }

  return { primary, spread, targetMode };
}

function tableToSlot(
  id: string,
  name: string,
  tags: string[],
  table: ParsedDamageTable,
): ImportedSkillSlot {
  const maxLevel = Math.max(
    table.primary.maxLevel,
    table.spread?.maxLevel ?? 0,
  );
  return {
    id,
    name,
    type: 'direct',
    tags,
    targetMode: table.targetMode,
    scaling: { ...table.primary, maxLevel },
    spreadScaling: table.spread ?? undefined,
  };
}

export function parseSkillsFromWiki(
  skills: WikiSkillBlock[] | undefined,
): {
  slots: Record<string, ImportedSkillSlot>;
  skillLevelCaps: Record<string, number>;
} {
  const parsedTables: ParsedDamageTable[] = [];

  for (const block of skills ?? []) {
    for (const table of block.scaling_tables ?? []) {
      const parsed = parseDamageTable(table.rows ?? [], table.headers);
      if (parsed) parsedTables.push(parsed);
    }
  }

  const basicIdx = parsedTables.findIndex((t) =>
    BASIC_ROWS.some((b) => t.primary.row.includes(b)),
  );
  const basicTable = basicIdx >= 0 ? parsedTables[basicIdx] : null;
  const rest =
    basicIdx >= 0
      ? parsedTables.filter((_, i) => i !== basicIdx)
      : parsedTables;
  const skillTable = rest[0] ?? null;
  const ultTable = rest[1] ?? null;

  const slots: Record<string, ImportedSkillSlot> = {};
  const skillLevelCaps: Record<string, number> = {
    basic: 6,
    skill: 10,
    ult: 10,
    talent: 10,
  };

  if (basicTable) {
    slots.basic = tableToSlot('basic', '普攻', ['basic'], basicTable);
    skillLevelCaps.basic = basicTable.primary.maxLevel;
  }
  if (skillTable) {
    slots.skill = tableToSlot('skill', '战技', ['skill'], skillTable);
    skillLevelCaps.skill = Math.max(
      skillTable.primary.maxLevel,
      skillTable.spread?.maxLevel ?? 0,
    );
  }
  if (ultTable) {
    slots.ult = tableToSlot('ult', '终结技', ['ult'], ultTable);
    skillLevelCaps.ult = Math.max(
      ultTable.primary.maxLevel,
      ultTable.spread?.maxLevel ?? 0,
    );
  }

  return { slots, skillLevelCaps };
}

export function scalingToSkillDef(slot: ImportedSkillSlot): {
  id: string;
  name: string;
  type: ImportedSkillSlot['type'];
  tags: string[];
  targetMode: SkillTargetMode;
  multiplier: number;
  spreadMultiplier?: number;
  level: number;
  maxLevel: number;
  scaling: ImportedSkillScaling;
  spreadScaling?: ImportedSkillScaling;
} {
  const level = slot.scaling.maxLevel;
  const multiplier =
    slot.scaling.levels[level] ??
    slot.scaling.levels[
      Math.max(...Object.keys(slot.scaling.levels).map(Number))
    ] ??
    1;

  let spreadMultiplier: number | undefined;
  if (slot.spreadScaling) {
    const spreadLevel = slot.spreadScaling.maxLevel;
    spreadMultiplier =
      slot.spreadScaling.levels[spreadLevel] ??
      slot.spreadScaling.levels[
        Math.max(...Object.keys(slot.spreadScaling.levels).map(Number))
      ];
  }

  return {
    id: slot.id,
    name: slot.name,
    type: slot.type,
    tags: slot.tags,
    targetMode: slot.targetMode,
    multiplier,
    spreadMultiplier,
    level,
    maxLevel: slot.scaling.maxLevel,
    scaling: {
      row: slot.scaling.row,
      levels: slot.scaling.levels,
    },
    spreadScaling: slot.spreadScaling
      ? {
          row: slot.spreadScaling.row,
          levels: slot.spreadScaling.levels,
        }
      : undefined,
  };
}

export function parseEidolonsFromWiki(raw: WikiEidolon[] | undefined) {
  return (raw ?? []).map((e) => ({
    index: e.index,
    name: e.name,
    effect: e.effect,
  }));
}

const SEMANTIC_SKILL_PATCH_KEYS = [
  'type',
  'effects',
  'tags',
  'maxStacks',
  'hitCount',
  'name',
  'targetMode',
] as const;

type SkillPatch = Partial<{
  id: string;
  name: string;
  type: ImportedSkillSlot['type'];
  targetMode: SkillTargetMode;
  multiplier: number;
  spreadMultiplier: number;
  level: number;
  maxLevel: number;
  tags: string[];
  scaling: ImportedSkillScaling;
  spreadScaling: ImportedSkillScaling;
  effects: unknown[];
  maxStacks: number;
  hitCount: number;
}>;

/** 合并模拟语义 override（support/dot 等），保留 wiki 导入的倍率表 */
export function applySkillOverrides<
  T extends Record<string, ReturnType<typeof scalingToSkillDef>>,
>(skills: T, override?: { skills?: Record<string, SkillPatch> }): T {
  if (!override?.skills) return skills;

  const out = { ...skills } as T;
  for (const [key, patch] of Object.entries(override.skills)) {
    if (out[key]) {
      const semantic: Record<string, unknown> = {};
      for (const field of SEMANTIC_SKILL_PATCH_KEYS) {
        if (patch[field] !== undefined) semantic[field] = patch[field];
      }
      out[key] = { ...out[key], ...semantic } as T[string];
      continue;
    }

    out[key] = {
      id: patch.id ?? key,
      name: patch.name ?? key,
      type: patch.type ?? 'direct',
      targetMode: patch.targetMode ?? 'single',
      multiplier: patch.multiplier ?? 1,
      spreadMultiplier: patch.spreadMultiplier,
      level: patch.level ?? 1,
      maxLevel: patch.maxLevel ?? patch.level ?? 1,
      tags: patch.tags ?? [],
      scaling: patch.scaling ?? {
        row: patch.name ?? key,
        levels: { [patch.level ?? 1]: patch.multiplier ?? 1 },
      },
      spreadScaling: patch.spreadScaling,
      ...(patch.effects ? { effects: patch.effects } : {}),
      ...(patch.maxStacks != null ? { maxStacks: patch.maxStacks } : {}),
      ...(patch.hitCount != null ? { hitCount: patch.hitCount } : {}),
    } as T[string];
  }
  return out;
}

export const FALLBACK_SKILLS = {
  basic: {
    id: 'basic',
    name: '普攻',
    type: 'direct' as const,
    targetMode: 'single' as const,
    multiplier: 1,
    level: 6,
    maxLevel: 6,
    tags: ['basic'],
    scaling: { row: '普攻伤害', levels: { 6: 1 } },
  },
  skill: {
    id: 'skill',
    name: '战技',
    type: 'direct' as const,
    targetMode: 'single' as const,
    multiplier: 1,
    level: 10,
    maxLevel: 10,
    tags: ['skill'],
    scaling: { row: '单体伤害', levels: { 10: 1 } },
  },
  ult: {
    id: 'ult',
    name: '终结技',
    type: 'direct' as const,
    targetMode: 'single' as const,
    multiplier: 1,
    level: 10,
    maxLevel: 10,
    tags: ['ult'],
    scaling: { row: '单体伤害', levels: { 10: 1 } },
  },
};
