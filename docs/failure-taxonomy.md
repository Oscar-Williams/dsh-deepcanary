# Attention failure taxonomy and case audit

## Purpose

`scripts/audit-attention-cases.mjs` turns already-sanitized dogfood evidence into an index of attention cases. It answers three bounded questions:

- which sanitized runs exist, at which plugin version and runtime tag, and whether each one qualifies as a natural task;
- which observed failures belong to the task plane (`TASK_FAILED`, `TASK_ABORTED`, provider errors) and which belong to the attention plane (missed, false, wrong-level, late, duplicate, or lost alerts);
- which of those cases carry review evidence strong enough to feed a later Judge entry.

It never reads a Host session, log, credential, transcript, or any location the operator did not name on the command line. It does not decide whether the evidence is sufficient for a release, and it does not create Judge rules.

## Inputs and privacy boundary

The audit refuses to run without an explicit `--input <file>` or `--input-dir <directory>`; there is no implicit default scan. `--input-dir` reads regular top-level `.json` files only. Subdirectories, symlinks, and non-JSON entries are counted in `inputMode` and skipped, so a directory scan cannot walk into unrelated trees.

A file is accepted only when it satisfies the existing sanitized contracts, reused directly from `lib/dogfood.js` and `lib/dogfoodAggregate.js`:

- `isDogfoodBundle` for a single sanitized run bundle;
- `isDogfoodAggregate` for an aggregate of bundles, which is split back into per-run records;
- `summarizeDogfoodAggregate` for the aggregate provenance (`real`, `controlled`, `replay`, or `mixed`).

A file that is unreadable, unparseable, or not one of those two contracts is recorded with its SHA256 hash, `status: "invalid"`, and one fixed reason code (`unreadable-file`, `unparseable-json`, `not-a-sanitized-dogfood-bundle-or-aggregate`). Its text and its path are never copied into the report.

## Source identity, deduplication, and conflicts

Every source is bound to the SHA256 of its bytes. Identity rules:

- two byte-identical files are one source with `occurrences > 1` and a `content-duplicate` entry;
- a run is identified by `runId` + `trialId` and an observation by `runId` + `observationRef`; a repeated identity is counted exactly once;
- a repeated `runId` + `trialId` whose material fields (version, runtime tag, policy version, provenance, capture mode, task origin, task ref, task family, scenario) agree is recorded as a `run-trial-duplicate` and not recounted;
- a repeated `runId` + `trialId` that disagrees is recorded as a `run-trial-conflict` with the differing field names, and the first declaration stays authoritative;
- a repeated `observationRef` with different sanitized content is recorded as an `observation-conflict`.

The `duplicates` and `conflicts` arrays are the explicit summary; disagreements are never silently merged or double counted.

## Run identity and natural qualification

Each run record reports `pluginVersion`, `runtimeTag`, `policyVersion`, `taskFamily`, `scenario`, `provenance`, `captureMode`, `taskOrigin` (missing values stay `"unknown"`), the opaque `taskRef` (or `null`), and `naturalQualified`.

`naturalQualified` comes only from `isNaturalDogfoodRun` in `lib/dogfood.js`, which requires `provenance === "real"`, `captureMode === "service"`, `taskOrigin === "natural"`, and an opaque 16-hex `taskRef`. A filename, a directory name, a source label, or a real-looking run id never upgrades a run: a controlled bundle stored as `real-natural-task-001.json` stays non-natural, and a `real`/`service` run without task attribution stays non-natural. `naturalBasis` records the four inputs so the decision is auditable.

## Case taxonomy

A case is created only from an actual sanitized observation or an explicit review label. Categories are split into two planes.

Task plane (`group: "task-failure"`):

| Category | Detected from |
| --- | --- |
| `TASK_FAILED` | `eventSubtype: "failed"` |
| `TASK_ABORTED` | `eventSubtype: "aborted"` |
| `provider-error` | `decisionDisposition: "provider-error"`, or an explicit `reviewLabel: "provider-error"` |

Attention plane (`group: "alerting-failure"`):

| Category | Detected from |
| --- | --- |
| `missed-human-needed` | `reviewLabel` or `policyReview: "missed-human-needed"` |
| `false-stall` | `reviewLabel` or `policyReview: "false-stall"` |
| `wrong-level` | `reviewLabel` or `policyReview: "wrong-level"` |
| `too-late` | `reviewLabel` or `policyReview: "too-late"` |
| `duplicate-final-interrupt` | `reviewLabel` or `policyReview: "duplicate-final-interrupt"` |
| `sink-error` | `decisionDisposition: "sink-error"`, or `reviewLabel: "sink-error"` |
| `dropped-event` | `decisionDisposition: "dropped-event"`, or `reviewLabel: "dropped-event"` |

Every case records `detectedBy` so an observation-derived case is not confused with a label-derived one. Attention states such as `c0-silent`, `suppressed`, `deduped`, and `recovery-closed` are negative opportunities, not failures; they are counted separately and never turned into cases.

## Review evidence

The sanitized observation schema keeps review provenance explicit, and the audit preserves it rather than compressing it:

- `reviewState: "confirmed"` requires `hasQualifiedDogfoodReview`: a review label or feedback plus `reviewSource`, `reviewBasis`, and `reviewConfidence`, with source and basis other than `unknown`. Confidence is an annotation, not a qualification filter.
- `reviewState: "pending"` covers everything else, including a review label without source/basis, and a case derived only from an observed disposition.
- `review` keeps the label, policy review, source, basis, and confidence verbatim.
- `engineeringReview` lists entries whose source is `engineering-review` or `independent-audit`; `userFeedback` lists explicit `userFeedback` values only, each with `countedAsFeedback` true for exactly `useful` and `not-useful`. An observation with no review is never counted as user feedback, and `unrated`/`not-applicable` stay uncounted rather than promoted.
- `rootCause` is fixed to `"unknown"` and `modelNeedInferred` to `false`. The sanitized schema carries no reviewed root-cause field, so the audit does not infer causes or model requirements from a level, a disposition, or a label.

## Negative opportunities and delivery visibility

For `c0-silent`, `suppressed`, `deduped`, and `recovery-closed`, the report counts `count`, `reviewed`, and `unreviewed` per run and in total. An unreviewed opportunity stays unreviewed: silence is not evidence of correctness.

Delivery is counted per final delivery unit (an observation with a user-facing disposition, a `deliveryUnitRef`, and a non-`none` channel). Units are separated into `visibleUnits`, `unknownVisibilityUnits`, and `constructedOnlyUnits`, with `visibleBySource` limited to `inbox-materialized`, `os-observed`, and `user-confirmed`. A browser-constructed notification, an unknown visibility source, or a missing `deliveryVisibility` is never counted as visible.

## Output whitelist

`output/dogfood/rc13/case-index.json` (overridable with `--out`) is assembled field by field from enums, opaque 16-hex references, SHA256 hashes, ISO timestamps, safe version labels, and fixed reason codes. Free-form values that pass the sanitized contracts but look like paths or prose (for example a `pluginVersion` containing `/`, or an `eventSubtype` containing spaces) are replaced by `unknown` or `other`, and decision reason codes are copied only when they match a strict uppercase taxonomy pattern.

Before writing, the script walks the whole report and fails closed if any object key is not declared in its whitelist, if any string is not a token, or if any prose is not one of its fixed sentences. The report therefore contains no prompt, model output, tool argument, transcript text, session content, or source path; `privacy.sourcePathsIncluded` is always `false`.

## Judge entry

`judgeEntry` is the only bridge to a future Judge surface. It becomes `ready` only when a case satisfies all three conditions:

1. the run qualifies as natural through `isNaturalDogfoodRun`;
2. `reviewState` is `confirmed` by a qualified review;
3. the category is rule-hard: `missed-human-needed`, `false-stall`, `wrong-level`, `too-late`, or `duplicate-final-interrupt` — an attention judgement the deterministic policy got wrong.

These conditions yield `requires-feasibility-review`, not permission to call a model. A separate review must demonstrate that allowlisted metadata can distinguish the case and deterministic rules remain insufficient after factual and lifecycle defects are fixed. The audit cannot establish those facts from a failure label alone.

Delivery-plane failures (`sink-error`, `dropped-event`) and task-plane outcomes (`TASK_FAILED`, `TASK_ABORTED`, `provider-error`) are recorded but are not Judge candidates. When no case qualifies, the entry is `not-entered` with the reason `no-natural-qualified-run-with-a-confirmed-rule-hard-case`. No empty Judge module, placeholder rule, or stub file is written.

## Historical corpus snapshot

An audit of the sanitized bundles already stored under `output/dogfood` (top level only) produced, at the time of writing:

- 21 JSON files read: 14 valid (13 bundles and 1 aggregate covering 21 bundles) and 7 invalid summary reports recorded by hash and reason code only;
- 13 distinct runs and 125 observations, with 0 natural-qualified runs (the stored `real` runs carry no `taskOrigin`/`taskRef` attribution);
- 1 case, a pending `TASK_ABORTED` observation with no review proof;
- 3 observations with review material (1 review label and 2 explicit user feedback values), 0 of them qualified because no `reviewSource`/`reviewBasis` was stored;
- `judgeEntry: "not-entered"`.

These numbers describe the original local sanitized-source audit. The later source-attribution audit in [current offline evaluation](offline-evaluation.md) has one qualified natural run, which remains insufficient for calibration.

## Usage

    node ./scripts/audit-attention-cases.mjs --input-dir output/dogfood
    node ./scripts/audit-attention-cases.mjs --input output/dogfood/real-coding-20260902.json --input output/dogfood/real-aggregate.json
    node ./scripts/audit-attention-cases.mjs --input-dir output/dogfood --out output/dogfood/rc13/case-index.json

The default output is `output/dogfood/rc13/case-index.json`. The script writes one report, exits non-zero on a missing explicit input, and exits non-zero without writing a report if the output whitelist check fails.
