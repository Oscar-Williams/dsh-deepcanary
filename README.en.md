# dsh-deepcanary

> A quiet layer for the moments that genuinely need your attention.

`dsh-deepcanary` is a local attention-supervision plugin for [DeepSeek Harness (DSH)](https://github.com/deepseek-ai/deepseek-harness). It reads structured facts from Sessions, Tools, Agents, Subagents, and the Host, then applies deterministic policy to decide what can stay quiet, what belongs in the Inbox, and what deserves a user-facing reminder.

## Current development line (unreleased)

The current `main` branch contains the next candidate's Policy Explain, read-only Dry-run, AttentionGold v3, privacy-safe dogfood protocol, and a bounded high-throughput benchmark covering multiple sessions, recovery samples, and resource measurements. This development line is being checked locally against the official DSH `dsh-v0.1.2-alpha.3` exact tag (commit `dd6322d604e00eec1ba5e0c8541159906a21094a`); the local WebUI pass also covers ARIA semantics, emulated touch input, forced colors, and a multi-viewport layout matrix, while the public commit `7600c13` passes the alpha.3 GitHub Actions browser smoke. It has not replaced the public `v0.1.0-rc.2` installation instructions or its historical alpha.2 receipt.

To reproduce the published release, follow the RC.2 installation path below. To validate the current source, use the alpha.3 development lane in [`docs/compatibility.md`](docs/compatibility.md) with an isolated test profile.

The current public RC tag is `v0.1.0-rc.2`, pointing to `4ae7c2bb577d7a2b855f425a8e3fde7800a9feb2`; its release receipt passes on the official `dsh-v0.1.2-alpha.2` runtime. `v0.1.0-rc.1` and npm `0.1.1-rc.2` are historical dependencies and must not be used as this revision's integration baseline. If a test profile still contains an older version, stop DSH and replace it before testing so the result cannot be confused with a stale install.

## What it does

DeepCanary answers one question: is this worth a human looking at now? It does not reimplement the agent loop or perform high-impact actions on the user's behalf.

- observes Human Needed, host unreachability, suspected stalls, tool-failure loops, no-progress signals, subagent pressure, context pressure, and completion events;
- uses C0–C3 attention levels, deduplication, Decision Bundles, and an hourly budget to reduce notification noise;
- keeps only a sidebar entry visible at startup; the panel opens on demand, can be closed and reopened, supports mouse or keyboard resizing, and follows DSH's Chinese/English setting;
- provides the Inbox, settings card, and evidence summaries inside that panel;
- supports acknowledge, snooze, mute, usefulness feedback, and navigation hints;
- never terminates or restarts a task, approves or rejects a request, or executes arbitrary commands.

The governing rule is evidence before escalation. C3 requires Host or Runtime authority, and model judgment is not required by this RC.

## Installation

### Requirements

- Windows x64 or WSL2 Ubuntu;
- Node.js `22.19+` (the release verification used Node.js `24.19.0`);
- pnpm `11.7.0`;
- the official DSH `dsh-v0.1.2-alpha.2` source runtime.

### 1. Prepare the official DSH alpha.2 runtime

```powershell
git clone --depth 1 --branch dsh-v0.1.2-alpha.2 https://github.com/deepseek-ai/deepseek-harness.git dsh-runtime-alpha2
Set-Location .\dsh-runtime-alpha2
npx --yes pnpm@11.7.0 install
npx --yes pnpm@11.7.0 run build
npx --yes pnpm@11.7.0 dsh --version
git rev-parse HEAD
```

The version command should print `0.1.2-alpha.2`, and the commit command should print `0a53fb55bea101816fa226bb964ae2bed71c343b`. See the official release page: [dsh-v0.1.2-alpha.2](https://github.com/deepseek-ai/deepseek-harness/releases/tag/dsh-v0.1.2-alpha.2). An existing checkout may still be named `dsh-runtime-alpha1`; its tag, commit, and `dsh --version` must still match the values above.

### 2. Install the plugin

For the supported installation path, use the independently verified immutable tag `v0.1.0-rc.2`. Do not use a local source directory or a directory containing personal design notes as the production installation source.

```powershell
Set-Location .\dsh-runtime-alpha2
npx --yes pnpm@11.7.0 dsh plugin --profile web add https://codeload.github.com/Oscar-Williams/dsh-deepcanary/tar.gz/refs/tags/v0.1.0-rc.2
npx --yes pnpm@11.7.0 dsh --profile web --dump-config
npx --yes pnpm@11.7.0 dsh web --no-open
```

Open the DSH Web page in a browser on the same machine. Once RC.2 is installed, its client is loaded through the alpha.2 client-module surface; the panel does not cover the page at startup and opens only after the sidebar entry is clicked. If browser notification permission is denied, the panel and model-visible tools remain available.

To update an existing RC installation, rebuild only when using a local development checkout; for an installed profile use:

```powershell
npx --yes pnpm@11.7.0 dsh plugin --profile web update dsh-deepcanary
```

### Local development installation

For an unpublished change, build the npm package and install the explicit local tarball into the test profile. This makes it clear that DSH is loading the current build rather than a stale tag:

```powershell
Set-Location F:\Agent_Related\ZCode_Related\plugin2
npm install
npm run build
$packDir = Join-Path $env:TEMP 'dsh-deepcanary-rc2-pack'
New-Item -ItemType Directory -Force $packDir | Out-Null
npm pack --pack-destination $packDir
$tarball = Join-Path $packDir 'dsh-deepcanary-0.1.0-rc.2.tgz'

Set-Location F:\Agent_Related\Deepseek-Harness_Related\dsh-runtime-alpha1
$env:DSH_HOME = 'F:\Agent_Related\Deepseek-Harness_test\.dsh-home'
npx --yes pnpm@11.7.0 dsh plugin --profile web remove dsh-deepcanary
npx --yes pnpm@11.7.0 dsh plugin --profile web add $tarball
npx --yes pnpm@11.7.0 dsh --profile web --dump-config
npx --yes pnpm@11.7.0 dsh web --no-open
```

The existing local runtime directory is named `dsh-runtime-alpha1`, but the version checks remain mandatory. Before testing the Web UI, confirm that the profile's `node_modules/dsh-deepcanary/package.json` is version `0.1.0-rc.2` and contains `exports["./client"]` and `dsh.client`. If a fixed card still appears on the right side, stop DSH and replace the profile package before testing again.

### Web UI interactions

- **Hide:** the Inbox panel is not rendered at startup; the close button, `Esc`, and an outside click hide it without blocking the DSH page.
- **Wake:** click the DeepCanary entry at the bottom of the sidebar to reopen it; focus moves to the close button and returns to the entry after closing.
- **Notification return:** when browser notification permission is granted, clicking a C2/C3 notification focuses DSH, opens the corresponding alert, and scrolls the target item into the visible panel range.
- **Resize:** the right and bottom handles support pointer dragging and keyboard arrows, `Home`, and `End`; the size is persisted when browser storage is available.
- **Bilingual display:** panel copy, reasons, suggestions, evidence labels, actions, and settings fields are registered with DSH locale and update when DSH switches between Chinese and English.

## Web and model-visible interfaces

The plugin registers these same-origin local WebServer routes:

| Route | Purpose |
| --- | --- |
| `/dsh-deepcanary/state` | status, settings, and pending Inbox snapshot |
| `/dsh-deepcanary/settings` | read or validate and update user-facing settings |
| `/dsh-deepcanary/health` | plugin health check |
| `/dsh-deepcanary/explain?id=...` | read a privacy-safe explanation for one Inbox item |
| `/dsh-deepcanary/dry-run` | compare current and candidate alert policy without side effects |
| `/dsh-deepcanary/action` | acknowledge, mute, snooze, feedback, and navigation hint |

The DSH model can use nine tools: `deepcanary_status`, `deepcanary_inbox`, `deepcanary_acknowledge`, `deepcanary_snooze`, `deepcanary_mute`, `deepcanary_feedback`, `deepcanary_explain`, `deepcanary_dry_run`, and `deepcanary_jump`.

The settings card uses DSH's standard `settings.plugin.item` location and exposes notification level, automatic critical-panel wake-up, hourly interrupt budget, quiet hours, long-run threshold, subagent-pressure mode, adjacent-event bundling, and privacy-safe summaries. When `@deepseek-ai/dsh-settings` is mounted, updates use the `dsh-deepcanary` namespace and take effect live; without that provider, the plugin continues to use its composed bundle configuration.

The client no longer registers a separate `/dsh-deepcanary/client.js` route or uses `webserver/index-inject`. The `dsh.client` manifest declaration and `./client` export are loaded by the DSH alpha.2/alpha.3 client-module loader; the entry contributes to `sidebar.footer.action`, the floating panel to `shell.overlay`, and the settings card to `settings.plugin.item`.

## Attention policy

| Level | Meaning | Default handling |
| --- | --- | --- |
| C0 | normal progress | silent |
| C1 | worth reviewing later | Inbox / status point |
| C2 | human judgment is a bottleneck | interrupt candidate + Inbox |
| C3 | high-impact blockage or host risk | urgent reminder candidate + Inbox |

Normal completion is always classified as `C1`. Adjacent signals with the same root-cause key form one Decision Bundle, preserving reason codes, event count, and bounded evidence summaries. Duplicate signals remain subject to the deduplication window. C2 consumes the rolling hourly budget and is downgraded to a digest during quiet hours; C3 does not consume the ordinary C2 budget, remains deduplicated, and is not hidden by quiet hours.

## Privacy and safety

The default state file is `~/.dsh/dsh-deepcanary/inbox.json`. It stores timestamps, levels, reason codes, hashed Session/Workspace references, evidence summaries, Bundle metadata, and user feedback. Prompts, model output, tool arguments, credentials, raw tool results, and full conversation content remain in DSH and are not written to DeepCanary state.

Web routes are same-origin local routes with `no-store` responses. The client renders dynamic values with DOM `textContent` rather than `innerHTML`. The plugin exposes no shell, file-write, terminate, restart, approval, or rejection tool. Do not put the DSH WebServer behind an unauthenticated public reverse proxy.

## Verification and release baseline

The release branch tracks built `lib/` output because DSH installs a public Git tag without depending on this repository's TypeScript toolchain. For local checks:

```powershell
npm install
npm run typecheck
npm run typecheck:tests
npm test
npm run build
npm run verify:distribution
npm pack --dry-run
```

The current development line also provides local value and reliability checks:

```powershell
npm run quality:report
npm run benchmark:attention
```

The quality report stores aggregate results only. Raw dogfood data should remain in the isolated test directory; see [`docs/dogfood-protocol.md`](docs/dogfood-protocol.md) for the fields and privacy boundary. The current alpha.3 local compatibility evidence and public-commit browser smoke are recorded in [`benchmark/alpha3-compatibility-receipt.json`](benchmark/alpha3-compatibility-receipt.json); it describes the current development lane and does not replace the public RC.2 receipt.

The current development line freezes 20 AttentionGold v3 classification scenarios plus duplicate-event, shared-root Bundle, recovery-recurrence, and parallel-session scenarios; the public RC.2 receipt still records the historical v2 set of 15 classification scenarios. RC.2 evidence for the upstream runtime, Windows/WSL, public-tag installation, Web, settings, unload/restart, and distribution integrity is recorded in [`benchmark/release-receipt.json`](benchmark/release-receipt.json), whose status is `PASS`. The receipt is intentionally excluded from the npm runtime package so its SHA-256 can be verified without a circular dependency. See [`docs/release-checklist.md`](docs/release-checklist.md) for the reproducible release procedure.

## Documentation

- [`docs/architecture.md`](docs/architecture.md) — runtime pipeline, stable contracts, and extension boundaries;
- [`docs/dsh-surface-audit.md`](docs/dsh-surface-audit.md) — DSH surface audit against alpha.2;
- [`docs/compatibility.md`](docs/compatibility.md) — runtime, platform, and known limitations;
- [`docs/security.md`](docs/security.md) — local state, action, and Web boundaries;
- [`docs/dogfood-protocol.md`](docs/dogfood-protocol.md) — privacy-safe dogfood, quality reports, and local benchmarks;
- [`docs/release-checklist.md`](docs/release-checklist.md) — reproducible release checks.

## License

MIT
