<div align="center">

# DeepCanary

**Let long tasks run quietly. Know when they need you.**

[![npm latest](https://img.shields.io/npm/v/dsh-deepcanary/latest?label=npm)](https://www.npmjs.com/package/dsh-deepcanary)
[![CI](https://github.com/Oscar-Williams/dsh-deepcanary/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/Oscar-Williams/dsh-deepcanary/actions/workflows/ci.yml)
[![DSH Web](https://img.shields.io/badge/DSH-Web-2563eb)](docs/compatibility.md)
[![License: MIT](https://img.shields.io/badge/license-MIT-2ea44f.svg)](LICENSE)

English · [简体中文](README.zh-CN.md) · [Documentation](docs/README.md) · [Changelog](CHANGELOG.md)

[Features](#what-you-get) · [Quick start](#quick-start) · [FAQ](#faq) · [Contributing](#contributing) · [Acknowledgments](#acknowledgments)

</div>

DeepCanary is a local attention inbox for [DeepSeek Harness (DSH)](https://github.com/deepseek-ai/deepseek-harness). It brings approvals, questions, failures, and completion summaries into one place, so you can step away from a running task and return to the session that needs you.

![DeepCanary Inbox in DSH Web](assets/deepcanary-panel-en.png)

*The Inbox opens from the DSH sidebar. Interface shown on an earlier DSH release; host appearance varies by version.*

## What you get

- **An inbox across tasks.** See pending approvals, unanswered questions, possible stalls, service failures, and task outcomes without checking each session.
- **Fewer repeat interruptions.** Related signals are grouped; deduplication, quiet hours, notification budgets, and snooze keep routine activity quiet.
- **A direct route back.** Open the relevant DSH session from an Inbox item or browser notification. Resolved conditions close their earlier reminders.
- **Reasons you can inspect.** Each item explains the signal and the policy behind it. A possible stall remains a suggestion to check, not a claim that a task has failed.
- **Local control.** Acknowledge, snooze, mute, or give feedback in a resizable English/Chinese panel. DeepCanary does not approve, stop, or restart tasks.

## Quick start

Requires an existing DSH Web installation and Node.js `22.19+` within the 22.x line, or `24+`. DSH `0.1.2-alpha.5` is the build and CI baseline; `0.1.3-alpha.1` has separate compatibility coverage. Read the [version and platform limits](docs/compatibility.md) before using a different host.

The current default release is **`0.1.1-rc.5` (prerelease)**. npm `latest` and the preview channel `next` currently point to this version.

With `dsh` available in your terminal, install into the profile you use:

```sh
dsh plugin --profile web add dsh-deepcanary@latest
dsh web
```

Finish active tasks before restarting an existing DSH process. Open the address printed by the new process, then select **DeepCanary** in the sidebar.

Using a DSH source checkout? Run the equivalent commands from that checkout:

```sh
npx --yes pnpm@11.7.0 dsh plugin --profile web add dsh-deepcanary@latest
npx --yes pnpm@11.7.0 dsh web
```

For a reproducible installation, replace `dsh-deepcanary@latest` with `dsh-deepcanary@0.1.1-rc.5`. Use `dsh-deepcanary@next` when you want the preview channel. You can also download the fixed `.tgz` from [GitHub Releases](https://github.com/Oscar-Williams/dsh-deepcanary/releases/tag/v0.1.1-rc.5) and pass its path to the same `plugin add` command. If a registry mirror has not synchronized the version, use the official npm registry or the release artifact.

### Update or remove

To update, rerun the installation command above. To remove DeepCanary from the same profile:

```sh
dsh plugin --profile web remove dsh-deepcanary
```

In a DSH source checkout, prefix this command with `npx --yes pnpm@11.7.0`. Finish active tasks before restarting DSH to apply the change. Package removal leaves saved reminder state in the [local data directory](docs/security.md#stored-data); it does not require deleting your DSH profile or sessions.

## Your first reminder

1. Open **DeepCanary** from the DSH sidebar.
2. Choose **Enable browser notifications** and allow the browser permission request. Desktop delivery also needs notifications enabled for your browser in the operating system.
3. Run your tasks normally. Open an Inbox item to inspect its reason, return to its session, or acknowledge, snooze, mute, and review it.

Configure notification level, quiet hours, budgets, and retention under **DSH Settings → Plugins → DeepCanary**. Normal completion is recorded in the Inbox; interruptions depend on the signal and your policy. The highest-severity reminders require host or runtime evidence and do not consume the ordinary notification budget.

## Design choices

**Attention is not activity.** A busy task does not always need a reminder. DeepCanary separates runtime facts from attention policy, then groups related events into one decision point.

**Uncertainty stays visible.** Silence can suggest a stall, but it does not prove failure. A browser-created notification does not prove that the operating system displayed it. The plugin keeps those distinctions explicit.

**The task stays in DSH.** DeepCanary is an observer and navigation aid. It does not replace the agent loop or add approval, shell, or process-control tools. No additional model API is required.

See the [architecture](docs/architecture.md) for the event model, policy, and persistence boundaries.

## Privacy and limits

- State stays local: bounded reminder metadata, hashed references, feedback, and a local session handle for navigation. Conversation text, model output, tool arguments, and credentials are not persisted. See [security and privacy](docs/security.md).
- Browser notifications require DSH and the web page to remain running. Permission settings, background throttling, and OS notification settings can affect delivery; closing the page stops its notifications.
- The Inbox works without desktop notification permission. Windows/Edge notification display, retention, and click-back were observed for RC4; this is not a guarantee for every browser or OS.
- Persistent Supervisor is experimental and disabled by default. It is not a standalone background service and does not keep running after DSH exits.
- WSL2 end-to-end desktop delivery, physical touch hardware, and screen-reader output do not yet have release-level validation. See [compatibility](docs/compatibility.md).

## FAQ

<details>
<summary>Why does my terminal say dsh: command not found?</summary>

DeepCanary needs an existing DSH installation. If you use a DSH source checkout, run the pinned pnpm commands in [Quick start](#quick-start) from that checkout. Installing this plugin alone does not install the DSH host.

</details>

<details>
<summary>Why is an item in the Inbox but not in a desktop notification?</summary>

Not every Inbox item triggers an interruption. Check your notification level, quiet hours, browser permission, and OS notification settings. DSH and the page must remain running. See [notification troubleshooting](docs/compatibility.md#troubleshooting).

</details>

<details>
<summary>Why do I still see an older version after an update?</summary>

Moving an npm channel does not update an existing installation. Rerun the installation command for the profile you actually use, then restart DSH after finishing active tasks. If a registry mirror is behind, use the official npm registry or the fixed Release artifact linked above.

</details>

## Contributing

Bug reports, focused improvements, and translations are welcome. Include your plugin version, DSH version, operating system, browser, and reproduction steps in a [GitHub issue](https://github.com/Oscar-Williams/dsh-deepcanary/issues). Remove credentials and private session content before sharing logs.

Start with [Contributing](CONTRIBUTING.md) and the [development guide](docs/development.md). [Release notes](CHANGELOG.md) describe changes between versions.

## Acknowledgments

- [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) and its maintainers, for the runtime, plugin APIs, and WebUI extension points that DeepCanary builds on.
- [React](https://react.dev/) and its contributors, for the component library used in the DSH Web integration.

DeepCanary is an independent community plugin.

## License

[MIT](LICENSE)
