# Changelog

All notable changes to `dsh-deepcanary` are recorded here.

## Post-RC4 maintenance — 2026-09-02

The public `0.1.0-rc.4` artifact remains unchanged. The current `main` branch contains a focused maintenance set for the alpha.4 compatibility baseline:

- debounced the local WebServer probe into outage epochs with stable `outageId` correlation and explicit recovery state;
- reduced foreground/background state polling and fixed request-timeout cleanup so a slow health request cannot leave a stale in-flight guard;
- recorded browser notification attempts with a per-attempt ID and explicit attempted, constructed, click-handler, clicked, and error stages;
- upgraded Windows notification evidence to schema v3 with run windows, browser receipts, screenshot/UIA hashes, and distinct `observed`, `not-observed`, and `not-tested` OS outcomes;
- changed dogfood review coverage to use unique user-facing delivery units and added bounded persistence for dedupe and interrupt-budget state;
- added Persistent Supervisor standby retry and versioned policy-state restoration;
- added `npm run gate:stable`, which regenerates replay and Supervisor evidence and records package, git, source-digest, runtime, and tarball identity.
- documented DSH launch-token rotation after restart and the alpha.4 Gateway heartbeat behavior in the connection troubleshooting guidance.

The upstream alpha.5 reference was checked against the official public tags and Releases interfaces on 2026-09-02 and could not be resolved as an immutable public object. The alpha.4 tag and commit therefore remain the verified runtime baseline until alpha.5 is publicly available for a complete compatibility run. npm publication remains paused.

## 0.1.0-rc.4 — release candidate (2026-09-01)

`0.1.0-rc.4` is a public prerelease for the official DSH `dsh-v0.1.2-alpha.4`. The GitHub tag and Release asset are available for installation and source review; npm publication remains paused for this cycle.

This release keeps the RC3 user experience while completing the alpha.4 compatibility update and strengthening the attention workflow. The local tarball, immutable GitHub tag, Release asset, release evidence, and Web UI behavior now describe one reproducible RC4 prerelease.

### Changed

- updated the npm package version, package-lock metadata, bilingual installation commands, compatibility references, and release checklist to `0.1.0-rc.4` and official DSH alpha.4;
- retained the public `v0.1.0-rc.3` tag as historical reference while directing new installations to the RC4 GitHub tag and Release asset;
- classified authoritative human approval/question boundaries separately from heuristic hints, preserving the C3 safety floor for host/runtime evidence;
- retained a bounded local DSH session handle for native session reopening while keeping session/workspace references, evidence, and content privacy-safe;
- made feedback, mute, restore, suppression, and historical-session states visible and actionable in the Inbox;
- validated the official DSH alpha.4 compatibility surface, including its Session sequence changes and the unchanged `sessions.open` navigation contract;
- refreshed the release receipt for the RC4 artifact, alpha4 CI run, GitHub tag, Release asset, and npm publication hold.

## 0.1.0-rc.3 — 2026-09-01

`0.1.0-rc.3` is a public prerelease for the official DSH `dsh-v0.1.2-alpha.3`. It is ready for daily trial use, integration testing, and structured feedback. Physical touch hardware, real screen-reader output, and operating-system notification delivery remain supplemental post-release verification items.

### Added

- a privacy-safe `PolicyDecisionTrace` carried from deterministic judgment through Inbox persistence, Web state, model explanation, and the bilingual client details view;
- read-only `deepcanary_dry_run` and `/dsh-deepcanary/dry-run` policy previews with bounded structured input and field-level differences;
- AttentionGold v3 cases for heuristic-versus-authoritative host facts, low-hint Human Needed signals, recovery, recurrence, parallel sessions, and presentation metadata;
- a local trial protocol, aggregate quality-report schema/generator, and high-throughput bounded-state benchmark;
- a browser-notification return path that focuses DSH, opens the selected alert, and positions the target item in the visible Inbox range;
- a privacy-safe OutcomeReceipt store with explicit real/controlled/replay provenance, bounded outcome fields, and source-filtered local reports;
- `/dsh-deepcanary/outcome` and `/dsh-deepcanary/outcomes` routes plus public receipt/report schemas for dogfood review;
- bilingual installation, rollback, and troubleshooting guidance, plus privacy-safe Web UI screenshots and an ecosystem screenshot manifest.

### Compatibility

- prepared RC3 against the official immutable DSH `dsh-v0.1.2-alpha.3` tag at commit `dd6322d604e00eec1ba5e0c8541159906a21094a`.
- added a public-commit Playwright smoke for the alpha.3 Web profile, covering onboarding, mount semantics, panel lifecycle, responsive bounds, forced colors, and live status semantics.
- The public `v0.1.0-rc.2` release remains the historical alpha.2 distribution; its receipt is retained for comparison with RC3.

## 0.1.0-rc.2 — 2026-08-31

### Changed

- replaced the historical body-injected Web client with a DSH alpha.2 `dsh.client` lazy-CJS client module;
- moved the visible entry to `sidebar.footer.action` and the Inbox panel to the additive `shell.overlay` seat;
- made the panel hidden by default, explicitly closable and reopenable, resizable with pointer and keyboard controls, and responsive to DSH Chinese/English locale changes;
- kept the local WebServer endpoints focused on state, settings, health, and actions; the plugin no longer owns a `/dsh-deepcanary/client.js` route.
- added the standard keyed `settings.plugin.item` card and alpha.2 Settings namespace pairing;
- versioned public state and action responses, added ETag/`304` state reads, request replay protection, and explicit Inbox recovery/expiry lifecycle;
- updated the local integration baseline to official DSH `dsh-v0.1.2-alpha.2`.

## 0.1.0-rc.1 — 2026-08-30

First public release candidate for the local attention-supervision experience.

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
