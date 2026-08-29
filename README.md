# dsh-deepcanary

> 让 DSH 在真正需要你判断时提醒你。

`dsh-deepcanary` 是面向 [DeepSeek Harness（DSH）](https://github.com/deepseek-ai/deepseek-harness) 的本地注意力监督插件。它读取 Session、Tool、Agent、Subagent 和 Host 的结构化运行时事实，经过确定性策略判断哪些事件应当保持安静、进入 Inbox，或提醒用户处理。

当前版本：`0.1.0-rc.1`。本 RC 的运行时与测试基线固定为官方 `dsh-v0.1.2-alpha.1`，对应 commit `cd5ef8148158c3a752a658978873241fdf8e2bbc`。安装与验证命令以该不可变 tag 为准；历史 npm `0.1.1-rc.2` 仅保留为开发期类型参考，不是本版本的运行测试基线。

## 能解决什么问题

DeepCanary 只回答一个问题：当前是否值得用户看一眼？它不重新编排 Agent，也不替 DSH 执行高影响操作。

- 观察 Human Needed、Host 不可达、疑似停滞、工具失败循环、无有效进展、Subagent 压力、Context 压力和任务完成信号；
- 用 C0–C3 注意力等级、去重窗口、Decision Bundle 和小时预算压缩提醒噪声；
- 在 DSH Web 页面提供状态指示器、Inbox、设置卡片和证据摘要；
- 支持确认、稍后提醒、静音、有效性反馈以及跳转提示；
- 仅提供本地元数据操作和 DSH 导航提示，不会终止或重启任务，不会自动批准或拒绝请求，也不执行任意命令。

核心原则是“证据先于升级”：C3 必须有 Host 或 Runtime 权威证据，模型判断不是本 RC 的必要依赖。

## 安装与运行

### 环境要求

- Windows x64 或 WSL2 Ubuntu；
- Node.js `22.19+`（本次 RC 验证使用 Node.js `24.19.0`）；
- pnpm `11.7.0`；
- 已准备官方 DSH `dsh-v0.1.2-alpha.1` 源码运行时。

### 1. 准备官方 DSH alpha.1

```powershell
git clone --depth 1 --branch dsh-v0.1.2-alpha.1 https://github.com/deepseek-ai/deepseek-harness.git dsh-runtime-alpha1
Set-Location .\dsh-runtime-alpha1
npx --yes pnpm@11.7.0 install
npx --yes pnpm@11.7.0 run build
npx --yes pnpm@11.7.0 dsh --version
```

最后一条命令应输出 `0.1.2-alpha.1`。官方发布页：[dsh-v0.1.2-alpha.1](https://github.com/deepseek-ai/deepseek-harness/releases/tag/dsh-v0.1.2-alpha.1)。

### 2. 从公开 RC tag 安装插件

以下命令使用 GitHub 不可变 tag，适合干净 profile 验证；不要把本地源码目录或包含个人设计资料的目录作为正式安装来源。

```powershell
Set-Location .\dsh-runtime-alpha1
npx --yes pnpm@11.7.0 dsh plugin --profile web add https://codeload.github.com/Oscar-Williams/dsh-deepcanary/tar.gz/refs/tags/v0.1.0-rc.1
npx --yes pnpm@11.7.0 dsh --profile web --dump-config
npx --yes pnpm@11.7.0 dsh web --no-open
```

启动后，在同一台机器的浏览器打开 DSH Web 页面。插件会通过同源接口注入轻量 Inbox 面板；如果浏览器通知权限被拒绝，面板和模型可见工具仍然可用。

更新已安装的 RC 时，先清理旧 profile 或执行：

```powershell
npx --yes pnpm@11.7.0 dsh plugin --profile web update dsh-deepcanary
```

### 本地开发安装

如需调试未发布代码，可以在本仓库构建后从本地目录安装。开发安装不等同于公开 RC 验证：

```powershell
Set-Location F:\Agent_Related\ZCode_Related\plugin2
npm install
npm run build

Set-Location F:\Agent_Related\Deepseek-Harness_Related\dsh-runtime-alpha1
npx --yes pnpm@11.7.0 dsh plugin --profile web add F:\Agent_Related\ZCode_Related\plugin2
npx --yes pnpm@11.7.0 dsh web --no-open
```

## Web 与工具接口

插件向 DSH 本地 WebServer 注册以下同源接口：

| 接口 | 用途 |
| --- | --- |
| `/dsh-deepcanary/state` | 状态、设置和待处理 Inbox 快照 |
| `/dsh-deepcanary/settings` | 读取或校验并更新体验设置 |
| `/dsh-deepcanary/health` | 插件健康检查 |
| `/dsh-deepcanary/action` | 确认、静音、稍后提醒、反馈和跳转提示 |
| `/dsh-deepcanary/client.js` | Web Inbox 面板脚本 |

DSH 模型可使用：

`deepcanary_status`、`deepcanary_inbox`、`deepcanary_acknowledge`、`deepcanary_snooze`、`deepcanary_mute`、`deepcanary_feedback`、`deepcanary_explain`、`deepcanary_jump`。

设置卡片暴露通知级别、每小时打断预算、静默时段、长时间阈值、Subagent 压力档位、相邻事件合并窗口和隐私安全摘要选项。挂载 `@deepseek-ai/dsh-settings` 后，设置通过 DSH Settings namespace 实时生效；没有该 provider 时，插件仍按 bundle 配置工作。

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

AttentionGold 固定覆盖 15 个分类场景，以及重复事件和共享根因 Bundle 场景。最终 RC 的运行时、Windows/WSL、公开 tag、安装、Web、设置、卸载重启和分发完整性证据记录在仓库内的 [`benchmark/release-receipt.json`](benchmark/release-receipt.json)；该文件不进入 npm 运行包，以避免与发布包 SHA-256 形成循环依赖。发布前步骤见 [`docs/release-checklist.md`](docs/release-checklist.md)。

## 文档

- [`docs/architecture.md`](docs/architecture.md)：运行时管线、稳定契约和扩展边界；
- [`docs/dsh-surface-audit.md`](docs/dsh-surface-audit.md)：针对官方 alpha.1 的 DSH 接口审计；
- [`docs/compatibility.md`](docs/compatibility.md)：运行时、平台和已知限制；
- [`docs/security.md`](docs/security.md)：本地状态、动作和 Web 边界；
- [`docs/release-checklist.md`](docs/release-checklist.md)：可复现发布检查。

## 许可证

MIT
