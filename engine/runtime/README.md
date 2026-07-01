# Runtime 层

组合式仿真核心（R1）。

## 主要类型

| 类型 | 文件 | 职责 |
|------|------|------|
| `TeamContext` | `team-context.ts` | 战技点等队伍共享资源 |
| `DefaultCharacterRuntime` | `default-character.ts` | `getStats`, `useBasic/useSkill/useUlt` |
| `LightConeInstance` | `light-cone-instance.ts` | 注入光锥插件 |
| `RelicSetInstance` | `relic-set-instance.ts` | 注入套装插件 |
| `CombatPlugin` | `types.ts` | 统一 modifier / hook 接口 |
| `Battle` | `../simulation/battle.ts` | 本地仿真入口 |

## 注册特化行为

```typescript
import { registerCharacterBehavior } from './actor-factory.js';

registerCharacterBehavior('1306', (runtime) => {
  // 为花火注册额外插件或 override 方法
});
```

## 与旧代码

- `engine/stat/aggregate.ts` — 仍保留，pipeline 已改走 runtime
- `engine/pipeline.ts` — `runSingleHit` → `Battle` + runtime
