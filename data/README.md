# L0 数据层

结构化游戏实体，供引擎加载。

原始参考文档在仓库根目录 [`../../raw_data/`](../../raw_data/)（公式、机制解析等）。

## 数据来源

角色、光锥、遗器套装来自 [bwiki-scraper](../bwiki-scraper/) 爬取的 BWIKI 数据，通过导入脚本同步：

```bash
npm run import:bwiki
# 或指定目录：
npm run import:bwiki -- ../bwiki-scraper/data
npm run import:bwiki -- /path/to/custom/bwiki/data
```

导入后生成：
- `characters/{slug}.json` — Wiki 标题 slug（如 `镜流.json`）
- `light_cones/{slug}.json`
- `relic_sets/{slug}.json`
- `catalog.json` — 索引与别名

## ID 约定

| 字段 | 说明 |
|------|------|
| `id` / `slug` | BWIKI 条目 slug（通常为中文 Wiki 标题） |
| `gameId` | Wiki `page_id`（字符串） |
| `catalog.json` → `aliases` | 兼容旧英文 slug（如 `jingliu` → `镜流`） |

`install.yaml` 中可使用 `镜流`、`jingliu` 或别名。

## 手工覆盖

| 文件 | 用途 |
|------|------|
| `character_skill_overrides.json` | 技能倍率与机制（按 slug） |
| `light_cone_passive_overrides.json` | 光锥被动效果（结构化 modifier） |
| `enemies/` | 敌人仍手工维护（如 `dummy` / `木桩` 无行动木桩） |

## Schema

见 `schemas/` 目录。
