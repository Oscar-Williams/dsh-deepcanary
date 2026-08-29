# DSH surface audit

This audit records the DSH surfaces used by dsh-deepcanary and the fallback behavior when an optional surface is unavailable. The current audit target is official dsh-v0.1.2-alpha.1.

| Surface | Use | Required? | Fallback |
| --- | --- | --- | --- |
| @deepseek-ai/dsh-session | Session lifecycle and event firehose | yes | Plugin does not mount without the Session service |
| @deepseek-ai/dsh-tools | Model-visible tools | yes | Plugin tools are not registered if Tools is absent |
| @deepseek-ai/dsh-agent | Agent error facts | no | Session facts and Web status remain available |
| @deepseek-ai/dsh-subagent | Active Subagent pressure | no | Subagent pressure provider remains inactive |
| @deepseek-ai/dsh-host-webserver | Local state/action/health routes and client injection | no | Model tools and local persistence remain available |
| @deepseek-ai/dsh-settings | Live namespace for notification, quiet-hours, budget, and threshold settings | no | Composed Config remains authoritative when the settings provider is absent |

## Session events used

- session/created: creates an in-memory liveness record from the session id and optional cwd;
- session/event: updates liveness, counts tool failures, and maps turn/end, tool/call, tool/result, and context lifecycle names;
- session/disposed: marks a session inactive.

The provider deliberately reads event type, sequence, time, and a small set of structured fields. It does not inspect message content or raw tool arguments.

## Tool contract

Every registered tool uses DSH defineTool and declares both a parameter schema and an output schema with a render function. The tool set is read-only or metadata-only:

deepcanary_status, deepcanary_inbox, deepcanary_acknowledge, deepcanary_snooze, deepcanary_mute, deepcanary_feedback, deepcanary_explain, and deepcanary_jump.

## Web contract

The WebServer seam is optional. When available, the plugin registers exact routes under /dsh-deepcanary and contributes /dsh-deepcanary/client.js through webserver/index-inject. The route disposer is owned by the WebServer injection context.

## Audit rule

If a future DSH release changes an event payload or route API, update this document and the compatibility matrix before changing the provider. Then rerun the alpha/canary install, typecheck, build, plugin load, and real Web startup gates.
