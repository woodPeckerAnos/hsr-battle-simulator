import type { ActiveModifier, DamageZone, ModifierDef } from '../types.js';

let counter = 0;

export function modifierFromDef(
  def: ModifierDef,
  source: string,
  duration?: number,
): ActiveModifier {
  return {
    id: `${source}-${++counter}`,
    source,
    zones: def.zones,
    tagFilter: def.tagFilter,
    value: def.value,
    duration,
    stackRule: 'add',
  };
}

export class BuffState {
  private modifiers: ActiveModifier[] = [];

  add(mod: ActiveModifier): void {
    const existing = this.modifiers.find(
      (m) => m.id === mod.id || (m.source === mod.source && m.zones.join() === mod.zones.join()),
    );
    if (existing && mod.stackRule === 'refresh') {
      existing.duration = mod.duration;
      return;
    }
    if (existing && mod.stackRule === 'max') {
      existing.value = Math.max(existing.value, mod.value);
      return;
    }
    this.modifiers.push(mod);
  }

  addFromDefs(defs: ModifierDef[], source: string, duration?: number): void {
    for (const d of defs) {
      this.add(modifierFromDef(d, source, duration));
    }
  }

  getAll(): ActiveModifier[] {
    return [...this.modifiers];
  }

  getByZone(zone: DamageZone): ActiveModifier[] {
    return this.modifiers.filter((m) => m.zones.includes(zone));
  }

  /** Decrement durations at end of turn; remove expired */
  tick(): void {
    this.modifiers = this.modifiers
      .map((m) =>
        m.duration !== undefined ? { ...m, duration: m.duration - 1 } : m,
      )
      .filter((m) => m.duration === undefined || m.duration > 0);
  }

  clear(): void {
    this.modifiers = [];
  }
}
