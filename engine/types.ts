/** Shared types for simulator engine */

export type Element =
  | 'physical'
  | 'fire'
  | 'ice'
  | 'lightning'
  | 'wind'
  | 'quantum'
  | 'imaginary';

export type DamageZone =
  | 'atk_percent'
  | 'flat_atk'
  | 'dmg_bonus'
  | 'vuln'
  | 'def_pen'
  | 'res_pen'
  | 'crit_rate'
  | 'crit_dmg'
  | 'speed_percent'
  | 'flat_speed'
  | 'break_effect';

export type SkillTag = 'basic' | 'skill' | 'ult' | 'dot' | 'follow_up' | 'break';

export type SkillType = 'direct' | 'dot' | 'break' | 'support';

export interface SkillEffect {
  type: 'action_advance' | 'action_delay' | 'speed_buff' | 'modifier';
  target?: 'self' | 'ally' | 'team' | 'enemy';
  value: number;
  duration?: number;
}

export interface SkillDef {
  id: string;
  name: string;
  type: SkillType;
  multiplier: number;
  tags: string[];
  maxStacks?: number;
  hitCount?: number;
  effects?: SkillEffect[];
}

export interface ModifierDef {
  zones: DamageZone[];
  tagFilter?: string[];
  value: number;
}

export interface CharacterData {
  id: string;
  slug?: string;
  gameId?: string;
  name: string;
  element: Element;
  path: string;
  level: number;
  rarity?: number;
  maxSp?: number;
  baseStats: {
    atk: number;
    hp?: number;
    def?: number;
    speed: number;
    critRate?: number;
    critDmg?: number;
  };
  traces?: Record<string, number>;
  tracesRaw?: Record<string, number>;
  traceModifiers?: ModifierDef[];
  skills: Record<string, SkillDef>;
  passives?: ModifierDef[];
  source?: string;
}

export interface LightConeData {
  id: string;
  slug?: string;
  gameId?: string;
  name: string;
  path: string;
  level: number;
  rarity?: number;
  superimposition?: number;
  baseStats: Record<string, number>;
  superimpositions?: Record<string, Record<string, number>>;
  passive?: {
    description: string;
    modifiers: ModifierDef[];
  } | null;
  source?: string;
}

export interface RelicSetData {
  id: string;
  slug?: string;
  gameId?: string;
  name: string;
  description?: string;
  pieces2?: { description: string; modifiers: ModifierDef[] };
  pieces4?: { description: string; modifiers: ModifierDef[] };
  source?: string;
}

export interface EnemyData {
  id: string;
  name: string;
  level: number;
  element?: Element;
  weaknesses?: Element[];
  defense: number;
  hp: number;
  toughness: number;
  speed?: number;
  resistances?: Partial<Record<Element, number>>;
  effectRes?: number;
}

export interface RelicBuild {
  setId: string;
  pieces: 2 | 4;
  mainStats?: Record<string, number>;
  subStats?: Record<string, number>;
}

export interface CharacterBuild {
  characterId: string;
  level?: number;
  lightConeId?: string;
  relicSets?: RelicBuild[];
  /** Flat stat overrides from install.md (percent as decimal, e.g. 0.3 = 30%) */
  statOverrides?: Record<string, number>;
  /** Which skill to evaluate for single-hit damage */
  skillId?: string;
}

export interface TeamBuild {
  members: CharacterBuild[];
  /** Preset action script for Phase 2+ */
  rotation?: RotationStep[];
}

export interface RotationStep {
  actorId: string;
  skillId: string;
  target?: string;
  note?: string;
}

export interface GameConstants {
  level_coefficient_base: number;
  level_coefficient_per_level: number;
  action_distance: number;
  first_cycle_av: number;
  subsequent_cycle_av: number;
  enemy_def_per_level: number;
  enemy_def_base: number;
  toughness_multiplier_unbroken: number;
  toughness_multiplier_broken: number;
  resistance_with_weakness: number;
  resistance_without_weakness: number;
  base_crit_rate: number;
  base_crit_dmg: number;
  default_effect_res: number;
  ult_energy_max: number;
  ult_energy_on_hit_taken: number;
}

export interface CombatStats {
  level: number;
  element: Element;
  atk: number;
  speed: number;
  baseSpeed: number;
  critRate: number;
  critDmg: number;
  breakEffect: number;
  /** Sum within zone before applying to formula */
  dmgBonus: number;
  vuln: number;
  defPen: number;
  resPen: number;
}

export interface ActiveModifier {
  id: string;
  source: string;
  zones: DamageZone[];
  tagFilter?: string[];
  value: number;
  duration?: number;
  stackRule: 'add' | 'max' | 'refresh';
}

export interface ZoneBreakdown {
  zone: string;
  coefficient: number;
}

export interface DamageResult {
  min: number;
  expected: number;
  max: number;
  breakdown: ZoneBreakdown[];
}

export interface ActionEvent {
  unitId: string;
  globalAV: number;
  roundIndex: number;
  actionType: 'normal' | 'skill' | 'ult' | 'passive' | 'insert' | 'enemy';
  skillId?: string;
  damage?: DamageResult;
}

export interface TimelineUnit {
  id: string;
  name: string;
  side: 'ally' | 'enemy';
  baseSpeed: number;
  speed: number;
  distanceRemaining: number;
  speedBuffs: SpeedBuff[];
}

export interface SpeedBuff {
  flatBonus: number;
  percentBonus: number;
  remainingDistance: number;
}

export interface TeamSimResult {
  events: ActionEvent[];
  totalDamage: number;
  dpr: number;
  actionCounts: Record<string, number>;
}

export interface CombatLogEntry {
  timestamp: number;
  type: string;
  actor?: string;
  target?: string;
  detail?: string;
  damage?: DamageResult;
  enemyHp?: number;
}

export interface CombatSimResult {
  log: CombatLogEntry[];
  victory: boolean;
  turnsElapsed: number;
  totalDamageDealt: number;
}

export interface BuildRequest {
  team: TeamBuild;
  enemyId?: string;
  mode: 'single_hit' | 'timeline' | 'combat';
  cycles?: number;
  /** Enemy broken state for damage calc */
  enemyBroken?: boolean;
}
