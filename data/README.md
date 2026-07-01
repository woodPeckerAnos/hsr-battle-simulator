# L0 数据层

结构化游戏实体，供引擎加载。

原始参考文档在仓库根目录 [`../../raw_data/`](../../raw_data/)（公式、机制解析等）。

## 数据来源

角色、光锥、遗器套装基础数据来自 [hsr-optimizer](https://github.com/nocoday/hsr-optimizer) 的 `game_data.json`，通过导入脚本同步：

```bash
npm run import:hsr
# 或指定路径：
npm run import:hsr -- /path/to/hsr-optimizer-main/src/data/game_data.json
```

导入后生成：
- `characters/{gameId}.json` — 92 个已发布角色
- `light_cones/{gameId}.json` — 162 个已发布光锥
- `relic_sets/{gameId}.json` — 60 个遗器/位面饰品套装
- `catalog.json` — 索引与 slug 别名

## ID 约定

| 字段 | 说明 |
|------|------|
| `id` / `gameId` | 游戏内 ID（如 `1212` = 镜流） |
| `slug` | 英文名 kebab-case（如 `jingliu`） |
| `catalog.json` → `aliases` | 兼容旧 slug 引用 |

`install.yaml` 中可使用 `1212`、`jingliu` 或 `Jingliu` 对应的 slug/id。

## 手工覆盖

| 文件 | 用途 |
|------|------|
| `character_skill_overrides.json` | 技能倍率与机制（按 gameId） |
| `light_cone_passive_overrides.json` | 光锥被动效果（JSON 中仅有叠影数值） |
| `enemies/` | 敌人仍手工维护 |

## Schema

见 `schemas/` 目录。
