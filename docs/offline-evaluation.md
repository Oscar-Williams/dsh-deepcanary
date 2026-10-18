# Offline evaluation for 0.1.6-rc.1

The current candidate adds background supervision, missed-outcome recovery, pending-work prioritization and explicit handled-feedback actions. Public Session/Agent/Job registry integration supplies the background facts. The existing deterministic core applies C1/C2 classification, deduplication, quiet hours and budget. Local receipts record checks and final artifact identity.

## Current case and repair

| Case | Observation and cause | Repair and reproduction |
| --- | --- | --- |
| Public tool failures | Published DSH represents failure in the tool message's `isError` flag. Earlier normalization inspected only legacy `data.error`. Three public failures were counted as zero. | Read the public flag with legacy fallback. Provider, startup-adapter and live-service regressions reproduce the miss and protect metadata privacy. |
| Different failed tools | Updating the most recently started tool also changed the comparison identity. Three different failed tools reached a same-tool streak of three. | Track the last failed tool independently. The reproduced streak becomes one and the false loop remains quiet. Public Session contracts check both paths after reload. |
| Background continuation | Foreground completion and a background Job have independent public lifecycles. Earlier providers observed the foreground turn. | Observe the public Job Registry, retain owned watches, recognize increasing byte counts and classify uncollected producer outcomes. Reload collects missed outcomes once; unreadable/foreign history preserves unknown state. |
| Crowded Inbox | Fifty rendered routine updates could hide an older urgent item. | Sort pending work by urgency and human interaction; allow further pages and reveal selected items beyond the first page. A 60-completion regression preserves the urgent item at the top. |
| Explicit handled feedback | The already-resolved action stored a label while leaving the selected reminder pending. | The same action now acknowledges that reminder. Runtime task state and a later authoritative question remain independently represented. |
| Pending reminder state during plugin replacement | A real Cordis fiber unload completed while a gated metadata write was still pending. The service used an obsolete public-event assumption for teardown. A replacement could read stale reminder state. | A public `ctx.effect()` disposer now returns and awaits the complete cleanup promise. `test/lifecycle.spec.ts` blocks the real store write, proves unload remains pending, releases it and verifies the replacement restores the completion summary. |
| Stopped and forked session semantics | Published session outcomes distinguish aborted/interrupted work from completed work and forked history. Existing providers already follow those facts. | `test/providers.spec.ts` protects C2 stopped outcomes and quiet fork history. These checks preserve existing policy. |

The factual defects and new capabilities have controlled, reproducible coverage. This iteration extends the available runtime facts and user actions; natural policy calibration retains the evidence conditions below.

The Windows regression run passes 239 tests in 33 files. Released Host contracts cover nine Session cases, nine background-registry cases, ten Settings cases and seven Connection cases. The frozen twelve-case policy replay has zero differences. Device receipts state the observed UI scope separately.

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

**Official Desktop bridge:** the released host forwards authenticated renderer requests and exposes running-Host Job Registry facts. Native notification delivery, renderer-independent notification delivery and hidden-window reveal still require a public third-party interface. Existing renderer notifications and exact session return remain available within their documented lifecycle scope.
