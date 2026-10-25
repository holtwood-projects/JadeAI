# 主题色覆盖矩阵（导出端，标题 h1–h3）

> 由 `node --import tsx scripts/audit-theme-coverage.ts` 生成于 2026-10-25。判定规则见脚本头部注释。

**汇总**：50 套模板中，6 套存在内联色标题（主题色对它们不生效）：elegant、medical、coder、japanese、luxe、mosaic。

| 模板 | 标题数 | 内联色（固定） | 无内联（跟随主题） |
| --- | --- | --- | --- |
| classic | 4 | 0 | 4 |
| modern | 4 | 0 | 4 |
| minimal | 4 | 0 | 4 |
| professional | 4 | 0 | 4 |
| two-column | 4 | 0 | 4 |
| creative | 4 | 0 | 4 |
| ats | 4 | 0 | 4 |
| academic | 4 | 0 | 4 |
| elegant | 4 | 1 | 3 |
| executive | 4 | 0 | 4 |
| developer | 4 | 0 | 4 |
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
| medical | 4 | 1 | 3 |
| gradient | 4 | 0 | 4 |
| metro | 1 | 0 | 1 |
| material | 4 | 0 | 4 |
| coder | 4 | 2 | 2 |
| blocks | 4 | 0 | 4 |
| magazine | 4 | 0 | 4 |
| artistic | 4 | 0 | 4 |
| retro | 4 | 0 | 4 |
| neon | 4 | 0 | 4 |
| watercolor | 4 | 0 | 4 |
| swiss | 4 | 0 | 4 |
| japanese | 4 | 1 | 3 |
| berlin | 4 | 0 | 4 |
| luxe | 4 | 1 | 3 |
| rose | 4 | 0 | 4 |
| architect | 4 | 0 | 4 |
| legal | 4 | 0 | 4 |
| teacher | 4 | 0 | 4 |
| scientist | 4 | 0 | 4 |
| engineer | 4 | 0 | 4 |
| sidebar | 4 | 0 | 4 |
| card | 4 | 0 | 4 |
| zigzag | 4 | 0 | 4 |
| ribbon | 4 | 0 | 4 |
| mosaic | 4 | 4 | 0 |

## 第五批：药丸式标题主题化（2026-10-25）

- **机制**：注入 `--theme-primary/accent-contrast-text`（填充面文字色，亮度 ≥0.5 自动切深字 `#111827`，否则白字）。teacher/medical 药丸标题背景改走 `var(--theme-primary-color)`、文字走 contrast-text，移除 text-white——默认外观不变（深底白字），用户选浅色时自动深字。
- **medical 姓名保留内联 TEAL_800**（深青姓名调，同 elegant/luxe/japanese 的中性色保留模式）；teacher 药丸迁移后标题全量跟随。
- 矩阵 7→6，剩余全部为文档化设计决策（elegant/luxe/japanese 姓名中性色、coder 主栏中性标题、medical 姓名深青、mosaic 循环色板）。
- 同批清理：buildThemeCss 遗留死分支（templateSafeVariables=false 路径，唯一消费者是断言其行为的测试，已改写为现行分支断言）；isDark 改为复用 relativeLuminance。
