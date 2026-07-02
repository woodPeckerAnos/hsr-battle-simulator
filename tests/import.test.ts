import { describe, it, expect } from 'vitest';
import {
  getCharacter,
  listCharacters,
  listLightCones,
  listRelicSets,
  resolveCharacterId,
} from '../engine/data-loader.js';

describe('bwiki catalog import', () => {
  it('indexes 90+ characters', () => {
    expect(listCharacters().length).toBeGreaterThanOrEqual(90);
  });

  it('indexes 160+ light cones', () => {
    expect(listLightCones().length).toBeGreaterThanOrEqual(160);
  });

  it('indexes 55+ relic sets', () => {
    expect(listRelicSets().length).toBeGreaterThanOrEqual(55);
  });

  it('resolves slug aliases to bwiki ids', () => {
    expect(resolveCharacterId('jingliu')).toBe('镜流');
    expect(resolveCharacterId('kafka')).toBe('卡芙卡');
    expect(resolveCharacterId('sparkle')).toBe('花火');
    expect(resolveCharacterId('镜流')).toBe('镜流');
  });

  it('Jingliu has bwiki base stats and traces', () => {
    const c = getCharacter('jingliu');
    expect(c.id).toBe('镜流');
    expect(c.baseStats.atk).toBeCloseTo(679, 0);
    expect(c.traces?.flatSpeed).toBe(9);
    expect(c.traces?.critDmg).toBeCloseTo(0.373, 3);
    expect(c.traces?.hpPercent).toBeCloseTo(0.1, 3);
    expect(c.source).toBe('bwiki-scraper');
  });

  it('Jingliu imports eidolons and skill scaling from bwiki', () => {
    const c = getCharacter('jingliu');
    expect(c.eidolons?.length).toBe(6);
    expect(c.eidolons?.[4]?.skillLevelBonus).toEqual({
      skill: 2,
      basic: 1,
    });
    expect(c.skillLevelCaps?.basic).toBe(9);
    expect(c.skills.basic.scaling?.levels[9]).toBeCloseTo(1.4, 2);
    expect(c.skills.skill.scaling?.levels[10]).toBeCloseTo(2.1, 2);
    expect(c.skills.ult.targetMode).toBe('blast');
    expect(c.skills.ult.spreadScaling?.levels[10]).toBeCloseTo(1.3125, 4);
  });

  it('Serval skill imports blast primary and spread scaling', () => {
    const c = getCharacter('希露瓦');
    expect(c.skills.skill.targetMode).toBe('blast');
    expect(c.skills.skill.scaling?.levels[10]).toBeCloseTo(1.47, 2);
    expect(c.skills.skill.spreadScaling?.levels[10]).toBeCloseTo(0.63, 2);
    expect(c.skills.ult.targetMode).toBe('aoe');
  });

  it('Kafka skill is blast; ult is aoe from wiki tables', () => {
    const c = getCharacter('kafka');
    expect(c.skills.skill.targetMode).toBe('blast');
    expect(c.skills.skill.scaling?.levels[10]).toBeCloseTo(1.68, 2);
    expect(c.skills.skill.spreadScaling?.levels[10]).toBeCloseTo(0.63, 2);
    expect(c.skills.ult.targetMode).toBe('aoe');
    expect(c.skills.ult.scaling?.levels[10]).toBeCloseTo(0.832, 3);
  });

  it('Sparkle skill slots stay support with wiki scaling', () => {
    const c = getCharacter('sparkle');
    expect(c.skills.skill.type).toBe('support');
    expect(c.skills.ult.type).toBe('support');
    expect(c.skills.skill.scaling?.levels[10]).toBeDefined();
  });
});
