# Fork 维护手册：分歧地图与上游同步

本仓库是 [LingyiChen-AI/JadeAI](https://github.com/LingyiChen-AI/JadeAI) 的 fork，由 holtwood-projects 维护，聚焦 Docker Web 部署（已移除桌面客户端）。本文回答两个问题：**fork 与上游的差异在哪里**、**如何安全地同步上游**。

## 1. 分歧概况

- 上游地址：`https://github.com/LingyiChen-AI/JadeAI`，本地 remote 名为 `upstream`。
- 最近同步：2026-10-04 → 上游 `aca6fbb`（本仓库 merge `b7402d5`）。此后上游 main 无新提交。
- 截至 2026-10-04 同步（v0.7.0）：fork 领先上游约百个提交（精确值用 `git rev-list --count upstream/main..main` 查询）。
- 版本约定：fork 与上游**共享版本号**（当前 v0.7.0），tag 指向上游对应版本的基线提交（origin 上亦如此），fork 自身增量只在 main 上；仓库不创建 GitHub Release，Docker 镜像从 main HEAD 构建。
- 定位差异：fork 删除 Electron 桌面客户端及 `desktop-release.yml`，新增/重写 Docker 构建运行链、GitHub Pages 站点、CI 工作流、PDF 分页策略与主题系统等。

## 2. 自有模块（零冲突区）

fork 的改动应尽量落在独立的新文件中——以下位置为 fork 自有，上游不会改动，合并时天然无冲突：

- `src/lib/pdf/pagination-strategy.ts` 及配套回归测试
- `src/lib/resume-theme/`、`src/lib/resume-section/`、`src/lib/resume-template-shared/`
- `src/lib/rate-limit.ts`
- `scripts/`（`build-export-css.ts`、`docker-smoke.sh`、`verify-release.sh` 等）
- `.github/workflows/ci.yml`、`pages.yml`、`upstream-sync.yml`（上游为 `publish.yml`、`desktop-release.yml`）
- `Dockerfile`、`docker_run_local.sh`、`docker_publish.sh`、`pages-site/`
- `changelog/`、`docs/`（含本文件）、`AGENTS.md`

**给贡献者的约定**：新增功能优先建新文件/新模块；必须改动上游共享文件时，改动尽量小而集中，并对照第 3 节评估冲突影响。

## 3. 共享热点文件（常驻冲突点与处理策略）

每次合并按下表机械执行，不要临场重新决策：

| 路径 | 上游状态 | fork 状态 | 合并策略 |
| --- | --- | --- | --- |
| `README.md` | 持续更新 | 已完全重写 | 保留 fork（`git checkout --ours`） |
| `README.zh-CN.md` | 存在且仍会改动 | 已删除 | `git rm`，保持删除 |
| `.gitignore` | `.superpowers/*` 写法 | `.superpowers/` 写法 | 保留 fork |
| `electron/` | main 仍在开发，另有 `desktop` 分支 | 已整体删除 | 保持删除；若合并后目录重现，`git rm -r electron` |
| `src/middleware.ts` | 存在 | 已改名 `src/proxy.ts` | 保留改名；上游对 middleware 的实质修改需手工对照移植到 `proxy.ts` |
| `package.json` | `version: 0.1.0`（上游不随 tag 更新，版本靠 tag 标记） | 与上游共享版本号 + fork 仓库元数据 | 保留 fork |
| `pnpm-lock.yaml` | 随上游依赖变化 | 可能双方都变 | 合并后必须 `pnpm install --frozen-lockfile` 校验，失败则按上游语义重新生成并回归测试 |
| `messages/zh.json`、`en.json` | 会新增 key | fork 也频繁修改 | 通常自动合并；合并后用 `node -e "JSON.parse(...)"` 之类校验 JSON 合法 |
| `.github/workflows/issue-spam-guard.yml` | 同名文件 | fork 自有版本 | 保留 fork |

维护者本机 Git 已开启 `git rerere`（`~/.gitconfig` 全局配置；解决方案缓存 `.git/rr-cache` 也只存本机），2026-10-04 的合并已记录 README.md 与 .gitignore 的解决方案，本机重复冲突会自动复用。注意：CI 与其他机器上 rerere **不生效**——需在该环境执行 `git config rerere.enabled true` 并重新积累缓存，或按本表手工处理。

## 4. 已拒绝的上游内容（避免重复评估）

- **LaunchAI 推广徽章**（上游 `ac7bf23`、`9d95236`，及 `ef3e3af` 中 footer 部分）：上游作者为其关联产品导流。徽章硬编码 `#1f2a24`、`#f8f8f6` 等色值，违反本仓库「主题色必须用语义化 `--brand-*` token」的约束，且引入对 `launchai.tools` 的外部图片依赖。合并后如发现 `launchai` 字样一律剔除：`grep -ri launchai src/ messages/ README.md`。
- **`.gitignore` 的 `.superpowers/*` 写法**：与 fork 现有 `.superpowers/` 语义等价，无需采纳。

## 5. tag 与版本号事实（2026-10-04 全量普查）

- 上游 tag 已发布到 **v0.7.0**（2026-08-26），并非停留在 v0.3.x；上游 v0.4.0–v0.7.0 是 annotated tag。
- 本 fork 与上游共享版本号：本地与 origin 的 `v0.4.0`–`v0.7.0` 指向上游对应版本的提交（如 `v0.7.0` → 上游 `1d8d7b6`），tag 仅作上游基线标记，不创建 Release。
- 上游 v0.3.1–v0.3.4 与 v0.4.0–v0.7.0 的提交在 fork 历史内；v0.0.1–v0.3.0 的早期 tag 指向 fork 历史之外的提交（早期仓库脉络不同），仅作参考。

本地 `upstream` remote 配置了命名空间化的 fetch refspec，上游 tag 一律落在 `refs/tags/upstream/*`，永不触碰全局命名空间的同名 tag（v0.4.0–v0.7.0 同名同目标，若被强制覆盖会破坏基线标记）：

```
+refs/heads/*:refs/remotes/upstream/*
+refs/tags/*:refs/tags/upstream/*
```

推送防护：本仓库已本地设置 `push.followTags false`（覆盖维护者全局的 `true`）——上游 v0.4.0–v0.7.0 是 annotated tag 且目标提交可达，若不关闭，`git push` 会把 `upstream/*` 命名空间 tag 推到 origin 造成污染。同样**不要**对 origin 使用 `git push --tags`。

新克隆仓库后执行一次即可：

```bash
git remote add upstream https://github.com/LingyiChen-AI/JadeAI.git
git config --replace-all remote.upstream.fetch '+refs/heads/*:refs/remotes/upstream/*'
git config --add remote.upstream.fetch '+refs/tags/*:refs/tags/upstream/*'
git config push.followTags false
```

## 6. 标准同步流程

```bash
# 1. 拉取上游，查看落后多少
git fetch upstream
git rev-list --count HEAD..upstream/main
git log --oneline HEAD..upstream/main   # 逐条浏览，先想好采纳/拒绝

# 2. 合并（用 merge，不要 rebase——fork 历史已发布）
git merge upstream/main

# 3. 按第 3 节表格解决冲突；按第 4 节剔除推广内容

# 4. 全量校验（与 CI 一致）
pnpm install --frozen-lockfile
pnpm lint && pnpm type-check && pnpm test
DB_TYPE=sqlite SQLITE_PATH=":memory:" pnpm build

# 5. （改动涉及依赖、导出或 Docker 相关时）镜像级冒烟
pnpm docker:build && pnpm docker:smoke

# 6. 确认推广内容未混入
grep -ri launchai src/ messages/ README.md

# 7. 合并提交写明采纳/拒绝了什么；用户可见变化写入 CHANGELOG.md [Unreleased]
```

**本地环境备注**：`.agents/`、`agent/`、`data/`、`.worktrees/` 是 gitignored 的 AI 工具目录。它们已被 `tsconfig.json` 的 `exclude` 与 `eslint.config.mjs` 的 `globalIgnores` 排除，`pnpm lint` / `type-check` / `build` 不再受其影响（CI 全新检出本来也看不到这些目录）。若日后新增 AI 工具目录，同步扩展这两处列表。

## 7. 同步检查自动化

`.github/workflows/upstream-sync.yml` 每周一（UTC）自动运行：fetch 上游 → 统计领先提交数 → 若有新提交且不存在未关闭的提醒 issue，则自动创建「上游同步提醒」issue（附新提交清单与本手册链接）；无新提交时不产生任何动静。支持在 Actions 页面手动触发（workflow_dispatch）。

提醒 issue 依赖仓库的 Issues 功能：holtwood-projects/JadeAI 已于 2026-10-04 开启（GitHub fork 默认关闭 Issues；其他仓库复用本 workflow 前需在 Settings → General → Features 勾选 Issues，否则 `gh issue create` 会失败）。提醒正文由 `printf` 参数生成，上游提交信息即使含反引号等字符也只会按字面渲染，无命令注入风险。

**启用前提（重要）**：GitHub fork 上定时 workflow **默认禁用**——推送后需在 Actions 页找到 Upstream Sync Check 手动 Enable；另外仓库 60 天无活动时 GitHub 会自动停用定时任务，届时同样在 Actions 页重新启用。
