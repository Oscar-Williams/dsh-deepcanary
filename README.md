# DeepCanary

Local task reminders for DeepSeek Harness. Know when a task needs you, keep routine work quiet, and return to the right session.

[简体中文](README.zh-CN.md) · [Development](docs/development.md) · [Compatibility](docs/compatibility.md)

## 0.1.8 candidate

Requires **DSH 0.2.1-rc.5 or >=0.2.2-alpha.3**. alpha.3 is the development baseline; RC5 receives the same features and UI. No older host is supported. Later DSH releases are admitted without a version whitelist; admission does not claim that an untested release has been verified.

`0.1.8-rc.2` is a local candidate. GitHub Release and npm publication are separate steps and have not been performed.

## Inbox

![DeepCanary task inbox](assets/deepcanary-panel-en.png)

[Screenshot source and sample provenance](docs/ui-captures.md).

- **Pending** contains active human requests and updates needing attention. Ordinary completions, compactions and explicit user cancellations appear in **Activity**. **Snoozed** retains reminders you scheduled.
- A wide panel separates the task list and detail. At narrow widths it switches between them while preserving selection and drafts.
- Drag the title bar, resize any edge or corner, adjust the list divider, dock, expand, restore, or reset. The default size is 880×640; the minimum is 360×320 when the viewport permits. Layout stays local to the device.
- The Layout menu offers keyboard movement and resizing: arrows adjust, Shift makes larger steps, Enter commits, Escape cancels. Closing returns focus to the trigger.
- Handling a reminder changes local metadata. Approval and question answers remain in the Host's native flow. Navigation checks the current target before returning there.

## Reminders and recovery

Only current authoritative approval or blocking-question facts produce C3. A timed question becomes a quiet C1 follow-up after its foreground wait ends; a late answer closes only its own question. Connection loss and tool failures remain C2 inspection hints. Quiet hours, deduplication and a rolling C2 budget reduce interruptions.

Session executions, jobs, subagents and automation occurrences retain independent identities. Automation delivery proves delivery; completion requires the matching execution. Ordinary forks remain separate from subagents.

State schema 2 migrates existing items, schedules, budgets and delivery claims. One Host owns a ledger. Tabs connected to that Host share state; different profiles have separate ledgers. A failed save pauses notification authorization and exposes a retry. Invalid or unknown state is preserved and activation fails visibly instead of clearing it.

## Install

Use the exact frozen candidate file supplied with its SHA-256 record. In Desktop, open **Plugins → Add plugin** and choose that file. Follow the manager's activation or restart result.

For WebUI, use the selected Host's CLI and an explicit profile:

```sh
dsh plugin --profile web add ./dsh-deepcanary-0.1.8-rc.2.tgz --registry=https://registry.npmjs.org/
dsh web
```

When using npm to launch alpha.3, select `@deepseek-ai/dsh@0.2.2-alpha.3` explicitly. Use `@deepseek-ai/dsh@0.2.1-rc.5` for RC5. A Desktop profile belongs to the application; use its manager, or its bundled CLI after the application has fully exited.

For an installed version, use the manager's supported update operation. If it requires removal before replacement, retain the profile and its state, replace only the bundle, then confirm the loaded version. Never bypass Host version checks.

## Notifications and privacy

Notifications require the current renderer's available permission and public capability. Permission denied, no renderer, hidden windows, and application exit have different delivery coverage; a successful claim or constructor is not proof that a person saw a notification. Delivery never completes the underlying task.

DeepCanary stores bounded metadata, hashed joins, structured states and safe reason codes. It does not retain prompts, answers, tool arguments, model output or raw failure text. Read [security](docs/security.md) for the storage and authentication boundaries.

[Architecture](docs/architecture.md) · [Release checklist](docs/release-checklist.md) · [Changelog](CHANGELOG.md)
