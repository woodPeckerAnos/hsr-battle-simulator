import type { CharacterBuild, CharacterData, EidolonDef, SkillDef } from '../types.js';
import { BuffContainer } from './buff-container.js';
import { createEquipLoadout, type EquipLoadout } from './equipment/index.js';
import {
  createStatOverridePlugin,
  createTracePlugin,
} from './plugins/modifier-plugin.js';
import { resolveSkillForBuild, resolveSkillLevel } from '../skill/scaling.js';
import { defaultBlastAdjacentCount } from '../skill/hits.js';
import { resolveHits } from './damage-pipeline.js';
import { createUnit } from '../timeline/engine.js';
import type { Participant } from '../simulation/participant.js';
import type { TeamContext } from './team-context.js';
import type {
  AbilityKind,
  ActionContext,
  ActionResult,
  CombatPlugin,
  StatBlock,
  StatContext,
} from './types.js';
import { abilityToSkillId, skillIdToAbility } from './types.js';
import { emptyStatBlock } from './stat-utils.js';
import type { ActiveModifier, ModifierDef } from '../types.js';
import {
  ActionAdvanceEffect,
  ActionEffect,
  BuffEffect,
  DamageEffect,
  EnergyEffect,
  SkillPointEffect,
  SpeedBuffEffect,
} from '../effects/index.js';
import type { TurnContext } from './turn-context.js';
import type { EquipPhase } from './equipment/types.js';
import type { ActionContext as EquipBattleContext } from './types.js';

function failAction(
  actorId: string,
  ability: AbilityKind,
  reason: string,
): ActionResult {
  return {
    actorId,
    ability,
    success: false,
    reason,
    effects: [],
    events: [],
    continueTurn: false,
  };
}

/** 角色基类：生命周期 + 面板 + 插件；子类实现 attack/skill/ultra */
export abstract class Character implements Participant {
  readonly id: string;
  readonly slug: string;
  readonly name: string;
  readonly side = 'ally' as const;
  readonly element: CharacterData['element'];
  readonly path: string;
  readonly catalog: CharacterData;
  readonly build: CharacterBuild;
  /** 星魂等级 0–6，默认 0 */
  readonly eidolonLevel: number;
  readonly axis;

  energy = 0;

  private readonly plugins: CombatPlugin[] = [];
  private readonly buffs = new BuffContainer();
  protected readonly team: TeamContext;
  readonly equipLoadout: EquipLoadout;
  private turnActionResults: ActionResult[] = [];

  constructor(catalog: CharacterData, build: CharacterBuild, team: TeamContext) {
    this.catalog = catalog;
    this.build = build;
    this.eidolonLevel = build.eidolonLevel ?? 0;
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

    this.equipLoadout = createEquipLoadout(build, catalog.element);
    if (this.equipLoadout.pieceStatModifiers.length) {
      this.registerPlugin(
        createTracePlugin(
          `relic-pieces-${catalog.id}`,
          this.equipLoadout.pieceStatModifiers,
          catalog.element,
        ),
      );
    }

    this.applyBuffEffects(
      this.equipLoadout.attach(this, catalog.element),
    );

    for (const p of this.plugins) {
      p.onAttach?.(this);
    }

    this.axis = createUnit(
      this.id,
      this.name,
      'ally',
      catalog.baseStats.speed,
      catalog.baseStats.speed,
    );
    this.syncAxisStats();
  }

  /** 由 Battle 在开战时调用 */
  reconcileEquipment(
    phase: EquipPhase,
    battle: EquipBattleContext,
    extras: {
      action?: ActionContext;
      result?: ActionResult;
      turnResults?: ActionResult[];
    } = {},
  ): ActionEffect[] {
    return this.equipLoadout.reconcilePhase(phase, this, this.element, {
      battle,
      ...extras,
    });
  }

  private applyBuffEffects(effects: ActionEffect[]): void {
    for (const fx of effects) {
      if (fx instanceof BuffEffect) {
        for (const targetId of fx.targets) {
          if (targetId === this.id || targetId === this.slug) {
            this.addBuff(fx.buff);
          } else {
            this.team.getMember(targetId)?.addBuff(fx.buff);
          }
        }
      }
    }
  }

  syncAxisStats(): void {
    const stats = this.getStats({ phase: 'in_combat' });
    this.axis.baseSpeed = stats.baseSpeed;
    this.axis.speed = stats.speed;
  }

  /** Battle 在 Timeline 槽位内唯一入口 */
  takeTurn(turn: TurnContext): void {
    this.onTurnStart(turn);
    this.runMainPhase(turn);
    this.runBonusPhase(turn);
    this.endTurn(turn);
  }

  protected onTurnStart(_turn: TurnContext): void {}

  protected runMainPhase(turn: TurnContext): void {
    this.turnActionResults = [];
    let result: ActionResult;
    do {
      const actionCtx = turn.toActionContext();
      turn.applyEffects(
        this.reconcileEquipment('before_action', actionCtx, {
          action: actionCtx,
        }),
      );
      result = this.action(actionCtx);
      turn.applyEffects(result.effects);
      turn.applyEffects(
        this.reconcileEquipment('after_action', actionCtx, {
          action: actionCtx,
          result,
        }),
      );
      this.turnActionResults.push(result);
      turn.onActionComplete?.(result);
      this.afterAction(turn, result);
    } while (result.continueTurn);
  }

  /** 星魂额外回合等：子类 override，内部可再次 action + applyEffects */
  protected runBonusPhase(_turn: TurnContext): void {}

  protected afterAction(_turn: TurnContext, _result: ActionResult): void {}

  /** 告知外部：含额外行动在内，本角色回合彻底结束 */
  protected endTurn(turn: TurnContext): void {
    const actionCtx = turn.toActionContext();
    turn.applyEffects(
      this.reconcileEquipment('turn_end', actionCtx, {
        turnResults: this.turnActionResults,
      }),
    );
    turn.notifyTurnComplete(this);
  }

  action(ctx: ActionContext): ActionResult {
    const skillId = ctx.chosenSkillId ?? this.build.skillId ?? 'skill';
    switch (skillIdToAbility(skillId)) {
      case 'basic':
        return this.attack(ctx);
      case 'ult':
        return this.ultra(ctx);
      default:
        return this.skill(ctx);
    }
  }

  abstract attack(ctx: ActionContext): ActionResult;
  abstract skill(ctx: ActionContext): ActionResult;
  abstract ultra(ctx: ActionContext): ActionResult;

  /** Participant 兼容：敌人等仍走 action；我方由 Battle 调 takeTurn */
  registerPlugin(plugin: CombatPlugin): void {
    this.plugins.push(plugin);
  }

  addBuff(buff: ActiveModifier): void {
    this.buffs.add(buff);
  }

  addBuffFromDef(defs: ModifierDef[], source: string, duration?: number): void {
    this.buffs.addFromDefs(defs, source, duration);
  }

  getActiveModifiers(): ActiveModifier[] {
    return this.buffs.getAll();
  }

  tickBuffs(): void {
    this.buffs.tick();
  }

  getStats(ctx: StatContext = { phase: 'out_of_combat' }): StatBlock {
    const level = this.build.level ?? this.catalog.level;
    let stats = emptyStatBlock(this.element, level);

    const whiteAtk =
      this.catalog.baseStats.atk + this.equipLoadout.getLightConeWhiteAtk();

    stats.hp = this.catalog.baseStats.hp ?? 0;
    stats.def = this.catalog.baseStats.def ?? 0;
    stats.baseSpeed = this.catalog.baseStats.speed;
    stats.speed = this.catalog.baseStats.speed;
    stats.critRate = this.catalog.baseStats.critRate ?? stats.critRate;
    stats.critDmg =
      (this.catalog.baseStats.critDmg ?? stats.critDmg) +
      this.equipLoadout.getLightConeCritDmg();
    stats.atk = whiteAtk;

    for (const plugin of this.plugins) {
      if (plugin.modifyStats) {
        stats = plugin.modifyStats(stats, ctx);
      }
    }

    stats.critRate = Math.min(stats.critRate, 1);
    return stats;
  }

  protected requireAlly(ctx: ActionContext): Character {
    const rawId = ctx.targetIds?.[0];
    if (!rawId) {
      throw new Error(`${this.id} skill requires target ally in ctx.targetIds`);
    }
    const ally = this.team.getMember(rawId);
    if (!ally) {
      throw new Error(`Target ally not found: ${rawId}`);
    }
    return ally;
  }

  protected canUseSkill(_ctx: ActionContext): boolean {
    return this.team.skillPoints >= 1;
  }

  protected canUseUlt(ctx: ActionContext): boolean {
    return this.energy >= ctx.constants.ult_energy_max;
  }

  /** 兼容旧 API / 测试 */
  useBasic(ctx: ActionContext): ActionResult {
    return this.attack(ctx);
  }

  useSkill(ctx: ActionContext): ActionResult {
    return this.skill(ctx);
  }

  useUlt(ctx: ActionContext): ActionResult {
    return this.ultra(ctx);
  }

  protected resolveSkill(skillId: string): SkillDef {
    return resolveSkillForBuild(this.catalog, this.build, skillId);
  }

  protected resolveSkillLevel(skillId: string): number {
    return resolveSkillLevel(this.catalog, this.build, skillId);
  }

  /** 星魂 index（1–6）是否已激活 */
  protected hasEidolon(index: number): boolean {
    return this.eidolonLevel >= index;
  }

  /** 当前生效的星魂定义 */
  protected getActiveEidolons(): EidolonDef[] {
    return (this.catalog.eidolons ?? []).filter(
      (e) => e.index <= this.eidolonLevel,
    );
  }

  /** 扩散技能相邻副目标数，build 可覆盖，默认 2 */
  protected getBlastAdjacentCount(): number {
    return defaultBlastAdjacentCount(this.build);
  }

  protected executeAbility(
    ability: AbilityKind,
    ctx: ActionContext,
    buildEffects: (skill: SkillDef) => ActionEffect[],
  ): ActionResult {
    const skillId = abilityToSkillId(ability);
    let skill: SkillDef;
    try {
      skill = this.resolveSkill(skillId);
    } catch {
      return failAction(this.id, ability, `Skill not found: ${skillId}`);
    }

    if (ability === 'skill' && !this.canUseSkill(ctx)) {
      return failAction(this.id, ability, 'Not enough skill points');
    }

    if (ability === 'ult' && !this.canUseUlt(ctx)) {
      return failAction(this.id, ability, 'Not enough energy');
    }

    for (const p of this.plugins) {
      p.onBeforeAction?.(ctx);
    }

    const effects = buildEffects(skill);

    const result: ActionResult = {
      actorId: this.id,
      ability,
      success: true,
      primaryTargets: ctx.targetIds ?? [ctx.enemy.id],
      effects,
      events: [],
      continueTurn: false,
    };

    for (const p of this.plugins) {
      p.onAfterAction?.(ctx, result);
    }

    return result;
  }

  protected buildDamageEffects(skill: SkillDef, ctx: ActionContext): ActionEffect[] {
    if (skill.type === 'support') return [];
    return resolveHits(this, skill, ctx, {
      blastAdjacentCount: this.getBlastAdjacentCount(),
    }).map(
      (hit) =>
        new DamageEffect(
          this.id,
          hit.targetId,
          hit.element,
          hit.tags,
          hit.damage,
        ),
    );
  }

  protected buildResourceEffects(
    ability: AbilityKind,
    ctx: ActionContext,
  ): ActionEffect[] {
    switch (ability) {
      case 'basic':
        return [new SkillPointEffect(this.id, this.id, 1)];
      case 'skill':
        return [new SkillPointEffect(this.id, this.id, -1)];
      case 'ult':
        return [
          new EnergyEffect(this.id, this.id, -ctx.constants.ult_energy_max),
        ];
      default:
        return [];
    }
  }

  protected buildSkillDefEffects(
    skill: SkillDef,
    ctx: ActionContext,
  ): ActionEffect[] {
    const effects: ActionEffect[] = [];
    if (!skill.effects?.length) return effects;

    for (const effect of skill.effects) {
      if (effect.type === 'action_advance') {
        const resolved =
          effect.target === 'team'
            ? this.team.getAllies()
            : effect.target === 'ally' && ctx.targetIds?.length
              ? ctx.targetIds
                  .map((id) => this.team.getMember(id))
                  .filter((m): m is Character => m != null)
              : [this];

        const targetIds = resolved.map((t) => t.id);
        if (targetIds.length > 0) {
          effects.push(
            new ActionAdvanceEffect(this.id, targetIds, effect.value),
          );
        }
      }
      if (effect.type === 'speed_buff') {
        effects.push(new SpeedBuffEffect(this.id, this.id, effect.value));
      }
    }
    return effects;
  }

  protected buildDefaultAbilityEffects(
    ability: AbilityKind,
    skill: SkillDef,
    ctx: ActionContext,
  ): ActionEffect[] {
    return [
      ...this.buildResourceEffects(ability, ctx),
      ...this.buildDamageEffects(skill, ctx),
      ...this.buildSkillDefEffects(skill, ctx),
    ];
  }
}
