# Security and privacy boundary

## Data flow

DeepCanary is a local observer. It receives structured DSH runtime facts, normalizes them into `CanarySignal`, classifies them with deterministic policy, and writes bounded Inbox metadata to the configured local state directory. It has no remote telemetry path and no child-process dependency.

## Stored data

The default state file is `~/.dsh/dsh-deepcanary/inbox.json`. It contains:

- schema version, item ID, timestamp, level, action, status, reason code, and bounded feedback;
- hashed Session and Workspace references;
- hashed evidence references plus provider-written type, authority, and bounded summary;
- Decision Bundle hash, count, and reason-code set;
- bounded `PolicyDecisionTrace` fields: policy version, stable rule IDs, scopes, suppression markers, authority counts, final decision, and recovery rule.

It does not contain prompts, assistant output, tool arguments, raw tool results, environment variables, API keys, credentials, arbitrary file contents, or a session transcript. The provider contract rejects the use of raw conversation content as an input to the local state path; new providers must use structured facts and short summaries.

Persistence uses an atomic temporary file and rename within the configured state directory. The plugin does not create files elsewhere.

## Public interfaces and actions

The Web routes are registered on DSH's local same-origin WebServer and send `cache-control: no-store`. The action endpoint accepts only `acknowledge`, `snooze`, `mute`, `feedback`, and `jump`. Model-visible tools expose the same bounded operations. `jump` returns a URL hint; it does not navigate, open, mutate, or stop a session by itself.

`deepcanary_explain` returns the same privacy-safe trace for one Inbox item. `deepcanary_dry_run` and `POST /dsh-deepcanary/dry-run` accept only bounded structured signal fields and an allowlisted notification-policy candidate. Dry-run never writes state, consumes an interrupt budget, sends a notification, or mutates a DSH Session.

The plugin has no shell, file-write, process-control, approval, rejection, arbitrary network, or destructive tool. It does not terminate or restart DSH or any Agent.

## Client safety

The DSH client-module browser interface uses DOM node construction and `textContent` for runtime values. It does not interpolate runtime values into `innerHTML`. The panel is mounted in the host's additive overlay slot and remains click-through outside its own bounds. Browser notifications are created only after the user grants permission. If permission is denied or the browser API is unavailable, the Web Inbox and model tools remain available as fallbacks.

## Evidence authority

Every provider assigns an authority to each evidence reference:

- `host` — a local Host or WebServer observation;
- `runtime` — a DSH Session, Agent, or Subagent fact;
- `derived` — deterministic inference over structured facts;
- `heuristic` — a bounded heuristic that must not independently promote an event to C3.

C3 requires Host or Runtime authority. The deterministic judge remains the final policy boundary even if a model-assisted provider is added in a later release.

## Settings safety

The Settings provider receives the same schema as the bundle configuration. Web updates pass through an allowlist and bounded range checks; `stateDir` and unknown keys cannot be changed through the live Web interface. State-directory changes remain restart-scoped. Privacy-safe summaries are enabled by default.

## Deployment boundary

The DSH WebServer is assumed to be a trusted local host. This plugin is not an authentication layer. Do not expose DSH Web or the DeepCanary routes through an unauthenticated public reverse proxy. If a deployment adds a reverse proxy, it must provide authentication, origin controls, and transport protection independently of this plugin.
