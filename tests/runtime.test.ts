import { describe, it, expect } from 'vitest';
import { Battle } from '../engine/simulation/battle.js';
import { createTeamFromBuilds } from '../engine/runtime/team-factory.js';
import { skillIdToAbility } from '../engine/runtime/types.js';
import { getConstants } from '../engine/data-loader.js';
import { EnemyRuntime } from '../engine/runtime/enemy-runtime.js';
import type { BuildRequest } from '../engine/types.js';

describe('Runtime simulation R1', () => {
  it('CharacterRuntime.getStats includes light cone atk', () => {
    const team = createTeamFromBuilds([
      { characterId: 'jingliu', lightConeId: 'before-dawn' },
    ]);
    const stats = team.members[0]!.getStats();
    expect(stats.atk).toBeGreaterThan(679);
  });

  it('useSkill consumes skill point when not evaluateOnly', () => {
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
    const result = actor.useSkill(ctx);
    expect(result.success).toBe(true);
    expect(team.skillPoints).toBe(2);
  });

  it('Battle.evaluateSingleHit matches pipeline shape', () => {
    const request: BuildRequest = {
      mode: 'single_hit',
      enemyId: 'foi-95',
      team: {
        members: [
          {
            characterId: 'jingliu',
            skillId: 'basic',
            statOverrides: { flatAtk: 970 },
          },
        ],
      },
    };
    const battle = Battle.fromRequest(request);
    const result = battle.evaluateSingleHit(request);
    expect(result.success).toBe(true);
    expect(result.hits[0]!.damage.min).toBeGreaterThan(0);
    expect(result.hits[0]!.damage.expected).toBeGreaterThanOrEqual(
      result.hits[0]!.damage.min,
    );
  });

  it('maps skillId to ability', () => {
    expect(skillIdToAbility('basic')).toBe('basic');
    expect(skillIdToAbility('ult')).toBe('ult');
    expect(skillIdToAbility('dot')).toBe('skill');
  });
});
