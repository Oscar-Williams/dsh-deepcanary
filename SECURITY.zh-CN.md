# 安全政策

[English](SECURITY.md) · [数据与隐私](docs/security.zh-CN.md)

## 报告漏洞

通过 [GitHub 私密漏洞报告](https://github.com/Oscar-Williams/dsh-deepcanary/security/advisories/new)提交，说明受影响版本、最小复现、预期与实际行为，以及可能的影响。

附件中应移除凭据、认证链接和私密会话内容。没有安全影响的普通问题可提交至 [Issues](https://github.com/Oscar-Williams/dsh-deepcanary/issues)。

## 支持的版本

安全修复面向当前 0.1.8 发布线。请使用该发布线的最新版本，以及符合其兼容声明的 DSH 版本。更早的 DeepCanary 发布线不单独回补修复。

[更新记录](CHANGELOG.zh-CN.md)列出依赖与安全修复，[兼容性说明](docs/compatibility.zh-CN.md)列出支持的宿主及实际验证范围。

## 数据与权限

DeepCanary 在 DSH 内运行，使用宿主经过认证的公开服务。插件动作管理提醒元数据，并返回 DSH 原生界面；会话正文和凭据不进入提醒账本。

Profile 数据和通知预览仍可能透露工作信息。请保护宿主与 profile 的访问权限，并按使用环境选择系统通知设置。

存储字段、传输、迁移和通知行为见[数据与隐私](docs/security.zh-CN.md)。

## 更新

使用 DSH 插件管理器或对应宿主的 CLI。发布文件从本仓库或 npm 包获取，并核对随附校验值。升级时沿用已有 home 和 profile。
