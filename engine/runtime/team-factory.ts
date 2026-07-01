import type { CharacterBuild } from '../types.js';
import { createCharacterRuntime } from './actor-factory.js';
import { TeamContext } from './team-context.js';

export function createTeamFromBuilds(builds: CharacterBuild[]): TeamContext {
  const team = new TeamContext();
  for (const build of builds.slice(0, 4)) {
    const runtime = createCharacterRuntime(build, team);
    team.members.push(runtime);
  }
  return team;
}
