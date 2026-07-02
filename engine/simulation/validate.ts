import type { BattleRequest, CharacterBuild, TeamBuild } from '../types.js';

function requireNonEmpty(value: unknown, field: string): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`${field} is required`);
  }
  return value.trim();
}

function requirePositiveInt(value: unknown, field: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    throw new Error(`${field} must be a positive number`);
  }
  if (!Number.isInteger(value)) {
    throw new Error(`${field} must be an integer`);
  }
  return value;
}

export function validateTeamBuild(team: TeamBuild): void {
  if (!team?.members?.length) {
    throw new Error('team.members must contain at least one character');
  }
  for (const [i, member] of team.members.entries()) {
    requireNonEmpty(member.characterId, `team.members[${i}].characterId`);
  }
}

export function validateBattleRequest(request: BattleRequest): void {
  if (!request?.team) {
    throw new Error('team is required');
  }
  validateTeamBuild(request.team);
  requireNonEmpty(request.enemyId, 'enemyId');
  requirePositiveInt(request.maxTurn, 'maxTurn');
}

export function validateDamageEval(
  build: CharacterBuild,
  enemyId: string,
): void {
  requireNonEmpty(build.characterId, 'characterId');
  requireNonEmpty(enemyId, 'enemyId');
}
