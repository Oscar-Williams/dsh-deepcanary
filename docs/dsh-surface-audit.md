# DSH interfaces used by DeepCanary

This document records the DSH interfaces used by `dsh-deepcanary`. The historical RC.2 audit targets the official `dsh-v0.1.2-alpha.2` source tag at commit `0a53fb55bea101816fa226bb964ae2bed71c343b`; the historical RC4 audit targets immutable `dsh-v0.1.2-alpha.4` at commit `4e84901e6471b79ec0338099867ebb4606d12bb5`. The current `0.1.1-rc.1` audit targets the official immutable `dsh-v0.1.2-alpha.5` tag at commit `db6bdc3576c2d4e7c965e8e3ed0c2a731eed87f5`.

## Services and lifecycle events

| Interface | Use | Required? | Fallback |
| --- | --- | --- | --- |
| `@deepseek-ai/dsh-session` | Session lifecycle and append-only event feed | yes | A valid plugin mount requires the Session service |
| `@deepseek-ai/dsh-tools` | Model-visible tools and JSON results | yes for model tools | Web and local service still expose their non-tool interfaces |
| `@deepseek-ai/dsh-agent` | `agent/error` facts | no | Session event and Web status remain available |
| `@deepseek-ai/dsh-subagent` | `subagent/start` and `subagent/end` pressure facts | no | Subagent pressure provider remains inactive |
| `@deepseek-ai/dsh-host-webserver` | exact local state/settings/health/action/OutcomeReceipt/Supervisor routes | no | Model tools and local persistence remain available |
| `@deepseek-ai/dsh-settings` | live namespace registration and user updates | no | Bundle-composed configuration remains authoritative |

`ContextDshAdapter` owns the DSH event wiring:

- `session/created` creates an in-memory liveness and session snapshot;
- `session/event` updates the heartbeat, counts tool failures, tracks compactions, and maps structured lifecycle names;
- `session/disposed` marks the session inactive and closes the snapshot;
- adapter subscriptions are disposed with the plugin service.

The adapter deliberately exposes only lifecycle events, a session snapshot lookup, the host version, and an optional runtime-health check. It does not copy the session log.

## Event vocabulary consumed

The alpha.2, alpha.4, and alpha.5 Session packages expose these relevant core events:

- `turn/end` with `{ reason: { kind: 'completed' | 'blocked' | 'aborted' | 'interrupted' | 'error' | 'max-tokens' } }`;
- `tool/call` and `tool/result`, including structured result errors;
- `compaction/start`, `compaction/summary`, `compaction/end`, and `compaction/prune`;
- other event names are ignored unless a provider has a documented structured marker.

Providers read event type, sequence, time, reason kind, small boolean/number markers, and tool name. They do not inspect `user/message`, `assistant/message`, raw tool arguments, raw tool results, or transcript content.

## Provider mapping

| Provider | DSH fact | Result |
| --- | --- | --- |
| Human Needed | approval/permission/question/clarification markers and blocked turn | C2 interrupt candidate |
| Completion | completed, failed, aborted, max-tokens, and structured unresolved-acceptance markers | C1 or C2 |
| Context | compaction lifecycle, pressure, overflow, token-limit, repeated compaction | C1 or C2 |
| Stuck / Progress | heartbeat silence, explicit no-progress marker, repeated result errors | C2 |
| Subagent Pressure | active start/end count | C1/C2/C3 according to policy |
| Host Health | local WebServer HTTP probe | C3 on authoritative failure; C1 on recovery |

## Model-visible tools

Every registered tool uses the DSH `defineTool` contract with parameters, an explicit JSON output schema, and a text renderer. The current set contains nine tools:

`deepcanary_status`, `deepcanary_inbox`, `deepcanary_acknowledge`, `deepcanary_snooze`, `deepcanary_mute`, `deepcanary_feedback`, `deepcanary_explain`, `deepcanary_dry_run`, and `deepcanary_jump`.

The actions mutate only local Inbox metadata or return a navigation hint. No tool calls the shell, writes user files, changes a DSH session, or performs an approval/rejection.

## Settings integration

When `@deepseek-ai/dsh-settings` is mounted, the plugin registers `dsh-deepcanary` through the alpha.2 `settings.installSection` API, using the composed configuration as the base and a provider update hook for live changes. The browser client binds the same namespace through `settingsScope.bind()` and contributes the keyed `settings.plugin.item` card. Web input is validated independently by `sanitizeConfigPatch`; `stateDir` is intentionally excluded from live updates.

## Web endpoints

When `webServer` is available, the plugin registers exact routes under `/dsh-deepcanary`:

- `GET /state`;
- `GET|POST /settings`;
- `GET /health`;
- `GET /explain?id=...`;
- `POST /dry-run`;
- `POST /action`;
- `POST /outcome`;
- `GET /outcomes`;
- `GET /supervisor` (read-only bounded snapshot, lease status, and resource counters);

Route disposers belong to the WebServer injection context, so unload does not leave duplicate routes. Responses are same-origin local responses with `cache-control: no-store`. Outcome input uses an explicit `source` and bounded `trialId`; the service derives decision fields from the matching Inbox item and keeps source filters available for local reports.

## Browser client

The package manifest declares `dsh.client.platform = "web"`, requests the alpha.5-compatible UI dependencies through `dsh.client.inject`, and exposes `./client` as `lib/client.js`. The browser artifact is a lazy-CJS factory that registers with `window.__ModuleLoader__.load`; DSH's client-module loader owns the `/plugins/.../client.js` transport and module-table lifecycle.

The client contributes the sidebar entry through the additive `sidebar.footer.action` slot, the floating Inbox through the additive `shell.overlay` slot, and the standard keyed settings card through `settings.plugin.item`. The overlay is click-through outside the panel. The panel starts hidden, supports close/reopen, pointer and keyboard resizing, and uses the DSH locale seat for Chinese/English updates. The client uses the alpha.5 module-loading surface and avoids permanent body injection, so the host shell remains available while the panel is closed. Alpha.5's `SessionSeq` changes do not affect the native `sessions.open(SessionId)` navigation contract used by DeepCanary.

## Audit rule

If a future DSH release changes an event payload, Settings scope, Tool definition, or WebServer route API, update this audit and the compatibility matrix before changing a provider. Then rerun the exact upstream install, CLI version, dump-config, plugin build, AttentionGold, Web startup, public-tag installation, Windows/WSL, and unload/restart gates.
