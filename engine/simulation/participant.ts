import type { TimelineUnit } from '../types.js';

/** 行动轴参与者 */
export interface Participant {
  readonly id: string;
  readonly name: string;
  readonly side: 'ally' | 'enemy';
  readonly axis: TimelineUnit;
}
