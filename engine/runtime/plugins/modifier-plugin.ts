import type { ModifierDef } from '../types.js';
import type { CombatPlugin, StatBlock, StatContext } from '../types.js';

function sumZone(
  mods: ModifierDef[],
  zone: ModifierDef['zones'][number],
  element: string,
  skillTags: string[] = [],
): number {
  return mods.reduce((sum, m) => {
    if (!m.zones.includes(zone)) return sum;
    if (m.tagFilter) {
      if (skillTags.length === 0) return sum;
      if (!m.tagFilter.some((t) => skillTags.includes(t) || t === element))
        return sum;
    }
    return sum + m.value;
  }, 0);
}

export function createTracePlugin(
  id: string,
  traceModifiers: ModifierDef[],
  element: string,
): CombatPlugin {
  return {
    id,
    kind: 'trace',
    modifyStats(stats: StatBlock, ctx: StatContext): StatBlock {
      const tags = ctx.skillTags ?? [];
      const next = { ...stats };
      next.critRate += sumZone(traceModifiers, 'crit_rate', element, tags);
      next.critDmg += sumZone(traceModifiers, 'crit_dmg', element, tags);
      next.breakEffect += sumZone(traceModifiers, 'break_effect', element, tags);
      next.dmgBonus += sumZone(traceModifiers, 'dmg_bonus', element, [
        ...tags,
        element,
      ]);
      next.vuln += sumZone(traceModifiers, 'vuln', element, tags);
      next.defPen += sumZone(traceModifiers, 'def_pen', element, tags);
      next.resPen += sumZone(traceModifiers, 'res_pen', element, tags);
      const atkP = sumZone(traceModifiers, 'atk_percent', element, tags);
      const flatAtk = sumZone(traceModifiers, 'flat_atk', element, tags);
      const spdP = sumZone(traceModifiers, 'speed_percent', element, tags);
      const flatSpd = sumZone(traceModifiers, 'flat_speed', element, tags);
      next.atk = next.atk * (1 + atkP) + flatAtk;
      next.speed = next.speed * (1 + spdP) + flatSpd;
      return next;
    },
  };
}

export function createModifierPlugin(
  id: string,
  kind: CombatPlugin['kind'],
  modifiers: ModifierDef[],
  element: string,
): CombatPlugin {
  return createTracePlugin(id, modifiers, element);
  // reuse same aggregation; trace plugin is generic modifier applier
}

export function createStatOverridePlugin(
  overrides: Record<string, number>,
): CombatPlugin {
  const defs: ModifierDef[] = [];
  if (overrides.atkPercent)
    defs.push({ zones: ['atk_percent'], value: overrides.atkPercent });
  if (overrides.flatAtk)
    defs.push({ zones: ['flat_atk'], value: overrides.flatAtk });
  if (overrides.critRate)
    defs.push({ zones: ['crit_rate'], value: overrides.critRate });
  if (overrides.critDmg)
    defs.push({ zones: ['crit_dmg'], value: overrides.critDmg });
  if (overrides.speedPercent)
    defs.push({ zones: ['speed_percent'], value: overrides.speedPercent });
  if (overrides.flatSpeed)
    defs.push({ zones: ['flat_speed'], value: overrides.flatSpeed });
  if (overrides.breakEffect)
    defs.push({ zones: ['break_effect'], value: overrides.breakEffect });
  return {
    id: 'stat-overrides',
    kind: 'override',
    modifyStats(stats, ctx) {
      return createTracePlugin('tmp', defs, stats.element).modifyStats!(
        stats,
        ctx,
      );
    },
  };
}
