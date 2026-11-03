# Architecture

The existing deterministic chain remains: public Host facts → CanarySignal → judgeSignal → delivery policy → Inbox metadata. Providers select facts; the core decides attention; the client renders state and requests local actions.

## Identity and lifecycle

A task has a taskRef and executionGeneration. Native subagent parentage and job ownership form groups; ordinary forks retain separate identity. Human interactions have independent humanActionRef values. A decision for one approval cannot close another.

Session sequence watermarks fence duplicate and old callbacks. Execution identity uses the source turn boundary rather than observation time. Seeded-fork inherited history cannot create fresh reminders.

An automation receipt identifies a schedule occurrence, target Session and delivered message. A matching admitted user message establishes its trigger watermark and turn. Only that execution can settle the run. Delivered, running, completed, failed, aborted and unknown remain distinct.

Timed questions use the Host's userQuestions projection. Open is blocking C3; continued is C1; an accepted answer closes that call. Enqueued input does not count as accepted execution. Host task state, reminder handling and delivery state remain separate.

An explicit `turn/end` outcome with `reason.kind = aborted` and nested `reason.kind = user` is quiet C1 Activity. Unknown aborts remain C2. An error code named ABORTED does not establish user cancellation.

## Persistence and actions

MetadataStore writes schema 2 atomically and migrates schema 1 without replacing the reminder state machine. It preserves schedules, notification generations, dedupe, budgets and claims. Invalid JSON or unsupported data remains untouched and prevents silent activation with an empty ledger.

State is scoped to profile and plugin instance. A lifetime writer claim prevents concurrent Hosts from writing the same ledger. Save bursts coalesce; callers waiting for a durable notification authorization receive the actual save result. Save failure is visible and withholds authorization.

Protocol 3 actions carry an idempotency request ID, expected revision and item execution generation. Repeating the same action returns its receipt; stale state returns 409. The client refreshes while preserving drafts. Notification callbacks additionally carry notificationGeneration.

The Inbox retains at most 500 items, favoring human requests and explicit schedules. If protected items fill the limit, it preserves them, records unread source watermarks and reports incomplete coverage. Authoritative reconciliation resumes when capacity is available. Background watches and automation history are each bounded at 256.

## Client

Pending, Snoozed and Activity share the same Host snapshot. A wide panel separates list and detail; narrow layout preserves the selected item and draft. Device-local geometry uses pointer capture, viewport bounds, keyboard editing and cancellation. Host menus and settings contributions are released with their owner.

A notification requires a persisted generation-scoped claim and budget before construction. Construction, delivery evidence, visibility and click are separate observations. None changes native task completion.
