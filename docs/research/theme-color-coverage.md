# 主题色覆盖矩阵（导出端，标题 h1–h3）

> 由 `node --import tsx scripts/audit-theme-coverage.ts` 生成于 2026-10-25。判定规则见脚本头部注释。

**汇总**：50 套模板中，27 套存在内联色标题（主题色对它们不生效）：two-column、elegant、executive、developer、timeline、nordic、corporate、consultant、finance、medical、metro、coder、blocks、magazine、artistic、neon、swiss、japanese、berlin、luxe、teacher、scientist、engineer、sidebar、card、zigzag、mosaic。

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
| executive | 4 | 3 | 1 |
| developer | 4 | 4 | 0 |
| designer | 4 | 0 | 4 |
| startup | 4 | 0 | 4 |
| formal | 4 | 0 | 4 |
| infographic | 4 | 0 | 4 |
| compact | 4 | 0 | 4 |
| euro | 4 | 0 | 4 |
| clean | 4 | 0 | 4 |
| bold | 4 | 0 | 4 |
| timeline | 4 | 4 | 0 |
| nordic | 4 | 4 | 0 |
| corporate | 4 | 3 | 1 |
| consultant | 4 | 4 | 0 |
| finance | 4 | 3 | 1 |
| medical | 4 | 4 | 0 |
| gradient | 4 | 0 | 4 |
| metro | 1 | 1 | 0 |
| material | 4 | 0 | 4 |
| coder | 4 | 4 | 0 |
| blocks | 4 | 4 | 0 |
| magazine | 4 | 4 | 0 |
| artistic | 4 | 3 | 1 |
| retro | 4 | 0 | 4 |
| neon | 4 | 4 | 0 |
| watercolor | 4 | 0 | 4 |
| swiss | 4 | 4 | 0 |
| japanese | 4 | 4 | 0 |
| berlin | 4 | 3 | 1 |
| luxe | 4 | 1 | 3 |
| rose | 4 | 0 | 4 |
| architect | 4 | 0 | 4 |
| legal | 4 | 0 | 4 |
| teacher | 4 | 3 | 1 |
| scientist | 4 | 4 | 0 |
| engineer | 4 | 3 | 1 |
| sidebar | 4 | 2 | 2 |
| card | 4 | 4 | 0 |
| zigzag | 4 | 4 | 0 |
| ribbon | 4 | 0 | 4 |
| mosaic | 4 | 4 | 0 |

## 第二批迁移记录（2026-10-25）

- **全量迁移 13 套**（标题内联色 → `var(--theme-primary-color)`，预览+导出两侧）：creative、designer、startup、formal、euro、clean、material、retro（含标题边框线）、gradient、watercolor、rose、architect、legal。矩阵 40→27。
- **部分迁移 2 套**：teacher（仅 h1；h2 为彩色药丸背景+白字，见下）、luxe（h2 金色；h1/h3 中性色保留）。
- **药丸式标题（teacher/medical）不迁**：标题文本为白字置于彩色背景上，跟随主题色会产生浅底白字的对比度风险，且背景属装饰层而非文字色插槽；待主题契约支持对比度防护后再迁。
- **多色板与深色背景模板仍待迁**：coder/developer/mosaic（多色语义）、neon/two-column/sidebar（深色背景对比度）、以及 13 套中性深色标题模板（executive/finance/engineer 等，机制上可直接机械迁移，留作第三批）。
