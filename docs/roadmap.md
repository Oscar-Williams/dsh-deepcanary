# Roadmap

[简体中文](roadmap.zh-CN.md)

DeepCanary helps people leave tasks running, notice when input is needed, and return to the correct work.

## Delivered in 0.1.8

- One package and interface for DSH alpha.3 and RC5, on WebUI and Windows Desktop.
- Pending, Snoozed, and Activity views; a movable, resizable panel; list/detail navigation; keyboard controls; and device-local layout.
- Independent question, approval, execution, Job, subagent, and automation identities.
- State migration, restart recovery, concurrent-action protection, and persisted notification claims.
- Native notifications and session return in running Web and Desktop hosts.

## Further work

| Goal | Basis for implementation |
| --- | --- |
| Follow DSH updates | Check changed public contracts when a released update affects the plugin |
| Improve reminder accuracy | Reproduce a missed, false, late, or duplicate reminder, then add a focused regression and fix |
| Improve long-running work | Extend reconciliation when background or child tasks expose a missing lifecycle |
| Refine the inbox | Address observed difficulty finding, reading, rescheduling, or returning to work |
| Support another platform | Test installation, notifications, navigation, and input in its actual application |
| Tune reminder policy | Compare interruptions and useful reminders across independent tasks and workdays |

The deterministic core owns attention decisions and C3 authority. New facts must preserve task ownership, privacy, bounded state, and quiet healthy work.

See the [changelog](../CHANGELOG.md) for delivered changes and [development guide](development.md) for implementation.
