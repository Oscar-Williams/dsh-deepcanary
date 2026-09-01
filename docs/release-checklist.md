# RC release checklist

This checklist records the historical `dsh-deepcanary` `v0.1.0-rc.2` release and the current candidate procedure. The RC.2 receipt is pinned to the exact official `dsh-v0.1.2-alpha.2` tag; the current candidate lane uses immutable DSH `dsh-v0.1.2-alpha.3` at commit `dd6322d604e00eec1ba5e0c8541159906a21094a`. An older npm runtime must not silently become either test baseline. The public `v0.1.0-rc.1` remains a historical artifact.

## Current candidate lane: official DSH alpha.3

Run the following from a clean or verified checkout before evaluating a new plugin tag:

```powershell
git fetch --tags https://github.com/deepseek-ai/deepseek-harness.git
git switch --detach dsh-v0.1.2-alpha.3
npx --yes pnpm@11.7.0 install --frozen-lockfile
npx --yes pnpm@11.7.0 run build
npx --yes pnpm@11.7.0 dsh --version
npx --yes pnpm@11.7.0 dsh --profile web --dump-config
```

The version must be `0.1.2-alpha.3` and the checkout must resolve to `dd6322d604e00eec1ba5e0c8541159906a21094a`. Install the current plugin build into isolated `web` and `headless` profiles, then record the plugin package version, health route, nine model-visible tools, settings namespace, client-module boot graph, unload/reload result, and model smoke result. Keep the alpha.3 result in a separate receipt; do not append it to the historical RC.2 receipt.

The current candidate also runs `npm run quality:report` and `npm run benchmark:attention`. These commands provide the frozen replay and local resource baseline; real-user outcome fields remain pending until a sanitized dogfood run supplies them. The completed alpha.3 local compatibility result is recorded separately in [`benchmark/alpha3-compatibility-receipt.json`](../benchmark/alpha3-compatibility-receipt.json); it is excluded from the npm package and does not replace the historical RC.2 receipt.

The repository CI workflow also starts the pinned alpha.3 Web profile in an isolated home and exercises the panel through Playwright CLI. Run [33454434211](https://github.com/Oscar-Williams/dsh-deepcanary/actions/runs/33454434211) passed on public commit `a369dc4`. This automated check covers first-run dismissal, mount semantics, close and Escape behavior, focus return, narrow-viewport bounds, forced-colors rendering, and the live status region; it does not replace physical touch or real Screen Reader evaluation.

## 1. Source and documentation

- [ ] Confirm `package.json`, `package-lock.json`, `CHANGELOG.md`, README files, compatibility matrix, surface audit, and release receipt use the same plugin version and DSH tag.
- [ ] Confirm `设计思路(不提交)/` is ignored and no design guide is tracked or present in the package artifact.
- [ ] Confirm the public README uses the immutable GitHub tag only after the new tag exists, and labels the historical tag separately until then.
- [ ] Review the diff for secrets, local paths, credentials, raw prompts, and unrelated changes.

## 2. Plugin gates

Run from the repository root:

```powershell
npm ci
npm run typecheck
npm run typecheck:tests
npm test
npm run build
npm run verify:distribution
npm pack --dry-run
```

The AttentionGold gate must pass offline. It must cover normal completion, approval, question, repeated failure, host unreachable, host stall, no-progress, Subagent pressure, compaction, context pressure, healthy long-running work, background completion, user viewing DSH, suspicious completion, recovered stall, duplicate events, and a shared-root Decision Bundle. The privacy gate must confirm that raw Session/Workspace identifiers and conversation content are absent from persisted metadata.

## 3. Exact DSH alpha.2 gates

Use a clean checkout or verify the existing checkout before installing the plugin:

```powershell
git clone --depth 1 --branch dsh-v0.1.2-alpha.2 https://github.com/deepseek-ai/deepseek-harness.git dsh-runtime-alpha2
Set-Location .\dsh-runtime-alpha2
npx --yes pnpm@11.7.0 install
npx --yes pnpm@11.7.0 run build
npx --yes pnpm@11.7.0 dsh --version
npx --yes pnpm@11.7.0 dsh --profile web --dump-config
```

The version must be `0.1.2-alpha.2`, and the checkout must resolve to commit `0a53fb55bea101816fa226bb964ae2bed71c343b`.

For the live-model smoke gate, use the same DSH home in which the API credential was configured and run one headless task from the dedicated acceptance workspace. The task must request an exact fixed response while explicitly prohibiting file inspection and file mutation. Record only the pass/fail result and the fixed response marker; never copy credentials, raw prompts, transcripts, or workspace contents into the release receipt.

## 4. Public distribution and Web E2E

The client-module revision was reviewed, the design guide was completed locally, and the immutable public RC tag `v0.1.0-rc.2` was published. Do not use the historical `v0.1.0-rc.1` tag for the current Web UI gates:

```powershell
npx --yes pnpm@11.7.0 dsh plugin --profile web remove dsh-deepcanary
npx --yes pnpm@11.7.0 dsh plugin --profile web add https://codeload.github.com/Oscar-Williams/dsh-deepcanary/tar.gz/refs/tags/v0.1.0-rc.2
npx --yes pnpm@11.7.0 dsh --profile web --dump-config
npx --yes pnpm@11.7.0 dsh web --no-open
```

The completed `benchmark/release-receipt.json` uses `status: "PASS"`; `publicTagInstall` is true only because both isolated profiles were reinstalled from `v0.1.0-rc.2` and the public-tag Web/model checks were repeated.

Verify from the running local Web host:

- the bundle patch is active;
- all nine `deepcanary_*` tools are registered once;
- `/dsh-deepcanary/health`, `/state`, `/settings`, and `/action` return the documented status codes;
- the installed package exposes `exports["./client"]`, declares `dsh.client`, and the DSH boot graph includes the plugin client module;
- the Web UI starts with no DeepCanary panel covering the page, opens from `sidebar.footer.action`, closes through its button/`Esc`/outside click, reopens from the entry, and leaves the page underneath usable;
- width and height change through both pointer handles and keyboard controls, with the constrained size reflected in `aria-valuenow`;
- switching DSH between Chinese and English updates the DeepCanary panel without a page reload;
- a C2 Inbox item can be acknowledged, snoozed, muted, and rated;
- a permission-granted notification click focuses DSH, opens its target alert, and brings that item into the visible panel range;
- settings update and validation behave as documented;
- a clean unload/restart leaves no duplicate routes, tools, timers, slot registrations, or client module factories;
- browser permission denial still leaves the Web Inbox and model tools available.
- a live-model smoke task returns the expected fixed marker without workspace file access;
- the standard `settings.plugin.item` card is visible under DSH Settings > Plugins and the overlay contains only the settings location hint.

## 5. Windows and WSL gates

Run the same public-tag install path on Windows x64 and WSL2 Ubuntu. Freeze evidence for:

- Windows DSH with browser fallback;
- WSL DSH with a Windows browser client;
- `/mnt/c` and CJK workspace paths;
- interop available, unavailable, and unknown;
- HTTP probe failure and recovery;
- notification permission denied;
- Node.js 22 and Node.js 24 compatibility;
- plugin unload and restart.

## 6. Artifact and publication

- [x] Run `npm pack --dry-run` and record the SHA-256 digest.
- [x] Confirm the package contains `lib/`, user-facing docs, AttentionGold fixtures, license, and bundle patch, and excludes the repository-only release receipt, `src/`, tests, local design notes, `.dsh` state, and credentials.
- [x] Confirm `benchmark/release-receipt.json` remains tracked in the repository as release evidence and is not included in the npm runtime package; this keeps the artifact digest independently verifiable.
- [x] Update `benchmark/release-receipt.json` only with gates that actually passed on the exact runtime and artifact.
- [x] Commit and push `main` after the design guide was complete and synchronization was authorized.
- [x] Create and push the immutable `v0.1.0-rc.2` tag for this revision.
- [x] Install from the public tag in fresh isolated `web` and `headless` profiles and repeat the Web/model checks.
- [ ] Create a separate GitHub Release entry with release notes and the artifact digest.
- [x] Verify the GitHub repository retains the `dsh` topic and that the README installation URL resolves to the published tag.
