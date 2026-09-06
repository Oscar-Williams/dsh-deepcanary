# dsh-deepcanary

[![CI](https://github.com/Oscar-Williams/dsh-deepcanary/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/Oscar-Williams/dsh-deepcanary/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-2ea44f.svg)](LICENSE)

![DSH Web UI 中的 DeepCanary 面板](assets/deepcanary-panel-zh.png)

> 让 DSH 在真正需要你判断时提醒你。

`dsh-deepcanary` 是 [DeepSeek Harness（DSH）](https://github.com/deepseek-ai/deepseek-harness) 的本地注意力监督插件。它只读取 Session、Tool、Agent、Subagent 和 Host 的结构化运行时事实，用确定性策略把事件压缩为安静、Inbox、提醒或强提醒。

## 当前状态

`0.1.1-rc.4` 是本地工程候选版本，尚未创建 GitHub tag、Release 或 npm 发布物。它补充了 alpha.13 Session v2 公共契约验证、真实工具结果关联、人工等待恢复和子任务完成汇总；Persistent Supervisor 仍为 experimental 且默认关闭。

推荐试用组合仍是已发布的 `0.1.1-rc.3` + DSH `dsh-v0.1.2-alpha.5`。本候选的 alpha.13 组合是独立兼容性 canary：使用 DSH `dsh-v0.1.3-alpha.1` 的本地 checkout（commit `d347e703908d0406b7a7ef80e3a0e594d86b2215`）。alpha.13 预发布包目前没有作为 npm 依赖使用；源码构建默认保持 alpha.5 类型/发布基线，并可用 `build:alpha13` 对实际 checkout 做编译和契约验证。

## 能做什么

- 观察人工审批/提问、Host 不可达、疑似停滞、工具失败循环、上下文压力、Subagent 压力和正常完成。
- 用 C0–C3、去重、Decision Bundle、静默时段和 C2 小时预算减少提醒噪声。
- 在 DSH Web 中提供默认隐藏、可关闭/重开、可缩放、双语的 Inbox；支持确认、稍后提醒、静音、反馈和导航提示。
- 将子任务完成摘要归并到父会话，并保留会话释放后的可读历史条目。

插件不执行 shell、文件写入、终止、重启、批准或拒绝；C3 必须有 Host 或 Runtime 权威证据。浏览器构造成功但没有真实可见性观察时，送达状态是 `unknown`，不宣称跨崩溃或跨 OS 的 exactly-once。

## 三步本地试用

需要 Node.js `22.19+`、`npx pnpm@11.7.0` 和一个独立 DSH profile。下面的 `<pluginDir>`、`<dshDir>`、`<testHome>` 请替换为实际路径。

```powershell
# 1. 构建候选包
Set-Location <pluginDir>
npm ci
npm run build
$packDir = Join-Path $env:TEMP 'dsh-deepcanary-rc4-pack'
New-Item -ItemType Directory -Force $packDir | Out-Null
npm pack --pack-destination $packDir
$tarball = Join-Path $packDir 'dsh-deepcanary-0.1.1-rc.4.tgz'

# 2. 在隔离 profile 安装同一个 tgz
Set-Location <dshDir>
$env:DSH_HOME = '<testHome>'
npx --yes pnpm@11.7.0 dsh plugin --profile web add $tarball
npx --yes pnpm@11.7.0 dsh --profile web --dump-config

# 3. 启动并打开本次进程打印的新 URL
npx --yes pnpm@11.7.0 dsh web --no-open
```

已发布的日常试用版本可安装 `dsh-deepcanary@next`；当前 `next` 指向 RC3。候选 RC4 只使用本地 tgz，未发布前不要使用不存在的远端 tag。

## 关键限制

- DSH alpha.5 是当前日常构建和已发布 RC3 的兼容基线；alpha.13 只在独立 profile 中验证。两个 runtime/profile 不混用。
- Windows OS-visible 通知、真实屏幕阅读器、实体触控、完整跨进程 Supervisor 连续性和自然使用样本仍是独立验收项；缺少证据会保持 pending/unknown。
- `supervisorMode: experimental` 只用于工程诊断，不代表 Stable。无模型凭据时，面板、健康检查、离线测试和公共 session 契约仍可验证。
- 状态目录只保存提醒元数据、哈希化引用、有限证据摘要、反馈、结果枚举和有界投递状态；Prompt、模型输出、工具参数、凭据、原始工具结果和完整会话内容留在 DSH。

## 文档与开发验证

- [开发、alpha.13 canary 和一次性验证命令](docs/development.md)
- [兼容矩阵与已知限制](docs/compatibility.md)
- [架构与生命周期边界](docs/architecture.md)
- [安全与隐私](docs/security.md)
- [发布检查清单](docs/release-checklist.md)
- [变更记录](CHANGELOG.md)

完整接口包括 `/dsh-deepcanary/state`、`/health`、`/settings`、`/action`、`/outcome`、`/outcomes`、`/explain`、`/dry-run` 和实验性的 `/supervisor`，以及九个 `deepcanary_*` 模型可见工具；详见开发文档。

## 反馈

报告问题时请附 DSH 的准确 tag/commit、插件版本或 source identity、Node.js 版本、操作系统、复现步骤和脱敏日志。不要提交 API key、Prompt、会话正文、工作区路径或原始工具结果。

## 许可证

MIT
