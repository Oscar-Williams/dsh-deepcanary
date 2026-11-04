<h1 align="center">DeepCanary</h1>

<p align="center">DeepSeek Harness 的任务收件箱与本地通知插件。</p>

<p align="center">
  <a href="https://www.npmjs.com/package/dsh-deepcanary"><img src="https://img.shields.io/npm/v/dsh-deepcanary/latest?label=npm&amp;color=2563eb" alt="npm 版本"></a>
  <a href="https://github.com/Oscar-Williams/dsh-deepcanary/actions/workflows/ci.yml"><img src="https://github.com/Oscar-Williams/dsh-deepcanary/actions/workflows/ci.yml/badge.svg?branch=main" alt="CI"></a>
  <a href="docs/compatibility.zh-CN.md"><img src="https://img.shields.io/badge/DSH-RC5%20%7C%20alpha.3%2B-2563eb" alt="DSH 兼容性"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-2563eb" alt="MIT 许可证"></a>
</p>

<p align="center"><a href="README.md">English</a> · <a href="docs/README.zh-CN.md">文档目录</a> · <a href="CHANGELOG.zh-CN.md">更新记录</a> · <a href="https://github.com/Oscar-Williams/dsh-deepcanary/releases">版本下载</a></p>

DeepCanary 将任务变化归入**待处理**、**稍后**和**动态**。DSH 需要你回答或审批时发出提醒，普通完成进入动态，点击后可返回对应会话。

<p align="center"><img src="assets/deepcanary-panel-zh.png" width="880" alt="DeepCanary 的任务列表与详情"></p>

[安装](#安装) · [使用](#使用) · [通知](#通知) · [更新或卸载](#更新或卸载) · [兼容性](#兼容性) · [常见问题](#常见问题) · [安全与隐私](#安全与隐私) · [参与开发](#参与开发) · [致谢](#致谢) · [许可证](#许可证)

## 安装

DeepCanary **0.1.9-rc.1** 支持 DSH `0.2.1-rc.5` 以及 `0.2.2-alpha.3` 和后续版本。使用 WebUI 前，请查看[对应的 Node.js 要求](#兼容性)。Windows 桌面版自带运行时。参见 [DeepSeek Harness 安装说明](https://github.com/deepseek-ai/deepseek-harness#readme)。

### Windows 桌面版

1. 打开**插件 → 添加插件 → 安装第三方插件**。
2. 在**包名或地址**中输入 `dsh-deepcanary@0.1.9-rc.1`，点击**安装**。
3. 如有提示，重启 DSH，然后从左侧边栏打开 **DeepCanary**。

### WebUI

停止正在运行的 DSH WebUI 服务，在终端执行以下命令。

```sh
dsh plugin --profile web add dsh-deepcanary@0.1.9-rc.1 --registry=https://registry.npmjs.org/
dsh web
```

启动 WebUI 后，从侧边栏打开 **DeepCanary**。

<details>
<summary>使用自定义 DSH 数据目录或配置名称</summary>

如果平时使用其他配置，将两条命令中的 `web` 换成该配置的名称。如果启动 DSH 时设置了 `DSH_HOME`，安装、更新或卸载前，先在当前终端将它设为同一个目录。

PowerShell

```powershell
$env:DSH_HOME = "<现有 DSH 数据目录>"
```

Bash 或 Zsh

```sh
export DSH_HOME="<现有 DSH 数据目录>"
```

</details>

<details>
<summary>使用下载的安装包</summary>

从 [GitHub 发布页](https://github.com/Oscar-Williams/dsh-deepcanary/releases/tag/v0.1.9-rc.1)下载 tgz 和 `SHA256SUMS`。在下载目录中运行以下任一命令，将结果与 `SHA256SUMS` 中对应的值比较。

```powershell
Get-FileHash ./dsh-deepcanary-0.1.9-rc.1.tgz -Algorithm SHA256
```

```sh
shasum -a 256 ./dsh-deepcanary-0.1.9-rc.1.tgz
```

安装到 WebUI 时，先停止服务，再在下载目录中运行以下命令。包管理器可能仍需从 npm 下载依赖。

```sh
dsh plugin --profile web add ./dsh-deepcanary-0.1.9-rc.1.tgz --registry=https://registry.npmjs.org/
dsh web
```

安装到 Windows 桌面版时，先打开一次 DSH 以初始化配置，再选择**应用 → 退出**。在应用目录下的 `resources/runtime/cli/bin` 中打开 PowerShell。使用自定义 `DSH_HOME` 时，先按上文设置。将占位内容换成下载包的完整路径，执行命令后重新打开 DSH。

```powershell
.\dsh.cmd plugin --profile desktop add "<dsh-deepcanary-0.1.9-rc.1.tgz 的完整路径>" --registry=https://registry.npmjs.org/
```

</details>

## 使用

| 分类 | 显示内容 |
| --- | --- |
| **待处理** | 等待回答、等待审批及其他需要关注的任务更新 |
| **稍后** | 已安排稍后提醒的事项 |
| **动态** | 普通完成、上下文压缩，以及你主动停止的任务 |

选择一条提醒查看详情，点击详情里的 DSH 按钮进入会话，在那里回答问题或处理审批。选择**更多操作 → 已处理**可将提醒移出待处理，选择**稍后提醒**可安排下一次提醒。

拖动标题栏可移动面板，拖动边缘或角落可调整大小，拖动分隔条可调整列表宽度。**布局**菜单提供停靠、展开、恢复和重置。DeepCanary 会在当前设备记住布局。窗口较窄时，从详情返回列表会回到之前的滚动位置。

需要用键盘调整时，从**布局**菜单选择移动或调整大小。用方向键调整，按住 Shift 加大步长，按 Enter 确认，按 Esc 取消。

## 通知

从收件箱打开**提醒设置**，可以选择最低提醒级别、设置静默时段，并限制每小时 C2 打断次数。静默时段或 C2 打断次数达到上限时，C3 仍可提醒。

| 等级 | 含义 |
| --- | --- |
| **C3** | DSH 正等待回答或审批，处理后才能继续 |
| **C2** | 任务出现错误或异常状态，需要检查 |
| **C1** | 有常规更新可在动态中查看 |

使用 WebUI 时，允许 DSH 站点发送通知，并保留一个 DSH 页面。Windows 用户还需在系统设置中允许浏览器或 DeepSeek Harness 发送通知。桌面应用持续运行时，窗口最小化或隐藏后仍可收到提醒。

点击系统通知可返回对应提醒和会话。在 DSH 中回答问题或完成审批，即可继续任务。

## 更新或卸载

Windows 桌面版用户可在**插件**中卸载旧版，再在同一个 DSH 应用中添加 `dsh-deepcanary@0.1.9-rc.1`。如有提示，按提示重启。只想移除插件时，完成卸载即可。

WebUI 用户先停止服务，再执行上面的[安装命令](#webui)。沿用原来的 DSH 数据目录和配置名称，以保留设置与提醒。

从 WebUI 移除 DeepCanary 时，先停止服务，再运行以下命令并重启 WebUI。使用其他配置时，将 `web` 换成该配置的名称。

```sh
dsh plugin --profile web remove dsh-deepcanary
```

## 兼容性

| 已测试的 DSH 版本 | 平台 | WebUI 的 Node.js 要求 |
| --- | --- | --- |
| `0.2.1-rc.5` | WebUI 和 Windows 桌面版 | `^22.19.0 \|\| >=24.0.0` |
| `0.2.2-alpha.3` | WebUI 和 Windows 桌面版 | `>=24.9.0` |

后续 DSH 版本可以安装此包，Node.js 要求请查阅所用 DSH 版本的说明。参见[兼容性详情](docs/compatibility.zh-CN.md)。

## 常见问题

| 问题 | 检查方法 |
| --- | --- |
| 找不到 DeepCanary | 在当前使用的 DSH 应用中打开**插件**。使用 WebUI 时，核对数据目录和配置名称是否与启动命令一致。如有提示，先重启。 |
| DSH 安装了旧版本 | 输入完整的 `dsh-deepcanary@0.1.9-rc.1`，并使用 npm 官方源 `https://registry.npmjs.org/`。 |
| 安装被拒绝 | 按[兼容性](#兼容性)核对 DSH 和 Node.js 版本。 |
| 没有系统横幅 | 确认 DSH 仍在运行，再检查浏览器权限、Windows“勿扰”和[提醒设置](#通知)。 |
| 无法返回会话 | 确认该会话仍列在当前 DSH 应用中。你仍可以在收件箱查看提醒。 |
| 面板位置或大小不合适 | 选择**布局 → 重置布局**。 |
| 提醒状态保存失败 | 点击收件箱的**刷新状态**重试。如果仍然失败，检查运行 DSH 的账户是否能写入对应的配置目录。 |

报告普通问题时，请附上 DSH 与 DeepCanary 版本、操作系统及复现步骤，提交前移除私密内容。[报告问题](https://github.com/Oscar-Williams/dsh-deepcanary/issues)。

## 安全与隐私

DeepCanary 在 DSH 数据目录中保存提醒元数据，并使用本地规则决定何时提醒。具体保存的文件与通知行为见[数据与隐私](docs/security.zh-CN.md)。

请通过私密渠道报告漏洞。参见[安全政策](SECURITY.zh-CN.md)。

## 参与开发

了解如何准备开发环境、运行测试和提交修改。[贡献指南](CONTRIBUTING.zh-CN.md) · [文档目录](docs/README.zh-CN.md)。

## 致谢

感谢 DeepSeek Harness 团队提供插件接口，也感谢社区目录收录 DeepCanary。[DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) · [dsh.works 插件目录](https://github.com/dshworks/awesome-dsh-plugins) · [Awesome DeepSeek Harness Plugins](https://github.com/jqueryscript/awesome-dsh-plugins)。

## 许可证

采用 [MIT 许可证](LICENSE)开源。版权所有 © 2026 Oscar Williams。
