# 贡献指南

[English](CONTRIBUTING.md) · [文档目录](docs/README.zh-CN.md)

欢迎报告问题、改进文档、补充翻译和提交针对性的修复。较大的功能改动可先提交 Issue，说明实际任务和期望行为。

## 准备环境

使用 Git、npm 和 Node 24.9 及以上版本。开发宿主为 DSH alpha.3，同时支持 RC5。

```sh
git clone https://github.com/Oscar-Williams/dsh-deepcanary.git
cd dsh-deepcanary
npm ci
```

为测试准备独立的 DSH home 和 profile，将日常会话、凭据及提醒状态放在仓库之外。[开发说明](docs/development.zh-CN.md)介绍如何选择实际宿主运行时。

## 修改与检查

运行覆盖本次行为的测试。

```sh
npm exec -- vitest run test/settings-migration.spec.ts
npm run build
```

示例检查设置迁移。修复可复现的缺陷时，补充回归测试，必要时覆盖恢复过程。源码变更需一并提交生成的 `lib/`，DSH 从 Git 标签安装时会使用其中的分发文件。

提交前运行与改动有关的检查。宿主集成或包行为变化按[开发说明](docs/development.zh-CN.md)执行集中验证；文档变更检查链接、双语对应关系和渲染效果。

## 设计边界

- Provider 选择 DSH 公开事实，确定性核心负责提醒判定。
- C3 必须来自当前有效的权威问答或审批。
- 保留任务归属、去重、静默时段、预算及恢复行为。
- 提示词、会话正文、工具参数、凭据和原始失败文本不得进入提醒账本。
- 使用宿主认证路由、revision 检查、有界状态和安全的 DOM 渲染。
- 任务执行、审批和回答由 DSH 原生流程处理。

修改相关契约前，阅读[架构](docs/architecture.zh-CN.md)和 [DSH 公开接口](docs/dsh-surface-audit.zh-CN.md)。

## 报告问题

附上 DSH 与 DeepCanary 版本、操作系统、复现步骤、预期行为和实际结果。示例应尽量小，并移除私密内容。漏洞通过[安全政策](SECURITY.zh-CN.md)中的渠道报告。

## 提交 PR

保持改动集中，说明问题、修改后的行为和已执行的检查。同步更新更新记录及相关文档的中文版本；可见交互变化可附截图。

补丁中应移除私密数据、凭据、宿主 profile 和本机过程日志。遵循现有代码风格和包锁文件。

## 文档与翻译

英文文档使用基础文件名，中文对应文件使用 `.zh-CN.md`。保持语言导航及命令示例对应，代码标识、版本字符串和 CLI 选项保留原拼写。

用户操作写入 README，具体实现与贡献者命令放在文档目录。项目采用 [MIT 许可证](LICENSE)。
