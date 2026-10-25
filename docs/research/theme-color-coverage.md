# 主题色覆盖矩阵（导出端，标题 h1–h3）

> 由 `node --import tsx scripts/audit-theme-coverage.ts` 生成于 2026-10-25。判定规则见脚本头部注释。

**汇总**：50 套模板中，11 套存在内联色标题（主题色对它们不生效）：two-column、elegant、developer、medical、coder、neon、japanese、luxe、teacher、sidebar、mosaic。

| 模板 | 标题数 | 内联色（固定） | 无内联（跟随主题） |
| --- | --- | --- | --- |
| classic | 4 | 0 | 4 |
| modern | 4 | 0 | 4 |
| minimal | 4 | 0 | 4 |
| professional | 4 | 0 | 4 |
| two-column | 4 | 2 | 2 |
| creative | 4 | 0 | 4 |
| ats | 4 | 0 | 4 |
| academic | 4 | 0 | 4 |
| elegant | 4 | 1 | 3 |
| executive | 4 | 0 | 4 |
| developer | 4 | 4 | 0 |
| designer | 4 | 0 | 4 |
| startup | 4 | 0 | 4 |
| formal | 4 | 0 | 4 |
| infographic | 4 | 0 | 4 |
| compact | 4 | 0 | 4 |
| euro | 4 | 0 | 4 |
| clean | 4 | 0 | 4 |
| bold | 4 | 0 | 4 |
| timeline | 4 | 0 | 4 |
| nordic | 4 | 0 | 4 |
| corporate | 4 | 0 | 4 |
| consultant | 4 | 0 | 4 |
| finance | 4 | 0 | 4 |
| medical | 4 | 4 | 0 |
| gradient | 4 | 0 | 4 |
| metro | 1 | 0 | 1 |
| material | 4 | 0 | 4 |
| coder | 4 | 4 | 0 |
| blocks | 4 | 0 | 4 |
| magazine | 4 | 0 | 4 |
| artistic | 4 | 0 | 4 |
| retro | 4 | 0 | 4 |
| neon | 4 | 4 | 0 |
| watercolor | 4 | 0 | 4 |
| swiss | 4 | 0 | 4 |
| japanese | 4 | 4 | 0 |
| berlin | 4 | 0 | 4 |
| luxe | 4 | 1 | 3 |
| rose | 4 | 0 | 4 |
| architect | 4 | 0 | 4 |
| legal | 4 | 0 | 4 |
| teacher | 4 | 3 | 1 |
| scientist | 4 | 0 | 4 |
| engineer | 4 | 0 | 4 |
| sidebar | 4 | 2 | 2 |
| card | 4 | 0 | 4 |
| zigzag | 4 | 0 | 4 |
| ribbon | 4 | 0 | 4 |
| mosaic | 4 | 4 | 0 |

## 第三批迁移记录（2026-10-25）

- **全量迁移 16 套中性深色标题模板**（预览+导出两侧）：executive、timeline、nordic、corporate、consultant、finance、metro、blocks、magazine、artistic、swiss、berlin、scientist、engineer、card、zigzag。矩阵 27→11。
- **新发现的预览↔导出漂移（japanese，未迁）**：预览端 h1/h2/h3 全用 `PRIMARY #1c1917`，导出端 h1 用 `PRIMARY` 但 h2 用 `ACCENT #a8a29e`，且两侧 `ACCENT` 值不同（预览 #44403c / 导出 #a8a29e）——同一简历分节标题在编辑器与 PDF 中颜色不同。需先对齐两侧色板（对照上游设计意图）再迁移。
- **剩余 11 套**：4 套为设计性保留（elegant 姓名中性色、luxe 姓名/条目中性色、teacher/medical 药丸式标题）；7 套需先扩展主题契约（coder/developer/mosaic 多色语义、neon/two-column/sidebar 深色背景对比度防护、japanese 两侧对齐）。
- timeline 导出端函数作用域内的孤儿 `BG` 常量已清理；swiss 导出快照随迁移更新。
