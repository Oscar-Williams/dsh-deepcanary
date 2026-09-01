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

## Privacy boundary

The local record contains no prompt, transcript, tool argument, credential, raw model output, or complete local path. Provider summaries are reduced to structured reason codes and bounded evidence summaries. A reviewed `missedHumanNeeded` or `falseStall` case is converted into a sanitized AttentionGold scenario containing its expected level, action, authority, and replay rationale.

Raw event exports remain in the local test directory and are removed after the aggregate report is produced. The repository stores the protocol and public schemas; it does not store raw trial data or `outcomes.json` from a real trial.

## Quality report

Generate the deterministic baseline after building the plugin:

```powershell
npm run quality:report
```

The command writes `output/attention-quality-report.json`, which is intentionally ignored by Git. It reports the frozen AttentionGold baseline and leaves user-outcome, recovery-latency, CPU, and memory fields empty until a sanitized trial supplies those measurements.

For a controlled multi-session throughput and recovery sample:

```powershell
$env:DSH_BENCHMARK_EVENTS = '1000'
npm run benchmark:attention
Remove-Item Env:DSH_BENCHMARK_EVENTS -ErrorAction SilentlyContinue
```

The benchmark uses synthetic structured signals across four isolated session identities, includes a Host failure/recovery pair for each session, measures CPU time and memory deltas/peaks, enforces a bounded Inbox, and removes its temporary metadata directory. Treat its output as an engineering sample; record a release performance gate only after the same workload has been repeated on the target DSH runtime and host.

## Review and promotion

At the end of a run, review the aggregate for missed Human Needed cases, wrong-level decisions, false stalls, duplicate final interrupts, provider errors, sink errors, and dropped events. Promote only sanitized cases into AttentionGold v3. Keep the source label and the replay expectation with every promoted case. Public README and release receipts describe only measurements that have completed the corresponding runtime and package checks.
