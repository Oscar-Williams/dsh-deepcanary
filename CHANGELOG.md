# Changelog

All notable changes to `dsh-deepcanary` are recorded here.

## 0.1.1-rc.3 — Supervisor renewal ordering (2026-09-05)

- Serialize heartbeat renewal and snapshot commits within each Supervisor owner to preserve ownership during concurrent persistence.
- Clear heartbeat timers on standby and ensure one heartbeat timer on successful startup.
- Verify delayed snapshot/heartbeat ordering and lease release with a deterministic regression test.
- Keep Supervisor experimental and off by default. Real-process recovery, resource limits and the real 8-hour soak remain separate release checks.
- Add the alpha.13 independent compatibility canary and the RC3 evidence identity record.
- Preserve the published RC1 and sealed RC2 artifact identities; RC3 evidence uses a separate package hash.

## 0.1.1-rc.2 — authoritative session reconciliation engineering candidate (2026-09-04)

`0.1.1-rc.2` introduced the first vertical slice of authoritative session reconciliation for the official DSH `dsh-v0.1.2-alpha.5` runtime while retaining the deterministic attention core and privacy boundary.

### Changed

- subscribe to DSH session lifecycle events before reading `ctx.sessions.list()`;
- derive bounded, privacy-safe session state from the public `Session.snapshotEvents()` contract;
- associate a reconciliation epoch with a bounded event buffer and perform a second authoritative read before switching to live delivery;
- merge already-snapshotted events by their exact session event sequence and expose an explicit degraded status when the authoritative list is unavailable or the boundary cannot be verified;
- carry the authoritative snapshot into service session state so startup restoration preserves running, Human Needed, failure, compaction, and last-event metadata;
- recreate one authoritative Human Needed item from an unresolved startup snapshot, persist a bounded orphan-grace timestamp, and converge a missing session to `expired` after an authoritative grace window;
- advance timestamp-only orphan grace from the liveness cadence, clear the grace immediately when an authoritative session returns, and cover three normal Supervisor restarts without a duplicate final interrupt;
- persist a bounded logical browser delivery ledger with idempotent attempt transitions, including delayed-callback protection and Supervisor snapshot restoration;
- add a controlled virtual-clock Supervisor bounded-soak report covering three normal restarts, stale-lease takeover, old-owner fencing, bounded policy/delivery state, resource counters, and shutdown release; the report remains supplemental-only and does not satisfy real elapsed-time Stable soak;
- keep the Persistent Supervisor explicitly experimental and off by default until its Stable reconciliation, restart, OS-delivery, resource, and soak criteria are complete;
- expose reconciliation status through the plugin state contract for operational diagnosis.

The adapter slice, orphan lifecycle, and bounded logical browser delivery ledger are covered by focused tests. Gate D remains pending because current dogfood evidence is controlled provenance and the real provider run requires a configured provider credential. Gate E remains prototype-ready while full restart policy acceptance, authoritative OS-level delivery states, resource delta, and soak evidence continue. The immutable `v0.1.1-rc.1` tag, Release asset, npm artifact, and their receipt retain their original identity.

## 0.1.1-rc.1 — DSH alpha.5 compatibility candidate (2026-09-02)

`0.1.1-rc.1` updates the compatibility baseline to the official DSH `dsh-v0.1.2-alpha.5` tag at commit `db6bdc3576c2d4e7c965e8e3ed0c2a731eed87f5`. The alpha.5 release addresses upgrade-time startup failures and missing session titles; the DSH interfaces consumed by DeepCanary remain compatible.

### Changed

- updated all current package, lockfile, source, test, installation, and compatibility references to plugin version `0.1.1-rc.1` and DSH alpha.5;
- kept the alpha.4 compatibility and `0.1.0-rc.4` release records as immutable historical evidence;
- retained the connection-stability maintenance from the RC4 follow-up, including host-probe outage epochs, bounded state polling, notification-attempt evidence, Persistent Supervisor standby retry, and bounded policy persistence;
- regenerated the distribution from the alpha.5 dependency graph and verified type checks, tests, build, distribution integrity, and release-gate inputs.
- published the exact verified tarball to the official npm registry with the `next` dist-tag, then verified its version, shasum, integrity metadata, and installation in a fresh alpha.5 profile;

The GitHub `v0.1.1-rc.1` tag and prerelease Release are synchronized with the verified artifact. The same artifact is published as `dsh-deepcanary@0.1.1-rc.1` on npm with the `next` dist-tag; registry metadata and the clean npm installation are recorded in [`benchmark/alpha5-compatibility-receipt.json`](benchmark/alpha5-compatibility-receipt.json).

## Post-RC4 maintenance — historical alpha.4 notes (2026-09-02)

The public `0.1.0-rc.4` artifact remains unchanged. The maintenance set below was first developed against the alpha.4 compatibility baseline and is carried into the current alpha.5 candidate:

- debounced the local WebServer probe into outage epochs with stable `outageId` correlation and explicit recovery state;
- reduced foreground/background state polling and fixed request-timeout cleanup so a slow health request cannot leave a stale in-flight guard;
- recorded browser notification attempts with a per-attempt ID and explicit attempted, constructed, click-handler, clicked, and error stages;
- upgraded Windows notification evidence to schema v3 with run windows, browser receipts, screenshot/UIA hashes, and distinct `observed`, `not-observed`, and `not-tested` OS outcomes;
- changed dogfood review coverage to use unique user-facing delivery units and added bounded persistence for dedupe and interrupt-budget state;
- added Persistent Supervisor standby retry and versioned policy-state restoration;
- added `npm run gate:stable`, which regenerates replay and Supervisor evidence and records package, git, source-digest, runtime, and tarball identity.
- documented DSH launch-token rotation after restart and the alpha.4 Gateway heartbeat behavior in the connection troubleshooting guidance.

The alpha.4 tag and commit remain the historical runtime baseline for this maintenance note. The current compatibility and release candidate are documented above against alpha.5.

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
