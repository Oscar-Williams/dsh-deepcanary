# Architecture

[简体中文](architecture.zh-CN.md) · [Documentation](README.md)

Public DSH facts flow through providers, deterministic rules, delivery policy, and the inbox. Providers select facts; the core decides attention; the client displays state and requests reminder actions.

## Task identity

A task has a `taskRef` and an `executionGeneration`. Native subagent parentage and job ownership form task groups. Forks retain separate identity. Each human interaction has its own `humanActionRef`, so handling one approval cannot close another.

Sequence watermarks separate executions and reject old callbacks. Inherited fork history cannot produce a new reminder.

Automation runs use the schedule occurrence, target session, delivered message, and admitted turn. A matching execution can settle that occurrence. Delivery, running, completion, failure, cancellation, and unknown state are distinct.

## Attention

| Level | Basis |
| --- | --- |
| C3 | A current authoritative question or approval blocks progress |
| C2 | An observed failure or abnormal state needs inspection |
| C1 | An informational update is available |
| C0 | Healthy work needs no attention |

Timed questions use DSH's question projection. A blocking question is C3; after a foreground timeout it becomes a continued C1 item. An accepted answer closes its exact call. Queued input alone does not establish an accepted execution.

The explicit `turn/end` outcome `aborted → user` enters Activity quietly. Unknown aborts retain C2. An `ABORTED` error code alone does not establish user cancellation.

## Persistence and actions

The metadata store writes schema 2 atomically and migrates schema 1. It preserves schedules, notification generations, deduplication, budgets, and claims. Invalid or unsupported data is retained and reported.

State belongs to a profile and plugin instance. One lifetime writer owns the ledger. Save bursts coalesce, and notification authorization waits for the actual durable save result.

Protocol 3 actions carry a request ID, expected revision, and execution generation. A repeated action returns its receipt. Stale state returns HTTP 409 and the client refreshes while preserving drafts. Notification callbacks additionally check `notificationGeneration`.

The inbox retains up to 500 items, prioritizing human requests and explicit schedules. When protected items fill that capacity, unread source watermarks are retained and incomplete coverage is reported. Background watches and automation history are each bounded at 256.

## Client and delivery

Pending, Snoozed, and Activity use the same host snapshot. The panel supports list/detail layouts, pointer capture, viewport bounds, keyboard editing, and cancellation. Layout is stored on the device.

A notification needs a persisted generation claim and budget before construction. Construction, delivery, visibility, and click are separate observations. Native task completion remains owned by DSH.

Host menus, settings contributions, subscriptions, and effects are released with their owner. [Public DSH interfaces](dsh-surface-audit.md) describes the integration points.
