import { getEnemy } from '../data-loader.js';
import {
  DelayAllAlliesEffect,
  GrantAllyEnergyEffect,
} from '../effects/index.js';
import { createUnit } from '../timeline/engine.js';
import type { EnemyData } from '../types.js';
import type { Participant } from '../simulation/participant.js';
import type { ActionContext, ActionResult, EnemyRuntimeRef } from './types.js';

export class EnemyRuntime implements Participant, EnemyRuntimeRef {
  readonly side = 'enemy' as const;
  readonly axis;
  private aiIndex = 0;

  constructor(readonly data: EnemyData) {
    this.axis = createUnit(
      data.id,
      data.name,
      'enemy',
      data.speed ?? 100,
    );
  }

  get id(): string {
    return this.data.id;
  }

  get name(): string {
    return this.data.name;
  }

  static fromCatalog(enemyId: string): EnemyRuntime {
    return new EnemyRuntime(getEnemy(enemyId));
  }

  action(ctx: ActionContext): ActionResult {
    if (this.data.passive) {
      return {
        actorId: this.id,
        ability: 'basic',
        success: true,
        effects: [],
        events: [],
        noop: true,
        continueTurn: false,
      };
    }

    const pattern = ['attack', 'attack', 'skill'];
    const actionName = pattern[this.aiIndex % pattern.length];
    this.aiIndex++;

    return {
      actorId: this.id,
      ability: 'basic',
      success: true,
      effects: [
        new GrantAllyEnergyEffect(
          this.id,
          ctx.constants.ult_energy_on_hit_taken,
        ),
        new DelayAllAlliesEffect(this.id, 0.1),
      ],
      events: [{ type: 'enemy_action', payload: { action: actionName } }],
      continueTurn: false,
    };
  }
}
