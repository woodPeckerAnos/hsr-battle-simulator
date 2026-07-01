# Wiki 角色数据爬虫（预留）

后续将从 wiki 页面爬取并补全：

- 技能倍率、多段 hit、韧性伤害
- 被动/行迹/星魂机制描述
- 光锥被动完整逻辑

## 计划输出

爬取结果建议写入：

```
data/wiki/raw/          # 原始 HTML/Markdown
data/wiki/parsed/       # 结构化 JSON（待定义 schema）
```

并通过脚本合并到：

- `data/character_skill_overrides.json`（短期）
- 或 `behaviors/characters/{gameId}.ts`（长期）

## 当前状态

**尚未实现**。Catalog 基础数值仍来自 `npm run import:hsr`（hsr-optimizer）。

你提供 wiki 源与字段需求后，在此目录添加 `crawl.ts` 与解析规则。
