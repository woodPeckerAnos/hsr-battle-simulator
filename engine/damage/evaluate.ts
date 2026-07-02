import { getCharacter, getConstants, getEnemy } from '../data-loader.js';
import { calcDamage } from './calc.js';
import { createTeamFromBuilds } from '../runtime/team-factory.js';
import { EnemyRuntime } from '../runtime/enemy-runtime.js';
import { resolveHits } from '../runtime/damage-pipeline.js';
import {
  applyActiveModifiersToCombatStats,
  statBlockToCombatStats,
} from '../runtime/stat-utils.js';
import { resolveSkillForBuild } from '../skill/scaling.js';
import { sumDamageResults } from '../skill/hits.js';
import { validateDamageEval } from '../simulation/validate.js';
import type { CharacterBuild, DamageEvalRequest, DamageResult } from '../types.js';

/** 单次伤害：角色 build + 敌人；扩散技能默认汇总主目标 + 副目标 */
export function evaluateCharacterDamage(
  build: CharacterBuild,
  enemyId: string,
  options: Omit<DamageEvalRequest, 'build' | 'enemyId'> = {},
): DamageResult {
  validateDamageEval(build, enemyId);

  const catalog = getCharacter(build.characterId);
  const skillId = options.skillId ?? build.skillId ?? 'skill';
  const skill = resolveSkillForBuild(catalog, build, skillId);

  const team = createTeamFromBuilds([build]);
  const actor = team.members[0];
  if (!actor) throw new Error('Failed to create character runtime');

  if (skill.targetMode === 'blast' && skill.spreadMultiplier != null) {
    const enemy = EnemyRuntime.fromCatalog(enemyId);
    const hits = resolveHits(
      actor,
      skill,
      {
        constants: getConstants(),
        team,
        enemy,
        globalAV: 0,
        roundIndex: 0,
        enemyBroken: options.enemyBroken ?? false,
        actor,
        evaluateOnly: true,
      },
      { blastAdjacentCount: build.blastAdjacentCount ?? 2 },
    );
    return sumDamageResults(hits.map((h) => h.damage));
  }

  const enemy = getEnemy(enemyId);
  const tags = skill.tags ?? [];
  const stats = statBlockToCombatStats(
    actor.getStats({ phase: 'in_combat', skillTags: tags }),
  );
  const combatStats = applyActiveModifiersToCombatStats(
    stats,
    actor.getActiveModifiers(),
    tags,
  );

  return calcDamage({
    stats: combatStats,
    skill: {
      ...skill,
      hitCount: skill.hitCount ?? 1,
    },
    enemy,
    enemyBroken: options.enemyBroken ?? false,
    stacks: skill.maxStacks ?? 1,
  });
}

export function evaluateDamageRequest(request: DamageEvalRequest): DamageResult {
  return evaluateCharacterDamage(request.build, request.enemyId, {
    skillId: request.skillId,
    enemyBroken: request.enemyBroken,
  });
}

export function runtimeAggregateStats(build: CharacterBuild) {
  const team = createTeamFromBuilds([build]);
  const actor = team.members[0];
  if (!actor) throw new Error('Failed to create character runtime');
  return statBlockToCombatStats(actor.getStats());
}
