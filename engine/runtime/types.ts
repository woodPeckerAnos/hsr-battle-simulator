import type {
  ActiveModifier,
  DamageResult,
  Element,
  EnemyData,
  GameConstants,
  SkillDef,
  SkillTag,
} from '../types.js';

export type AbilityKind =
  | 'basic'
  | 'skill'
  | 'ult'
  | 'talent'
  | 'insert'
  | 'follow_up';

export type PluginKind =
  | 'light_cone'
  | 'relic_set'
  | 'trace'
  | 'talent'
  | 'buff'
  | 'character'
  | 'override';

/** 战斗面板快照 */
export interface StatBlock {
  level: number;
  element: Element;
  atk: number;
  hp: number;
  def: number;
  speed: number;
  baseSpeed: number;
  critRate: number;
  critDmg: number;
  breakEffect: number;
  dmgBonus: number;
  vuln: number;
  defPen: number;
  resPen: number;
}

export interface StatContext {
  phase: 'out_of_combat' | 'in_combat';
  skillTags?: SkillTag[];
}

export interface SimEvent {
  type: string;
  payload: Record<string, unknown>;
}

export interface HitRequest {
  skill: SkillDef;
  tags: SkillTag[];
  multiplier: number;
  stacks?: number;
  hitCount?: number;
}

export interface HitResult {
  targetId: string;
  element: Element;
  tags: SkillTag[];
  damage: DamageResult;
}

export interface ActionResult {
  actorId: string;
  ability: AbilityKind;
  success: boolean;
  reason?: string;
  skillPointDelta?: number;
  energyDelta?: number;
  actionAdvances?: Array<{ targetId: string; percent: number }>;
  hits: HitResult[];
  events: SimEvent[];
  totalDamageExpected: number;
}

export interface CombatPlugin {
  readonly id: string;
  readonly kind: PluginKind;
  onAttach?(owner: CharacterRuntimeRef): void;
  modifyStats?(stats: StatBlock, ctx: StatContext): StatBlock;
  onBeforeAction?(ctx: ActionContext): void;
  onAfterAction?(ctx: ActionContext, result: ActionResult): void;
  modifyHit?(hit: HitRequest, ctx: HitContext): HitRequest;
}

/** 避免 circular import 的轻量引用 */
export interface CharacterRuntimeRef {
  readonly id: string;
  readonly element: Element;
  getStats(ctx?: StatContext): StatBlock;
  getActiveModifiers(): ActiveModifier[];
}

export interface BattleContext {
  constants: GameConstants;
  team: TeamContextRef;
  enemy: EnemyRuntimeRef;
  globalAV: number;
  roundIndex: number;
  enemyBroken: boolean;
}

export interface TeamContextRef {
  readonly skillPoints: number;
  readonly maxSkillPoints: number;
  consumeSkillPoint(n: number): boolean;
  gainSkillPoint(n: number): void;
  getMember(id: string): CharacterRuntimeRef | undefined;
  getAllies(): CharacterRuntimeRef[];
}

export interface EnemyRuntimeRef {
  readonly id: string;
  readonly data: EnemyData;
}

export interface ActionContext extends BattleContext {
  actor: CharacterRuntimeRef;
  evaluateOnly: boolean;
  targetIds?: string[];
}

export interface HitContext extends ActionContext {
  hit: HitRequest;
}

export interface CharacterBehavior {
  extend?(runtime: DefaultCharacterRuntimeLike): void;
}

export interface DefaultCharacterRuntimeLike extends CharacterRuntimeRef {
  useBasic(ctx: ActionContext): ActionResult;
  useSkill(ctx: ActionContext): ActionResult;
  useUlt(ctx: ActionContext): ActionResult;
}

export function skillIdToAbility(skillId: string): AbilityKind {
  if (skillId === 'basic') return 'basic';
  if (skillId === 'ult') return 'ult';
  if (skillId === 'talent') return 'talent';
  return 'skill';
}

export function abilityToSkillId(ability: AbilityKind): string {
  if (ability === 'basic') return 'basic';
  if (ability === 'ult') return 'ult';
  if (ability === 'talent') return 'talent';
  return 'skill';
}
