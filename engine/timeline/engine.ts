import { getConstants } from '../data-loader.js';
import type { SpeedBuff, TimelineUnit } from '../types.js';

const DISTANCE = () => getConstants().action_distance;

/** Effective speed including active buffs (percent applies to base speed) */
export function effectiveSpeed(unit: TimelineUnit): number {
  let flat = unit.speed;
  let percent = 0;
  for (const b of unit.speedBuffs) {
    flat += b.flatBonus;
    percent += b.percentBonus;
  }
  return flat + unit.baseSpeed * percent;
}

export function actionValue(speed: number): number {
  return DISTANCE() / speed;
}

export function createUnit(
  id: string,
  name: string,
  side: 'ally' | 'enemy',
  baseSpeed: number,
  panelSpeed?: number,
): TimelineUnit {
  return {
    id,
    name,
    side,
    baseSpeed,
    speed: panelSpeed ?? baseSpeed,
    distanceRemaining: DISTANCE(),
    speedBuffs: [],
  };
}

/** Advance action: reduce remaining distance (拉条). Capped at remaining. */
export function actionAdvance(unit: TimelineUnit, percent: number): number {
  const amount = DISTANCE() * percent;
  const applied = Math.min(amount, unit.distanceRemaining);
  unit.distanceRemaining -= applied;
  return applied;
}

/** Delay action: increase remaining distance (推条) */
export function actionDelay(unit: TimelineUnit, percent: number): void {
  unit.distanceRemaining = Math.min(
    unit.distanceRemaining + DISTANCE() * percent,
    DISTANCE(),
  );
}

/** Speed buff: percent applies to base speed white value per game rules */
export function addSpeedBuff(
  unit: TimelineUnit,
  percent: number,
  remainingDistance: number,
  flatBonus = 0,
): void {
  unit.speedBuffs.push({ flatBonus, percentBonus: percent, remainingDistance });
}

/** Consume distance; when reaching 0, reset for next turn */
export function tickDistance(unit: TimelineUnit, delta: number): boolean {
  const speed = effectiveSpeed(unit);
  const traveled = speed * delta;
  unit.distanceRemaining -= traveled;

  // Consume speed buff remaining distance
  for (const b of unit.speedBuffs) {
    b.remainingDistance -= traveled;
  }
  unit.speedBuffs = unit.speedBuffs.filter((b) => b.remainingDistance > 0);

  if (unit.distanceRemaining <= 0) {
    unit.distanceRemaining = DISTANCE();
    return true; // acted
  }
  return false;
}

/** Time until next action for a unit */
export function timeToAction(unit: TimelineUnit): number {
  return unit.distanceRemaining / effectiveSpeed(unit);
}

/** Find unit with soonest action among list */
export function nextActor(units: TimelineUnit[]): TimelineUnit {
  return units.reduce((a, b) =>
    timeToAction(a) <= timeToAction(b) ? a : b,
  );
}

/** Simulate until all units have acted `turns` times or global AV limit */
export interface TimelineSimOptions {
  maxAV?: number;
  maxActions?: number;
}

export interface TimelineTickResult {
  actorId: string;
  globalAV: number;
  roundIndex: number;
}

export function simulateTimeline(
  units: TimelineUnit[],
  options: TimelineSimOptions = {},
): TimelineTickResult[] {
  const c = getConstants();
  const maxAV = options.maxAV ?? c.first_cycle_av + c.subsequent_cycle_av * 2;
  const results: TimelineTickResult[] = [];
  let globalAV = 0;
  let roundIndex = 0;
  let cycleAV = 0;

  while (globalAV < maxAV && results.length < (options.maxActions ?? 100)) {
    const actor = nextActor(units);
    const dt = timeToAction(actor);
    globalAV += dt;
    cycleAV += dt;

    // Move all units forward by dt (parallel timelines)
    for (const u of units) {
      if (u.id === actor.id) {
        u.distanceRemaining = 0;
        tickDistance(u, 0);
      } else {
        tickDistance(u, dt);
      }
    }

    if (cycleAV >= (roundIndex === 0 ? c.first_cycle_av : c.subsequent_cycle_av)) {
      roundIndex++;
      cycleAV = 0;
    }

    results.push({ actorId: actor.id, globalAV, roundIndex });
  }

  return results;
}

/** Variable speed: split remaining distance when speed changes mid-turn */
export function timeToActionWithSpeedChange(
  distanceBefore: number,
  speedBefore: number,
  speedAfter: number,
  distanceAfter: number,
): number {
  return distanceBefore / speedBefore + distanceAfter / speedAfter;
}
