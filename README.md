# battle-simulator

星铁本地战斗模拟器：单次伤害、行动轴 DPR、全战斗模拟。

## 快速开始

```bash
cd projects/battle-simulator
npm install
npm test
npm run calc -- install.yaml
```

## 数据

- `data/` — 结构化角色/光锥/遗器/敌人数据（L0）
- 仓库根目录 `../../raw_data/` — 原始公式与机制参考文档

从 [bwiki-scraper](../bwiki-scraper/) 同步 BWIKI catalog：

```bash
npm run import:bwiki
# 或指定数据源目录：
npm run import:bwiki -- ../bwiki-scraper/data
npm run import:bwiki -- /path/to/bwiki/data
```

## 引擎结构

| 目录 | 说明 |
|------|------|
| `engine/damage/` | L3 伤害公式 |
| `engine/stat/`, `engine/buff/` | L1/L2 面板与静态 buff |
| `engine/timeline/` | L4 行动轴 |
| `engine/team/` | L5 队伍 DPR |
| `engine/combat/` | L6 全战斗模拟 |
| `engine/runtime/` | 组合式运行时（角色 + 光锥/遗器插件 + Battle） |

## 配置示例

见 `install.yaml`。
