# 贡献指南

[English](CONTRIBUTING.md) · [文档目录](docs/README.zh-CN.md)

欢迎报告问题、改进文档、补充翻译和提交针对性的修复。较大的功能改动可先提交 Issue，说明实际任务和期望行为。

## 准备环境

请准备 Git、npm 和 Node.js 24.9 或更高版本。使用 DSH `0.2.2-alpha.3` 开发，涉及 DSH 接口的改动也要在 `0.2.1-rc.5` 中检查。

```sh
git clone https://github.com/Oscar-Williams/dsh-deepcanary.git
cd dsh-deepcanary
npm ci
```

为测试准备独立的 DSH home 和 profile，将日常会话、凭据及提醒状态放在仓库之外。[开发说明](docs/development.zh-CN.md)介绍如何选择实际宿主运行时。

## 修改与检查

提交前运行完整测试。开发时，可以把相关测试文件的路径传给 Vitest，只运行该文件。

```sh
npm test
npm exec -- vitest run test/settings-migration.spec.ts
npm run build
```

修改 `src/` 后，请构建并将生成的 `lib/` 与源码一并提交。DSH 从 Git 标签安装时直接使用这些文件，用户无需编译 TypeScript。

修复可复现的缺陷时，请添加回归测试。涉及 DSH 接口的改动按开发指南检查。修改文档时，运行 `npm run verify:docs` 并检查两个语言版本。参见[开发指南](docs/development.zh-CN.md)。

## 设计边界

- 在适配器中通过 DSH 公开接口读取会话和任务状态，再由 `src/core/` 中的规则确定提醒等级。
- 仅当 DSH 确认某个未回答的问题或待处理的审批阻塞任务时，才设为 C3。
- 只保存恢复提醒和返回会话所需的元数据。提示词、对话正文、工具参数、原始报错和凭据应留在提醒文件之外。
- 使用 DSH 认证路由，写入前核对预期版本。限制保留的记录量，并安全地渲染文本。
- 在 DeepCanary 中查看提醒或打开会话，在 DSH 中执行任务、回答问题和处理审批。

[架构](docs/architecture.zh-CN.md) · [DSH 公开接口](docs/dsh-surface-audit.zh-CN.md)

## 报告问题

附上 DSH 与 DeepCanary 版本、操作系统、复现步骤、预期行为和实际结果。示例应尽量小，并移除私密内容。漏洞通过[安全政策](SECURITY.zh-CN.md)中的渠道报告。

## 提交 PR

保持改动集中，说明问题、修改后的行为和已执行的检查。同步更新更新记录及相关文档的中文版本；可见交互变化可附截图。

补丁中应移除私密数据、凭据、宿主 profile 和本机过程日志。遵循现有代码风格和包锁文件。

## 文档与翻译

英文文档使用基础文件名，中文对应文件使用 `.zh-CN.md`。保持语言导航及命令示例对应，代码标识、版本字符串和 CLI 选项保留原拼写。

用户操作写入 README，具体实现与贡献者命令放在文档目录。项目采用 [MIT 许可证](LICENSE)。
