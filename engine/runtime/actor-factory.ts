import type { CharacterBuild } from '../types.js';
import { getCharacter } from '../data-loader.js';
import { DefaultCharacterRuntime } from './default-character.js';
import type { TeamContext } from './team-context.js';

const behaviorRegistry: Record<string, (r: DefaultCharacterRuntime) => void> = {};

export function registerCharacterBehavior(
  gameId: string,
  setup: (runtime: DefaultCharacterRuntime) => void,
): void {
  behaviorRegistry[gameId] = setup;
}

export function createCharacterRuntime(
  build: CharacterBuild,
  team: TeamContext,
): DefaultCharacterRuntime {
  const catalog = getCharacter(build.characterId);
  const runtime = new DefaultCharacterRuntime(catalog, build, team);
  behaviorRegistry[catalog.id]?.(runtime);
  return runtime;
}
