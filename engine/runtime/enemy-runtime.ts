import type { EnemyData } from '../types.js';
import { getEnemy } from '../data-loader.js';
import type { EnemyRuntimeRef } from './types.js';

export class EnemyRuntime implements EnemyRuntimeRef {
  constructor(readonly data: EnemyData) {}

  get id(): string {
    return this.data.id;
  }

  static fromCatalog(enemyId: string): EnemyRuntime {
    return new EnemyRuntime(getEnemy(enemyId));
  }
}
