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

## Collection record

Record one redacted `OutcomeReceipt` for each reviewed attention decision. The service accepts it through `POST /dsh-deepcanary/outcome`:

```json
{
  "id": "<Inbox item id>",
  "source": "real",
  "trialId": "manual-alpha4-01",
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

`source` is required and has one of three values: `real` for an actual user trial, `controlled` for a controlled local scenario, and `replay` for a frozen or historical replay. Keep one source per aggregate. `trialId` uses a local redacted identifier and accepts letters, numbers, dots, underscores, colons, and hyphens.

For a run-level summary, record:

```text
runId
scenarioFamily
dataSource                 # real | controlled-fixture | replay
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

`decisionLatency` is measured from the first delivered C2/C3 item to the first user action on that item. Store counts, levels, reason codes, time buckets, versions, and privacy-safe references. Keep real runs, controlled fixtures, and replay runs in separate aggregates.

The local state directory stores receipts in `outcomes.json`. Read a filtered set through `GET /dsh-deepcanary/outcomes?source=real&trialId=manual-alpha4-01`. Generate a report after building the plugin:

```powershell
npm run outcomes:report -- --input <path-to-outcomes.json> --source real
```

The command writes `output/dogfood/outcome-report.json`, which is ignored by Git and follows [`../benchmark/outcome-report.schema.json`](../benchmark/outcome-report.schema.json). It rejects mixed-source aggregates unless `--source` selects one source explicitly. When a trial is withdrawn or its retention window expires, remove it with `DELETE /dsh-deepcanary/outcomes?source=real&trialId=manual-alpha4-01` or an explicit `before=<ISO date>` cutoff. The endpoint always requires an explicit trial or time boundary.

## Opportunity taxonomy and sanitized dogfood bundle

OutcomeReceipts describe decisions that reached an Inbox item. A dogfood observation describes the opportunity itself, including opportunities that remain silent or are removed by deduplication. Keep these dimensions independent:

| Dimension | Values |
| --- | --- |
| Event class | `human-needed`, `host-health`, `stuck-progress`, `subagent-pressure`, `context-pressure`, `completion`, `healthy-run` |
| Event source | `session`, `agent`, `subagent`, `tool`, `host`, `windows`, `usage`, `external` |
| Phase | `startup`, `running`, `human-wait`, `recovery`, `completion` |
| Disposition | `c0-silent`, `deduped`, `bundle-merged`, `suppressed`, `inbox`, `digest`, `interrupt`, `escalate`, `recovery-closed`, `provider-error`, `sink-error`, `dropped-event` |
| Review label | `correct-useful`, `correct-low-value`, `not-relevant`, `already-resolved`, `wrong-level`, `false-stall`, `missed-human-needed`, `duplicate-final-interrupt`, `too-late`, `provider-error`, `sink-error`, `dropped-event`, `uncertain` |

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
$env:DSH_DEEPCANARY_DOGFOOD_RUN_ID = 'real-coding-alpha4-01'
$env:DSH_DEEPCANARY_DOGFOOD_TRIAL_ID = 'real-alpha4-01'
$env:DSH_DEEPCANARY_DOGFOOD_TASK_FAMILY = 'coding'
$env:DSH_DEEPCANARY_DOGFOOD_SCENARIO = 'normal-completion'
$env:DSH_DEEPCANARY_DOGFOOD_RUNTIME_TAG = 'dsh-v0.1.2-alpha.4'
dsh --profile headless "Run the selected read-only coding task"
Remove-Item Env:DSH_DEEPCANARY_DOGFOOD,Env:DSH_DEEPCANARY_DOGFOOD_RUN_ID,Env:DSH_DEEPCANARY_DOGFOOD_TRIAL_ID,Env:DSH_DEEPCANARY_DOGFOOD_TASK_FAMILY,Env:DSH_DEEPCANARY_DOGFOOD_SCENARIO,Env:DSH_DEEPCANARY_DOGFOOD_RUNTIME_TAG -ErrorAction SilentlyContinue
```

Every accepted runtime signal is recorded, including C0 silence, suppression, deduplication, Bundle merges, recovery closure, delivery opportunities, and dropped-event outcomes. The recorder stores only bounded structured fields and hashed references. Pass the matching file explicitly to the capture helper so the runtime ledger remains authoritative for negative opportunities:

```powershell
npm run dogfood:capture -- `
  --state-dir <isolated-dsh-state-dir> `
  --dogfood-file <dogfood-<run-id-hash>.json> `
  --run-id real-coding-alpha4-01 `
  --trial-id real-alpha4-01 `
  --task-family coding `
  --scenario normal-completion `
  --started-at <ISO-start> `
  --ended-at <ISO-end> `
  --out output/dogfood/real-coding-alpha4-01.json
```

An authoritative DSH human question or approval request sets the session phase to `human-wait`. Stall evaluation pauses for that session until the runtime records the corresponding answer, approval, decision, or terminal state. This keeps a deliberate wait for user input separate from a session that has stopped progressing. The browser notification sink records `attempted`, `constructed`, `click-handler-attached`, `clicked`, or `error` stages under one opaque `notificationAttemptId`. These stages contain only opaque notification references, the safe title key, a body fingerprint, and timestamps. The Windows observation record separately binds the attempt to the browser receipt, run window, screenshot hash, UIA hash, Toast, Notification Center, focus, DSH return, and target visibility.

The helper verifies the run, trial, task family, scenario, and real provenance before copying the ledger into a public bundle. A missing opt-in ledger produces an explicit Inbox-only fallback, which is suitable for diagnosis and remains insufficient for a stable Gate D decision.

When a DSH state directory contains the selected run, the capture helper can create the first privacy-safe bundle from observed Inbox metadata. It hashes local item references, copies only enumerated decisions, and leaves expected decisions, policy reviews, usefulness labels, and negative opportunities for independent review:

```powershell
npm run dogfood:capture -- `
  --state-dir <isolated-dsh-state-dir> `
  --run-id real-coding-01 `
  --trial-id real-alpha4-01 `
  --task-family coding `
  --scenario normal-completion `
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
npm run gates:report
```

The checked-in [`../benchmark/policy-replay.json`](../benchmark/policy-replay.json) covers normal completion, healthy C0 silence, Human Needed, explicit failure, Host escalation, duplicate signals, persistent suppression, Bundle escalation, budget downgrade, quiet hours, and both recovery paths. The runner retains allowlisted structured signal data, injects a deterministic clock, applies fixture-declared user suppression at the specified step, and rejects a candidate that attempts to select a state directory. The output follows [`../benchmark/policy-replay-report.schema.json`](../benchmark/policy-replay-report.schema.json). Candidate promotion requires every required case to pass and a separate real-run review of usefulness, missed Human Needed, false stalls, notification delivery, and recovery timing.

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

For a controlled multi-session throughput and recovery sample:

```powershell
$env:DSH_BENCHMARK_EVENTS = '1000'
npm run benchmark:attention
Remove-Item Env:DSH_BENCHMARK_EVENTS -ErrorAction SilentlyContinue
```

The benchmark uses synthetic structured signals across four isolated session identities, includes a Host failure/recovery pair for each session, measures CPU time and memory deltas/peaks, enforces a bounded Inbox, and removes its temporary metadata directory. Treat its output as an engineering sample; record a release performance gate only after the same workload has been repeated on the target DSH runtime and host.

## Review and promotion

At the end of a run, review the aggregate for missed Human Needed cases, wrong-level decisions, false stalls, duplicate final interrupts, provider errors, sink errors, and dropped events. Promote only sanitized cases into AttentionGold v3. Keep the source label and the replay expectation with every promoted case. Public README and release receipts describe only measurements that have completed the corresponding runtime and package checks.
