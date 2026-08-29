# dsh-deepcanary

> DeepCanary watches your agents so you don’t have to.

`dsh-deepcanary` 是面向 DeepSeek Harness 的本地注意力监督插件。它把 DSH 的 Session、Tool、Agent 和 Subagent 运行时事实整理为可追溯的信号，再用确定性规则判断哪些信息应当保持安静、进入收件箱或提醒人类处理。

当前包为 `0.1.0-rc.1`。本版本的测试基线是官方 `dsh-v0.1.2-alpha.1` 源码运行时；由于本轮核验时该 alpha 版本尚未提供对应 npm 包，安装步骤使用官方仓库 checkout、`pnpm install`、`pnpm run build` 和源码 CLI。请勿把 npm `0.1.1-rc.2` 目录当作本轮测试运行时。

## 能解决什么问题

DeepCanary 关注“现在是否需要人看一眼”，而不是替 DSH 重新编排 Agent：

- 记录 Human Needed、主机疑似停滞、工具失败循环、上下文压力、Subagent 压力和任务结束等信号；
- 通过 C0–C3 注意力等级、去重窗口、相邻事件合并和小时预算降低提醒噪声；
- 在 Web 页面提供灰/黄/橙/红状态指示器和本地收件箱；
- 提供 `acknowledge`、`snooze`、`mute`、`feedback` 和跳转提示；
- 只建议跳转或检查，不会自动终止、重启、批准、拒绝或修改 DSH 任务。

核心原则是“证据先于升级”：模型判断是可选辅助，最终等级由结构化运行时事实和确定性规则决定；C3 必须有 Host 或 Runtime 权威证据。

## 在官方 alpha.1 上安装并运行

以下步骤是本项目当前唯一的完整验证路径，要求 Node.js `22.19+`（本地验证使用 Node.js 24）和 pnpm `11.7.0`。

### 1. 准备 DSH alpha.1

```powershell
git clone --depth 1 --branch dsh-v0.1.2-alpha.1 https://github.com/deepseek-ai/deepseek-harness.git dsh-runtime-alpha1
Set-Location .\\dsh-runtime-alpha1
npx --yes pnpm@11.7.0 install
npx --yes pnpm@11.7.0 run build
npx --yes pnpm@11.7.0 dsh --version
```

最后一条命令应输出 `0.1.2-alpha.1`。官方发布页见 [dsh-v0.1.2-alpha.1](https://github.com/deepseek-ai/deepseek-harness/releases/tag/dsh-v0.1.2-alpha.1)。

### 2. 把插件加入 Web profile

在 `dsh-runtime-alpha1` 仓库目录内执行。插件目录必须已经完成 `npm run build`。

```powershell
Set-Location F:\\Agent_Related\\ZCode_Related\\plugin2
npm install
npm run build

Set-Location F:\\Agent_Related\\Deepseek-Harness_Related\\dsh-runtime-alpha1
npx --yes pnpm@11.7.0 dsh plugin --profile web add F:\\Agent_Related\\ZCode_Related\\plugin2
npx --yes pnpm@11.7.0 dsh web
```

如果插件已经安装过，修改代码后重新运行 `npm run build`，再执行：

```powershell
npx --yes pnpm@11.7.0 dsh plugin --profile web update dsh-deepcanary
```

不要直接在 alpha.1 源码仓库中执行 `npm install @deepseek-ai/dsh@0.1.2-alpha.1`：该版本的测试安装来源是官方 tag checkout，而不是一个可假定存在的 npm tarball。

## 本地开发

```powershell
npm install
npm run typecheck
npm run typecheck:tests
npm test
npm run build
npm run verify:distribution
npm pack --dry-run
```

插件构建产物位于 `lib/`，发布包不包含 `src/`、测试目录或本地运行状态。`cordis.patch.yml` 声明了标准 DSH bundle 入口；也可以在开发 patch 中直接挂载源码目录，但正式安装应使用构建后的包或不可变 Git tag。

## Web 端入口

插件会向 DSH WebServer 注册以下同源本地接口：

| 地址 | 用途 |
| --- | --- |
| `/dsh-deepcanary/state` | 当前状态和收件箱快照 |
| `/dsh-deepcanary/health` | 插件健康检查 |
| `/dsh-deepcanary/action` | 确认、静音、稍后提醒和反馈 |
| `/dsh-deepcanary/client.js` | Web 页面轻量面板 |

浏览器通知只在用户主动授予权限后启用。若 Web 页面不可用，模型仍可通过 `deepcanary_status`、`deepcanary_inbox` 和 `deepcanary_explain` 读取结构化信息。

如果当前 DSH profile 同时挂载了 `@deepseek-ai/dsh-settings` provider，DeepCanary 会注册同名设置空间，使通知级别、静默时段、长时间阈值、Subagent 压力档位和提醒预算可以按 DSH 设置机制实时更新；状态目录变更需要重启后生效。

## 隐私与安全边界

本地状态默认写入 `~/.dsh/dsh-deepcanary/inbox.json`，仅保存时间、等级、稳定原因码、哈希化 Session/Workspace 引用、证据摘要和反馈。Prompt、模型输出、工具参数、凭据和完整会话内容留在 DSH，不写入 DeepCanary 状态文件。

插件提供的动作是可逆的本地元数据更新。它没有终止 Agent、重启进程、自动批准、自动拒绝或执行任意命令的工具。更完整的边界说明见 [`docs/security.md`](docs/security.md)。

## 兼容性与当前状态

| 运行时 | 用途 | 状态 |
| --- | --- | --- |
| `dsh-v0.1.2-alpha.1`（官方源码 tag） | 本项目当前测试基线 | 已完成本地安装、构建、CLI 版本、Web 配置、tarball 加载和 Web HTTP 验证 |
| `@deepseek-ai/dsh@0.1.1-rc.2` | 历史 npm 类型/回退环境 | 不作为本轮运行测试基线 |
| Node.js `22.19+` / Windows x64、WSL | 运行平台 | 代码提供 WorkspaceIdentity 归一化；原生 Toast 仅作为能力探测，不是硬依赖 |

运行时接口审计记录在 [`docs/dsh-surface-audit.md`](docs/dsh-surface-audit.md)，架构说明在 [`docs/architecture.md`](docs/architecture.md)，发布前检查在 [`docs/release-checklist.md`](docs/release-checklist.md)。

## 许可证

MIT
