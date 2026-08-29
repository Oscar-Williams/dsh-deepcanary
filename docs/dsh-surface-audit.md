# DSH surface audit

This document records the DSH surfaces consumed by `dsh-deepcanary`. The audit target is the official `dsh-v0.1.2-alpha.1` source tag at commit `cd5ef8148158c3a752a658978873241fdf8e2bbc`.

## Service and lifecycle seams

| Surface | Use | Required? | Fallback |
| --- | --- | --- | --- |
| `@deepseek-ai/dsh-session` | Session lifecycle and append-only event feed | yes | A valid plugin mount requires the Session service |
| `@deepseek-ai/dsh-tools` | Model-visible tools and JSON results | yes for model tools | Web and local service still expose their non-tool surfaces |
| `@deepseek-ai/dsh-agent` | `agent/error` facts | no | Session event and Web status remain available |
| `@deepseek-ai/dsh-subagent` | `subagent/start` and `subagent/end` pressure facts | no | Subagent pressure provider remains inactive |
| `@deepseek-ai/dsh-host-webserver` | exact local routes and body script injection | no | Model tools and local persistence remain available |
| `@deepseek-ai/dsh-settings` | live namespace registration and user updates | no | Bundle-composed configuration remains authoritative |

`ContextDshAdapter` owns the DSH event wiring:

- `session/created` creates an in-memory liveness and session snapshot;
- `session/event` updates the heartbeat, counts tool failures, tracks compactions, and maps structured lifecycle names;
- `session/disposed` marks the session inactive and closes the snapshot;
- adapter subscriptions are disposed with the plugin service.

The adapter deliberately exposes only lifecycle events, a session snapshot lookup, the host version, and an optional runtime-health seam. It does not copy the session log.

## Event vocabulary consumed

The alpha.1 Session package exposes these relevant core events:

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

## Tool contract

Every registered tool uses the alpha.1 `defineTool` contract with parameters, an explicit JSON output schema, and a text renderer:

`deepcanary_status`, `deepcanary_inbox`, `deepcanary_acknowledge`, `deepcanary_snooze`, `deepcanary_mute`, `deepcanary_feedback`, `deepcanary_explain`, and `deepcanary_jump`.

The actions mutate only local Inbox metadata or return a navigation hint. No tool calls the shell, writes user files, changes a DSH session, or performs an approval/rejection.

## Settings contract

When `@deepseek-ai/dsh-settings` is mounted, the plugin calls `ctx.settings.register('dsh-deepcanary', Config, { base, applies: 'live' })`, reads the resolved snapshot, watches commits, and writes through the scope's `update()` method. Web input is validated independently by `sanitizeConfigPatch`; `stateDir` is intentionally excluded from live updates.

## Web contract

When `webServer` is available, the plugin registers exact routes under `/dsh-deepcanary`:

- `GET /state`;
- `GET|POST /settings`;
- `GET /health`;
- `POST /action`;
- `GET /client.js`.

The plugin adds `/dsh-deepcanary/client.js` through `webserver/index-inject`. Route disposers belong to the WebServer injection context, so unload does not leave duplicate routes. Responses are same-origin local responses with `cache-control: no-store`.

## Audit rule

If a future DSH release changes an event payload, Settings scope, Tool definition, or WebServer route API, update this audit and the compatibility matrix before changing a provider. Then rerun the exact upstream install, CLI version, dump-config, plugin build, AttentionGold, Web startup, public-tag installation, Windows/WSL, and unload/restart gates.
