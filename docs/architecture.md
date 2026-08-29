# Architecture

## Runtime pipeline

DeepCanary keeps DSH integration, interpretation, and presentation separate:

```text
DSH runtime facts
  -> ContextDshAdapter
  -> provider-normalized CanarySignal
  -> deterministic AttentionVerdict
  -> dedupe + Decision Bundle + budget + quiet hours
  -> local Inbox / browser notification / model-visible tools
```

The plugin observes DSH seams; it does not reimplement the agent loop. Session events are the primary runtime feed. Agent errors and Subagent lifecycle events add optional facts. Session heartbeat silence and WebServer probes provide conservative Host evidence.

## Stable contracts

`src/types.ts` owns the stable vocabulary:

- `CanarySignal` carries source, reason code, evidence, an optional severity hint, a dedupe key, a root-cause Bundle key, and privacy-safe scalar data;
- `EvidenceRef` records the evidence type and authority: `host`, `runtime`, `derived`, or `heuristic`;
- `AttentionVerdict` carries C0–C3, action, confidence, reason, and evidence;
- `InboxItem` adds reversible local status, feedback, Bundle count, and the reason-code set shown to users;
- `PublicSnapshot` is the Web and client boundary and excludes internal hashes and raw evidence references.

`src/adapters/dsh.ts` owns the DSH-facing adapter contract. `ContextDshAdapter` translates the alpha.1 Context events into a small lifecycle interface and keeps session snapshots in memory. Providers do not depend on Web UI or persistence details.

## Provider coverage

The RC includes six deterministic provider families:

1. Human Needed — approval, permission, question, clarification, and blocked boundaries;
2. Host Health — WebServer HTTP failures and recovery;
3. Stuck / Progress — heartbeat silence, repeated tool failures, and explicit no-progress facts;
4. Subagent Pressure — configurable relaxed, standard, and strict thresholds;
5. Context Pressure — compaction, repeated compaction, overflow, token-limit, and pressure markers;
6. Completion — normal, failed, aborted, and structured suspicious-completion boundaries.

Each provider emits a stable reason code and an `EvidenceRef`. The provider may summarize a structured runtime fact, but it never reads prompt text, model output, raw tool arguments, or transcript content into the local persistence path.

## Deterministic attention policy

The judge is deterministic and runs before all notification policy:

- C0 is silent;
- C1 is recorded in the Inbox;
- C2 is an interrupt candidate, subject to quiet hours and the rolling budget;
- C3 is an escalation candidate, requires Host or Runtime authority, and does not consume the ordinary C2 budget;
- duplicate signals are rejected inside `dedupeWindowMinutes`;
- an event with a shared root-cause key is merged into a Decision Bundle inside `bundleWindowSeconds`.

Normal completion is C1. Human approval/question, failure, suspected stall, no-progress, repeated tool failures, context pressure, and suspicious completion are C2 by default. Host unreachability with Host evidence and the highest Subagent threshold are C3. A healthy fact is explicitly silent, and a user-viewing fact downgrades a reminder to C1.

## Decision Bundle

A Bundle is a user-facing compression unit, not a replacement for the raw DSH log. Providers provide a stable in-memory root key such as a session failure, context lifecycle, or human-needed boundary. DeepCanary hashes it before retaining it, merges adjacent open items, increments `bundleCount`, unions reason codes, de-duplicates evidence references, and keeps the highest level observed. The Inbox card presents one decision point while the original DSH session remains the source of detail.

## DSH integration seams

The entry point is `src/index.ts`:

- `inject = ['tools', 'sessions']` expresses the required DSH services;
- `session/created`, `session/event`, and `session/disposed` feed the adapter and Session providers;
- optional `agents` and `subagents` injections observe live lifecycle facts;
- optional `webServer` injection registers exact same-origin routes and a structured body script injection;
- optional `settings` injection registers the `dsh-deepcanary` namespace with the composed configuration as its base and applies live user changes;
- DSH Tools are registered with `defineTool`, explicit JSON output schemas, and text renderers.

The standalone client is deliberately decoupled from a particular React slot so the alpha.1 Web host can load it through `webserver/index-inject`. The state route remains the source of truth.

## Configuration and lifecycle

`Config` is a schemastery schema shared by bundle configuration and the optional Settings provider. Web updates pass through `sanitizeConfigPatch`; unknown keys, `stateDir`, invalid ranges, and malformed quiet-hour values are rejected. The state directory is restart-scoped. Notification level, budget, dedupe, Bundle window, liveness threshold, Subagent mode, quiet hours, privacy flag, health polling, and Inbox retention are bounded.

The service queues persistence writes, uses atomic replace for `inbox.json`, disposes timers and adapter subscriptions, and leaves no process or route cleanup to the client. DSH Context owns the host-side event listener lifecycle.

## Persistence and privacy

`MetadataStore` writes an atomic JSON file containing metadata only. Session and Workspace references are hashed before writing; evidence references are reduced to metadata codes. No transcript cache, prompt cache, credential store, raw model-judgment log, network client, or child process belongs to the plugin.

The store is local by construction and writes only below the configured state directory. Public Web responses omit internal hashes and evidence references; the client uses `textContent` for dynamic values.

## Extending the plugin

Add a provider only when its runtime fact has a clear event or probe boundary. Give it a stable reason code, evidence authority, dedupe key, Bundle key where appropriate, and an AttentionGold case. Prefer structured DSH facts over content inspection. Any new user-facing behavior must update the stable types, Web contract, tests, README files, compatibility audit, security notes, and release receipt procedure together.
