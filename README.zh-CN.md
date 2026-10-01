# DeepCanary

**任务正常时保持安静，需要你时及时提醒，返回后直达正确会话。**

[English](README.md) · 简体中文 · [文档](docs/README.md) · [更新记录](CHANGELOG.md)

DeepCanary 为 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) 提供本地任务收件箱，将提问、审批、故障与完成摘要集中呈现，并通过提醒策略控制打扰频率。

**版本：0.1.4-rc.1 · 宿主基线：DSH 0.2.0-rc.2。** 当前为候选版本。npm 的 `latest` 与 `next` 均选择本 RC，渠道名称表示默认安装入口。实际适用范围见[兼容性与设备覆盖](docs/compatibility.md)。

![DeepCanary 收件箱](assets/deepcanary-panel-zh.png)

## 安装

### 桌面应用

打开 DSH **插件**，使用官方包安装控件，输入：

```text
dsh-deepcanary@0.1.4-rc.1
```

按照管理器提示启用或重启；重启前保存正在进行的工作。桌面应用维护自己的专用 profile，安装、更新和卸载均优先使用应用内管理器。

### 使用 DSH CLI 的 WebUI

核对已安装的宿主为 `0.2.0-rc.2`，然后安装到 **web** profile：

```sh
dsh --version
dsh plugin --profile web add dsh-deepcanary@0.1.4-rc.1
dsh --profile web
```

打开 DSH 打印的认证地址。固定版本便于复现安装；也可将 [GitHub Releases](https://github.com/Oscar-Williams/dsh-deepcanary/releases/tag/v0.1.4-rc.1) 下载的 `.tgz` 路径传给 `plugin add`。镜像尚未同步时使用官方 npm registry。

### 已构建的 DSH 源码检出

在 `dsh-v0.2.0-rc.2`、提交 `639ed015397290b3745d163aafe02ffee4aa3f84` 的已构建检出中运行：

```sh
npx --yes pnpm@11.7.0 run dsh plugin --profile web add dsh-deepcanary@0.1.4-rc.1
npx --yes pnpm@11.7.0 run dsh --profile web
```

源码环境准备遵循 [DSH 官方说明](https://github.com/deepseek-ai/deepseek-harness/tree/dsh-v0.2.0-rc.2)。插件仓库使用独立 npm 锁文件，维护命令见[开发文档](docs/development.md)。

### 更新与卸载

更新 Web profile 时重新执行固定版本安装命令，并遵循宿主加载提示。卸载命令为：

```sh
dsh plugin --profile web remove dsh-deepcanary
```

源码检出使用 `npx --yes pnpm@11.7.0 run dsh plugin --profile web remove dsh-deepcanary`。卸载保留宿主 profile、会话和已有提醒数据。

## 使用

1. 在侧边栏打开 **DeepCanary**。
2. 在 **设置 → 插件 → DeepCanary** 配置提醒等级、每小时预算和静默时段。
3. 按需开启浏览器通知，然后正常执行任务。
4. 从收件箱返回相关会话，查看证据、稍后提醒或提交明确反馈。

| 等级 | 含义 | 行为 |
| --- | --- | --- |
| C1 | 建议查看 | 常规结果与完成摘要保留在收件箱。 |
| C2 | 需要处理 | 故障与可能停滞按通知策略判断。 |
| C3 | 立即处理 | 需要 Host/runtime 权威事实，包括开放的人类问题与审批边界。 |

相关事件合并并去重；健康长工具获得有界进展宽限，并行工具完成后及时重算。异步问题超时后仍可回答，接纳答案后提醒闭合。完成摘要在恢复和重载后保留。

收件箱支持不透明亮暗主题、尺寸调整、键盘操作和展开证据。返回功能使用 DSH 公开会话接口；目标失效时明确显示可用性并保留摘要。

设置通过宿主 revision 保护并发修改。发生冲突时保留草稿；放弃修改并重新读取后，可基于当前快照继续编辑。

## 隐私

提醒状态保留在本地 profile，仅保存有界元数据、哈希引用、明确反馈和导航所需的本地会话句柄。会话原文、提示词、模型输出、工具参数和 API 凭据不进入采集的提醒状态。

插件 HTTP 接口继承宿主共享 API 的认证、Host/Origin 防护，限制 JSON 大小并使用脱敏错误响应。反馈采集可选；打开和确认记录交互，提醒有用性由明确反馈提供。详见[安全](docs/security.md)与[反馈校准](docs/feedback-calibration.md)。

## 适用范围

- 通知依赖 Host 与渲染页面运行、浏览器授权及系统设置。操作系统投递结果在实际观察前保持未知。
- Desktop 共用确定性核心、设置及收件箱。隐藏窗口通知唤回与 Toast 点击返回依赖公开宿主能力和设备证据；本 RC 提供渲染器通知路径。
- 当前开发与设备验证入口为 Windows WebUI。CI 所在平台具有自动化源码覆盖，原生通知覆盖独立说明。
- Supervisor 保持实验状态、默认关闭，其本地投影随所属 Host 进程运行。
- 自然反馈用于具体缺陷调查；跨工作日策略校准与模型 Judge 继续遵循证据门槛，当前实时策略保持确定性。

[兼容性](docs/compatibility.md)说明覆盖范围与排查方式，[架构](docs/architecture.md)说明实现，[贡献指南](CONTRIBUTING.md)说明维护流程。

## 许可证

[MIT](LICENSE)。基于 DeepSeek Harness 公开插件接口构建。
