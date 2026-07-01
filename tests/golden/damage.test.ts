import { describe, it, expect } from 'vitest';
import { calcDamage } from '../../engine/damage/calc.js';
import { getEnemy } from '../../engine/data-loader.js';
import type { CombatStats, SkillDef } from '../../engine/types.js';

const boss95 = () => getEnemy('foi-95');

function jingliuPanel(): CombatStats {
  return {
    level: 80,
    element: 'ice',
    atk: 1668,
    speed: 96,
    baseSpeed: 96,
    critRate: 0.05,
    critDmg: 0.5,
    breakEffect: 0,
    dmgBonus: 0,
    vuln: 0,
    defPen: 0,
    resPen: 0,
  };
}

const basic70: SkillDef = {
  id: 'basic',
  name: '普攻',
  type: 'direct',
  multiplier: 0.7,
  tags: ['basic'],
};

describe('L3 golden tests (raw_data/星铁计算公式1)', () => {
  it('镜流 1668 攻击 逆属性 未破韧 无暴击 ≈ 391', () => {
    const enemy = { ...boss95(), weaknesses: ['fire', 'lightning'] };
    const result = calcDamage({
      stats: jingliuPanel(),
      skill: basic70,
      enemy,
      enemyBroken: false,
    });
    expect(result.min).toBe(391);
  });

  it('镜流 1668 攻击 顺属性(冰弱) 未破韧 ≈ 488', () => {
    const enemy = { ...boss95(), weaknesses: ['ice', 'fire', 'lightning'] };
    const result = calcDamage({
      stats: jingliuPanel(),
      skill: basic70,
      enemy,
      enemyBroken: false,
    });
    // 游戏内显示四舍五入，公式结果 488.64 → 488 或 489
    expect(result.min).toBeGreaterThanOrEqual(488);
    expect(result.min).toBeLessThanOrEqual(489);
  });

  it('卡芙卡 dot 869 攻击 顺属性 ≈ 1055', () => {
    const stats: CombatStats = {
      level: 80,
      element: 'lightning',
      atk: 869,
      speed: 100,
      baseSpeed: 100,
      critRate: 0.05,
      critDmg: 0.5,
      breakEffect: 0,
      dmgBonus: 0,
      vuln: 0,
      defPen: 0,
      resPen: 0,
    };
    const dotSkill: SkillDef = {
      id: 'dot',
      name: '持续伤害',
      type: 'dot',
      multiplier: 2.9,
      tags: ['dot'],
      maxStacks: 1,
    };
    const enemy = {
      ...boss95(),
      weaknesses: ['lightning'],
    };
    const result = calcDamage({
      stats,
      skill: dotSkill,
      enemy,
      enemyBroken: false,
      stacks: 1,
    });
    expect(result.expected).toBe(1055);
  });

  it('暴击区间: expected 在 min 和 max 之间', () => {
    const stats = { ...jingliuPanel(), critRate: 0.8, critDmg: 1.5 };
    const result = calcDamage({
      stats,
      skill: basic70,
      enemy: boss95(),
      enemyBroken: false,
    });
    expect(result.min).toBeLessThan(result.expected);
    expect(result.expected).toBeLessThan(result.max);
  });
});
