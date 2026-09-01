# dsh-deepcanary

[![CI](https://github.com/Oscar-Williams/dsh-deepcanary/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/Oscar-Williams/dsh-deepcanary/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-2ea44f.svg)](LICENSE)

> 让 DSH 在真正需要你判断时提醒你。

`dsh-deepcanary` 是面向 [DeepSeek Harness（DSH）](https://github.com/deepseek-ai/deepseek-harness) 的本地注意力监督插件。它读取 Session、Tool、Agent、Subagent 和 Host 的结构化运行时事实，经过确定性策略判断哪些事件应当保持安静、进入 Inbox，或提醒用户处理。

## 版本与兼容性

**已发布版本**：公开插件 tag 为 `v0.1.0-rc.2`，对应提交 `4ae7c2bb577d7a2b855f425a8e3fde7800a9feb2`。该版本已在官方 DSH `dsh-v0.1.2-alpha.2` 上完成发布验证，日常安装请使用下面的“已发布版本”路径。

**最新代码**：`main` 已在官方 DSH `dsh-v0.1.2-alpha.3` 固定版本标签（commit `dd6322d604e00eec1ba5e0c8541159906a21094a`）上完成本地兼容性验证，公开 CI 也已通过 Web UI 浏览器验收（[CI 工作流](https://github.com/Oscar-Williams/dsh-deepcanary/actions/workflows/ci.yml)）。新的公开插件 tag 尚未建立；需要验证最新代码时，请使用下面的“验证最新代码”路径和独立测试配置。

`v0.1.0-rc.1` 和 npm `0.1.1-rc.2` 仅用于历史复现，不属于本仓库当前的安装或测试基线。测试前请先停止 DSH，移除测试配置中的旧插件，再安装目标版本。

## 能解决什么问题

DeepCanary 只回答一个问题：当前是否值得用户看一眼？它不重新编排 Agent，也不替 DSH 执行高影响操作。

- 观察 Human Needed、Host 不可达、疑似停滞、工具失败循环、无有效进展、Subagent 压力、Context 压力和任务完成信号；
- 用 C0–C3 注意力等级、去重窗口、Decision Bundle 和小时预算压缩提醒噪声；
- 在 DSH Web 页面默认只显示侧栏入口；面板按需打开，可关闭、再次唤起、用鼠标或键盘缩放，并跟随 DSH 的中英文设置；
- 在面板中提供 Inbox、设置卡片和证据摘要；
- 支持确认、稍后提醒、静音、有效性反馈以及跳转提示；
- 仅提供本地元数据操作和 DSH 导航提示，不会终止或重启任务，不会自动批准或拒绝请求，也不执行任意命令。

核心原则是“证据先于升级”：C3 必须有 Host 或 Runtime 权威证据，模型判断不是本 RC 的必要依赖。

## 安装和启动

下面提供两条清晰路径：已发布版本适合日常使用；最新代码适合参与测试或开发。

### 环境要求

- Windows x64 或 WSL2 Ubuntu；
- Node.js `22.19+`（本次 RC 验证使用 Node.js `24.19.0`）；
- pnpm `11.7.0`；
- 已安装官方 DSH 源码运行时；已发布版本使用 `dsh-v0.1.2-alpha.2`，最新代码验证使用 `dsh-v0.1.2-alpha.3`。

### 已发布版本：v0.1.0-rc.2

#### 1. 准备官方 DSH alpha.2

```powershell
git clone --depth 1 --branch dsh-v0.1.2-alpha.2 https://github.com/deepseek-ai/deepseek-harness.git dsh-runtime-alpha2
Set-Location .\dsh-runtime-alpha2
npx --yes pnpm@11.7.0 install
npx --yes pnpm@11.7.0 run build
npx --yes pnpm@11.7.0 dsh --version
git rev-parse HEAD
```

版本命令应输出 `0.1.2-alpha.2`，commit 命令应输出 `0a53fb55bea101816fa226bb964ae2bed71c343b`。官方发布页：[dsh-v0.1.2-alpha.2](https://github.com/deepseek-ai/deepseek-harness/releases/tag/dsh-v0.1.2-alpha.2)。已有本地 checkout 即使目录名仍为 `dsh-runtime-alpha1`，也必须先确认 tag、commit 和 `dsh --version` 均符合上述值。

#### 2. 安装插件

正式安装请使用已独立验证的不可变 tag `v0.1.0-rc.2`。不要把本地源码目录或包含个人设计资料的目录作为正式安装来源。

```powershell
Set-Location .\dsh-runtime-alpha2
npx --yes pnpm@11.7.0 dsh plugin --profile web add https://codeload.github.com/Oscar-Williams/dsh-deepcanary/tar.gz/refs/tags/v0.1.0-rc.2
npx --yes pnpm@11.7.0 dsh --profile web --dump-config
npx --yes pnpm@11.7.0 dsh web --no-open
```

启动后，在同一台机器的浏览器打开 DSH Web 页面。成功安装 RC.2 后，客户端通过 alpha.2 的客户端模块机制加载，默认不会遮挡页面，点击侧栏入口后才打开浮动 Inbox。浏览器通知权限被拒绝时，面板和模型可见工具仍然可用。

更新已安装的 RC 时，先清理旧配置或执行：

```powershell
npx --yes pnpm@11.7.0 dsh plugin --profile web update dsh-deepcanary
```

### 验证最新代码：官方 DSH alpha.3

最新代码验证必须使用官方 DSH `dsh-v0.1.2-alpha.3`。以下命令使用单独的 DSH 目录和测试配置；请将 `$pluginDir`、`$dshDir` 改为本机路径。

```powershell
$pluginDir = 'C:\path\to\dsh-deepcanary'
$dshDir = 'C:\path\to\dsh-runtime-alpha3'
$testHome = Join-Path $env:USERPROFILE '.dsh-deepcanary-test'

git clone --depth 1 --branch dsh-v0.1.2-alpha.3 https://github.com/deepseek-ai/deepseek-harness.git $dshDir
Set-Location $dshDir
npx --yes pnpm@11.7.0 install --frozen-lockfile
npx --yes pnpm@11.7.0 run build
npx --yes pnpm@11.7.0 dsh --version
git rev-parse HEAD

Set-Location $pluginDir
npm ci
npm run build
$packDir = Join-Path $env:TEMP 'dsh-deepcanary-local-pack'
New-Item -ItemType Directory -Force $packDir | Out-Null
npm pack --pack-destination $packDir
$packageVersion = (Get-Content .\package.json | ConvertFrom-Json).version
$tarball = Join-Path $packDir "dsh-deepcanary-$packageVersion.tgz"

Set-Location $dshDir
$env:DSH_HOME = $testHome
npx --yes pnpm@11.7.0 dsh plugin --profile web remove dsh-deepcanary
npx --yes pnpm@11.7.0 dsh plugin --profile web add $tarball
npx --yes pnpm@11.7.0 dsh --profile web --dump-config
npx --yes pnpm@11.7.0 dsh web --no-open
```

`dsh --version` 应输出 `0.1.2-alpha.3`，`git rev-parse HEAD` 应输出 `dd6322d604e00eec1ba5e0c8541159906a21094a`。本地压缩包的包版本在新的公开候选版本建立前仍可能显示 `0.1.0-rc.2`；它只用于独立测试，不代表重新发布了历史 RC.2。开始 Web UI 手测前，请确认测试配置已加载当前压缩包，并且页面只显示侧栏入口，不再出现固定在右侧的旧卡片。

### WebUI 交互

- **隐藏**：插件启动后不渲染 Inbox 面板；关闭按钮、`Esc` 或面板外点击都会隐藏它，外部 DSH 页面仍可操作。
- **唤起**：点击侧栏底部的 DeepCanary 入口即可重新打开；打开后焦点落到关闭按钮，关闭后返回入口。
- **通知回跳**：浏览器已授予通知权限时，点击 C2/C3 通知会聚焦 DSH、打开对应提醒，并将目标条目滚动到面板可见区域。
- **缩放**：面板右侧和底部提供可聚焦的调整手柄，支持鼠标拖动以及方向键、`Home`、`End`；尺寸会在浏览器允许时保存在本地。
- **双语**：面板文案、原因说明、建议、证据类型、操作按钮和设置字段注册到 DSH locale，切换 DSH 的中文/English 后实时更新。

## Web 与工具接口

插件向 DSH 本地 WebServer 注册以下同源接口：

| 接口 | 用途 |
| --- | --- |
| `/dsh-deepcanary/state` | 状态、设置和待处理 Inbox 快照 |
| `/dsh-deepcanary/settings` | 读取或校验并更新体验设置 |
| `/dsh-deepcanary/health` | 插件健康检查 |
| `/dsh-deepcanary/explain?id=...` | 读取单条 Inbox 的隐私安全决策解释 |
| `/dsh-deepcanary/dry-run` | 只读比较当前与候选提醒策略 |
| `/dsh-deepcanary/action` | 确认、静音、稍后提醒、反馈和跳转提示 |

DSH 模型可使用九个工具：

`deepcanary_status`、`deepcanary_inbox`、`deepcanary_acknowledge`、`deepcanary_snooze`、`deepcanary_mute`、`deepcanary_feedback`、`deepcanary_explain`、`deepcanary_dry_run`、`deepcanary_jump`。

设置卡片通过 DSH 标准 `settings.plugin.item` 位置暴露通知级别、自动唤起策略、每小时打断预算、静默时段、长时间阈值、Subagent 压力档位、相邻事件合并窗口和隐私安全摘要选项。挂载 `@deepseek-ai/dsh-settings` 后，设置通过 `dsh-deepcanary` namespace 实时生效；没有该 provider 时，插件仍按 bundle 配置工作。

客户端不再注册独立的 `/dsh-deepcanary/client.js` 路由，也不使用 `webserver/index-inject`。包 manifest 的 `dsh.client` 声明和 `./client` 导出由 DSH alpha.2/alpha.3 的客户端模块加载器负责加载；面板入口贡献到 `sidebar.footer.action`，浮动面板贡献到 `shell.overlay`，设置卡贡献到标准 `settings.plugin.item`。

## 注意力策略

| 等级 | 含义 | 默认处理 |
| --- | --- | --- |
| C0 | 正常进展 | 保持安静 |
| C1 | 稍后值得查看 | Inbox / 状态点 |
| C2 | 人工判断已成为瓶颈 | 打断候选 + Inbox |
| C3 | 高影响阻塞或主机风险 | 强提醒候选 + Inbox |

正常完成固定为 `C1`。同一根因的相邻事件会形成一个 Decision Bundle，保留原因码、事件数量和有限证据摘要；重复信号仍受去重窗口约束。C2 使用滚动小时预算，并在静默时段降为 Digest；C3 不消耗普通 C2 预算，仍执行去重，但不因静默时段而被隐藏。

## 隐私与安全边界

默认状态文件为 `~/.dsh/dsh-deepcanary/inbox.json`。只保存时间、等级、原因码、哈希化的 Session/Workspace 引用、证据摘要、Bundle 元数据和用户反馈。Prompt、模型输出、工具参数、凭据、原始工具结果和完整会话内容留在 DSH，不写入 DeepCanary 状态文件。

Web 接口使用同源本地 WebServer 和 `no-store` 响应；客户端通过 DOM `textContent` 渲染动态字段，不拼接 `innerHTML`。插件不提供 shell、文件写入、终止、重启、批准或拒绝工具。不要把 DSH WebServer 暴露到未经认证的公网反向代理后面。

## 验证与发布基线

本仓库提交构建后的 `lib/`，因为 DSH 从公开 Git tag 安装时不应依赖本仓库的 TypeScript 工具链。开发检查：

```powershell
npm install
npm run typecheck
npm run typecheck:tests
npm test
npm run build
npm run verify:distribution
npm pack --dry-run
```

仓库还提供本地质量与可靠性检查：

```powershell
npm run quality:report
npm run benchmark:attention
```

质量报告只保存汇总结果；原始试用数据应留在隔离测试目录，具体字段和隐私边界见 [`docs/dogfood-protocol.md`](docs/dogfood-protocol.md)。最新代码的 alpha.3 本地兼容性证据与公开 CI 浏览器验收结果见 [`benchmark/alpha3-compatibility-receipt.json`](benchmark/alpha3-compatibility-receipt.json)，该收据不替代公开 RC.2 收据。

最新代码的 AttentionGold v3 固定覆盖 20 个分类场景，以及重复、共享根因 Bundle、恢复复发和多 Session 场景；公开 RC.2 收据仍记录历史 v2 的 15 个分类场景。RC.2 的官方运行时、Windows/WSL、公开 tag 安装、Web、设置、卸载重启和分发完整性证据记录在仓库内的 [`benchmark/release-receipt.json`](benchmark/release-receipt.json)，收据状态为 `PASS`。该文件不进入 npm 运行包，以避免与发布包 SHA-256 形成循环依赖。可复现检查步骤见 [`docs/release-checklist.md`](docs/release-checklist.md)。

## 文档

- [`docs/README.md`](docs/README.md)：文档导航；
- [`docs/architecture.md`](docs/architecture.md)：插件如何接收 DSH 运行信息、判断提醒级别并提供 Web 与工具接口；适合开发者阅读；
- [`docs/dsh-surface-audit.md`](docs/dsh-surface-audit.md)：插件使用的 DSH 接口、版本和兼容注意事项；
- [`docs/compatibility.md`](docs/compatibility.md)：DSH 版本、操作系统、Node.js 与已知限制；
- [`docs/security.md`](docs/security.md)：保存哪些数据、提供哪些操作以及安全注意事项；
- [`docs/dogfood-protocol.md`](docs/dogfood-protocol.md)：如何进行脱敏试用、质量评估和本地性能测试；
- [`docs/release-checklist.md`](docs/release-checklist.md)：发布前逐项执行的验证清单。

## 许可证

MIT
