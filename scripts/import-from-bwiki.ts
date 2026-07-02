/**
 * Import L0 catalog from bwiki-scraper output into battle-simulator/data/
 *
 * Usage:
 *   npm run import:bwiki
 *   npm run import:bwiki -- /path/to/bwiki-scraper/data
 */
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { enrichEidolons } from '../engine/skill/scaling.js';
import {
  applySkillOverrides,
  FALLBACK_SKILLS,
  parseEidolonsFromWiki,
  parseSkillsFromWiki,
  parsePercent,
  scalingToSkillDef,
} from './import/character-import.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, '..', 'data');
const DEFAULT_SOURCE = join(__dirname, '..', '..', 'bwiki-scraper', 'data');

const ELEMENT_MAP: Record<string, string> = {
  物理: 'physical',
  火: 'fire',
  冰: 'ice',
  雷: 'lightning',
  风: 'wind',
  量子: 'quantum',
  虚数: 'imaginary',
};

const PATH_MAP: Record<string, string> = {
  毁灭: 'destruction',
  巡猎: 'hunt',
  智识: 'erudition',
  同谐: 'harmony',
  虚无: 'nihility',
  存护: 'preservation',
  丰饶: 'abundance',
  记忆: 'remembrance',
};

/** Backward-compatible aliases used by tests and install.yaml */
const LEGACY_ALIASES = {
  characters: {
    jingliu: '镜流',
    kafka: '卡芙卡',
    sparkle: '花火',
  },
  lightCones: {
    'before-dawn': '拂晓之前',
  },
  relicSets: {
    'quantum-set': '繁星璀璨的天才',
    messenger: '骇域漫游的信使',
  },
};

type WikiMeta = {
  name: string;
  slug: string;
  wiki_title: string;
  page_id?: number;
  rev_id?: number;
  scraped_at?: string;
  source?: string;
};

type ScalingTable = {
  headers?: string[];
  rows?: Array<Record<string, string>>;
};

type WikiCharacter = {
  meta: WikiMeta;
  profile: Record<string, string>;
  base_stats: {
    level_rows?: Array<{
      level?: number;
      hp_before?: number;
      atk_before?: number;
      def_before?: number;
    }>;
    speed?: number;
    max_energy?: number;
  };
  skills?: Array<{ kind?: string; name?: string; scaling_tables?: ScalingTable[] }>;
  eidolons?: Array<{ index: number; name: string; effect: string }>;
};

type WikiLightCone = {
  meta: WikiMeta;
  profile: Record<string, string>;
  passive?: { name?: string; description?: string };
};

type WikiRelicSet = {
  meta: WikiMeta;
  profile: Record<string, string>;
  effects?: { two_piece?: string | null; four_piece?: string | null };
};

type WikiCatalog = {
  scraped_at?: string;
  source?: string;
  characters: Array<{ slug: string; name: string }>;
  light_cones: Array<{ slug: string; name: string }>;
  relic_sets: Array<{ slug: string; name: string }>;
};

function parseNumber(value: unknown): number | null {
  if (value == null || value === '' || value === '-') return null;
  const n = parseFloat(String(value));
  return Number.isFinite(n) ? n : null;
}

function parseElement(raw: string | undefined): string {
  if (!raw) return 'physical';
  for (const [cn, en] of Object.entries(ELEMENT_MAP)) {
    if (raw.includes(cn)) return en;
  }
  return 'physical';
}

function parsePath(raw: string | undefined): string {
  if (!raw) return 'destruction';
  for (const [cn, en] of Object.entries(PATH_MAP)) {
    if (raw.includes(cn)) return en;
  }
  return raw.toLowerCase();
}

function parseRarity(raw: string | undefined, maxAtk: number): number {
  const match = raw?.match(/(\d)\s*星/);
  if (match) return parseInt(match[1], 10);
  return maxAtk >= 500 ? 5 : 4;
}

function tracesToModifiers(
  traces: Record<string, number>,
  element: string,
): Array<{ zones: string[]; value: number; tagFilter?: string[] }> {
  const mods: Array<{ zones: string[]; value: number; tagFilter?: string[] }> =
    [];
  if (traces.atkPercent)
    mods.push({ zones: ['atk_percent'], value: traces.atkPercent });
  if (traces.hpPercent)
    mods.push({ zones: ['hp_percent'], value: traces.hpPercent });
  if (traces.critRate) mods.push({ zones: ['crit_rate'], value: traces.critRate });
  if (traces.critDmg) mods.push({ zones: ['crit_dmg'], value: traces.critDmg });
  if (traces.flatSpeed) mods.push({ zones: ['flat_speed'], value: traces.flatSpeed });
  if (traces.elementDmgBonus) {
    mods.push({
      zones: ['dmg_bonus'],
      value: traces.elementDmgBonus,
      tagFilter: [element],
    });
  }
  return mods;
}

function parseTraceStats(
  skills: WikiCharacter['skills'],
): Record<string, number> {
  const traces: Record<string, number> = {};
  for (const skill of skills ?? []) {
    for (const table of skill.scaling_tables ?? []) {
      if (!table.headers?.includes('行迹属性加成')) continue;
      for (const row of table.rows ?? []) {
        const label = row['等级'] ?? '';
        const bonus = parsePercent(row['行迹属性加成']);
        const hpBonus = parsePercent(row['col_2']);
        const flatSpeed = parseNumber(row['col_1']);

        if (label.includes('暴击伤害') && bonus != null) traces.critDmg = bonus;
        if (label.includes('暴击率') && bonus != null) traces.critRate = bonus;
        if (label.includes('攻击力') && bonus != null) traces.atkPercent = bonus;
        if (label.includes('生命') && bonus != null) traces.hpPercent = bonus;
        if (hpBonus != null && !traces.hpPercent) traces.hpPercent = hpBonus;
        if (flatSpeed != null && flatSpeed <= 30) traces.flatSpeed = flatSpeed;
      }
    }
  }
  return traces;
}

function parseSetModifiers(text: string, elementHint?: string) {
  const mods: Array<{ zones: string[]; value: number; tagFilter?: string[] }> =
    [];
  if (!text) return mods;

  for (const [cn, en] of Object.entries(ELEMENT_MAP)) {
    const re = new RegExp(`${cn}属性伤害提高(\\d+(?:\\.\\d+)?)%`);
    const match = text.match(re);
    if (match) {
      mods.push({
        zones: ['dmg_bonus'],
        value: parseFloat(match[1]) / 100,
        tagFilter: [en],
      });
    }
  }

  const atkMatch = text.match(/攻击力提高(\d+(?:\.\d+)?)%/);
  if (atkMatch) {
    mods.push({ zones: ['atk_percent'], value: parseFloat(atkMatch[1]) / 100 });
  }

  const spdMatch = text.match(/速度提高(\d+(?:\.\d+)?)%/);
  if (spdMatch) {
    mods.push({ zones: ['speed_percent'], value: parseFloat(spdMatch[1]) / 100 });
  }

  const critRateMatch = text.match(/暴击率提高(\d+(?:\.\d+)?)%/);
  if (critRateMatch) {
    mods.push({
      zones: ['crit_rate'],
      value: parseFloat(critRateMatch[1]) / 100,
    });
  }

  const critDmgMatch = text.match(/暴击伤害提高(\d+(?:\.\d+)?)%/);
  if (critDmgMatch) {
    mods.push({
      zones: ['crit_dmg'],
      value: parseFloat(critDmgMatch[1]) / 100,
    });
  }

  const defPenMatch = text.match(/无视(?:其)?(\d+(?:\.\d+)?)%的?防御力/);
  if (defPenMatch) {
    mods.push({ zones: ['def_pen'], value: parseFloat(defPenMatch[1]) / 100 });
  }

  // English fallback for mixed descriptions
  if (elementHint) {
    const dmgMatch = text.match(
      /Increases (Physical|Fire|Ice|Lightning|Wind|Quantum|Imaginary) DMG by (\d+(?:\.\d+)?)%/i,
    );
    if (dmgMatch) {
      mods.push({
        zones: ['dmg_bonus'],
        value: parseFloat(dmgMatch[2]) / 100,
        tagFilter: [ELEMENT_MAP[dmgMatch[1]] ?? dmgMatch[1].toLowerCase()],
      });
    }
  }

  return mods;
}

function parseLcCritDmg(description: string | undefined): number | undefined {
  if (!description) return undefined;
  const match = description.match(/暴击伤害提高(\d+(?:\.\d+)?)%/);
  return match ? parseFloat(match[1]) / 100 : undefined;
}

function loadOverrides<T>(filename: string): Record<string, T> {
  const path = join(DATA_DIR, filename);
  if (!existsSync(path)) return {};
  return JSON.parse(readFileSync(path, 'utf-8')) as Record<string, T>;
}

function clearJsonDir(dir: string) {
  if (!existsSync(dir)) return;
  for (const file of readdirSync(dir)) {
    if (file.endsWith('.json')) unlinkSync(join(dir, file));
  }
}

function readWikiJson<T>(sourceDir: string, subdir: string, slug: string): T {
  return JSON.parse(
    readFileSync(join(sourceDir, subdir, `${slug}.json`), 'utf-8'),
  ) as T;
}

function importCharacter(
  sourceDir: string,
  entry: { slug: string; name: string },
  skillOverrides: Record<string, { skills?: unknown; passives?: unknown }>,
) {
  const wiki = readWikiJson<WikiCharacter>(sourceDir, 'characters', entry.slug);
  const id = wiki.meta.slug;
  const element = parseElement(wiki.profile['战斗属性']);
  const path = parsePath(wiki.profile['命途']);
  const level80 = wiki.base_stats.level_rows?.find((r) => r.level === 80);
  const atk = level80?.atk_before ?? 0;
  const hp = level80?.hp_before ?? 0;
  const def = level80?.def_before ?? 0;
  const speed = wiki.base_stats.speed ?? 100;
  const traces = parseTraceStats(wiki.skills);
  const traceModifiers = tracesToModifiers(traces, element);
  const override = skillOverrides[id] ?? skillOverrides[entry.slug];

  const { slots, skillLevelCaps } = parseSkillsFromWiki(wiki.skills);
  const importedSkills = {
    basic: slots.basic
      ? scalingToSkillDef(slots.basic)
      : FALLBACK_SKILLS.basic,
    skill: slots.skill ? scalingToSkillDef(slots.skill) : FALLBACK_SKILLS.skill,
    ult: slots.ult ? scalingToSkillDef(slots.ult) : FALLBACK_SKILLS.ult,
  };
  const skills = applySkillOverrides(importedSkills, override);
  const eidolons = enrichEidolons(parseEidolonsFromWiki(wiki.eidolons));

  return {
    $schema: '../schemas/character.schema.json',
    id,
    slug: id,
    gameId: wiki.meta.page_id != null ? String(wiki.meta.page_id) : id,
    name: wiki.meta.name,
    rarity: parseRarity(wiki.profile['稀有度'], atk),
    element,
    path,
    level: 80,
    maxSp: wiki.base_stats.max_energy,
    baseStats: {
      atk: Math.round(atk * 100) / 100,
      hp: Math.round(hp * 100) / 100,
      def: Math.round(def * 100) / 100,
      speed,
      critRate: 0.05,
      critDmg: 0.5,
    },
    traces,
    traceModifiers,
    skillLevelCaps,
    skills,
    eidolons,
    passives: override?.passives ?? traceModifiers,
    wiki: {
      title: wiki.meta.wiki_title,
      url: wiki.meta.wiki_url,
      revId: wiki.meta.rev_id,
    },
    source: 'bwiki-scraper',
  };
}

function importLightCone(
  sourceDir: string,
  entry: { slug: string; name: string },
  lcPassiveOverrides: Record<string, { passive?: unknown }>,
) {
  const wiki = readWikiJson<WikiLightCone>(sourceDir, 'light_cones', entry.slug);
  const id = wiki.meta.slug;
  const path = parsePath(wiki.profile['命途']);
  const atk = parseNumber(wiki.profile['满级攻击']) ?? 0;
  const hp = parseNumber(wiki.profile['满级生命']) ?? 0;
  const def = parseNumber(wiki.profile['满级防御']) ?? 0;
  const critDmg = parseLcCritDmg(wiki.passive?.description);
  const override = lcPassiveOverrides[id] ?? lcPassiveOverrides[entry.slug];

  const baseStats: Record<string, number> = {
    atk: Math.round(atk * 100) / 100,
    hp: Math.round(hp * 100) / 100,
    def: Math.round(def * 100) / 100,
  };
  if (critDmg != null) baseStats.critDmg = critDmg;

  return {
    $schema: '../schemas/light_cone.schema.json',
    id,
    slug: id,
    gameId: wiki.meta.page_id != null ? String(wiki.meta.page_id) : id,
    name: wiki.meta.name,
    rarity: parseRarity(wiki.profile['稀有度'], atk),
    path,
    level: 80,
    superimposition: 1,
    baseStats,
    passive: override?.passive ?? {
      name: wiki.passive?.name ?? wiki.profile['技能名称'],
      description: wiki.passive?.description ?? wiki.profile['技能效果'],
    },
    wiki: {
      title: wiki.meta.wiki_title,
      url: wiki.meta.wiki_url,
      revId: wiki.meta.rev_id,
    },
    source: 'bwiki-scraper',
  };
}

function importRelicSet(sourceDir: string, entry: { slug: string; name: string }) {
  const wiki = readWikiJson<WikiRelicSet>(sourceDir, 'relic_sets', entry.slug);
  const id = wiki.meta.slug;
  const two =
    wiki.effects?.two_piece ??
    wiki.profile['二件套效果'] ??
    '';
  const four =
    wiki.effects?.four_piece ??
    wiki.profile['四件套效果'] ??
    '';
  const twoMods = parseSetModifiers(two);
  const fourMods = parseSetModifiers(four);

  return {
    $schema: '../schemas/relic_set.schema.json',
    id,
    slug: id,
    gameId: wiki.meta.page_id != null ? String(wiki.meta.page_id) : id,
    name: wiki.meta.name,
    description: [two, four].filter(Boolean).join(' '),
    pieces2: { description: two, modifiers: twoMods },
    pieces4: {
      description: four,
      modifiers: fourMods.length ? fourMods : twoMods,
    },
    wiki: {
      title: wiki.meta.wiki_title,
      url: wiki.meta.wiki_url,
      revId: wiki.meta.rev_id,
    },
    source: 'bwiki-scraper',
  };
}

function safeFilename(slug: string): string {
  return slug.replace(/[/\\?%*:|"<>]/g, '_');
}

function importAll(sourceDir: string) {
  const catalogPath = join(sourceDir, 'catalog.json');
  if (!existsSync(catalogPath)) {
    console.error(`catalog.json not found in ${sourceDir}`);
    process.exit(1);
  }

  const wikiCatalog = JSON.parse(
    readFileSync(catalogPath, 'utf-8'),
  ) as WikiCatalog;

  const charDir = join(DATA_DIR, 'characters');
  const lcDir = join(DATA_DIR, 'light_cones');
  const setDir = join(DATA_DIR, 'relic_sets');
  mkdirSync(charDir, { recursive: true });
  mkdirSync(lcDir, { recursive: true });
  mkdirSync(setDir, { recursive: true });

  clearJsonDir(charDir);
  clearJsonDir(lcDir);
  clearJsonDir(setDir);

  const skillOverrides = loadOverrides<{ skills?: unknown; passives?: unknown }>(
    'character_skill_overrides.json',
  );
  const lcPassiveOverrides = loadOverrides<{ passive?: unknown }>(
    'light_cone_passive_overrides.json',
  );

  const catalog = {
    source: wikiCatalog.source ?? 'bwiki-scraper',
    scrapedAt: wikiCatalog.scraped_at,
    importedAt: new Date().toISOString(),
    importFrom: sourceDir,
    characters: [] as Array<{ id: string; slug: string; name: string }>,
    lightCones: [] as Array<{ id: string; slug: string; name: string }>,
    relicSets: [] as Array<{ id: string; slug: string; name: string }>,
    aliases: {
      characters: { ...LEGACY_ALIASES.characters } as Record<string, string>,
      lightCones: { ...LEGACY_ALIASES.lightCones } as Record<string, string>,
      relicSets: { ...LEGACY_ALIASES.relicSets } as Record<string, string>,
    },
  };

  for (const entry of wikiCatalog.characters) {
    try {
      const record = importCharacter(sourceDir, entry, skillOverrides);
      writeFileSync(
        join(charDir, `${safeFilename(record.id)}.json`),
        JSON.stringify(record, null, 2),
      );
      catalog.characters.push({
        id: record.id,
        slug: record.slug,
        name: record.name,
      });
      catalog.aliases.characters[record.slug] = record.id;
    } catch (err) {
      console.warn(`Skip character ${entry.slug}: ${err}`);
    }
  }

  for (const entry of wikiCatalog.light_cones) {
    try {
      const record = importLightCone(sourceDir, entry, lcPassiveOverrides);
      writeFileSync(
        join(lcDir, `${safeFilename(record.id)}.json`),
        JSON.stringify(record, null, 2),
      );
      catalog.lightCones.push({
        id: record.id,
        slug: record.slug,
        name: record.name,
      });
      catalog.aliases.lightCones[record.slug] = record.id;
    } catch (err) {
      console.warn(`Skip light cone ${entry.slug}: ${err}`);
    }
  }

  for (const entry of wikiCatalog.relic_sets) {
    try {
      const record = importRelicSet(sourceDir, entry);
      writeFileSync(
        join(setDir, `${safeFilename(record.id)}.json`),
        JSON.stringify(record, null, 2),
      );
      catalog.relicSets.push({
        id: record.id,
        slug: record.slug,
        name: record.name,
      });
      catalog.aliases.relicSets[record.slug] = record.id;
    } catch (err) {
      console.warn(`Skip relic set ${entry.slug}: ${err}`);
    }
  }

  writeFileSync(join(DATA_DIR, 'catalog.json'), JSON.stringify(catalog, null, 2));
  console.log(
    `Imported ${catalog.characters.length} characters, ${catalog.lightCones.length} light cones, ${catalog.relicSets.length} relic sets from ${sourceDir}`,
  );
}

const sourceDir = process.argv[2] ?? DEFAULT_SOURCE;
if (!existsSync(sourceDir)) {
  console.error(`Source directory not found: ${sourceDir}`);
  process.exit(1);
}
importAll(sourceDir);
