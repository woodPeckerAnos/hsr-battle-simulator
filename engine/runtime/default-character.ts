import type { CharacterBuild, CharacterData, SkillDef } from '../types.js';
import {
  getCharacter,
  getLightCone,
  getRelicSet,
  resolveLightConeId,
  resolveRelicSetId,
} from '../data-loader.js';
import { BuffContainer } from './buff-container.js';
import { LightConeInstance } from './light-cone-instance.js';
import { RelicSetInstance } from './relic-set-instance.js';
import {
  createStatOverridePlugin,
  createTracePlugin,
} from './plugins/modifier-plugin.js';
import { resolveHits } from './damage-pipeline.js';
import type { TeamContext } from './team-context.js';
import type {
  AbilityKind,
  ActionContext,
  ActionResult,
  CombatPlugin,
  HitResult,
  StatBlock,
  StatContext,
} from './types.js';
import { abilityToSkillId } from './types.js';
import { emptyStatBlock } from './stat-utils.js';
import type { ActiveModifier } from '../types.js';

export class DefaultCharacterRuntime {
  readonly id: string;
  readonly slug: string;
  readonly name: string;
  readonly element: CharacterData['element'];
  readonly path: string;
  readonly catalog: CharacterData;
  readonly build: CharacterBuild;

  energy = 0;
  distanceRemaining = 10000;

  private readonly plugins: CombatPlugin[] = [];
  private readonly buffs = new BuffContainer();
  private readonly team: TeamContext;

  constructor(catalog: CharacterData, build: CharacterBuild, team: TeamContext) {
    this.catalog = catalog;
    this.build = build;
    this.team = team;
    this.id = catalog.id;
    this.slug = catalog.slug ?? catalog.id;
    this.name = catalog.name;
    this.element = catalog.element;
    this.path = catalog.path;

    this.registerPlugin(
      createTracePlugin(
        `trace-${catalog.id}`,
        catalog.traceModifiers ?? [],
        catalog.element,
      ),
    );
    if (catalog.passives?.length) {
      this.registerPlugin(
        createTracePlugin(
          `passive-${catalog.id}`,
          catalog.passives,
          catalog.element,
        ),
      );
    }
    if (build.statOverrides && Object.keys(build.statOverrides).length) {
      this.registerPlugin(createStatOverridePlugin(build.statOverrides));
    }

    if (build.lightConeId) {
      const lcData = getLightCone(resolveLightConeId(build.lightConeId));
      const lc = new LightConeInstance(lcData, build.lightConeId ? 1 : 1);
      for (const p of lc.toPlugins()) this.registerPlugin(p);
    }

    for (const relic of build.relicSets ?? []) {
      const set = getRelicSet(resolveRelicSetId(relic.setId));
      const rs = new RelicSetInstance(set, relic.pieces);
      for (const p of rs.toPlugins()) this.registerPlugin(p);
    }

    for (const p of this.plugins) {
      p.onAttach?.(this);
    }
  }

  registerPlugin(plugin: CombatPlugin): void {
    this.plugins.push(plugin);
  }

  getActiveModifiers(): ActiveModifier[] {
    return this.buffs.getAll();
  }

  getStats(ctx: StatContext = { phase: 'out_of_combat' }): StatBlock {
    const level = this.build.level ?? this.catalog.level;
    let stats = emptyStatBlock(this.element, level);

    const lc = this.build.lightConeId
      ? getLightCone(resolveLightConeId(this.build.lightConeId))
      : null;
    const whiteAtk = this.catalog.baseStats.atk + (lc?.baseStats.atk ?? 0);

    stats.hp = this.catalog.baseStats.hp ?? 0;
    stats.def = this.catalog.baseStats.def ?? 0;
    stats.baseSpeed = this.catalog.baseStats.speed;
    stats.speed = this.catalog.baseStats.speed;
    stats.critRate = this.catalog.baseStats.critRate ?? stats.critRate;
    stats.critDmg = this.catalog.baseStats.critDmg ?? stats.critDmg;
    stats.atk = whiteAtk;

    for (const plugin of this.plugins) {
      if (plugin.modifyStats) {
        stats = plugin.modifyStats(stats, ctx);
      }
    }

    stats.critRate = Math.min(stats.critRate, 1);
    return stats;
  }

  canUseBasic(_ctx: ActionContext): boolean {
    return true;
  }

  canUseSkill(_ctx: ActionContext): boolean {
    return this.team.skillPoints >= 1;
  }

  canUseUlt(ctx: ActionContext): boolean {
    const max = ctx.constants.ult_energy_max;
    return this.energy >= max;
  }

  useBasic(ctx: ActionContext): ActionResult {
    return this.useAbility('basic', ctx);
  }

  useSkill(ctx: ActionContext): ActionResult {
    return this.useAbility('skill', ctx);
  }

  useUlt(ctx: ActionContext): ActionResult {
    return this.useAbility('ult', ctx);
  }

  useAbility(ability: AbilityKind, ctx: ActionContext): ActionResult {
    const skillId = abilityToSkillId(ability);
    const skill = this.catalog.skills[skillId];
    if (!skill) {
      return {
        actorId: this.id,
        ability,
        success: false,
        reason: `Skill not found: ${skillId}`,
        hits: [],
        events: [],
        totalDamageExpected: 0,
      };
    }

    if (ability === 'skill' && !this.canUseSkill(ctx)) {
      return {
        actorId: this.id,
        ability,
        success: false,
        reason: 'Not enough skill points',
        hits: [],
        events: [],
        totalDamageExpected: 0,
      };
    }

    if (ability === 'ult' && !this.canUseUlt(ctx)) {
      return {
        actorId: this.id,
        ability,
        success: false,
        reason: 'Not enough energy',
        hits: [],
        events: [],
        totalDamageExpected: 0,
      };
    }

    for (const p of this.plugins) {
      p.onBeforeAction?.(ctx);
    }

    let skillPointDelta = 0;
    let energyDelta = 0;

    if (!ctx.evaluateOnly) {
      if (ability === 'basic') {
        this.team.gainSkillPoint(1);
        skillPointDelta = 1;
      } else if (ability === 'skill') {
        this.team.consumeSkillPoint(1);
        skillPointDelta = -1;
      } else if (ability === 'ult') {
        this.energy = 0;
        energyDelta = -ctx.constants.ult_energy_max;
      }
    }

    const hits =
      skill.type === 'support'
        ? []
        : resolveHits(this, skill, ctx);

    const actionAdvances = this.applySkillEffects(skill, ctx);

    const totalDamageExpected = hits.reduce(
      (sum, h) => sum + h.damage.expected,
      0,
    );

    const result: ActionResult = {
      actorId: this.id,
      ability,
      success: true,
      skillPointDelta: skillPointDelta || undefined,
      energyDelta: energyDelta || undefined,
      actionAdvances: actionAdvances.length ? actionAdvances : undefined,
      hits,
      events: [],
      totalDamageExpected,
    };

    for (const p of this.plugins) {
      p.onAfterAction?.(ctx, result);
    }

    return result;
  }

  private applySkillEffects(
    skill: SkillDef,
    ctx: ActionContext,
  ): Array<{ targetId: string; percent: number }> {
    const advances: Array<{ targetId: string; percent: number }> = [];
    if (!skill.effects?.length || ctx.evaluateOnly) return advances;

    for (const effect of skill.effects) {
      if (effect.type !== 'action_advance') continue;
      const targets =
        effect.target === 'team'
          ? this.team.getAllies()
          : effect.target === 'ally' && ctx.targetIds?.[0]
            ? [this.team.getMember(ctx.targetIds[0])].filter(Boolean)
            : [this];

      for (const t of targets) {
        if (!t) continue;
        advances.push({ targetId: t.id, percent: effect.value });
      }
    }
    return advances;
  }
}
