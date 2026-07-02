import { describe, it, expect } from 'vitest';
import { createTeamFromBuilds } from '../engine/runtime/team-factory.js';
import { evaluateCharacterDamage } from '../engine/damage/evaluate.js';
import { resolveSkillForBuild } from '../engine/skill/scaling.js';
import { getCharacter, getConstants } from '../engine/data-loader.js';
import { EnemyRuntime } from '../engine/runtime/enemy-runtime.js';
import { resolveHits } from '../engine/runtime/damage-pipeline.js';
import { skillIdToAbility } from '../engine/runtime/types.js';
import { applyActionEffects } from '../engine/effects/index.js';

describe('Runtime simulation R1', () => {
  it('CharacterRuntime.getStats includes light cone atk', () => {
    const team = createTeamFromBuilds([
      { characterId: 'jingliu', lightConeId: 'before-dawn' },
    ]);
    const stats = team.members[0]!.getStats();
    expect(stats.atk).toBeGreaterThan(679);
  });

  it('skill consumes skill point via effects', () => {
    const team = createTeamFromBuilds([{ characterId: 'jingliu' }]);
    const actor = team.members[0]!;
    const enemy = EnemyRuntime.fromCatalog('foi-95');
    const ctx = {
      constants: getConstants(),
      team,
      enemy,
      globalAV: 0,
      roundIndex: 0,
      enemyBroken: false,
      actor,
      evaluateOnly: false,
    };
    expect(team.skillPoints).toBe(3);
    const result = actor.skill(ctx);
    applyActionEffects(result.effects, {
      team,
      enemy,
      participants: [actor, enemy],
      timeline: {
        applyAdvance: () => 0,
        applyDelay: () => {},
        applySpeedBuff: () => {},
      } as never,
    });
    expect(result.success).toBe(true);
    expect(team.skillPoints).toBe(2);
  });

  it('evaluateCharacterDamage matches expected shape', () => {
    const build = {
      characterId: 'jingliu',
      skillId: 'basic',
      statOverrides: { flatAtk: 970 },
    };
    const result = evaluateCharacterDamage(build, 'foi-95');
    expect(result.min).toBeGreaterThan(0);
    expect(result.expected).toBeGreaterThanOrEqual(result.min);
  });

  it('blast skill resolves primary and spread hits', () => {
    const build = { characterId: 'kafka', skillId: 'skill' };
    const catalog = getCharacter('kafka');
    const skill = resolveSkillForBuild(catalog, build, 'skill');
    expect(skill.targetMode).toBe('blast');
    expect(skill.spreadMultiplier).toBeCloseTo(0.63, 2);

    const team = createTeamFromBuilds([build]);
    const actor = team.members[0]!;
    const enemy = EnemyRuntime.fromCatalog('foi-95');
    const hits = resolveHits(
      actor,
      skill,
      {
        constants: getConstants(),
        team,
        enemy,
        globalAV: 0,
        roundIndex: 0,
        enemyBroken: false,
        actor,
        evaluateOnly: true,
      },
      { blastAdjacentCount: 2 },
    );

    expect(hits).toHaveLength(3);
    expect(hits[0]?.role).toBe('primary');
    expect(hits[1]?.role).toBe('secondary');
    expect(hits[0]!.damage.expected).toBeGreaterThan(hits[1]!.damage.expected);
  });

  it('maps skillId to ability', () => {
    expect(skillIdToAbility('basic')).toBe('basic');
    expect(skillIdToAbility('ult')).toBe('ult');
    expect(skillIdToAbility('dot')).toBe('skill');
  });
});
