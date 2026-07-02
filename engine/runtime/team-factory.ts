import type { CharacterBuild } from '../types.js';
import { createCharacter } from './actor-factory.js';
import { TeamContext } from './team-context.js';

export function createTeamFromBuilds(builds: CharacterBuild[]): TeamContext {
  const team = new TeamContext();
  for (const build of builds) {
    const runtime = createCharacter(build, team);
    team.members.push(runtime);
  }
  return team;
}
