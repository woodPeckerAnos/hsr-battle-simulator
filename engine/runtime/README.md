# Runtime 层

组合式仿真核心（R1）。

## 主要类型

| 类型 | 文件 | 职责 |
|------|------|------|
| `Character` | `character.ts` | 生命周期 `takeTurn`、attack/skill/ultra、`effects[]` |
| `DefaultCharacter` | `characters/default.ts` | 按 catalog 默认施法 |
| `Sparkle` | `characters/sparkle.ts` | 花火战技：队友 buff + 拉条 |
| `EquipLoadout` | `equipment/` | 光锥 / 遗器 reconcile |
| `TeamContext` | `team-context.ts` | 战技点等队伍共享资源 |
| `ActionEffect` | `../effects/` | 战斗 effect 类（DamageEffect、BuffEffect 等） |
| `calcDamage` | `../damage/calc.ts` | L3 伤害公式 |
| `CombatPlugin` | `types.ts` | trace / 被动 modifier 插件 |
| `Battle` | `../simulation/battle.ts` | 本地仿真入口 |

## 注册特化角色

在 `actor-factory.ts` 的 `characterClasses` 映射里添加子类即可，例如花火：

```typescript
const characterClasses = {
  花火: Sparkle,
};
```

## 对外入口

- `engine/pipeline.ts` — `runBattle` / `evaluateCharacterDamage` / `aggregateStats`
