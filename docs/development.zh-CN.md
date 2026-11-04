# 开发说明

[English](development.md) · [贡献指南](../CONTRIBUTING.zh-CN.md)

使用 Node 24.9 及以上版本、npm 和仓库中的锁文件。开发宿主为 DSH 0.2.2-alpha.3，并保留实际 RC5 安装用于兼容性检查。

## 准备源码

```sh
git clone https://github.com/Oscar-Williams/dsh-deepcanary.git
cd dsh-deepcanary
npm ci
```

宿主运行时、测试 home 和凭据放在仓库之外，开发与日常使用不同的 profile。

## 测试与构建

选择覆盖本次改动的测试。

```sh
npm exec -- vitest run test/settings-migration.spec.ts
npm run build
```

构建会检查直接依赖版本、编译 TypeScript，并将客户端打包为 DSH 模块工厂。源码变更与生成的 `lib/` 一并提交。

## 检查两版宿主

准备包含 `node_modules/@deepseek-ai/dsh` 的运行时目录，将实际路径传给集中验证入口。

```sh
npm run verify:candidate -- --alpha-runtime /absolute/alpha3-runtime --rc5-runtime /absolute/rc5-runtime
```

该入口检查应用与测试类型、测试套件、构建、策略回放及两版宿主契约，并按输入和运行时身份缓存结果。

单独检查一项宿主契约时，将 `DSH_RUNTIME` 设为对应运行时目录，再运行相关 `:host` 脚本。例如在 PowerShell 中：

```powershell
$env:DSH_RUNTIME = "<运行时目录的实际绝对路径>"
npm run settings:host
```

通过宿主 CLI 或管理器，将构建包安装到独立 profile。行为变化需在实际界面中检查，场景见 [Web 与桌面版验收](dual-host-acceptance.zh-CN.md)。

## 准备分发包

完成修改后检查文档与分发内容。

```sh
npm run verify:docs
npm run verify:distribution
```

提交审阅后的源码、文档和 `lib/`，再冻结 `package.json` 中的版本。

```sh
node scripts/freeze-local-candidate.mjs 0.1.8-rc.4
```

输出目录包含唯一 tgz、文件清单、校验值和本地验证元数据。生成的报告保留在 Git 之外，发布步骤见[发布指南](release-checklist.zh-CN.md)。
