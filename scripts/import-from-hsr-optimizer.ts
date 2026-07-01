/**
 * Import game catalog from hsr-optimizer game_data.json
 * Usage: npx tsx scripts/import-from-hsr-optimizer.ts [path/to/game_data.json]
 */
import {
  mkdirSync,
  readFileSync,
  writeFileSync,
  existsSync,
  readdirSync,
} from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, '..', 'data');
const DEFAULT_SOURCE = join(
  process.env.HOME ?? '',
  'Documents/hsr-optimizer-main/src/data/game_data.json',
);

type OptimizerCharacter = {
  id: string;
  name: string;
  rarity: number;
  path: string;
  element: string;
  traces: Record<string, number>;
  stats: Record<string, number>;
  max_sp?: number;
  unreleased?: boolean;
};

type OptimizerLightCone = {
  id: string;
  name: string;
  rarity: number;
  path: string;
  stats: Record<string, number>;
  superimpositions?: Record<string, Record<string, number>>;
  unreleased?: boolean;
};

type OptimizerRelicSet = {
  id: string;
  name: string;
  skills: string;
};

type GameData = {
  characters: Record<string, OptimizerCharacter>;
  lightCones: Record<string, OptimizerLightCone>;
  relics: OptimizerRelicSet[];
};

const ELEMENT_MAP: Record<string, string> = {
  Physical: 'physical',
  Fire: 'fire',
  Ice: 'ice',
  Lightning: 'lightning',
  Wind: 'wind',
  Quantum: 'quantum',
  Imaginary: 'imaginary',
};

const PATH_MAP: Record<string, string> = {
  Destruction: 'destruction',
  Hunt: 'hunt',
  Erudition: 'erudition',
  Harmony: 'harmony',
  Nihility: 'nihility',
  Preservation: 'preservation',
  Abundance: 'abundance',
  Remembrance: 'remembrance',
};

const SUPERIMposition_STAT_MAP: Record<string, string> = {
  CriticalChanceBase: 'critRate',
  CriticalDamageBase: 'critDmg',
  AttackAddedRatio: 'atkPercent',
  DefenceAddedRatio: 'defPercent',
  HPAddedRatio: 'hpPercent',
  SpeedDelta: 'flatSpeed',
  BreakDamageAddedRatioBase: 'breakEffect',
  StatusProbabilityBase: 'effectHitRate',
  StatusResistanceBase: 'effectRes',
};

const DEFAULT_SKILLS = {
  basic: {
    id: 'basic',
    name: '普攻',
    type: 'direct',
    multiplier: 1.0,
    tags: ['basic'],
  },
  skill: {
    id: 'skill',
    name: '战技',
    type: 'direct',
    multiplier: 1.0,
    tags: ['skill'],
  },
  ult: {
    id: 'ult',
    name: '终结技',
    type: 'direct',
    multiplier: 1.0,
    tags: ['ult'],
  },
};

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[•·]/g, '-')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function normalizeTraces(
  traces: Record<string, number>,
  element: string,
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [key, value] of Object.entries(traces)) {
    if (key === 'ATK%') out.atkPercent = (out.atkPercent ?? 0) + value;
    else if (key === 'HP%') out.hpPercent = (out.hpPercent ?? 0) + value;
    else if (key === 'DEF%') out.defPercent = (out.defPercent ?? 0) + value;
    else if (key === 'CRIT Rate') out.critRate = (out.critRate ?? 0) + value;
    else if (key === 'CRIT DMG') out.critDmg = (out.critDmg ?? 0) + value;
    else if (key === 'SPD') out.flatSpeed = (out.flatSpeed ?? 0) + value;
    else if (key === 'Effect Hit Rate')
      out.effectHitRate = (out.effectHitRate ?? 0) + value;
    else if (key === 'Effect RES')
      out.effectRes = (out.effectRes ?? 0) + value;
    else if (key.endsWith(' DMG Boost')) {
      const el = key.replace(' DMG Boost', '').toLowerCase();
      if (el === element.toLowerCase()) {
        out.elementDmgBonus = (out.elementDmgBonus ?? 0) + value;
      }
    }
  }
  return out;
}

function tracesToModifiers(
  traces: Record<string, number>,
  element: string,
): Array<{
  zones: string[];
  value: number;
  tagFilter?: string[];
}> {
  const mods: Array<{ zones: string[]; value: number; tagFilter?: string[] }> =
    [];
  const norm = normalizeTraces(traces, element);
  if (norm.atkPercent)
    mods.push({ zones: ['atk_percent'], value: norm.atkPercent });
  if (norm.critRate) mods.push({ zones: ['crit_rate'], value: norm.critRate });
  if (norm.critDmg) mods.push({ zones: ['crit_dmg'], value: norm.critDmg });
  if (norm.flatSpeed) mods.push({ zones: ['flat_speed'], value: norm.flatSpeed });
  if (norm.elementDmgBonus) {
    mods.push({
      zones: ['dmg_bonus'],
      value: norm.elementDmgBonus,
      tagFilter: [ELEMENT_MAP[element] ?? element.toLowerCase()],
    });
  }
  return mods;
}

function parseSetModifiers(text: string, elementHint?: string) {
  const mods: Array<{ zones: string[]; value: number; tagFilter?: string[] }> =
    [];
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
  const spdMatch = text.match(/Increases SPD by (\d+(?:\.\d+)?)%/i);
  if (spdMatch) {
    mods.push({ zones: ['speed_percent'], value: parseFloat(spdMatch[1]) / 100 });
  }
  const atkMatch = text.match(/Increases ATK by (\d+(?:\.\d+)?)%/i);
  if (atkMatch) {
    mods.push({ zones: ['atk_percent'], value: parseFloat(atkMatch[1]) / 100 });
  }
  const defPenMatch = text.match(/ignores (\d+(?:\.\d+)?)% DEF/i);
  if (defPenMatch) {
    mods.push({ zones: ['def_pen'], value: parseFloat(defPenMatch[1]) / 100 });
  }
  const critRateMatch = text.match(/Increases CRIT Rate by (\d+(?:\.\d+)?)%/i);
  if (critRateMatch) {
    mods.push({
      zones: ['crit_rate'],
      value: parseFloat(critRateMatch[1]) / 100,
    });
  }
  return mods;
}

function splitSetSkills(skills: string): { two: string; four: string } {
  const parts = skills.split(/\.\s+/).filter(Boolean);
  if (parts.length <= 1) {
    return { two: skills, four: skills };
  }
  return {
    two: parts[0].endsWith('.') ? parts[0] : `${parts[0]}.`,
    four: parts.slice(1).join('. '),
  };
}

function loadSkillOverrides(): Record<string, unknown> {
  const path = join(DATA_DIR, 'character_skill_overrides.json');
  if (!existsSync(path)) return {};
  return JSON.parse(readFileSync(path, 'utf-8'));
}

function loadLcPassiveOverrides(): Record<string, unknown> {
  const path = join(DATA_DIR, 'light_cone_passive_overrides.json');
  if (!existsSync(path)) return {};
  return JSON.parse(readFileSync(path, 'utf-8'));
}

function loadExistingSlugs(dir: string): Map<string, string> {
  const map = new Map<string, string>();
  if (!existsSync(dir)) return map;
  for (const file of readdirSync(dir)) {
    if (!file.endsWith('.json')) continue;
    try {
      const data = JSON.parse(readFileSync(join(dir, file), 'utf-8'));
      if (data.slug && data.id) map.set(data.slug, data.id);
    } catch {
      /* skip */
    }
  }
  return map;
}

function importAll(sourcePath: string) {
  const raw = readFileSync(sourcePath, 'utf-8');
  const gameData = JSON.parse(raw) as GameData;

  const charDir = join(DATA_DIR, 'characters');
  const lcDir = join(DATA_DIR, 'light_cones');
  const setDir = join(DATA_DIR, 'relic_sets');
  mkdirSync(charDir, { recursive: true });
  mkdirSync(lcDir, { recursive: true });
  mkdirSync(setDir, { recursive: true });

  const skillOverrides = loadSkillOverrides() as Record<
    string,
    { skills?: unknown; passives?: unknown }
  >;
  const lcPassiveOverrides = loadLcPassiveOverrides() as Record<
    string,
    { passive?: unknown }
  >;

  const catalog = {
    source: 'hsr-optimizer game_data.json',
    importedAt: new Date().toISOString(),
    characters: [] as Array<{ id: string; slug: string; name: string }>,
    lightCones: [] as Array<{ id: string; slug: string; name: string }>,
    relicSets: [] as Array<{ id: string; slug: string; name: string }>,
    aliases: {
      characters: {} as Record<string, string>,
      lightCones: {} as Record<string, string>,
      relicSets: {} as Record<string, string>,
    },
  };

  for (const char of Object.values(gameData.characters)) {
    if (char.unreleased) continue;
    if (char.id.endsWith('b1')) continue; // skip beta variant duplicates

    const slug = slugify(char.name);
    const element = ELEMENT_MAP[char.element] ?? char.element.toLowerCase();
    const path = PATH_MAP[char.path] ?? char.path.toLowerCase();
    const traceMods = tracesToModifiers(char.traces, char.element);
    const override = skillOverrides[char.id] ?? skillOverrides[slug];

    const record = {
      $schema: '../schemas/character.schema.json',
      id: char.id,
      slug,
      gameId: char.id,
      name: char.name,
      rarity: char.rarity,
      element,
      path,
      level: 80,
      maxSp: char.max_sp,
      baseStats: {
        atk: Math.round(char.stats.ATK * 100) / 100,
        hp: Math.round(char.stats.HP * 100) / 100,
        def: Math.round(char.stats.DEF * 100) / 100,
        speed: char.stats.SPD,
        critRate: char.stats['CRIT Rate'],
        critDmg: char.stats['CRIT DMG'],
      },
      traces: normalizeTraces(char.traces, char.element),
      tracesRaw: char.traces,
      traceModifiers: traceMods,
      skills: override?.skills ?? DEFAULT_SKILLS,
      passives: override?.passives ?? traceMods,
      source: 'hsr-optimizer',
    };

    writeFileSync(join(charDir, `${char.id}.json`), JSON.stringify(record, null, 2));
    catalog.characters.push({ id: char.id, slug, name: char.name });
    catalog.aliases.characters[slug] = char.id;
  }

  for (const lc of Object.values(gameData.lightCones)) {
    if (lc.unreleased) continue;

    const slug = slugify(lc.name);
    const path = PATH_MAP[lc.path] ?? lc.path.toLowerCase();
    const s1 = lc.superimpositions?.['1'] ?? {};
    const extraStats: Record<string, number> = {};
    for (const [k, v] of Object.entries(s1)) {
      const mapped = SUPERIMposition_STAT_MAP[k];
      if (mapped) extraStats[mapped] = v;
    }

    const override = lcPassiveOverrides[lc.id] ?? lcPassiveOverrides[slug];

    const record = {
      $schema: '../schemas/light_cone.schema.json',
      id: lc.id,
      slug,
      gameId: lc.id,
      name: lc.name,
      rarity: lc.rarity,
      path,
      level: 80,
      superimposition: 1,
      baseStats: {
        atk: Math.round(lc.stats.ATK * 100) / 100,
        hp: Math.round(lc.stats.HP * 100) / 100,
        def: Math.round(lc.stats.DEF * 100) / 100,
        ...extraStats,
      },
      superimpositions: lc.superimpositions ?? {},
      passive: override?.passive ?? null,
      source: 'hsr-optimizer',
    };

    writeFileSync(join(lcDir, `${lc.id}.json`), JSON.stringify(record, null, 2));
    catalog.lightCones.push({ id: lc.id, slug, name: lc.name });
    catalog.aliases.lightCones[slug] = lc.id;
  }

  for (const set of gameData.relics) {
    const slug = slugify(set.name);
    const { two, four } = splitSetSkills(set.skills);
    const twoMods = parseSetModifiers(two);
    const fourMods = parseSetModifiers(four);

    const record = {
      $schema: '../schemas/relic_set.schema.json',
      id: set.id,
      slug,
      gameId: set.id,
      name: set.name,
      description: set.skills,
      pieces2: {
        description: two,
        modifiers: twoMods,
      },
      pieces4: {
        description: four,
        modifiers: fourMods.length ? fourMods : twoMods,
      },
      source: 'hsr-optimizer',
    };

    writeFileSync(join(setDir, `${set.id}.json`), JSON.stringify(record, null, 2));
    catalog.relicSets.push({ id: set.id, slug, name: set.name });
    catalog.aliases.relicSets[slug] = set.id;
  }

  // Legacy slug aliases used by existing examples/tests
  catalog.aliases.characters.jingliu = '1212';
  catalog.aliases.characters.kafka = '1005';
  catalog.aliases.characters.sparkle = '1306';
  catalog.aliases.lightCones['before-dawn'] = '23010';
  catalog.aliases.relicSets['quantum-set'] = '108';
  catalog.aliases.relicSets.messenger = '114';

  writeFileSync(join(DATA_DIR, 'catalog.json'), JSON.stringify(catalog, null, 2));
  console.log(
    `Imported ${catalog.characters.length} characters, ${catalog.lightCones.length} light cones, ${catalog.relicSets.length} relic sets`,
  );
}

const source = process.argv[2] ?? DEFAULT_SOURCE;
if (!existsSync(source)) {
  console.error(`Source not found: ${source}`);
  process.exit(1);
}
importAll(source);
