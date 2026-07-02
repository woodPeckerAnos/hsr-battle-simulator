import { getConstants, levelCoefficient } from '../data-loader.js';
import type {
  ActiveModifier,
  CombatStats,
  DamageResult,
  Element,
  EnemyData,
  SkillDef,
  ZoneBreakdown,
} from '../types.js';
import { applyActiveModifiersToCombatStats } from '../runtime/stat-utils.js';

export interface DamageContext {
  stats: CombatStats;
  skill: SkillDef;
  enemy: EnemyData;
  modifiers?: ActiveModifier[];
  enemyBroken?: boolean;
  /** For dot: stack count */
  stacks?: number;
  /** Attacker element for weakness check */
  element?: Element;
}

function defZone(attackerLevel: number, enemyDef: number, defPen: number): number {
  const effectiveDef = enemyDef * (1 - Math.min(defPen, 1));
  const lvCoef = levelCoefficient(attackerLevel);
  return lvCoef / (effectiveDef + lvCoef);
}

function resZone(
  enemy: EnemyData,
  element: Element,
  resPen: number,
): number {
  const c = getConstants();
  const hasWeakness = enemy.weaknesses?.includes(element) ?? false;
  const baseRes = hasWeakness
    ? c.resistance_with_weakness
    : c.resistance_without_weakness;
  const extraRes = enemy.resistances?.[element] ?? 0;
  const totalRes = baseRes + extraRes - resPen;
  return 1 - totalRes;
}

function toughnessZone(broken: boolean): number {
  const c = getConstants();
  return broken
    ? c.toughness_multiplier_broken
    : c.toughness_multiplier_unbroken;
}

function critZone(critRate: number, critDmg: number, mode: 'min' | 'expected' | 'max'): number {
  switch (mode) {
    case 'min':
      return 1;
    case 'max':
      return 1 + critDmg;
    case 'expected':
      return 1 + critRate * critDmg;
  }
}

function dmgBonusZone(base: number, extra: number): number {
  return 1 + base + extra;
}

function buildBreakdown(
  ctx: DamageContext,
  effective: CombatStats,
  mode: 'min' | 'expected' | 'max',
): ZoneBreakdown[] {
  const element = ctx.element ?? effective.element;
  const defCoef = defZone(effective.level, ctx.enemy.defense, effective.defPen);
  const resCoef = resZone(ctx.enemy, element, effective.resPen);
  const toughCoef = toughnessZone(ctx.enemyBroken ?? false);
  const critCoef = critZone(effective.critRate, effective.critDmg, mode);
  const dmgCoef = dmgBonusZone(effective.dmgBonus, 0);
  const vulnCoef = 1 + effective.vuln;

  return [
    { zone: 'base', coefficient: effective.atk * ctx.skill.multiplier * (ctx.stacks ?? 1) },
    { zone: 'defense', coefficient: defCoef },
    { zone: 'resistance', coefficient: resCoef },
    { zone: 'toughness', coefficient: toughCoef },
    { zone: 'crit', coefficient: critCoef },
    { zone: 'dmg_bonus', coefficient: dmgCoef },
    { zone: 'vuln', coefficient: vulnCoef },
  ];
}

function multiplyBreakdown(breakdown: ZoneBreakdown[]): number {
  const base = breakdown.find((b) => b.zone === 'base')!.coefficient;
  const rest = breakdown
    .filter((b) => b.zone !== 'base')
    .reduce((p, b) => p * b.coefficient, 1);
  return Math.round(base * rest);
}

export function calcDirectDamage(ctx: DamageContext): DamageResult {
  const effective = applyActiveModifiersToCombatStats(
    ctx.stats,
    ctx.modifiers ?? [],
    ctx.skill.tags,
  );

  const minBd = buildBreakdown(ctx, effective, 'min');
  const expBd = buildBreakdown(ctx, effective, 'expected');
  const maxBd = buildBreakdown(ctx, effective, 'max');

  const hitCount = ctx.skill.hitCount ?? 1;
  const single = (bd: ZoneBreakdown[]) => multiplyBreakdown(bd);
  const aggregate = (bd: ZoneBreakdown[]) => single(bd) * hitCount;

  return {
    min: aggregate(minBd),
    expected: aggregate(expBd),
    max: aggregate(maxBd),
    breakdown: expBd,
  };
}

export function calcDotDamage(ctx: DamageContext): DamageResult {
  const effective = applyActiveModifiersToCombatStats(
    ctx.stats,
    ctx.modifiers ?? [],
    ctx.skill.tags,
  );
  const element = ctx.element ?? effective.element;

  const base = effective.atk * ctx.skill.multiplier * (ctx.stacks ?? 1);
  const defCoef = defZone(effective.level, ctx.enemy.defense, effective.defPen);
  const resCoef = resZone(ctx.enemy, element, effective.resPen);
  const toughCoef = toughnessZone(ctx.enemyBroken ?? false);
  const dmgCoef = dmgBonusZone(effective.dmgBonus, 0);
  const vulnCoef = 1 + effective.vuln;

  const breakdown: ZoneBreakdown[] = [
    { zone: 'base', coefficient: base },
    { zone: 'defense', coefficient: defCoef },
    { zone: 'resistance', coefficient: resCoef },
    { zone: 'toughness', coefficient: toughCoef },
    { zone: 'dmg_bonus', coefficient: dmgCoef },
    { zone: 'vuln', coefficient: vulnCoef },
  ];

  const total = multiplyBreakdown(breakdown);
  return { min: total, expected: total, max: total, breakdown };
}

export function calcDamage(ctx: DamageContext): DamageResult {
  if (ctx.skill.type === 'dot') return calcDotDamage(ctx);
  return calcDirectDamage(ctx);
}
