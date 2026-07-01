import { describe, it, expect } from 'vitest';
import {
  getCharacter,
  listCharacters,
  listLightCones,
  listRelicSets,
  resolveCharacterId,
} from '../engine/data-loader.js';

describe('hsr-optimizer catalog import', () => {
  it('indexes 90+ characters', () => {
    expect(listCharacters().length).toBeGreaterThanOrEqual(90);
  });

  it('indexes 160+ light cones', () => {
    expect(listLightCones().length).toBeGreaterThanOrEqual(160);
  });

  it('indexes 60 relic sets', () => {
    expect(listRelicSets().length).toBe(60);
  });

  it('resolves slug aliases to game ids', () => {
    expect(resolveCharacterId('jingliu')).toBe('1212');
    expect(resolveCharacterId('kafka')).toBe('1005');
    expect(resolveCharacterId('1306')).toBe('1306');
  });

  it('Jingliu has optimizer base stats', () => {
    const c = getCharacter('jingliu');
    expect(c.id).toBe('1212');
    expect(c.baseStats.atk).toBeCloseTo(679.14, 1);
    expect(c.traces?.flatSpeed).toBe(9);
    expect(c.traces?.critDmg).toBeCloseTo(0.373, 3);
  });
});
