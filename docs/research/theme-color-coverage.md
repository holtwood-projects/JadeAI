# 主题色覆盖矩阵（导出端，标题 h1–h3）

> 由 `node --import tsx scripts/audit-theme-coverage.ts` 生成于 2026-10-25。判定规则见脚本头部注释。

**汇总**：50 套模板中，7 套存在内联色标题（主题色对它们不生效）：elegant、medical、coder、japanese、luxe、teacher、mosaic。

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
| medical | 4 | 4 | 0 |
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
| teacher | 4 | 3 | 1 |
| scientist | 4 | 0 | 4 |
| engineer | 4 | 0 | 4 |
| sidebar | 4 | 0 | 4 |
| card | 4 | 0 | 4 |
| zigzag | 4 | 0 | 4 |
| ribbon | 4 | 0 | 4 |
| mosaic | 4 | 4 | 0 |

## 第四批：主题契约扩展 + 收官（2026-10-25）

### 契约扩展（三项，均服务端计算、预览与导出同源）

1. **`--theme-accent-color` 激活**：accent 槽位本就有取色器与预设支持，新增 `TEMPLATE_ACCENT_DEFAULTS`（coder 蓝 / sidebar 蓝 / developer 绿）按模板填充第二身份色，用户显式设置优先。
2. **`--theme-primary/accent-safe-on-dark`**：深色面标题专用。注入时计算相对亮度，低于 0.45 则向白阶梯混合（20%/步，最多 5 步）直至可读（≈8:1 on #0d1117）。
3. **`--theme-primary/accent-alpha-{60,40,20,08,05}`**：主/辅色的透明度变体（hex+alpha 后缀拼接），供辉光、渐变线、边框消费。

### 六套模板映射

| 模板 | primary 默认 | accent 默认 | 说明 |
| --- | --- | --- | --- |
| two-column | #1a1a2e | — | 浅色主栏正常迁移（边框同色跟随） |
| sidebar | #1e40af | #3b82f6 | 主栏标题走 primary、边框走 accent |
| coder | #3fb950 | #58a6ff | 侧栏姓名/标题用 safe-on-dark；主栏中性标题保留；`$` 终端提示符为固定装饰 |
| developer | #e5c07b | #98c379 | 分节标题 primary、姓名 accent；浅色终端风无需 safe 变体 |
| neon | #22d3ee | — | 标题+辉光+分隔线全部 safe-on-dark/alpha 变体；VIOLET 保持固定 |
| japanese | #a8a29e | — | 先按导出侧对齐预览（含 h2 字号/字重与 ACCENT 色值，上游即漂移），再迁移 |

### 收官状态

剩余 7 套均为文档化设计决策，非遗漏：elegant/luxe/japanese 姓名中性色、coder 主栏中性标题、teacher/medical 药丸式标题（背景色+白字，对比度防护需进一步设计）、mosaic 循环色板（四色按分节轮换，单一主题色无法表达）。50 套中 43 套标题跟随主题（36 迁移 + 7 原生）+ 3 套部分跟随。
