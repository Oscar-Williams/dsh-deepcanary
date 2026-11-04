# 安全政策

[English](SECURITY.md) · [数据与隐私](docs/security.zh-CN.md)

## 报告漏洞

通过 [GitHub 私密漏洞报告](https://github.com/Oscar-Williams/dsh-deepcanary/security/advisories/new)提交，说明受影响版本、最小复现、预期与实际行为，以及可能的影响。

附件中应移除凭据、认证链接和私密会话内容。没有安全影响的普通问题可提交至 [Issues](https://github.com/Oscar-Williams/dsh-deepcanary/issues)。

## 支持的版本

| DeepCanary | DSH | 安全更新 |
| --- | --- | --- |
| `0.1.9-rc.1` | `0.2.1-rc.5` 或 `>=0.2.2-alpha.3` | 当前维护 |
| 更早的版本 | 以对应版本的说明为准 | 请升级到当前版本 |

请安装当前版本以获得安全修复。升级时沿用原来的 DSH 数据目录和配置名称。参见[更新步骤](README.zh-CN.md#更新或卸载)、[更新记录](CHANGELOG.zh-CN.md)和[兼容性](docs/compatibility.zh-CN.md)。

## 数据与权限

DeepCanary 通过 DSH 认证接口读取任务状态，并在 DSH 配置目录中保存提醒元数据。提醒文件可能反映你的工作时间和需要处理的会话。请限制对配置目录的访问，并检查系统的通知预览设置。参见[数据与隐私](docs/security.zh-CN.md)。
