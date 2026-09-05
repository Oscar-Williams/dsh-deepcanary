# How DeepCanary works

## From DSH activity to a reminder

DeepCanary keeps DSH integration, interpretation, and presentation separate:

```text
DSH runtime facts
  -> ContextDshAdapter
  -> provider-normalized CanarySignal
  -> deterministic AttentionVerdict
  -> dedupe + Decision Bundle + budget + quiet hours
  -> local Inbox / browser notification / model-visible tools
```

The Persistent Supervisor prototype adds a bounded local projection after the Core has committed a decision:

```text
DeepCanary Core commit
  -> hashed session/pending projection
  -> bounded policy state (dedupe hashes + interrupt timestamps)
  -> atomic supervisor.json snapshot
  -> fenced supervisor.lease heartbeat
  -> read-only /dsh-deepcanary/supervisor diagnostics
```

The Supervisor provides restart-visible state, single-owner protection, standby retry, stale-lease takeover, and resource counters. RC3 marks it experimental and keeps it off by default; `supervisorMode: experimental` enables the engineering path. The browser notification path records a bounded, per-logical-delivery ledger with idempotent attempt stages; Windows OS-visible browser notification delivery, Notification Center, and click-back facts are added by the Windows evidence record. The RC3 release adds an alpha.5 adapter reconciliation slice: subscriber-first buffering, public `ctx.sessions.list()` and `Session.snapshotEvents()` reads, reconciliation epochs, sequence-aware duplicate merging, authoritative disposal convergence for previously observed sessions, startup Human Needed reconstruction, bounded orphan grace with immediate cleanup on authoritative session return, and an explicit degraded status. Full Stable semantics still require restart policy acceptance, authoritative OS delivery states, cross-process orphan convergence, resource delta, and real elapsed-time soak evidence; the virtual-clock report remains supplemental.

The plugin observes DSH interfaces; it does not reimplement the agent loop. Session events are the primary runtime feed. Agent errors and Subagent lifecycle events add optional facts. Session heartbeat silence and WebServer probes provide conservative Host evidence.

## Shared data and interfaces

`src/types.ts` defines the shared data types:

- `CanarySignal` carries source, reason code, evidence, an optional severity hint, a dedupe key, a root-cause Bundle key, and privacy-safe scalar data;
- `EvidenceRef` records the evidence type and authority: `host`, `runtime`, `derived`, or `heuristic`;
- `AttentionVerdict` carries C0–C3, action, confidence, reason, evidence, a stable message key, the protocol/policy versions, and a privacy-safe `PolicyDecisionTrace`;
- `InboxItem` adds reversible local status, feedback, Bundle count, lifecycle timestamps, and the reason-code set shown to users;
- `DogfoodNotificationDelivery` links `attempted`, `constructed`, `click-handler-attached`, `clicked`, and `error` stages to one opaque notification attempt; OS observation remains a separate evidence layer;
- `OutcomeReceipt` links one redacted decision to observed user and task outcomes while preserving source (`real`, `controlled`, or `replay`), policy version, review flags, and bounded outcome enums. Separate source/trial pairs can coexist for the same attention reference;
- `PublicSnapshot` is the data exposed to the Web client, carries a monotonic revision for conditional reads, and excludes internal hashes and raw evidence references.

`PolicyDecisionTrace` records stable rule identifiers, applied scopes, suppression causes, evidence-authority counts, final delivery action, Bundle aggregation, and recovery correlation. It contains no prompt, transcript, tool payload, credential, or raw event reference. `deepcanary_explain` and the Web explain route expose this projection for user decisions and support diagnosis.

`src/adapters/dsh.ts` owns the DSH-facing adapter. `ContextDshAdapter` translates the alpha.5 Context events into a small lifecycle interface, reconciles the authoritative session list before releasing buffered events, and keeps only bounded metadata snapshots in memory. Providers do not depend on Web UI or persistence details.

## Provider coverage

The RC includes six deterministic provider families:

1. Human Needed — approval, permission, question, clarification, and blocked boundaries;
2. Host Health — WebServer HTTP failures and recovery;
3. Stuck / Progress — heartbeat silence, repeated tool failures, and explicit no-progress facts;
4. Subagent Pressure — configurable relaxed, standard, and strict thresholds;
5. Context Pressure — compaction, repeated compaction, overflow, token-limit, and pressure markers;
6. Completion — normal, failed, aborted, and structured suspicious-completion boundaries.

Each provider emits a consistent reason code and an `EvidenceRef`. The provider may summarize a structured runtime fact, but it never reads prompt text, model output, raw tool arguments, or transcript content into the local persistence path.

## Deterministic attention policy

The judge is deterministic and runs before all notification policy. It emits a trace at the same time as the base verdict, and the pure delivery-policy layer appends quiet-hours, notification-level, budget, candidate-policy, Bundle, and recovery details:

- C0 is silent;
- C1 is recorded in the Inbox;
- C2 is an interrupt candidate, subject to quiet hours and the rolling budget;
- C3 is an escalation candidate, requires Host or Runtime authority, and does not consume the ordinary C2 budget;
- duplicate signals are rejected inside `dedupeWindowMinutes`;
- an event with a shared root-cause key is merged into a Decision Bundle inside `bundleWindowSeconds`.

The policy layer is pure and reusable by `DeepCanaryService.dryRun()`. Dry-run accepts bounded structured signal fields, compares current and candidate notification policy, returns field-level differences, and does not consume a budget, write state, send a notification, or mutate a DSH Session.

Normal completion is C1. Human approval/question, failure, suspected stall, no-progress, repeated tool failures, context pressure, and suspicious completion are C2 by default. Host unreachability with Host evidence and the highest Subagent threshold are C3. A healthy fact is explicitly silent, and a user-viewing fact downgrades a reminder to C1.

## Decision Bundle

A Bundle is a user-facing compression unit, not a replacement for the raw DSH log. Providers provide a stable in-memory root key such as a session failure, context lifecycle, or human-needed boundary. DeepCanary hashes it before retaining it, merges adjacent open items, increments `bundleCount`, unions reason codes, de-duplicates evidence references, and keeps the highest level observed. The Inbox card presents one decision point while the original DSH session remains the source of detail.

## DSH integration points

The entry point is `src/index.ts`:

- `inject = ['tools', 'sessions']` expresses the required DSH services;
- `session/created`, `session/event`, and `session/disposed` feed the adapter and Session providers;
- optional `agents` and `subagents` injections observe live lifecycle facts;
- optional `webServer` injection registers exact same-origin state, settings, health, action, OutcomeReceipt, and read-only Supervisor routes;
- optional `settings` injection registers the `dsh-deepcanary` namespace through the DSH Settings `installSection` API used by alpha.5, with the composed configuration as its base and live user changes applied through the provider;
- DSH Tools are registered with `defineTool`, explicit JSON output schemas, and text renderers.

The browser client is a DSH alpha.5 `dsh.client` module. Its `./client` export is built as a lazy-CJS factory for the client-module loader, then contributes the sidebar entry through `sidebar.footer.action`, the floating Inbox through `shell.overlay`, and the settings card through `settings.plugin.item`. The state route remains the source of truth; the overlay opens on demand. The Inbox renders the decision trace in a bilingual details section so policy reasoning remains available without opening another page.

The Web protocol is versioned independently from the persisted file format. State and action responses expose `schemaVersion` and a monotonic `revision`; state reads use an ETag and may return `304 Not Modified`. Actions require a client-generated `requestId`, and identical replays return the original receipt without applying the mutation twice. `GET /dsh-deepcanary/explain?id=...` returns one public trace projection, while `POST /dsh-deepcanary/dry-run` returns a read-only current/candidate comparison. `POST /dsh-deepcanary/outcome` records one bounded OutcomeReceipt, and `GET /dsh-deepcanary/outcomes` returns filtered receipts for one source and trial. Inbox entries move through explicit `open`, `seen`, `acknowledged`, `snoozed`, `muted`, `recovered`, and `expired` states so a transient host recovery cannot create a second alert for the same root cause.

## Configuration and lifecycle

`Config` is a schemastery schema shared by bundle configuration and the optional Settings provider. Web updates pass through `sanitizeConfigPatch`; unknown keys, `stateDir`, invalid ranges, and malformed quiet-hour values are rejected. The state directory is restart-scoped. Notification level, budget, dedupe, Bundle window, liveness threshold, Subagent mode, quiet hours, privacy flag, health polling, and Inbox retention are bounded.

The service queues persistence writes, uses atomic replace for `inbox.json`, disposes timers and adapter subscriptions, and leaves no process or route cleanup to the client. The Supervisor uses atomic snapshot replacement, short-lived lease heartbeats, standby retry, stale-lease archival, bounded policy restoration, and a read-only route when explicitly enabled. DSH Context owns the host-side event listener lifecycle.

## Persistence and privacy

`MetadataStore` writes an atomic `inbox.json` containing attention metadata only. `OutcomeStore` writes an independent atomic `outcomes.json` with validated, redacted decision-to-outcome records. Session and Workspace references are hashed before writing; evidence references are reduced to metadata codes. When DSH provides a native session identity, the Inbox may retain a bounded opaque local session handle solely for `sessions.open` navigation. No transcript cache, prompt cache, credential store, raw model-judgment log, network client, or child process belongs to the plugin.

Outcome input requires an explicit source and redacted trial identifier. The service derives event class, reason code, level, action, policy version, and evidence authority from the stored Inbox item; callers supply only bounded user and later-outcome fields. The store caps records, validates every enum, keeps source aggregates separable, and uses an atomic replace. `scripts/generate-outcome-report.mjs` reads one source at a time and writes aggregate counts without trial identifiers or raw content.

The store is local by construction and writes only below the configured state directory. Public Web responses omit internal hashes and evidence references; the client uses `textContent` for dynamic values. The persisted `orphanedAt` field is a timestamp-only lifecycle marker and is removed when the session returns or the item expires.

## Adding or changing a provider

Add a provider only when its runtime fact has a clear event or health-probe source. Give it a consistent reason code, evidence authority, dedupe key, Bundle key where appropriate, and an AttentionGold case. Prefer structured DSH facts over content inspection. Any new user-facing behavior must update the shared types, Web API definition, tests, README files, compatibility audit, security notes, quality report procedure, and release receipt procedure together. Outcome changes additionally update `benchmark/outcome-receipt.schema.json`, `benchmark/outcome-report.schema.json`, and the dogfood protocol. AttentionGold v3 and the local trial protocol provide the replay and aggregate-evidence path for rule changes.
