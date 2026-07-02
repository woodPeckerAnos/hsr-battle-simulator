import type { CharacterBuild } from '../types.js';
import { getCharacter } from '../data-loader.js';
import type { Character } from './character.js';
import { DefaultCharacter } from './characters/default.js';
import { Sparkle } from './characters/sparkle.js';
import type { TeamContext } from './team-context.js';

const characterClasses: Record<string, new (...args: ConstructorParameters<typeof DefaultCharacter>) => Character> = {
  花火: Sparkle,
};

export function createCharacter(
  build: CharacterBuild,
  team: TeamContext,
): Character {
  const catalog = getCharacter(build.characterId);
  const C = characterClasses[catalog.id] ?? DefaultCharacter;
  return new C(catalog, build, team);
}
