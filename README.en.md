# dsh-deepcanary

> A quiet layer for the moments that genuinely need your attention.

`dsh-deepcanary` is a local attention-supervision plugin for [DeepSeek Harness (DSH)](https://github.com/deepseek-ai/deepseek-harness). It reads structured facts from Sessions, Tools, Agents, Subagents, and the Host, then applies deterministic policy to decide what can stay quiet, what belongs in the Inbox, and what deserves a user-facing reminder.

Current version: `0.1.0-rc.1`. This release candidate is tested against the official `dsh-v0.1.2-alpha.1` runtime at commit `cd5ef8148158c3a752a658978873241fdf8e2bbc`. Installation and verification use that immutable upstream tag. The historical npm `0.1.1-rc.2` runtime is retained only as a development type reference and is not the integration-test baseline.

## What it does

DeepCanary answers one question: is this worth a human looking at now? It does not reimplement the agent loop or perform high-impact actions on the user's behalf.

- observes Human Needed, host unreachability, suspected stalls, tool-failure loops, no-progress signals, subagent pressure, context pressure, and completion events;
- uses C0–C3 attention levels, deduplication, Decision Bundles, and an hourly budget to reduce notification noise;
- adds a same-origin Web Inbox with a status indicator, settings card, and evidence summaries;
- supports acknowledge, snooze, mute, usefulness feedback, and navigation hints;
- never terminates or restarts a task, approves or rejects a request, or executes arbitrary commands.

The governing rule is evidence before escalation. C3 requires Host or Runtime authority, and model judgment is not required by this RC.

## Installation

### Requirements

- Windows x64 or WSL2 Ubuntu;
- Node.js `22.19+` (the release verification used Node.js `24.19.0`);
- pnpm `11.7.0`;
- the official DSH `dsh-v0.1.2-alpha.1` source runtime.

### 1. Prepare the official DSH alpha.1 runtime

```powershell
git clone --depth 1 --branch dsh-v0.1.2-alpha.1 https://github.com/deepseek-ai/deepseek-harness.git dsh-runtime-alpha1
Set-Location .\dsh-runtime-alpha1
npx --yes pnpm@11.7.0 install
npx --yes pnpm@11.7.0 run build
npx --yes pnpm@11.7.0 dsh --version
```

The last command should print `0.1.2-alpha.1`. See the official release page: [dsh-v0.1.2-alpha.1](https://github.com/deepseek-ai/deepseek-harness/releases/tag/dsh-v0.1.2-alpha.1).

### 2. Install the plugin from the public RC tag

The following command uses an immutable GitHub tag and is the clean-profile verification path. Do not use a local source directory or a directory containing personal design notes as the production installation source.

```powershell
Set-Location .\dsh-runtime-alpha1
npx --yes pnpm@11.7.0 dsh plugin --profile web add https://codeload.github.com/Oscar-Williams/dsh-deepcanary/tar.gz/refs/tags/v0.1.0-rc.1
npx --yes pnpm@11.7.0 dsh --profile web --dump-config
npx --yes pnpm@11.7.0 dsh web --no-open
```

Open the DSH Web page in a browser on the same machine. The plugin injects a small same-origin Inbox panel. If browser notification permission is denied, the panel and model-visible tools remain available.

To update an existing RC installation, rebuild only when using a local development checkout; for an installed profile use:

```powershell
npx --yes pnpm@11.7.0 dsh plugin --profile web update dsh-deepcanary
```

### Local development installation

For an unpublished change, build this repository and install the local directory. This is useful for development but is not a substitute for public-tag verification:

```powershell
Set-Location F:\Agent_Related\ZCode_Related\plugin2
npm install
npm run build

Set-Location F:\Agent_Related\Deepseek-Harness_Related\dsh-runtime-alpha1
npx --yes pnpm@11.7.0 dsh plugin --profile web add F:\Agent_Related\ZCode_Related\plugin2
npx --yes pnpm@11.7.0 dsh web --no-open
```

## Web and model-visible interfaces

The plugin registers these same-origin local WebServer routes:

| Route | Purpose |
| --- | --- |
| `/dsh-deepcanary/state` | status, settings, and pending Inbox snapshot |
| `/dsh-deepcanary/settings` | read or validate and update user-facing settings |
| `/dsh-deepcanary/health` | plugin health check |
| `/dsh-deepcanary/action` | acknowledge, mute, snooze, feedback, and navigation hint |
| `/dsh-deepcanary/client.js` | Web Inbox client |

The DSH model can use `deepcanary_status`, `deepcanary_inbox`, `deepcanary_acknowledge`, `deepcanary_snooze`, `deepcanary_mute`, `deepcanary_feedback`, `deepcanary_explain`, and `deepcanary_jump`.

The settings card exposes notification level, hourly interrupt budget, quiet hours, long-run threshold, subagent-pressure mode, adjacent-event bundling, and privacy-safe summaries. When `@deepseek-ai/dsh-settings` is mounted, updates use the DSH Settings namespace and take effect live; without that provider, the plugin continues to use its composed bundle configuration.

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

AttentionGold freezes 15 classification scenarios plus duplicate-event and shared-root Bundle scenarios. The final RC evidence for the upstream runtime, Windows/WSL, public-tag installation, Web, settings, unload/restart, and distribution integrity is recorded in the repository's [`benchmark/release-receipt.json`](benchmark/release-receipt.json). The receipt is intentionally excluded from the npm runtime package so its SHA-256 can be verified without a circular dependency. See [`docs/release-checklist.md`](docs/release-checklist.md) for the reproducible release procedure.

## Documentation

- [`docs/architecture.md`](docs/architecture.md) — runtime pipeline, stable contracts, and extension boundaries;
- [`docs/dsh-surface-audit.md`](docs/dsh-surface-audit.md) — DSH surface audit against alpha.1;
- [`docs/compatibility.md`](docs/compatibility.md) — runtime, platform, and known limitations;
- [`docs/security.md`](docs/security.md) — local state, action, and Web boundaries;
- [`docs/release-checklist.md`](docs/release-checklist.md) — reproducible release checks.

## License

MIT
