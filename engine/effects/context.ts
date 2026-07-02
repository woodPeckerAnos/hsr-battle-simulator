import type { TeamContext } from '../runtime/team-context.js';
import type { EnemyRuntime } from '../runtime/enemy-runtime.js';
import type { Participant } from '../simulation/participant.js';
import type { Timeline } from '../timeline/timeline.js';

export interface EffectApplierContext {
  team: TeamContext;
  enemy: EnemyRuntime;
  participants: Participant[];
  timeline: Timeline;
  onEnemyDamage?: (amount: number) => void;
}
