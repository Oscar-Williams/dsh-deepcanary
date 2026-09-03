# DeepCanary Local Trial and Quality Protocol

This protocol defines a repeatable local trial for DeepCanary. It measures whether reminders are useful and whether the plugin remains reliable while keeping personal session content outside the repository and the report. The executable decision-to-outcome record is `OutcomeReceipt`; its public field contract is [`../benchmark/outcome-receipt.schema.json`](../benchmark/outcome-receipt.schema.json).

## Purpose

The trial answers six product questions:

- Are Human Needed boundaries discovered reliably?
- Do C2 and C3 notifications lead to a useful human decision?
- Does Decision Bundle compression reduce repeated decisions?
- Do healthy long-running sessions remain quiet?
- Do recovery events close the original attention debt?
- Does the supervision layer remain lightweight during long and high-throughput runs?

## Scenario coverage

Use a fresh isolated DSH profile and cover the following task families:

1. coding;
2. build and test;
3. research;
4. multi-stage work;
5. Subagent work;
6. approval, question, or clarification boundaries;
7. transient network interruption and reconnect;
8. healthy long-running tool calls;
9. normal completion;
10. explicit failure;
11. recovery followed by continued progress.

The profile must use the specific DSH runtime tag listed in the compatibility matrix. Keep the test profile directory separate from the Conda environment and the user's normal DSH profile.

## Run-level labels and observation-level opportunities

The capture contract uses one task family and one scenario for each run. Fine-grained opportunity types belong to observations inside that run. This two-level model keeps the capture command aligned with the schema while preserving the detail needed for quality analysis:

| Level | Values | Purpose |
| --- | --- | --- |
| Run task family | `coding`, `build-test`, `research`, `multi-stage`, `subagent` | One primary work type per run |
| Run scenario | `approval-boundary`, `network-recovery`, `healthy-long-run`, `normal-completion`, `explicit-failure`, `recovery-continued` | One primary scenario per run |
| Observation event class | `human-needed`, `host-health`, `stuck-progress`, `subagent-pressure`, `context-pressure`, `completion`, `healthy-run` | Opportunity or state type inside a run |
| Independent audit disposition | `delivered`, `suppressed-by-policy`, `missed`, `not-in-scope` | Audit finding mapped to runtime decision fields |

The schemaVersion 1 bundle uses `provenance=real` for a natural-real run, `provenance=controlled` for a controlled-real run, and `provenance=replay` for a deterministic fixture or replay. The independent audit source `manual-audit` is recorded in the audit sidecar and is not substituted into the schemaVersion 1 bundle provenance enum. Reports preserve the distinction between natural-real, controlled-real, fixture, and manual-audit evidence.

Examples:

- A natural coding session uses `taskFamily=coding` and a scenario such as `normal-completion`; an approval or quiet-hour opportunity remains an observation within that run.
- A controlled recovery session uses `taskFamily=build-test` and `scenario=network-recovery`; its recovery chain and notification observations remain separately countable.
- “Returned while the user was away”, “merged by Bundle”, and “deduplicated” are observation-level facts. They do not require new run-level scenario values.

## Collection record

Record one redacted `OutcomeReceipt` for each reviewed attention decision. The service accepts it through `POST /dsh-deepcanary/outcome`:

```json
{
  "id": "<Inbox item id>",
  "source": "real",
  "trialId": "manual-alpha5-01",
  "opened": true,
  "acknowledged": true,
  "snoozed": false,
  "muted": false,
  "feedback": "useful",
  "laterOutcome": "continued",
  "recoveredBeforeOpen": false,
  "latencyBucket": "under-1m",
  "reviewFlags": []
}
```

`source` is required and has one of three schemaVersion 1 values: `real` for a natural-real user trial, `controlled` for a controlled-real DSH scenario, and `replay` for a deterministic fixture or historical replay. Keep one source per aggregate. The independent `manual-audit` source belongs to the audit sidecar and remains visible in the report without being inserted into the OutcomeReceipt source enum. `trialId` uses a local redacted identifier and accepts letters, numbers, dots, underscores, colons, and hyphens.

For a run-level summary, record:

```text
runId
trialId
taskFamily                 # coding | build-test | research | multi-stage | subagent
scenario                   # approval-boundary | network-recovery | healthy-long-run | normal-completion | explicit-failure | recovery-continued
provenance                 # real | controlled | replay
evidenceSource             # natural-real | controlled-real | fixture | manual-audit
pluginVersion
runtimeTag
policyVersion
rawRelevantSignals
finalVerdicts
interrupts
openedInterrupts
acknowledged
snoozed
muted
useful
notUseful
wrongLevel
missedHumanNeeded
falseStall
recoveredBeforeHumanAction
decisionLatency
providerErrors
sinkErrors
cpuOverhead
memoryOverhead
```

`decisionLatency` is measured from the first delivered C2/C3 item to the first user action on that item. Store counts, levels, reason codes, time buckets, versions, and privacy-safe references. Keep natural-real runs, controlled-real runs, fixtures, and replay runs in separate aggregates.

Use three independent coverage measures:

1. `User-facing Review Coverage = reviewedDeliveryUnits / reviewEligibleDeliveryUnits`, where the denominator contains unique final Inbox, Digest, Interrupt, and Escalate delivery units that require user understanding or judgment.
2. `Negative Opportunity Audit Coverage`, which samples C0, suppressed, deduped, no-delivery, and recovery-closed opportunities to detect false negatives and incorrect suppression.
3. `Scenario Coverage`, which reports every declared run-level task family and scenario separately.

System bookkeeping such as heartbeat, deduplication, and recovery closure does not automatically enter user usefulness review. `reviewed observations / all observations` is retained as a diagnostic count and is not the primary usefulness denominator.

Calibration begins after at least two independent real runs across two workdays, five Human Needed opportunities, three healthy-long-run samples, one recovery chain, and five reviewed user-facing delivery units. Stable evidence additionally targets three natural-real runs across three workdays, three task families, ten audited Human Needed opportunities, fifteen reviewed user-facing delivery units with at least 80% review coverage, five reviewed C2/C3 units, five healthy-long-run samples with two hours of supervised time, three recovery chains including one network/Host recovery, one recovery-continued case, zero duplicate final interrupts, and `rawContentPersisted=false`. Reports show numerator, denominator, exact counts, provenance, confidence interval, and `insufficient-sample` when a floor is not met.

The local state directory stores receipts in `outcomes.json`. Read a filtered set through `GET /dsh-deepcanary/outcomes?source=real&trialId=manual-alpha5-01`. Generate a report after building the plugin:

```powershell
npm run outcomes:report -- --input <path-to-outcomes.json> --source real
```

The command writes `output/dogfood/outcome-report.json`, which is ignored by Git and follows [`../benchmark/outcome-report.schema.json`](../benchmark/outcome-report.schema.json). It rejects mixed-source aggregates unless `--source` selects one source explicitly. When a trial is withdrawn or its retention window expires, remove it with `DELETE /dsh-deepcanary/outcomes?source=real&trialId=manual-alpha5-01` or an explicit `before=<ISO date>` cutoff. The endpoint always requires an explicit trial or time boundary.

## Opportunity taxonomy and sanitized dogfood bundle

OutcomeReceipts describe decisions that reached an Inbox item. A dogfood observation describes the opportunity itself, including opportunities that remain silent or are removed by deduplication. Keep these dimensions independent:

| Dimension | Values |
| --- | --- |
| Event class | `human-needed`, `host-health`, `stuck-progress`, `subagent-pressure`, `context-pressure`, `completion`, `healthy-run` |
| Event source | `session`, `agent`, `subagent`, `tool`, `host`, `windows`, `usage`, `external` |
| Phase | `startup`, `running`, `human-wait`, `recovery`, `completion` |
| Disposition | `c0-silent`, `deduped`, `bundle-merged`, `suppressed`, `inbox`, `digest`, `interrupt`, `escalate`, `recovery-closed`, `provider-error`, `sink-error`, `dropped-event` |
| Review label | `correct-useful`, `correct-low-value`, `not-relevant`, `already-resolved`, `wrong-level`, `false-stall`, `missed-human-needed`, `duplicate-final-interrupt`, `too-late`, `provider-error`, `sink-error`, `dropped-event`, `uncertain` |

### Independent DSH anchor audit

The runtime ledger is authoritative for signals that DeepCanary received and processed. The DSH session history is authoritative for discovering whether a Human Needed opportunity happened at all. Every real run therefore receives a short independent audit after completion:

1. Review DSH session history or the structured trajectory view session by session.
2. Locate approval requests, questions or clarification waits, and permission confirmations.
3. Match each anchor by session reference, stable sequence when available, structured event id, and time window.
4. Record the expected level/action, matched observation and delivery references, disposition, and primary attribution.
5. Record unmatched anchors as independent audit findings. This preserves the evidence meaning that the runtime did not observe the event.
6. Complete the first review within 30 minutes of the run and retain reviewer, reviewedAt, and safe evidence references.
7. Record internal-only events as `not-in-scope` notes; keep them outside the recall denominator.

The four audit dispositions map to runtime facts as follows:

| Audit disposition | Runtime mapping |
| --- | --- |
| `delivered` | Matching observation with an expected decision and a user-facing delivery |
| `suppressed-by-policy` | Policy-selected suppression, deduplication, or Bundle merge that satisfies the applicable floor |
| `missed` | DSH anchor exists without an explainable observation or delivery; add `missed-human-needed` as an audit finding |
| `not-in-scope` | Event has no current user-action meaning; retain only in audit notes |

The schemaVersion 1 bundle keeps the audit sidecar separate so its existing `observations` contract remains valid. A recommended sidecar is `output/dogfood/<run-id>.audit.json`:

~~~json
{
  "schemaVersion": 1,
  "auditId": "audit-<opaque>",
  "runId": "real-coding-alpha5-01",
  "trialId": "real-alpha5-01",
  "sessionRef": "<hash>",
  "anchorKind": "approval",
  "occurredAt": "<ISO>",
  "matchedObservationRef": "<hash-or-omit>",
  "matchedDeliveryUnitRef": "<hash-or-omit>",
  "disposition": "delivered",
  "expectedLevel": "C3",
  "expectedAction": "ESCALATE",
  "reviewer": "developer",
  "reviewedAt": "<ISO>",
  "primaryAttribution": "adapter",
  "evidenceRefs": ["<safe-hash>"]
}
~~~

The sidecar stores hashes, opaque references, enums, timestamps, and expected decisions. It keeps prompts, transcripts, model output, tool arguments, credentials, original approval text, complete paths, and raw file content outside the evidence set.

The public bundle format is [`../benchmark/dogfood.schema.json`](../benchmark/dogfood.schema.json). It keeps one `run` context, opportunity observations, and matching OutcomeReceipts together while requiring `rawContentPersisted: false`. Opaque observation, delivery-unit, and Bundle references use hashes; prompt text, transcripts, tool arguments, credentials, complete paths, and raw model output do not enter the bundle. A bundle remains one run/trial/provenance/runtime/policy context.

Validate and summarize a sanitized bundle after building the plugin:

```powershell
npm run dogfood:report -- --input <path-to-sanitized-dogfood.json> --out output/dogfood/dogfood-report.json
```

The report emits numerators, denominators, rates, and an `insufficient-sample` status for small cohorts. The primary measures are Human Needed recall, usefulness rate, useful interrupt precision, wrong-level rate, false-stall rate, recovery-before-open rate, attention compression, dropped-event rate, and review coverage. `policyReview` describes decision correctness, while `userFeedback` and `usefulnessReason` describe user value; the legacy `reviewLabel` remains accepted for existing records. A single receipt or a single task family remains useful for diagnosis and is insufficient for a stable Gate D decision.

For a complete real dogfood view, keep each task family/scenario in its own bundle and merge only validated bundles:

```powershell
npm run dogfood:merge -- `
  --input <real-coding-bundle.json> `
  --input <real-build-test-bundle.json> `
  --input <real-research-bundle.json> `
  --input <real-multi-stage-bundle.json> `
  --input <real-subagent-bundle.json> `
  --out output/dogfood/real-aggregate.json
npm run dogfood:report -- --input output/dogfood/real-aggregate.json --out output/dogfood/real-aggregate-report.json
```

The aggregate preserves `byTaskFamily`, `byScenario`, `byProvenance`, runtime and policy versions, per-run summaries, and explicit missing-category lists. It rejects duplicate run/trial identities and mixed provenance remains visible. Gate D accepts the aggregate only when all declared task families and scenarios, reviewed metrics, negative opportunities, and real provenance are present.

### Runtime observation ledger

For a real DSH run, enable the recorder explicitly for that run. The recorder writes a separate hashed `dogfood-<run-id-hash>.json` file under the DeepCanary state directory. An ordinary DSH session does not create this file.

```powershell
$env:DSH_DEEPCANARY_DOGFOOD = '1'
$env:DSH_DEEPCANARY_DOGFOOD_RUN_ID = 'real-coding-alpha5-01'
$env:DSH_DEEPCANARY_DOGFOOD_TRIAL_ID = 'real-alpha5-01'
$env:DSH_DEEPCANARY_DOGFOOD_TASK_FAMILY = 'coding'
$env:DSH_DEEPCANARY_DOGFOOD_SCENARIO = 'normal-completion'
$env:DSH_DEEPCANARY_DOGFOOD_RUNTIME_TAG = 'dsh-v0.1.2-alpha.5'
dsh --profile headless "Run the selected read-only coding task"
Remove-Item Env:DSH_DEEPCANARY_DOGFOOD,Env:DSH_DEEPCANARY_DOGFOOD_RUN_ID,Env:DSH_DEEPCANARY_DOGFOOD_TRIAL_ID,Env:DSH_DEEPCANARY_DOGFOOD_TASK_FAMILY,Env:DSH_DEEPCANARY_DOGFOOD_SCENARIO,Env:DSH_DEEPCANARY_DOGFOOD_RUNTIME_TAG -ErrorAction SilentlyContinue
```

Every accepted runtime signal is recorded, including C0 silence, suppression, deduplication, Bundle merges, recovery closure, delivery opportunities, and dropped-event outcomes. The recorder stores only bounded structured fields and hashed references. Pass the matching file explicitly to the capture helper so the runtime ledger remains authoritative for negative opportunities:

```powershell
npm run dogfood:capture -- `
  --state-dir <isolated-dsh-state-dir> `
  --dogfood-file <dogfood-<run-id-hash>.json> `
  --run-id real-coding-alpha5-01 `
  --trial-id real-alpha5-01 `
  --task-family coding `
  --scenario normal-completion `
  --provenance real `
  --started-at <ISO-start> `
  --ended-at <ISO-end> `
  --out output/dogfood/real-coding-alpha5-01.json
```

An authoritative DSH human question or approval request sets the session phase to `human-wait`. Stall evaluation pauses for that session until the runtime records the corresponding answer, approval, decision, or terminal state. This keeps a deliberate wait for user input separate from a session that has stopped progressing. The browser notification sink records `attempted`, `constructed`, `click-handler-attached`, `clicked`, or `error` stages under one opaque `notificationAttemptId`. These stages contain only opaque notification references, the safe title key, a body fingerprint, and timestamps. The Windows observation record separately binds the attempt to the browser receipt, run window, screenshot hash, UIA hash, Toast, Notification Center, focus, DSH return, and target visibility.

The helper requires an explicit provenance choice. Use `--provenance real` only with the opt-in runtime observation ledger; use `--provenance controlled` for an Inbox-only controlled capture. The helper verifies the run, trial, task family, scenario, and provenance before copying evidence into a public bundle. A controlled fallback remains separate from natural-real evidence and remains insufficient for a stable Gate D decision.

When a DSH state directory contains the selected run, the capture helper can create the first privacy-safe bundle from observed Inbox metadata. It hashes local item references, copies only enumerated decisions, and leaves expected decisions, policy reviews, usefulness labels, and negative opportunities for independent review:

```powershell
npm run dogfood:capture -- `
  --state-dir <isolated-dsh-state-dir> `
  --run-id real-coding-01 `
  --trial-id real-alpha5-01 `
  --task-family coding `
  --scenario normal-completion `
  --provenance controlled `
  --started-at <ISO-start> `
  --ended-at <ISO-end> `
  --out output/dogfood/real-coding-01.json
```

The helper never copies prompts, transcripts, evidence summaries, session handles, full paths, or model output. An observed Inbox item proves a delivered decision; it does not prove usefulness or absence of a missed opportunity. Reviewers add an expected decision or an explicit missed-opportunity record before aggregation.

## Privacy boundary

The local record contains no prompt, transcript, tool argument, credential, raw model output, or complete local path. Provider summaries are reduced to structured reason codes and bounded evidence summaries. A reviewed `missedHumanNeeded` or `falseStall` case is converted into a sanitized AttentionGold scenario containing its expected level, action, authority, and replay rationale.

Raw event exports remain in the local test directory and are removed after the aggregate report is produced. The repository stores the protocol and public schemas; it does not store raw trial data or `outcomes.json` from a real trial.

## Quality report

Generate the deterministic baseline after building the plugin:

```powershell
npm run quality:report
```

The command writes `output/attention-quality-report.json`, which is intentionally ignored by Git. It reports the frozen AttentionGold baseline and leaves user-outcome, recovery-latency, CPU, and memory fields empty until a sanitized trial supplies those measurements.

## Policy replay

The replay runner exercises the full service path over sanitized signal sequences, including judgment, delivery policy, deduplication, Decision Bundles, quiet hours, interrupt budget, and recovery:

```powershell
npm run replay:policy
npm run replay:policy -- --input <path-to-replay-fixture.json> --candidate <path-to-candidate-config.json>
npm run supervisor:smoke
npm run supervisor:soak
npm run gates:report
```

The checked-in [`../benchmark/policy-replay.json`](../benchmark/policy-replay.json) covers normal completion, healthy C0 silence, Human Needed, explicit failure, Host escalation, duplicate signals, persistent suppression, Bundle escalation, budget downgrade, quiet hours, and both recovery paths. The runner retains allowlisted structured signal data, injects a deterministic clock, applies fixture-declared user suppression at the specified step, and rejects a candidate that attempts to select a state directory. The output follows [`../benchmark/policy-replay-report.schema.json`](../benchmark/policy-replay-report.schema.json).

`npm run supervisor:soak` runs the experimental Supervisor against a virtual eight-hour clock. It covers three normal restarts, one stale-lease takeover, old-owner fencing, bounded policy and delivery state, and shutdown lease release; the report follows [`../benchmark/supervisor-soak-report.schema.json`](../benchmark/supervisor-soak-report.schema.json) and carries `provenance=controlled-virtual` plus `stableGateUse=supplemental-only`. The result supports local engineering review and resource budgeting, while real elapsed-time soak and authoritative DSH reconciliation remain separate Stable evidence.

Candidate promotion uses four gates:

1. **Target Fix**: every target failure fixture reaches the expected verdict, delivery, and recovery.
2. **Safety No Regression**: Frozen Critical Recall and Frozen Human Needed Recall remain 100%; C3 authority, duplicate-final-interrupt safety, normal-completion C1, critical suppression floor, and privacy assertions remain intact.
3. **Attention Budget No Regression**: C2 interrupt count, Bundle compression, quiet hours, and recovery convergence remain within the approved baseline.
4. **Resource No Regression**: event processing, timers/wakes, persisted state, heap/state delta, restore latency, and disk write rate remain within the approved budget.

Discovery data generates a candidate. A holdout run remains outside candidate selection. The frozen suite remains unchanged and supplies the long-term regression guard. Candidate adoption is manual, versioned, explainable, and reversible; online feedback creates a candidate record rather than changing policy in place.

`npm run gate:stable` combines fresh replay evidence, Supervisor smoke, package identity, and the supplied dogfood report into `output/gates/stable-gates-report.json`. Pass `--dogfood <path-to-sanitized-dogfood.json>` or a validated aggregate. A Windows observation is supplied with `--notification-evidence <path-to-notification-evidence.json>`; the record must use [`../benchmark/notification-evidence.schema.json`](../benchmark/notification-evidence.schema.json), include the run window, notification attempt ID, browser receipt, screenshot/UIA hashes, and record every OS fact as `observed`, `not-observed`, or `not-tested`. Missing evidence remains pending and the command does not change release tags or publish a package.

## Edge and Windows notification evidence

The browser layer can record permission, page visibility, polling, and `Notification` constructor activity. Windows Toast appearance, Notification Center retention, and click-to-focus belong to the operating-system observation layer. After a real eligible C2/C3 event, record the result without prompts, transcripts, notification text, paths, cookies, or credentials. Each record binds to the matching dogfood `observationRef` and `deliveryUnitRef`, identifies the safe title key and body fingerprint, and confirms that only minimal content was used:

```powershell
npm run notification:evidence -- `
  --input <path-to-notification-evidence.json> `
  --dogfood output/dogfood/real-aggregate.json
npm run gates:report -- `
  --dogfood output/dogfood/real-aggregate.json `
  --notification-evidence <path-to-notification-evidence.json>
```

The evidence validator returns `pass` only when Edge permission and browser delivery observations are present together with `observed` status for Windows notifications enabled, Edge notifications enabled, Focus Assist off, a visible Toast, Notification Center retention, a successful Toast click, Edge focus, return to DSH, target-item visibility, and a matching real dogfood delivery record. `not-observed` and `not-tested` remain explicit pending outcomes with different reasons. The browser-notification channel represents the browser-to-operating-system delivery path; the actual Toast, Notification Center, and click-to-focus observations complete the OS evidence.

Before each U5 trial, record Edge site permission, Windows Notifications, Edge system permission, Focus Assist/Do Not Disturb, page visibility, quiet hours, C2 budget, notificationAttempt ledger, plugin/runtime/package identity, and the matching runId/trialId. Playwright supplies browser-layer facts; Windows Toast, Notification Center, Focus Assist behavior, and real system-click behavior require manual or Windows UI Automation observation.

## Fresh Gate report identity

Generate the final Gate report from current source bundles and evidence. Record:

~~~text
generatedAt
sourceCommit
worktreeDirty
pluginVersion
packageSha256
dshTag
dshCommit
policyVersion
dogfoodBundleDigests[]
auditDigest
notificationEvidenceDigests[]
supervisorSmokeDigest
supervisorSoakDigest
attentionGoldDigest
replayReportDigest
gateEvaluatorVersion
~~~

An input digest, version, or policy change marks the previous report `STALE`. Rebuild the report before making a new Gate decision. Historical reports remain available for comparison with their original identity.

## Stable decision matrix

| Decision | Criteria |
| --- | --- |
| `STABLE_READY` | Gate A–E core criteria pass; only low-risk optional enhancements remain |
| `STABLE_READY_WITH_NON_CORE_EXCEPTIONS` | Only physical touch, full screen-reader certification, or extended WSL combinations remain partial |
| `CONTINUE_RC` | Gate D, OS-visible delivery, or Supervisor Stable semantics remains incomplete |
| `NO_GO_REDESIGN` | Real evidence shows the core value cannot be made reliable through deterministic policy and targeted fixes |

Core Stable criteria include zero critical Human Needed misses, 100% frozen critical and Human Needed recall, authoritative C3, zero duplicate final interrupts, normal completion at C1, privacy-safe persistence, idempotent actions, correct session navigation, proven OS-visible delivery for the public unattended-work claim, and authoritative Supervisor reconciliation before any future default enablement. The RC2 Supervisor prototype is explicitly enabled only for its engineering evidence lane.

For a controlled multi-session throughput and recovery sample:

```powershell
$env:DSH_BENCHMARK_EVENTS = '1000'
npm run benchmark:attention
Remove-Item Env:DSH_BENCHMARK_EVENTS -ErrorAction SilentlyContinue
```

The benchmark uses synthetic structured signals across four isolated session identities, includes a Host failure/recovery pair for each session, measures CPU time and memory deltas/peaks, enforces a bounded Inbox, and removes its temporary metadata directory. Treat its output as an engineering sample; record a release performance gate only after the same workload has been repeated on the target DSH runtime and host.

## Review and promotion

At the end of a run, review the aggregate for missed Human Needed cases, wrong-level decisions, false stalls, duplicate final interrupts, provider errors, sink errors, and dropped events. Promote only sanitized cases into AttentionGold v3. Keep the source label and the replay expectation with every promoted case. Public README and release receipts describe only measurements that have completed the corresponding runtime and package checks.
