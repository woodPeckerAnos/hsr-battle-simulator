import type { EffectApplierContext } from './context.js';

/** 行动 effect 基类；Battle 通过 apply() 统一执行 */
export abstract class ActionEffect {
  constructor(readonly sourceId: string) {}

  abstract apply(ctx: EffectApplierContext): void;
}

export function normalizeTargets(targets: string | string[]): string[] {
  return Array.isArray(targets) ? [...targets] : [targets];
}

/** 指向一个或多个目标的 effect */
export abstract class TargetedEffect extends ActionEffect {
  readonly targets: string[];

  constructor(sourceId: string, targets: string | string[]) {
    super(sourceId);
    this.targets = normalizeTargets(targets);
  }
}
