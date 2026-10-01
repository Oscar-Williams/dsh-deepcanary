# DeepCanary

**Let tasks run quietly. Know when they need you. Return to the right session.**

[![npm](https://img.shields.io/npm/v/dsh-deepcanary/latest)](https://www.npmjs.com/package/dsh-deepcanary)
[![CI](https://github.com/Oscar-Williams/dsh-deepcanary/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/Oscar-Williams/dsh-deepcanary/actions/workflows/ci.yml)
[![MIT](https://img.shields.io/badge/license-MIT-blue)](LICENSE)

English · [简体中文](README.zh-CN.md) · [Documentation](docs/README.md) · [Changelog](CHANGELOG.md)

DeepCanary adds a local task inbox to [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness). It brings questions, approvals, failures and completion summaries together, with quiet notification policies and a direct return to the relevant session.

**Version: 0.1.4-rc.1 · Host baseline: DSH 0.2.0-rc.2.** This is a release candidate. The npm `latest` and `next` channels both select this RC; their channel names describe installation defaults. See [compatibility and device coverage](docs/compatibility.md) for the supported scope.

![DeepCanary Inbox](assets/deepcanary-panel-en.png)

## Install

### Desktop

Open DSH **Plugins**, use its official package installation control, and enter:

```text
dsh-deepcanary@0.1.4-rc.1
```

Apply the change using the manager's enable/restart instructions. Save active work before restarting. Desktop manages its own reserved profile; use the application's manager for installation, update and removal.

### WebUI with the DSH CLI

Check that your installed host is DSH `0.2.0-rc.2`, then install into the **web** profile:

```sh
dsh --version
dsh plugin --profile web add dsh-deepcanary@0.1.4-rc.1
dsh --profile web
```

Open the authenticated URL printed by DSH. The fixed package version makes installation reproducible. You can also pass the downloaded `.tgz` from [GitHub Releases](https://github.com/Oscar-Williams/dsh-deepcanary/releases/tag/v0.1.4-rc.1) to `plugin add`. Use the official npm registry if a mirror has not synchronized the release.

### Existing DSH source checkout

From a built checkout at `dsh-v0.2.0-rc.2` (commit `639ed015397290b3745d163aafe02ffee4aa3f84`), run the checkout's CLI script:

```sh
npx --yes pnpm@11.7.0 run dsh plugin --profile web add dsh-deepcanary@0.1.4-rc.1
npx --yes pnpm@11.7.0 run dsh --profile web
```

Follow DSH's [source setup instructions](https://github.com/deepseek-ai/deepseek-harness/tree/dsh-v0.2.0-rc.2) to prepare that checkout. The plugin repository uses its own npm lockfile; its development commands are in [development](docs/development.md).

### Update and remove

To update the Web profile, rerun the fixed-version installation command and follow DSH's reload instructions. To remove it:

```sh
dsh plugin --profile web remove dsh-deepcanary
```

In a source checkout, use `npx --yes pnpm@11.7.0 run dsh plugin --profile web remove dsh-deepcanary`. Removal preserves the host profile, sessions and saved reminder data.

## Use

1. Open **DeepCanary** from the DSH sidebar.
2. Configure it under **Settings → Plugins → DeepCanary**. Choose the notification level, hourly budget and quiet hours.
3. Enable browser notifications if you want them, then run your tasks normally.
4. Open an Inbox item to return to its session, inspect its evidence, snooze it or give explicit feedback.

| Level | Meaning | Behavior |
| --- | --- | --- |
| C1 | Suggested check | Routine outcomes and completion summaries remain available in Inbox. |
| C2 | Needs attention | Failures and possible stalls are evaluated against your notification policy. |
| C3 | Immediate human attention | Requires authoritative Host/runtime evidence, including open human questions and approval boundaries. |

Related events are grouped and deduplicated. Healthy long tools keep bounded progress grace; parallel tool completion updates that grace. Timed questions remain answerable after timeout, and accepted replies close their reminder. Completion summaries survive recovery and reload.

The resizable Inbox has opaque light/dark surfaces, keyboard controls and expandable evidence. Navigation uses DSH's public session-opening capability. When a target is unavailable, the item explains its availability and preserves the summary.

Settings use DSH's revision-aware configuration service. A concurrent change produces a conflict while retaining your draft; discard and reread before editing against the current snapshot.

## Privacy

Reminder state stays in the local profile. Stored fields are bounded metadata, hashed references, explicit feedback and the local session handle used for navigation. Conversation text, prompts, model output, tool arguments and API credentials remain outside captured reminder state.

Plugin HTTP endpoints use DSH's authenticated shared API, with Host/Origin checks, bounded JSON input and sanitized errors. Feedback collection is optional. Open and acknowledge actions describe interaction; usefulness is supplied by explicit feedback. See [security](docs/security.md) and [feedback calibration](docs/feedback-calibration.md).

## Limits

- Notifications require the Host and renderer to remain running, browser permission and suitable OS settings. Operating-system delivery remains unknown until observed.
- Desktop shares the deterministic core, settings and Inbox. Hidden-window notification wake-up and Toast click return require public Host support and device evidence; this RC provides the renderer notification path.
- Windows WebUI is the current development and device-validation entry. Other operating systems have automated source coverage where CI runs; native delivery coverage is documented separately.
- Supervisor remains experimental and disabled by default. Its local projection lasts while its owning Host process runs.
- Natural feedback currently supports specific defect investigation. Cross-workday policy calibration and model Judge adoption retain their evidence gates; current live policy is deterministic.

See [compatibility](docs/compatibility.md) for coverage and troubleshooting, [architecture](docs/architecture.md) for the implementation, and [contributing](CONTRIBUTING.md) to help improve it.

## License

[MIT](LICENSE). Built on the public DeepSeek Harness plugin APIs.
