# Roadmap

DeepCanary helps people leave tasks running, notice when their input is needed, and return to the correct work.

## Delivered in 0.1.8

- One package and interface for DSH alpha.3 and RC5, on WebUI and Windows Desktop.
- Pending, Snoozed, and Activity views with a movable, resizable panel, list/detail navigation, keyboard controls, and device-local layout.
- Independent question, approval, task execution, job, subagent, and automation identities.
- State migration, restart recovery, concurrent-action protection, and persisted notification claims.
- Native notification and return behavior in running Web and Desktop hosts.

## Further work

| Goal | Basis for implementation |
| --- | --- |
| Follow DSH updates | Check new public session, automation, job, menu, and settings contracts when a released change affects the plugin |
| Improve reminder accuracy | Turn a reproduced missed, false, late, or duplicate reminder into a focused regression and fix |
| Improve long-running work | Extend reconciliation when real background or child tasks expose a missing lifecycle |
| Refine the inbox | Address observed difficulty finding, reading, rescheduling, or returning to work |
| Support another platform | Complete its installation, notification, navigation, and input checks in the actual application |
| Tune reminder policy | Compare interruption cost and useful reminders across independent tasks and workdays |

The deterministic core continues to own attention decisions and C3 authority. Any new source of facts must preserve task ownership, privacy, bounded state, and quiet healthy work.

The [changelog](../CHANGELOG.md) describes delivered changes. The [development guide](development.md) explains how to implement and validate a change.
