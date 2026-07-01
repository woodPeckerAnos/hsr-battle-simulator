import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import YAML from 'yaml';
import type {
  CharacterData,
  EnemyData,
  GameConstants,
  LightConeData,
  ModifierDef,
  RelicSetData,
} from './types.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, '..', 'data');

interface Catalog {
  aliases: {
    characters: Record<string, string>;
    lightCones: Record<string, string>;
    relicSets: Record<string, string>;
  };
  characters: Array<{ id: string; slug: string; name: string }>;
  lightCones: Array<{ id: string; slug: string; name: string }>;
  relicSets: Array<{ id: string; slug: string; name: string }>;
}

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, 'utf-8')) as T;
}

let catalogCache: Catalog | null = null;

function getCatalog(): Catalog {
  if (!catalogCache) {
    catalogCache = readJson<Catalog>(join(DATA_DIR, 'catalog.json'));
  }
  return catalogCache;
}

function resolveId(
  id: string,
  aliases: Record<string, string>,
  bySlug: Map<string, string>,
): string {
  if (aliases[id]) return aliases[id];
  if (bySlug.has(id)) return bySlug.get(id)!;
  return id;
}

function loadDir<T extends { id: string; slug?: string }>(
  subdir: string,
): Map<string, T> {
  const dir = join(DATA_DIR, subdir);
  const map = new Map<string, T>();
  for (const file of readdirSync(dir)) {
    if (!file.endsWith('.json')) continue;
    const data = readJson<T>(join(dir, file));
    map.set(data.id, data);
    if (data.slug) map.set(data.slug, data);
  }
  return map;
}

let constantsCache: GameConstants | null = null;
let charactersCache: Map<string, CharacterData> | null = null;
let lightConesCache: Map<string, LightConeData> | null = null;
let relicSetsCache: Map<string, RelicSetData> | null = null;
let enemiesCache: Map<string, EnemyData> | null = null;

export function getConstants(): GameConstants {
  if (!constantsCache) {
    constantsCache = YAML.parse(
      readFileSync(join(DATA_DIR, 'constants.yaml'), 'utf-8'),
    ) as GameConstants;
  }
  return constantsCache;
}

export function resolveCharacterId(id: string): string {
  const catalog = getCatalog();
  return resolveId(id, catalog.aliases.characters, new Map());
}

export function resolveLightConeId(id: string): string {
  const catalog = getCatalog();
  return resolveId(id, catalog.aliases.lightCones, new Map());
}

export function resolveRelicSetId(id: string): string {
  const catalog = getCatalog();
  return resolveId(id, catalog.aliases.relicSets, new Map());
}

export function getCharacter(id: string): CharacterData {
  if (!charactersCache) charactersCache = loadDir<CharacterData>('characters');
  const resolved = resolveCharacterId(id);
  const c = charactersCache.get(resolved);
  if (!c) throw new Error(`Character not found: ${id}`);
  return c;
}

export function getLightCone(id: string): LightConeData {
  if (!lightConesCache) lightConesCache = loadDir<LightConeData>('light_cones');
  const resolved = resolveLightConeId(id);
  const lc = lightConesCache.get(resolved);
  if (!lc) throw new Error(`Light cone not found: ${id}`);
  return lc;
}

export function getRelicSet(id: string): RelicSetData {
  if (!relicSetsCache) relicSetsCache = loadDir<RelicSetData>('relic_sets');
  const resolved = resolveRelicSetId(id);
  const rs = relicSetsCache.get(resolved);
  if (!rs) throw new Error(`Relic set not found: ${id}`);
  return rs;
}

export function getEnemy(id: string): EnemyData {
  if (!enemiesCache) enemiesCache = loadDir<EnemyData>('enemies');
  const e = enemiesCache.get(id);
  if (!e) throw new Error(`Enemy not found: ${id}`);
  return e;
}

export function listCharacters(): Catalog['characters'] {
  return getCatalog().characters;
}

export function listLightCones(): Catalog['lightCones'] {
  return getCatalog().lightCones;
}

export function listRelicSets(): Catalog['relicSets'] {
  return getCatalog().relicSets;
}

export function getCharacterTraceModifiers(char: CharacterData): ModifierDef[] {
  if (char.traceModifiers?.length) return char.traceModifiers;
  const mods: ModifierDef[] = [];
  const t = char.traces ?? {};
  if (t.atkPercent) mods.push({ zones: ['atk_percent'], value: t.atkPercent });
  if (t.critRate) mods.push({ zones: ['crit_rate'], value: t.critRate });
  if (t.critDmg) mods.push({ zones: ['crit_dmg'], value: t.critDmg });
  if (t.flatSpeed) mods.push({ zones: ['flat_speed'], value: t.flatSpeed });
  if (t.speedPercent)
    mods.push({ zones: ['speed_percent'], value: t.speedPercent });
  return mods;
}

export function levelCoefficient(level: number): number {
  const c = getConstants();
  return c.level_coefficient_base + c.level_coefficient_per_level * level;
}

export function enemyDefense(level: number): number {
  const c = getConstants();
  return c.enemy_def_base + c.enemy_def_per_level * level;
}

/** Clear caches (for tests after re-import) */
export function clearDataCaches(): void {
  catalogCache = null;
  charactersCache = null;
  lightConesCache = null;
  relicSetsCache = null;
  enemiesCache = null;
}
