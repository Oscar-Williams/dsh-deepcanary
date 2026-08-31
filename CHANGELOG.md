# Changelog

All notable changes to `dsh-deepcanary` are recorded here.

## 0.1.0-rc.2 — 2026-08-31

### Changed

- replaced the historical body-injected Web client with a DSH alpha.2 `dsh.client` lazy-CJS client module;
- moved the visible entry to `sidebar.footer.action` and the Inbox panel to the additive `shell.overlay` seat;
- made the panel hidden by default, explicitly closable and reopenable, resizable with pointer and keyboard controls, and responsive to DSH Chinese/English locale changes;
- kept the local WebServer contract focused on state, settings, health, and actions; the plugin no longer owns a `/dsh-deepcanary/client.js` route.
- added the standard keyed `settings.plugin.item` card and alpha.2 Settings namespace pairing;
- versioned public state and action responses, added ETag/`304` state reads, request replay protection, and explicit Inbox recovery/expiry lifecycle;
- updated the local integration baseline to official DSH `dsh-v0.1.2-alpha.2`.

## 0.1.0-rc.1 — 2026-08-30

First public release candidate for the local attention-supervision surface.

### Included

- evidence-first `CanarySignal`, `EvidenceRef`, `AttentionVerdict`, and deterministic C0–C3 policy;
- six provider families: Human Needed, Host Health, Stuck/Progress, Subagent Pressure, Context Pressure, and Completion;
- official alpha.2 adapter boundary for Session lifecycle events, structured turn reasons, tool results, and compaction markers;
- deduplication, adjacent root-cause Decision Bundles, quiet hours, and rolling C2 interrupt budget;
- metadata-only local persistence with hashed Session/Workspace/evidence references;
- DSH model-visible status, Inbox, explanation, feedback, reversible actions, and navigation-hint tools;
- same-origin Web state, settings, health, and action routes;
- settings-card support for notification level, budget, quiet hours, liveness threshold, Subagent pressure, bundling, and privacy-safe summaries;
- Windows/WSL path identity normalization, interop capability detection, browser-notification fallback, and CJK path fixtures;
- AttentionGold v2 with 15 classification scenarios plus duplicate and shared-root Bundle scenarios;
- tracked `lib/` distribution output so a public DSH Git tag is directly installable;
- classic lazy-CJS client-module output for DSH alpha.2, with a distribution guard for the `window.__ModuleLoader__` factory handoff;
- release receipt structure for exact DSH runtime, platform, package, public-tag, Web, settings, privacy, and unload/restart gates.

### Deliberately deferred

Model-assisted judgment, Done Verification, Watcher Swarm, tray persistence, and organization policy are planned for later release lines. The RC's declared behavior remains deterministic and complete without those optional layers.

The exact verification evidence is recorded in [`benchmark/release-receipt.json`](benchmark/release-receipt.json).
