# dsh-deepcanary

[![CI](https://github.com/Oscar-Williams/dsh-deepcanary/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/Oscar-Williams/dsh-deepcanary/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-2ea44f.svg)](LICENSE)

![DeepCanary panel in DSH Web](assets/deepcanary-panel-en.png)

> Notify the user when DSH genuinely needs a decision.

`dsh-deepcanary` is a local attention-supervision plugin for [DeepSeek Harness (DSH)](https://github.com/deepseek-ai/deepseek-harness). It reads structured facts from Sessions, Tools, Agents, Subagents, and the Host, then applies a deterministic policy to keep routine events quiet or put actionable events in the Inbox.

## Current status

`0.1.1-rc.4` is a local engineering candidate. It has no GitHub tag, Release, or npm publication. It adds the alpha.13 Session v2 public-contract check, real tool-result correlation, Human Needed recovery, and parent-session subtask summaries. The Persistent Supervisor remains experimental and off by default.

The recommended trial combination is the published `0.1.1-rc.3` with DSH `dsh-v0.1.2-alpha.5`. The candidate's independent alpha.13 canary uses a clean local checkout of DSH `dsh-v0.1.3-alpha.1` at commit `d347e703908d0406b7a7ef80e3a0e594d86b2215`. No alpha.13 npm dependency is assumed: normal builds retain the alpha.5 package/type floor, while `build:alpha13` overlays declarations from the actual checkout and runs the public contract check.

## What it does

- Observes Human Needed approval/question boundaries, host reachability, suspected stalls, repeated tool failures, context pressure, subagent pressure, and normal completion.
- Uses C0–C3 levels, deduplication, Decision Bundles, quiet hours, and a rolling C2 budget to reduce alert noise.
- Provides a hidden-by-default, closable, reopenable, resizable, bilingual DSH Web Inbox with acknowledgement, snooze, mute, feedback, and navigation hints.
- Routes subtask completion summaries to the parent session and retains readable metadata after a session is disposed.

The plugin never runs shell commands, writes user files, terminates or restarts tasks, or approves/rejects requests. C3 requires Host or Runtime authority. A constructed browser notification without observed visibility is `unknown`; no cross-crash or cross-OS exactly-once guarantee is made.

## Three-step local trial

Requirements: Node.js `22.19+`, `npx pnpm@11.7.0`, and a separate DSH profile. Replace `<pluginDir>`, `<dshDir>`, and `<testHome>` with real paths.

```powershell
# 1. Build one candidate package
Set-Location <pluginDir>
npm ci
npm run build
$packDir = Join-Path $env:TEMP 'dsh-deepcanary-rc4-pack'
New-Item -ItemType Directory -Force $packDir | Out-Null
npm pack --pack-destination $packDir
$tarball = Join-Path $packDir 'dsh-deepcanary-0.1.1-rc.4.tgz'

# 2. Install that exact tgz into an isolated profile
Set-Location <dshDir>
$env:DSH_HOME = '<testHome>'
npx --yes pnpm@11.7.0 dsh plugin --profile web add $tarball
npx --yes pnpm@11.7.0 dsh --profile web --dump-config

# 3. Start and open the fresh URL printed by this process
npx --yes pnpm@11.7.0 dsh web --no-open
```

The published daily-trial channel is `dsh-deepcanary@next`, which currently points to RC3. Use the local tgz for RC4 until a separate publication decision is made; do not invent a remote tag.

## Important limits

- Alpha.5 is the daily build and published RC3 compatibility baseline; alpha.13 is tested only in its isolated checkout/profile. Do not mix the two runtime/profile lanes.
- Windows OS-visible notifications, a real screen reader, physical touch, complete cross-process Supervisor continuity, and natural-use samples are separate acceptance items. Missing evidence remains pending/unknown.
- `supervisorMode: experimental` is an engineering diagnostic path, not Stable. Without model credentials, the Inbox, health routes, offline tests, and public session contract can still be verified.
- State stores contain metadata, hashed references, bounded evidence summaries, feedback, outcome enums, and bounded delivery state. Prompts, model output, tool arguments, credentials, raw tool results, and full session content remain in DSH.

## Documentation and development checks

- [Development, alpha.13 canary, and one-time verification commands](docs/development.md)
- [Compatibility matrix and known limits](docs/compatibility.md)
- [Architecture and lifecycle boundaries](docs/architecture.md)
- [Security and privacy](docs/security.md)
- [Release checklist](docs/release-checklist.md)
- [Changelog](CHANGELOG.md)

The full interface includes `/dsh-deepcanary/state`, `/health`, `/settings`, `/action`, `/outcome`, `/outcomes`, `/explain`, `/dry-run`, experimental `/supervisor`, and nine `deepcanary_*` model-visible tools. See the development documentation for the complete route and validation details.

## Feedback

Include the exact DSH tag/commit, plugin version or source identity, Node.js version, OS, reproduction steps, and redacted logs. Do not include API keys, prompts, session text, workspace paths, or raw tool results.

## License

MIT
