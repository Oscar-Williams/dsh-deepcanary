# Offline evaluation for 0.1.5-rc.2

The current candidate improves Host lifecycle reliability while retaining the deterministic policy baseline. All **214 tests** pass, including actual Cordis unload and task-outcome regressions. The frozen replay suite passes **12 of 12 cases**, with **zero policy differences**. Local candidate receipts record the final package identity and device observations.

## Current case and repair

| Case | Observation and cause | Repair and reproduction |
| --- | --- | --- |
| Pending reminder state during plugin replacement | A real Cordis fiber unload completed while a gated metadata write was still pending. The service used an obsolete public-event assumption for teardown. A replacement could read stale reminder state. | A public `ctx.effect()` disposer now returns and awaits the complete cleanup promise. `test/lifecycle.spec.ts` blocks the real store write, proves unload remains pending, releases it and verifies the replacement restores the completion summary. |
| Stopped and forked session semantics | Published session outcomes distinguish aborted/interrupted work from completed work and forked history. Existing providers already follow those facts. | `test/providers.spec.ts` protects C2 stopped outcomes and quiet fork history. These checks preserve existing policy. |

The replacement failure is an engineering-confirmed persistence and recovery defect. It supplies a reproducible lifecycle case. It adds no natural task or user-usefulness count. Its repair changes lifecycle correctness; policy calibration remains subject to the evidence conditions below.

## Retained evidence scope

The local sanitized-source audit inspected 27 inputs: 16 valid capture records and 11 other reports. Deduplication produced 15 runs and 132 observations, including one source-qualified natural run. Eight duplicate records were excluded and no identity conflict remained. One task-failure case awaits review; no confirmed reminder-failure case establishes a threshold change.

These counts describe the audited collection. They provide insufficient independent natural-task and cross-workday coverage for policy calibration. Controlled integration tests and replay cases retain their separate roles. Opening a session, acknowledging an alert or constructing a notification supplies no usefulness label.

## Changes supported by direct evidence

- Host integration reproduced an unauthenticated legacy-route exposure. Connection Fetch registration now applies the released host's authentication and request protections.
- Independent development review identified buffered oversized request handling and unnecessary workspace-path projection. Streaming limits and enum-only workspace status address both findings.
- Foreground Desktop use found retained completion summaries without a usable history action. Exact public catalog membership now permits returning to retained sessions and rejects absent targets.
- Settings and task regressions protect preserved drafts, authoritative Human Needed, parallel progress, recovery and C3 boundaries.

## Entry decisions

**Outcome Learning:** capture attribution, feedback aggregation, task-separated evaluation, explicit adoption and rollback records form the offline workflow. This release adopts no threshold candidate. Passing an evaluation does not itself create an adoption record.

**Selective Judge:** no qualified natural difficult-case cohort currently demonstrates an improvement over deterministic rules. No model calls or idle Judge module are added. The white-list, output-enum and bounded-call requirements remain entry gates.

**Official Desktop bridge:** the released host forwards authenticated renderer requests, but supplies no stable third-party notification, background or hidden-window reveal capability. Existing renderer notifications and exact session return remain available within their documented lifecycle scope.
