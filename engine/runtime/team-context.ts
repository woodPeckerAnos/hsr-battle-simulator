import type { DefaultCharacterRuntime } from './default-character.js';
import type { TeamContextRef } from './types.js';

export class TeamContext implements TeamContextRef {
  members: DefaultCharacterRuntime[] = [];
  skillPoints: number;
  maxSkillPoints: number;

  constructor(maxSkillPoints = 3) {
    this.skillPoints = maxSkillPoints;
    this.maxSkillPoints = maxSkillPoints;
  }

  consumeSkillPoint(n: number): boolean {
    if (this.skillPoints < n) return false;
    this.skillPoints -= n;
    return true;
  }

  gainSkillPoint(n: number): void {
    this.skillPoints = Math.min(this.maxSkillPoints, this.skillPoints + n);
  }

  getMember(id: string): DefaultCharacterRuntime | undefined {
    return this.members.find((m) => m.id === id || m.slug === id);
  }

  getAllies(): DefaultCharacterRuntime[] {
    return [...this.members];
  }
}
