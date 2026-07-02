import { getConstants } from '../data-loader.js';
import type { TimelineUnit } from '../types.js';
import {
  actionAdvance,
  actionDelay,
  addSpeedBuff,
  nextActor,
  timeToAction,
  tickDistance,
} from './engine.js';

/** 行动轴调度器：根据当前参与者状态决定下一动，并在行动后应用 timeline 副作用 */
export class Timeline {
  globalAV = 0;
  roundIndex = 0;
  private cycleAV = 0;

  next(units: TimelineUnit[]): TimelineUnit {
    return nextActor(units);
  }

  /** 推进全局时间直到 actor 行动，并行更新所有单位路程。返回本次 Δt。 */
  advanceTo(units: TimelineUnit[], actor: TimelineUnit): number {
    const dt = timeToAction(actor);
    this.globalAV += dt;
    this.cycleAV += dt;
    const c = getConstants();

    for (const u of units) {
      if (u.id === actor.id) {
        u.distanceRemaining = 0;
        tickDistance(u, 0);
      } else {
        tickDistance(u, dt);
      }
    }

    const limit =
      this.roundIndex === 0 ? c.first_cycle_av : c.subsequent_cycle_av;
    if (this.cycleAV >= limit) {
      this.roundIndex++;
      this.cycleAV = 0;
    }

    return dt;
  }

  applyAdvance(unit: TimelineUnit, percent: number): number {
    return actionAdvance(unit, percent);
  }

  applyDelay(unit: TimelineUnit, percent: number): void {
    actionDelay(unit, percent);
  }

  applySpeedBuff(
    unit: TimelineUnit,
    percent: number,
    remainingDistance?: number,
  ): void {
    addSpeedBuff(
      unit,
      percent,
      remainingDistance ?? getConstants().action_distance,
    );
  }
}
