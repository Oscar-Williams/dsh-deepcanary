# 文档导航

普通用户从仓库根目录的 [`README.md`](../README.md) 开始即可。本文档帮助用户和贡献者快速找到对应内容。

## 用户文档

| 需要了解的内容 | 文档 |
| --- | --- |
| 安装、启动和 Web UI 操作 | [`README.md`](../README.md) |
| DSH 版本、操作系统和已知限制 | [`compatibility.md`](compatibility.md) |
| 数据保存、插件操作和安全注意事项 | [`security.md`](security.md) |

## 开发者文档

| 需要了解的内容 | 文档 |
| --- | --- |
| 插件如何接收 DSH 活动并生成提醒 | [`architecture.md`](architecture.md) |
| 插件使用的 DSH 接口与版本依据 | [`dsh-surface-audit.md`](dsh-surface-audit.md) |
| 脱敏试用、机会分类、质量评估和本地性能测试 | [`dogfood-protocol.md`](dogfood-protocol.md) |
| 发布与验收的完整步骤 | [`release-checklist.md`](release-checklist.md) |
| 参与代码、测试和文档贡献 | [`../CONTRIBUTING.md`](../CONTRIBUTING.md) |

结果记录的公开字段约束见 [`../benchmark/outcome-receipt.schema.json`](../benchmark/outcome-receipt.schema.json)，汇总报告约束见 [`../benchmark/outcome-report.schema.json`](../benchmark/outcome-report.schema.json)。脱敏 dogfood bundle、跨 run 汇总和 Windows 通知观察约束见 [`../benchmark/dogfood.schema.json`](../benchmark/dogfood.schema.json)、[`../benchmark/dogfood-aggregate.schema.json`](../benchmark/dogfood-aggregate.schema.json) 和 [`../benchmark/notification-evidence.schema.json`](../benchmark/notification-evidence.schema.json)。策略回放输入、报告和 Gate D/E 约束见 [`../benchmark/policy-replay.schema.json`](../benchmark/policy-replay.schema.json)、[`../benchmark/policy-replay-report.schema.json`](../benchmark/policy-replay-report.schema.json)、[`../benchmark/supervisor-soak-report.schema.json`](../benchmark/supervisor-soak-report.schema.json)、[`../benchmark/u7-real-soak-report.schema.json`](../benchmark/u7-real-soak-report.schema.json)、[`../benchmark/attention-candidate-promotion.schema.json`](../benchmark/attention-candidate-promotion.schema.json) 和 [`../benchmark/stable-gates-report.schema.json`](../benchmark/stable-gates-report.schema.json)。公开 `0.1.1-rc.3` / DSH alpha.5 兼容性与发布回执见 [`../benchmark/alpha5-compatibility-receipt.json`](../benchmark/alpha5-compatibility-receipt.json)；RC3 结果按 source commit、包摘要和 fresh Gate 报告单独记录。RC4 与历史 RC3 记录仍分别见 [`../benchmark/release-candidate-receipt.json`](../benchmark/release-candidate-receipt.json) 和 [`../benchmark/release-receipt.json`](../benchmark/release-receipt.json)。Windows notification evidence 当前为 v3，要求 OS 状态使用三态并携带 run window、notification attempt、browser receipt、截图和 UIA 哈希。

设计指南保存在仓库外的本地“设计思路(不提交)”目录，不属于安装包和公开仓库内容。
