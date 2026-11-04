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

[安装](#安装) · [使用](#使用) · [通知](#通知) · [更新或卸载](#更新或卸载) · [兼容性](#兼容性) · [常见问题](#常见问题)

## 安装

**0.1.8-rc.4** 通过 GitHub 预发布提供，按下方步骤安装本版。npm 徽章显示当前 npm 渠道的版本。

DeepCanary 现已支持 **DSH 0.2.1-rc.5 或 >=0.2.2-alpha.3**。桌面版自带运行时。WebUI 中，DeepCanary 支持 Node `^22.19.0 || >=24.0.0`，DSH alpha.3 要求 Node 24.9 及以上版本。尚未安装宿主时，先按 [DSH 安装说明](https://github.com/deepseek-ai/deepseek-harness#readme)操作。

### Windows 桌面版

1. 在 DSH 中打开**插件 → 添加插件**。
2. 粘贴以下包地址并安装。

   ```text
   https://github.com/Oscar-Williams/dsh-deepcanary/releases/download/v0.1.8-rc.4/dsh-deepcanary-0.1.8-rc.4.tgz
   ```
3. 按管理器提示完成激活或重启。
4. 点击侧边栏的 **DeepCanary**。

### WebUI

先停止 WebUI 服务，再安装到平时启动 DSH 所用的 profile。

安装、更新和卸载时，沿用该宿主原来的 `DSH_HOME`。使用自定义 home 时先设置；PowerShell 示例：

```powershell
$env:DSH_HOME = "<现有 DSH 数据目录>"
```

将占位内容换成宿主已经使用的目录。

```sh
dsh plugin --profile web add https://github.com/Oscar-Williams/dsh-deepcanary/releases/download/v0.1.8-rc.4/dsh-deepcanary-0.1.8-rc.4.tgz --registry=https://registry.npmjs.org/
dsh web
```

使用其他 profile 时，将两条命令中的 `web` 换成它的名称。

<details>
<summary>安装离线包或使用桌面版 CLI</summary>

从[本版 Release](https://github.com/Oscar-Williams/dsh-deepcanary/releases/tag/v0.1.8-rc.4) 下载 `dsh-deepcanary-0.1.8-rc.4.tgz` 与 `SHA256SUMS`。在 PowerShell 中计算哈希，与 `SHA256SUMS` 中对应文件的记录比较。

```powershell
Get-FileHash ./dsh-deepcanary-0.1.8-rc.4.tgz -Algorithm SHA256
```

WebUI 先停止服务，再在下载目录中执行以下命令。

```sh
dsh plugin --profile web add ./dsh-deepcanary-0.1.8-rc.4.tgz --registry=https://registry.npmjs.org/
dsh web
```

使用桌面版 CLI 时，先从**应用 → 退出**正常关闭 DSH。在应用安装目录下的 `resources/runtime/cli/bin` 中打开 PowerShell。桌面版若使用自定义 home，先在该会话中设置：

```powershell
$env:DSH_HOME = "<现有 DSH 数据目录>"
```

再使用已下载包的实际完整路径安装：

```powershell
.\dsh.cmd plugin --profile desktop add "<dsh-deepcanary-0.1.8-rc.4.tgz 的完整路径>" --registry=https://registry.npmjs.org/
```

完成后重新打开 DSH。应用内的插件管理器会直接使用当前应用的 home 和 profile。

</details>

## 使用

| 分类 | 显示内容 |
| --- | --- |
| **待处理** | 等待回答或审批的事项，以及需要关注的任务变化 |
| **稍后** | 已安排在指定时间再次提醒的事项 |
| **动态** | 普通完成、上下文压缩，以及你主动停止的任务 |

选择一条提醒查看详情，点击**跳转到 DSH**进入对应会话，在 DSH 原生界面中回答问题或处理审批。**已处理**关闭这条提醒，**稍后提醒**为它安排下一次提醒时间。

拖动标题栏可移动面板，拖动任一边缘或角落可调整大小，列表与详情之间的分栏也可拖动。**布局**菜单提供停靠、展开、恢复和重置。默认尺寸为 880×640，会适应可视区域，并在当前设备保存布局。

从**布局**菜单进入键盘移动或调整大小后，用方向键调整，Shift 加大步长，Enter 确认，Esc 取消。窄屏切换列表和详情时会保留选择与草稿。

## 通知

打开收件箱，点击**提醒设置**。在浏览器中允许 DSH 站点发送通知，并在 Windows 中允许 Edge 或 DeepSeek Harness 显示通知。

保留 DSH 网页或桌面应用运行，后台网页和隐藏的桌面窗口也可收到通知。完全退出 DSH 后，插件随之停止。Windows“勿扰”、静默时段和浏览器权限会影响系统横幅显示。

| 等级 | 含义 |
| --- | --- |
| **C3** | 任务正在等待回答或审批 |
| **C2** | 需要检查异常状态 |
| **C1** | 有更新可在动态中查看 |

点击通知返回对应提醒和会话。通知送达或提醒被标记为已处理，都不会改变 DSH 任务的完成状态。

## 更新或卸载

桌面版在**插件**页面使用上方包地址替换 DeepCanary，或执行卸载，并按提示重启。

WebUI 更新前先停止服务。

```sh
dsh plugin --profile web add https://github.com/Oscar-Williams/dsh-deepcanary/releases/download/v0.1.8-rc.4/dsh-deepcanary-0.1.8-rc.4.tgz --registry=https://registry.npmjs.org/
dsh web
```

从该 profile 卸载时，先停止服务，再执行 `dsh plugin --profile web remove dsh-deepcanary`。

更新时沿用宿主原来的 home 和 profile，已有提醒和设置保存在其中。若管理器要求先移除再替换，移除插件后重新添加新包。

## 兼容性

同一个包已在 **RC5 和 alpha.3 的 WebUI、Windows 桌面版**中验证。alpha.3 桌面验证使用固定源码的未签名构建，RC5 使用官方应用。版本声明也接受后续 DSH 更新，实际覆盖范围见[兼容性说明](docs/compatibility.zh-CN.md)。

## 常见问题

| 问题 | 检查方法 |
| --- | --- |
| 找不到 DeepCanary | 在当前宿主的**插件**页面确认已安装，并核对安装时使用的 home 和 profile；有重启提示时先重启。 |
| 安装被拒绝 | 检查 DSH 版本及[兼容性要求](docs/compatibility.zh-CN.md)。 |
| npm 安装的是旧版 | 本次预发布使用上方 GitHub 包地址安装，npm 渠道按各自进度发布。 |
| 包下载失败 | 检查 GitHub Release 地址、网络与代理设置；依赖从选定的 npm 源下载。 |
| 没有系统横幅 | 检查通知权限、Windows“勿扰”、提醒设置，以及 DSH 是否仍在运行。 |
| 无法返回会话 | 会话可能已删除，或已不在当前宿主可访问的范围中；可先在收件箱查看提醒。 |
| 面板尺寸不合适 | 选择**布局 → 重置布局**。 |
| 保存失败 | 使用收件箱状态区域的重试按钮，并保留已有状态文件。 |

普通问题可提交至 [GitHub Issues](https://github.com/Oscar-Williams/dsh-deepcanary/issues)，附上版本、平台和复现步骤，并移除私密内容。

## 安全与隐私

DeepCanary 在 DSH profile 中保存提醒元数据，使用本地规则判定提醒。会话正文、提示词、答案、工具参数和原始失败文本不进入提醒账本，详见[数据与隐私](docs/security.zh-CN.md)。

漏洞请通过[安全政策](SECURITY.zh-CN.md)中的私密渠道报告。

## 参与开发

[贡献指南](CONTRIBUTING.zh-CN.md)介绍环境准备、定向测试、文档和 PR 要求。[文档目录](docs/README.zh-CN.md)提供架构、宿主集成和发布流程的入口。

## 致谢

感谢 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) 提供宿主和插件接口，感谢 [dsh.works 插件目录](https://github.com/dshworks/awesome-dsh-plugins)与 [Awesome DeepSeek Harness Plugins](https://github.com/jqueryscript/awesome-dsh-plugins) 收录 DeepCanary。

## 许可证

采用 [MIT 许可证](LICENSE)，版权归 © 2026 Oscar Williams。可按许可证使用、修改和分发本软件，并保留其中的版权声明与许可声明。

[截图说明](docs/ui-captures.zh-CN.md)
