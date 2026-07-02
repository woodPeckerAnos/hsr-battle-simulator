import { describe, it, expect } from 'vitest';
import { createTeamFromBuilds } from '../engine/runtime/team-factory.js';
import { getConstants } from '../engine/data-loader.js';
import { EnemyRuntime } from '../engine/runtime/enemy-runtime.js';
import { applyActionEffects } from '../engine/effects/index.js';

describe('Equipment reconcile v1', () => {
  it('applies light cone passive as permanent buff on attach', () => {
    const team = createTeamFromBuilds([
      { characterId: 'jingliu', lightConeId: 'before-dawn' },
    ]);
    const actor = team.members[0]!;
    const mods = actor.getActiveModifiers();
    const skillUltDmg = mods.filter(
      (m) =>
        m.source === 'lc-拂晓之前-passive' &&
        m.zones.includes('dmg_bonus'),
    );
    expect(skillUltDmg.length).toBeGreaterThan(0);
    expect(skillUltDmg[0]?.duration).toBeUndefined();
  });

  it('applies relic 2pc/4pc on attach by piece count', () => {
    const team = createTeamFromBuilds([
      {
        characterId: 'jingliu',
        relicSets: [{ setId: 'quantum-set', pieces: 4 }],
      },
    ]);
    const actor = team.members[0]!;
    const mods = actor.getActiveModifiers();
    expect(
      mods.some(
        (m) => m.source === 'relic-繁星璀璨的天才-2pc' && m.duration === undefined,
      ),
    ).toBe(true);
    expect(
      mods.some(
        (m) => m.source === 'relic-繁星璀璨的天才-4pc' && m.zones.includes('def_pen'),
      ),
    ).toBe(true);
  });

  it('aggregates relic piece sub stats into panel', () => {
    const team = createTeamFromBuilds([
      {
        characterId: 'jingliu',
        relicSets: [
          {
            setId: 'quantum-set',
            pieces: 2,
            subStats: { atkPercent: 0.12, flatSpeed: 10 },
          },
        ],
      },
    ]);
    const base = team.members[0]!.getStats();
    const plain = createTeamFromBuilds([{ characterId: 'jingliu' }]).members[0]!
      .getStats();
    expect(base.atk).toBeGreaterThan(plain.atk);
    expect(base.speed).toBeGreaterThan(plain.speed);
  });

  it('reconcile after_action receives action result (hook point alive)', () => {
    const team = createTeamFromBuilds([{ characterId: 'jingliu', skillId: 'skill' }]);
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
    const result = actor.skill(ctx);
    const extra = actor.reconcileEquipment('after_action', ctx, {
      action: ctx,
      result,
    });
    expect(Array.isArray(extra)).toBe(true);
  });
});
