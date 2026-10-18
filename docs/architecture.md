# How DeepCanary works

## Reminder flow

DSH public runtime facts pass through the adapter and providers into a deterministic attention core. Policy then groups related events, deduplicates, applies quiet hours and budget, commits bounded local state, and presents Inbox items and renderer notifications.

```text
Public Session / question projection / Host facts
  → normalized CanarySignal with evidence authority
  → deterministic AttentionVerdict
  → lifecycle + grouping + dedupe + notification policy
  → profile-local Inbox / renderer notification
  → public session return / explicit feedback / recovery
```

C3 requires authoritative Host/runtime evidence. Child-agent count alone reaches at most C2. Pending question projections use their public sequence watermark and exact call identity; timeout retains an answerable C1 item and admitted answers close it. Completion summaries remain visible after task completion. Parallel running calls recompute tool class when each call finishes, preserving and releasing bounded long-tool grace at the correct time.

## Host contracts

WebUI and official Windows Desktop use released DSH 0.2.1-rc.2. Session startup subscribes before reconciliation, buffers events, merges sequence-aware duplicates and tracks authoritative active-set convergence. Missing authority leaves pending work open until a public fact resolves it.

The optional public Job Registry supplies owner-scoped lifecycle and output-count events. Background tracking reads identity, kind, lifecycle, timestamps and increasing byte counts. Running jobs stay out of the reminder queue; unawaited producer outcomes enter the existing deterministic core. Awaited outcomes and intentional cancellation remain quiet. Durable Session job events reconcile watches after replacement, checking the original owner to reject copied fork history.

The atomic Inbox state also retains at most 256 background watches and recent settlement references. Unknown and settled records expire after seven days when reconciled; live authoritative work continues to be tracked. A missing registry/history fact preserves unknown status. Catch-up observes a producer outcome from durable metadata and leaves its prior waiter collection unknown; live waiter suppression uses the explicit public `awaited` flag. Foreground liveness uses increasing background byte counts and bounded grace, closes a prior stall on renewed activity and releases grace at settlement. No output, label, progress text, command or terminal detail enters reminder state.

Pending Inbox items sort by level, then human interaction and recency. Rendering expands in pages of 50 and reveals a selected item when it lies beyond the first page. Explicit already-resolved feedback acknowledges its selected reminder; runtime task state and later Human Needed generations retain their own facts.

Explicit snooze creates a bounded integer delivery generation in the same reminder. Scheduled work remains available inside Inbox with its due time, rescheduling and restore-to-pending actions. Deadline processing reapplies delivery preferences to the existing verdict and evidence. Due C2 work waits through quiet hours, mute or budget pressure; a resolved task stays closed. Restored C3 work waits for current public authority. Capacity retention gives active human waits and deliberately scheduled work priority over routine updates.

A higher authoritative verdict advances the delivery generation and returns a snoozed item to pending. A previously completed C2 delivery therefore permits the new C3 notification. Equal or lower-level merges preserve the current generation and its deduplication.

The service registers cleanup through the public Cordis `ctx.effect()` contract. Unloading removes subscriptions and timers, then awaits pending metadata, outcome and capture writes. Repeated disposal awaits the same completion. A replacement instance reads the committed state before reconciliation. Completed sessions retain their summaries; aborted and interrupted sessions retain explicit outcome semantics, and forked history stays quiet until it represents new work.

Configuration uses Host ConfigForm mutation with the original draft revision, volatile snapshots and profile-isolated state. Dirty drafts retain their revision across remote refresh. Conflicts preserve the draft; discard and successful save reread Host state. Legacy settings migration uses the same Host service and preserves the original source on failure.

HTTP contributions use public `connection.fetch.register()` exact routes under `/api/dsh-deepcanary/*`. The Host applies authentication and Host/Origin admission before routing. GET reads return no-store responses; POST mutations validate bounded structured input. Settings HTTP access is read-only. Feedback withdrawal uses filtered POST `/outcomes/delete` because the published Fetch registry supports GET, HEAD and POST. The old direct WebServer endpoints are removed. Missing Connection capability has no unauthenticated fallback.

The client requests allowlisted same-origin endpoints and returns through `uiWorkspace.openSession()`. Navigation validates the actual target and pending identity at click time. Runtime strings use DOM `textContent`; Inbox paints use dedicated opaque light/dark surfaces.

Host self-checks read mounted in-process WebServer facts. They establish service availability inside the process, with external reachability outside that observation scope.

## Delivery and local state

Notification permission, level, quiet hours and budget decide interruptions. Expiring server-owned claims arbitrate multiple renderer pages; client storage is an optimization. Bounded attempt stages distinguish attempted, constructed, callback-attached, clicked and failed. OS visibility stays unknown without an observation.

Ordinary operation persists bounded dedupe, budget and delivery ledger metadata in the atomic Inbox state. A successful claim is saved before the server authorizes construction. Each delivery generation has its own claim and hashed notification identity; stale claims, callbacks and clicks preserve the newer arrangement. Client passes examine at most twelve claims and construct at most three notifications, continuing past completed claims. Regular refresh also supplies lease takeover opportunities. Supervisor can project this primary state when explicitly enabled.

Local state stores bounded summaries, hashes, lifecycle, feedback and session navigation handles. Atomic replacement persists state in the active profile. Separate homes/profiles keep runtime instances independent. Raw conversation content, tool arguments, model output and credentials stay outside reminder capture.

Supervisor projects bounded state with owner fencing and leases. It is experimental and off by default. Its lifetime follows its owning Host process. Public notification/window-wake bridging remains gated by released third-party capabilities.

## Feedback and policy iteration

Capture provenance and task origin remain separate. Natural qualification requires service-captured real work with explicit natural origin and actual hashed task ownership. Missing origin remains unknown. Receipts, export and aggregation preserve ownership; repeated exports and identity conflicts cannot inflate counts.

Confirmed failures become sanitized replay cases. Discovery and holdout use different actual tasks, with a frozen safety set. The evaluator separates insufficient evidence, scoped pass, pass, explicit local adoption and rollback. Evaluation does not modify live policy. See [feedback calibration](feedback-calibration.md) and [failure taxonomy](failure-taxonomy.md).

Selective offline Judge requires rule-hard natural cases and sufficient allowlisted metadata. Current live behavior stays deterministic. Supervisor expansion, second adapters and active actions retain independent entry conditions.
