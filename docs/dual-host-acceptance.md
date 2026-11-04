# Web and Desktop testing

[简体中文](dual-host-acceptance.zh-CN.md) · [Development](development.md)

Use an isolated home for each DSH version and separate Web/Desktop profiles. Keep daily data outside test profiles. Install the same frozen tgz in all four combinations: alpha.3 and RC5, each on WebUI and Windows Desktop.

## Installation and startup

Confirm that the host accepts the package, the plugin activates after a cold start, and its displayed version matches the package. For Desktop, identify whether the application is official or built from pinned source. Test an upgrade with existing reminder state when persistence or migration changes.

If an official alpha.3 Desktop package is unavailable, build `apps/desktop` from its pinned source and test that application. Describe the result as a local unsigned build.

## Choose checks for the change

| Changed area | Cases to exercise |
| --- | --- |
| Human requests | Question, timeout, late answer, approval, and independent closure |
| Task ownership | Root task, child task, Job, fork, and automation reusing a session |
| Persistence | Existing state migration, restart, failed write, and recovery |
| Concurrent actions | Two pages, stale revision, repeated action, and retained draft |
| Notifications | Foreground, background, minimized/hidden Desktop, click, and stale target |
| Interface | Light/dark themes, narrow layout, keyboard, drag, resize, and zoom |
| Authentication | Authenticated requests succeed and unauthenticated requests are refused |

Resolve defects in the affected behavior and rerun those cases. Reuse successful results when their inputs have not changed. For a documentation or version update, confirm installation and loaded identity without repeating the full interaction matrix.

## Notification lifecycle

Keep the host and a renderer running. Test a real system banner and its click separately from internal delivery events. A click must select the current reminder and correct session. Removed targets must leave the user in the inbox with a useful message.

Minimizing or hiding a Desktop window can leave the application running. Fully quitting it stops the plugin. Browser and Windows permissions, Do Not Disturb, quiet hours, and reminder budgets affect delivery.

## Keep test data local

Store host identities, package hash, outcomes, screenshots, and diagnostic logs outside Git. Remove private conversation content and authentication data before sharing a bug report.

Controlled fixtures, emulated touch, and checks on one operating system have their own scope. Describe untested platforms and future host releases accurately.
