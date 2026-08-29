# Changelog

All notable changes to `dsh-deepcanary` are recorded here.

## 0.1.0-rc.1 — 2026-08-30

First public release candidate for the local attention-supervision surface.

### Included

- evidence-first `CanarySignal`, `EvidenceRef`, `AttentionVerdict`, and deterministic C0–C3 policy;
- six provider families: Human Needed, Host Health, Stuck/Progress, Subagent Pressure, Context Pressure, and Completion;
- official alpha.1 adapter boundary for Session lifecycle events, structured turn reasons, tool results, and compaction markers;
- deduplication, adjacent root-cause Decision Bundles, quiet hours, and rolling C2 interrupt budget;
- metadata-only local persistence with hashed Session/Workspace/evidence references;
- DSH model-visible status, Inbox, explanation, feedback, reversible actions, and navigation-hint tools;
- same-origin Web state, settings, health, action, client, and index-injection routes;
- settings-card support for notification level, budget, quiet hours, liveness threshold, Subagent pressure, bundling, and privacy-safe summaries;
- Windows/WSL path identity normalization, interop capability detection, browser-notification fallback, and CJK path fixtures;
- AttentionGold v2 with 15 classification scenarios plus duplicate and shared-root Bundle scenarios;
- tracked `lib/` distribution output so a public DSH Git tag is directly installable;
- classic-script client output for DSH `index-inject`, with a distribution guard that rejects accidental module exports;
- release receipt structure for exact DSH runtime, platform, package, public-tag, Web, settings, privacy, and unload/restart gates.

### Deliberately deferred

Model-assisted judgment, Done Verification, Watcher Swarm, tray persistence, and organization policy are planned for later release lines. The RC's declared behavior remains deterministic and complete without those optional layers.

The exact verification evidence is recorded in [`benchmark/release-receipt.json`](benchmark/release-receipt.json).
