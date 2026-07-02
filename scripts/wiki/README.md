# Wiki 数据对接

BWIKI 详细数据由 [`bwiki-scraper`](../../bwiki-scraper/) 抓取，经 `npm run import:bwiki` 转换为 battle-simulator 的 L0 catalog。

```bash
# 默认从 ../bwiki-scraper/data 导入
npm run import:bwiki

# 指定任意已爬取的数据目录
npm run import:bwiki -- /path/to/bwiki/data
```

导入脚本：`scripts/import-from-bwiki.ts`
