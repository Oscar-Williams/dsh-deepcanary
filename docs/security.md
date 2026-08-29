# Security and privacy boundary

## Stored data

The default state file contains:

- plugin schema version;
- item id, timestamp, level, action, status, reason code, and bounded feedback;
- hash-based Session and Workspace references;
- evidence type, authority, metadata code, and short provider-written summary.

It does not contain prompts, assistant output, tool arguments, raw tool results, environment variables, API keys, credentials, arbitrary file contents, or full session logs. privacySafeSummary remains enabled by default.

## Actions

The model-visible and Web actions are limited to acknowledge, snooze, mute, feedback, status, explanation, and a navigation hint. They do not terminate or restart agents, approve or reject requests, run commands, change files, or make network calls on behalf of the user.

## Web boundary

Routes are registered with the DSH local WebServer and are same-origin by design. Responses use no-store; the client renders dynamic values with textContent rather than HTML interpolation. The action endpoint accepts a small JSON payload and rejects unsupported actions.

The plugin assumes the DSH WebServer is a trusted local host. It is not an authentication layer and should not be exposed through an unauthenticated public reverse proxy.

## Evidence authority

Heuristic evidence may explain a C1/C2 recommendation but cannot independently create C3. A provider must identify the authority of every evidence item. The deterministic judge is the final policy boundary, even when a model-assisted provider is added later.
