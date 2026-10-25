# 主题色覆盖矩阵（导出端，标题 h1–h3）

> 由 `node --import tsx scripts/audit-theme-coverage.ts` 生成于 2026-10-25。判定规则见脚本头部注释。

**汇总**：50 套模板中，40 套存在内联色标题（主题色对它们不生效）：two-column、creative、elegant、executive、developer、designer、startup、formal、euro、clean、timeline、nordic、corporate、consultant、finance、medical、gradient、metro、material、coder、blocks、magazine、artistic、retro、neon、watercolor、swiss、japanese、berlin、luxe、rose、architect、legal、teacher、scientist、engineer、sidebar、card、zigzag、mosaic。

| 模板 | 标题数 | 内联色（固定） | 无内联（跟随主题） |
| --- | --- | --- | --- |
| classic | 4 | 0 | 4 |
| modern | 4 | 0 | 4 |
| minimal | 4 | 0 | 4 |
| professional | 4 | 0 | 4 |
| two-column | 4 | 2 | 2 |
| creative | 4 | 3 | 1 |
| ats | 4 | 0 | 4 |
| academic | 4 | 0 | 4 |
| elegant | 4 | 1 | 3 |
| executive | 4 | 3 | 1 |
| developer | 4 | 4 | 0 |
| designer | 4 | 3 | 1 |
| startup | 4 | 3 | 1 |
| formal | 4 | 4 | 0 |
| infographic | 4 | 0 | 4 |
| compact | 4 | 0 | 4 |
| euro | 4 | 4 | 0 |
| clean | 4 | 4 | 0 |
| bold | 4 | 0 | 4 |
| timeline | 4 | 4 | 0 |
| nordic | 4 | 4 | 0 |
| corporate | 4 | 3 | 1 |
| consultant | 4 | 4 | 0 |
| finance | 4 | 3 | 1 |
| medical | 4 | 4 | 0 |
| gradient | 4 | 3 | 1 |
| metro | 1 | 1 | 0 |
| material | 4 | 3 | 1 |
| coder | 4 | 4 | 0 |
| blocks | 4 | 4 | 0 |
| magazine | 4 | 4 | 0 |
| artistic | 4 | 3 | 1 |
| retro | 4 | 4 | 0 |
| neon | 4 | 4 | 0 |
| watercolor | 4 | 4 | 0 |
| swiss | 4 | 4 | 0 |
| japanese | 4 | 4 | 0 |
| berlin | 4 | 3 | 1 |
| luxe | 4 | 4 | 0 |
| rose | 4 | 4 | 0 |
| architect | 4 | 4 | 0 |
| legal | 4 | 4 | 0 |
| teacher | 4 | 4 | 0 |
| scientist | 4 | 4 | 0 |
| engineer | 4 | 3 | 1 |
| sidebar | 4 | 2 | 2 |
| card | 4 | 4 | 0 |
| zigzag | 4 | 4 | 0 |
| ribbon | 4 | 0 | 4 |
| mosaic | 4 | 4 | 0 |

## 首批迁移记录（2026-10-25）

- **机制**：`mergeThemeConfig(theme, template?)` 新增按模板默认色表 `TEMPLATE_PRIMARY_DEFAULTS`——用户未显式设置主色时用模板身份色，显式设置（取色器/预设）永远优先；预览、PDF/HTML 导出与主题编辑器均已接入。
- **已迁移**（标题内联色 → `var(--theme-primary-color)`，预览与导出两侧同步）：modern（`#e94560`，矩阵归零）、professional（`#1e3a5f`，归零）、elegant（金 `#d4af37`；姓名 h1 的中性色 `#2c2c2c` 刻意保留内联）。未设置主题色时外观不变，设置后标题跟随。
- **条目级装饰色（职位名/公司名/技能标签等）刻意保留内联**：它们是模板版式细节而非主题插槽，主题系统（h1–h3 + h2 下边线）本就不作用于它们。
- **coder 等多色板模板未迁**：单一 primary 变量无法表达其多色语义，需先扩展主题契约（如按模板多插槽）再迁。
- 判定规则更新：内联 `color:var(--theme-primary-color)` 计为「跟随主题」（显式接线），仅内联字面色计为「固定」。
