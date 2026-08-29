# Architecture

## Runtime pipeline

DeepCanary has five deliberately separate stages:

    DSH runtime facts
      -> providers
      -> CanarySignal
      -> deterministic judge
      -> dedupe + policy + budget
      -> local inbox / browser notification / model tools

The plugin observes DSH seams rather than reimplementing the agent loop. Session events are the primary durable source of truth. Agent errors and Subagent lifecycle events add live runtime facts. A local liveness timer can report a suspected stall; it never claims that a process is dead without an authoritative probe.

## Stable contracts

src/types.ts owns the stable vocabulary:

- CanarySignal carries source, reason code, evidence, an optional severity hint, and privacy-safe scalar data.
- EvidenceRef records the evidence type and its authority: host, runtime, derived, or heuristic.
- AttentionVerdict carries C0–C3, the action, confidence, reason, and evidence.
- InboxItem adds reversible local status and feedback.

The provider layer may use richer runtime objects in memory, but only the normalized verdict is persisted.

## Attention policy

The judge is deterministic:

- C0 is silent.
- C1 is recorded in the inbox.
- C2 is an interrupt candidate and may be downgraded to a digest by quiet hours or budget.
- C3 is an escalation candidate and may bypass the hourly C2 budget, but still passes the deduplication window.
- C3 is not granted from heuristic evidence alone.

Normal completion and context compaction are C1. Human approval/question boundaries, repeated tool failures, suspected stalls, task failure/abort, and suspicious completion are C2 by default. Host unreachability with Host/Runtime evidence and the highest Subagent pressure threshold are C3.

## DSH integration seams

The host entry point is src/index.ts:

- inject = tools and sessions expresses the required DSH services.
- session/created, session/event, and session/disposed feed Session providers.
- optional agents and subagents injections observe live lifecycle events.
- optional webServer injection registers same-origin routes and a structured index script injection.
- optional settings injection exposes the same Config schema as a live dsh-deepcanary namespace; state directory changes remain restart-scoped.
- DSH Tools are registered with defineTool, including an explicit JSON output schema and render function.

The client is a standalone browser script. This keeps the first release compatible with the alpha.1 Web host without coupling the plugin to a particular React slot implementation. The server route remains the source of truth for state.

## Persistence and privacy

MetadataStore writes an atomic JSON file containing only metadata. Session and workspace references are hashed before writing; evidence references are reduced to metadata codes. There is no transcript cache, prompt cache, credential store, or model-judgment log.

The store is local by construction. It does not make network requests, spawn processes, or write outside the configured state directory.

## Extending the plugin

Add a provider only when its runtime fact has a clear event or probe boundary. Give it a stable reason code, evidence authority, dedupe key, and an AttentionGold case. If it needs content to decide, prefer a structured DSH fact; do not read raw conversation text into the persistence path.
