# DeepCanary

让长任务安静运行，在需要你时提醒。

[![npm latest](https://img.shields.io/npm/v/dsh-deepcanary/latest?label=npm)](https://www.npmjs.com/package/dsh-deepcanary)
[![CI](https://github.com/Oscar-Williams/dsh-deepcanary/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/Oscar-Williams/dsh-deepcanary/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-2ea44f.svg)](LICENSE)

[English](README.md) · 简体中文 · [文档](docs/README.md) · [更新日志](CHANGELOG.md)

DeepCanary 是 [DeepSeek Harness（DSH）](https://github.com/deepseek-ai/deepseek-harness) 的本地任务提醒收件箱。审批、提问、异常和完成摘要集中在一处，让你无需持续盯着任务页面，在需要处理时回到对应会话。

![DSH Web 中的 DeepCanary 收件箱](assets/deepcanary-panel-zh.png)

*从 DSH 侧栏打开收件箱。截图使用较早的 DSH 版本，宿主界面可能随版本变化。*

## 能帮你做什么

- **集中查看需要关注的任务。** 待审批、待回答、可能停滞、服务异常和任务结果，无需逐个会话检查。
- **减少重复打扰。** 合并相关信号，结合去重、静默时段、提醒预算和稍后提醒，让常规活动保持安静。
- **直接回到工作现场。** 从收件箱条目或浏览器通知打开对应 DSH 会话；问题恢复后，原提醒随之收束。
- **看得懂提醒的理由。** 每条提醒展示信号和策略依据。疑似停滞只是检查建议，不等于任务已经失败。
- **由你掌握操作。** 在可调整大小的中英文面板中确认、稍后处理、静音或反馈。DeepCanary 不会代你审批、终止或重启任务。

## 快速开始

需要已配置的 DSH Web 和 Node.js `22.19+`。构建与 CI 基线为 DSH `0.1.2-alpha.5`，`0.1.3-alpha.1` 有独立兼容性验证。使用其他宿主前，请查看[版本与平台限制](docs/compatibility.md)。

当前默认版本为 **`0.1.1-rc.5`（预发布版）**。npm 默认渠道 `latest` 与预览渠道 `next` 目前均指向该版本。

如果终端中可以直接运行 `dsh`：

```sh
dsh plugin --profile web add dsh-deepcanary@latest
dsh web
```

如果 DSH 已在运行，请先完成当前任务，再重启以加载插件。打开新进程打印的地址，在侧栏选择 **DeepCanary**。

使用 DSH 源码安装时，在 DSH 源码目录运行等价命令：

```sh
npx --yes pnpm@11.7.0 dsh plugin --profile web add dsh-deepcanary@latest
npx --yes pnpm@11.7.0 dsh web
```

需要可复现安装时，将 `dsh-deepcanary@latest` 替换为 `dsh-deepcanary@0.1.1-rc.5`；需要预览渠道时使用 `dsh-deepcanary@next`。也可以从 [GitHub Releases](https://github.com/Oscar-Williams/dsh-deepcanary/releases/tag/v0.1.1-rc.5) 下载固定版本的 `.tgz`，将同一条 `plugin add` 命令中的包名替换为文件路径。若镜像源尚未同步，请使用 npm 官方源或 Release 附件。

## 收到第一条提醒

1. 在 DSH 侧栏打开 **DeepCanary**。
2. 点击 **启用浏览器通知**，允许浏览器权限请求。需要桌面通知时，也请在操作系统中开启该浏览器的通知。
3. 正常运行任务。打开收件箱条目查看原因、返回对应会话，或选择确认、稍后提醒、静音和反馈。

提醒级别、静默时段、预算与保留数量可在 **DSH 设置 → 插件 → DeepCanary** 中调整。正常完成默认记入收件箱；是否打断取决于具体信号和你的策略。最高级别提醒必须有宿主或运行时证据，且不占用普通提醒预算。

## 设计取舍

**活动不等于需要关注。** 任务忙碌时未必需要提醒。DeepCanary 先区分运行时事实与提醒策略，再将相关事件合并成一个待处理事项。

**不确定性保持可见。** 一段时间没有活动可能意味着停滞，却不能证明失败；浏览器创建了通知，也不能证明系统已将它展示给你。插件保留这些区别。

**任务仍由 DSH 管理。** DeepCanary 只负责观察与导航，不替换 Agent 执行循环，也不提供审批、Shell 或进程控制工具，不需要额外的模型 API。

事件模型、策略和持久化边界见[架构说明](docs/architecture.md)。

## 隐私与限制

- 本地仅保存有限的提醒元数据、哈希引用、反馈，以及用于导航的本地会话标识；不保存对话正文、模型输出、工具参数或密钥。详见[安全与隐私](docs/security.md)。
- 浏览器通知需要 DSH 服务和网页保持运行。权限、后台节流和系统设置可能影响投递；关闭网页后，该页面无法继续发送通知。
- 未开启桌面通知时，仍可使用收件箱。RC4 已观察到 Windows/Edge 的通知显示、通知中心保留和点击返回；这不代表所有浏览器或系统均有相同保证。
- 持续监督功能（Persistent Supervisor）仍为实验功能，默认关闭；它不是独立后台服务，DSH 退出后不会继续运行。
- WSL2 端到端桌面通知、实体触控设备和屏幕阅读器输出尚未完成发布级验证。详见[兼容说明](docs/compatibility.md)。

## 参与贡献

欢迎报告问题、提出针对性改进或完善翻译。提交 [GitHub Issue](https://github.com/Oscar-Williams/dsh-deepcanary/issues) 时，请附插件版本、DSH 版本、操作系统、浏览器和复现步骤；分享日志前请移除密钥与私人会话内容。

开发从[贡献指南](CONTRIBUTING.md)和[开发文档](docs/development.md)开始，版本变更见[更新日志](CHANGELOG.md)。

## 许可证

[MIT](LICENSE)
