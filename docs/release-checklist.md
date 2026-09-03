# RC release checklist

This checklist records the current `0.1.1-rc.2` source engineering candidate and the published immutable `0.1.1-rc.1` prerelease against the official DSH `dsh-v0.1.2-alpha.5` tag. RC4 and historical RC2 procedures remain available for reproduction with their original identities.

The published GitHub tag, Release asset, npm `next` package, and alpha.5 source checkout provide the RC1 installation path. The RC2 local tarball and fresh Gate report provide the engineering path. The isolated Ubuntu-26.04 alpha.5 profile and device-level notification, touch, and screen-reader observations remain separately tracked below and in `benchmark/alpha5-compatibility-receipt.json`.

## 0.1.1-rc.2 engineering candidate: authoritative session reconciliation

The current `main` package version is `0.1.1-rc.2`. It targets the same official `dsh-v0.1.2-alpha.5` commit `db6bdc3576c2d4e7c965e8e3ed0c2a731eed87f5` and contains the first reconciliation slice: subscriber-first event buffering, authoritative `ctx.sessions.list()` seeding, `Session.snapshotEvents()` metadata derivation, reconciliation epochs, sequence-aware buffered-event merge, startup Human Needed reconstruction, previously observed-session disposal convergence, bounded orphan grace, public reconciliation status, and a bounded logical browser delivery ledger.

This candidate is a source-build identity. Build and verify it with:

```powershell
npm ci
npm run typecheck
npm run typecheck:tests
npm test -- --run
npm run build
npm run verify:distribution
npm run pack:check
npm run gate:stable
npm pack --pack-destination output/local-pack
```

Bind the resulting `dsh-deepcanary-0.1.1-rc.2.tgz` hash to the fresh Gate report and any local DSH profile used for validation. The candidate has no public tag, Release, or registry publication; the immutable RC1 receipt remains the historical publication record. The Persistent Supervisor is explicitly experimental and off by default; set `supervisorMode: experimental` for its engineering checks. Gate E keeps `prototype-ready` semantics until authoritative restart continuity, OS-level delivery states, cross-process orphan convergence, resource delta, and soak evidence reach their documented floor.

## 0.1.1-rc.1 release: official DSH alpha.5

The published release record is `0.1.1-rc.1`, tested against the official `dsh-v0.1.2-alpha.5` tag at commit `db6bdc3576c2d4e7c965e8e3ed0c2a731eed87f5`. The alpha.5 runtime remains the compatibility baseline for both the published RC1 artifact and the RC2 source candidate. RC4 and historical RC2 sections below preserve their original evidence and reproduction commands.

The Windows alpha.5 Web profile, isolated headless model smoke, package gates, and clean npm `next` installation passed. The Ubuntu-26.04 profile has a separate pending WSL gate because its alpha.5 Web health evidence has not been recorded; the alpha.4 WSL result remains historical evidence and is not promoted to alpha.5.

Run the following sequence from the plugin repository after confirming the alpha.5 DSH checkout:

```powershell
npm ci
npm run typecheck
npm run typecheck:tests
npm test
npm run build
npm run verify:distribution
npm run pack:check
npm run gate:stable
npm pack --pack-destination output/local-pack
```

The historical release artifact is `dsh-deepcanary-0.1.1-rc.1.tgz`. Its SHA-256 and publication identity remain recorded in [`benchmark/alpha5-compatibility-receipt.json`](../benchmark/alpha5-compatibility-receipt.json). Keep Windows OS-visible browser notification observations separate from browser construction evidence; each new candidate uses its own fresh report and digest.

For the public npm installation path, use the explicit `next` selector and verify the resolved version and dist-tags:

```powershell
$env:npm_config_registry = 'https://registry.npmjs.org/'
npx --yes pnpm@11.7.0 dsh plugin --profile web add dsh-deepcanary@next
npm view dsh-deepcanary@0.1.1-rc.1 version dist --json
npm view dsh-deepcanary dist-tags --json
```

The public synchronization order is: commit and push `main`, create and push the immutable `v0.1.1-rc.1` tag, create the prerelease Release with the exact tarball, verify the remote tag and Release asset, then publish the same tarball to npm with dist-tag `next`. After npm publication, verify the package version and dist-tag from the public registry and update the receipt and bilingual README publication status in a follow-up commit. The GitHub tag remains immutable throughout this process.

- [x] alpha.5 source checkout, CLI version, package lock, and plugin version agree;
- [x] local unit, type, build, distribution, package, and stable-gate checks pass;
- [x] fresh alpha.5 Web profile loads the exact local artifact and passes the WebUI smoke;
- [x] public CI run [33630531423](https://github.com/Oscar-Williams/dsh-deepcanary/actions/runs/33630531423) passes on Windows and Ubuntu with Node 22 and 24 plus the alpha.5 WebUI smoke;
- [ ] isolated Ubuntu-26.04 WSL alpha.5 profile completes the package install and Web health check;
- [x] `main`, tag `v0.1.1-rc.1`, and GitHub Release are synchronized;
- [x] npm `dsh-deepcanary@0.1.1-rc.1` is published with dist-tag `next` and verified from the public registry;
- [x] README, English README, changelog, compatibility matrix, and release receipt reflect the final publication state.

## RC4 release: official DSH alpha.4

Run the following from a clean or verified checkout before evaluating a new plugin tag:

```powershell
git fetch --tags https://github.com/deepseek-ai/deepseek-harness.git
git switch --detach dsh-v0.1.2-alpha.4
npx --yes pnpm@11.7.0 install --frozen-lockfile
npx --yes pnpm@11.7.0 run build
npx --yes pnpm@11.7.0 dsh --version
npx --yes pnpm@11.7.0 dsh --profile web --dump-config
```

The version must be `0.1.2-alpha.4` and the checkout must resolve to `4e84901e6471b79ec0338099867ebb4606d12bb5`. Install the locally generated RC4 tarball into isolated `web` and `headless` profiles, then record the plugin package version, health and OutcomeReceipt routes, nine model-visible tools, settings namespace, client-module boot graph, unload/reload result, and model smoke result. Repeat with the immutable GitHub tag in fresh public-source profiles; the npm package remains pending. Keep the alpha.4 result in the active RC4 receipt and preserve alpha.3 evidence in its historical receipt.

RC4 also runs `npm run quality:report` and `npm run benchmark:attention`. These commands provide the frozen replay and local resource baseline. A sanitized trial records OutcomeReceipts through `/dsh-deepcanary/outcome` and produces a source-filtered report with `npm run outcomes:report`; the public schemas are [`benchmark/outcome-receipt.schema.json`](../benchmark/outcome-receipt.schema.json) and [`benchmark/outcome-report.schema.json`](../benchmark/outcome-report.schema.json). The RC4 public receipt is [`benchmark/release-candidate-receipt.json`](../benchmark/release-candidate-receipt.json); the earlier alpha.3 compatibility record remains separate and does not replace the historical RC2 receipt.

## 2A. Stable Gate D: real usefulness and delivery evidence

Gate D is the product-quality gate. Run the checked-in policy replay first:

```powershell
npm run replay:policy
```

The report must pass every expected case for judgment, deduplication, Bundle escalation, budget downgrade, quiet hours, and recovery. Then collect a sanitized dogfood bundle with [`benchmark/dogfood.schema.json`](../benchmark/dogfood.schema.json) across the task families and scenarios in [`docs/dogfood-protocol.md`](dogfood-protocol.md), including positive decisions and negative opportunities. Generate its report with `npm run dogfood:report -- --input <path-to-sanitized-dogfood.json>`. Review labels, numerators, denominators, and sample-status values are part of the gate evidence.

Gate D requires a validated multi-run real dogfood aggregate covering coding, build/test, research, multi-stage, and Subagent work plus concrete opportunity evidence for every declared scenario. It also requires reviewed Human Needed opportunities, separate policy and usefulness labels for delivered C2/C3 decisions, false-stall and wrong-level review, duplicate-final-interrupt review, recovery-before-open observations, negative opportunities for C0/dedupe/suppression, and a real Edge/Windows notification observation. Browser permission and client callback evidence can be automated; actual Windows OS-visible browser notification appearance, Notification Center retention, and click-to-focus behavior require a schema-validated record bound to the matching dogfood observation and delivery unit. A small single-task sample or the legacy `--native-toast-observed` flag remains diagnostic evidence and does not pass Gate D.

## 2B. Stable Gate E: release integrity and operational continuity

Gate E combines a reproducible package with the explicitly enabled Persistent Supervisor prototype. In addition to the standard checks above, run:

```powershell
npm run replay:policy
npm run supervisor:smoke
npm run verify:distribution
npm run verify:release-receipt
npm pack --dry-run
```

Select `supervisorMode: experimental` in the exact alpha.5 test profile, then inspect `GET /dsh-deepcanary/supervisor` and confirm that `supervisor.json` is bounded, `supervisor.lease` is released after shutdown, a competing process enters `standby` and retries after the active lease is released, a stale lease is archived before takeover, and a previous owner cannot overwrite the active owner's snapshot. The lease mutations and owned snapshot commits use the same local operation lock, so fencing is checked within one serialized filesystem operation. Record startup, restore, write, heartbeat, wake, state-directory-size, RSS counters, policy-state version, restored dedupe/budget entries, and logical browser delivery entries. RC2 now exposes the first authoritative session reconciliation slice and orphan grace, while post-restart convergence, Windows OS observation, and the remaining Stable semantics stay as separate evidence gates.

The repository CI workflow starts the pinned alpha.4 Web profile in an isolated home and exercises the panel through Playwright CLI. Run [33557376591](https://github.com/Oscar-Williams/dsh-deepcanary/actions/runs/33557376591) passed on the final RC4 main commit across Windows and Ubuntu with Node 22 and 24, including the alpha.4 WebUI smoke. Automated checks cover the computer interaction surface; physical touch and real Screen Reader evaluation remain separate device checks.

## 1. Source and documentation

- [x] Confirm `package.json`, `package-lock.json`, `CHANGELOG.md`, README files, compatibility matrix, surface audit, and release receipt use the same plugin version and DSH tag.
- [x] Confirm `设计思路(不提交)/` is ignored and no design guide is tracked or present in the package artifact.
- [x] Confirm the public README uses the immutable GitHub tag and labels the historical tag separately.
- [x] Review the diff for secrets, local paths, credentials, raw prompts, and unrelated changes.

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

The AttentionGold gate must pass offline. It must cover normal completion, approval, question, repeated failure, host unreachable, host stall, no-progress, Subagent pressure, compaction, context pressure, healthy long-running work, background completion, user viewing DSH, suspicious completion, recovered stall, duplicate events, and a shared-root Decision Bundle. The privacy gate must confirm that Session/Workspace references and conversation content remain absent from persisted metadata. A bounded opaque local DSH session handle may be present solely for native `sessions.open` navigation.

## 3. Historical DSH alpha.2 gates

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

## 4. Public GitHub distribution and Web E2E

The client-module revision is verified locally and the RC4 GitHub tag/Release is available. npm publication remains paused; keep the public npm checklist pending until a separate publication decision is made.

```powershell
npx --yes pnpm@11.7.0 dsh plugin --profile web remove dsh-deepcanary
npx --yes pnpm@11.7.0 dsh plugin --profile web add https://codeload.github.com/Oscar-Williams/dsh-deepcanary/tar.gz/refs/tags/v0.1.0-rc.4
npx --yes pnpm@11.7.0 dsh --profile web --dump-config
npx --yes pnpm@11.7.0 dsh web --no-open
```

The active `benchmark/release-candidate-receipt.json` uses `status: "PASS"` for the GitHub prerelease because the exact public tag, Release asset, alpha4 profiles, CI, and claimed local gates have been verified. npm publication remains separately marked `PAUSED`. The model smoke evidence is labeled by its exact runtime profile. The historical `benchmark/release-receipt.json` continues to document RC2.

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
- a redacted OutcomeReceipt can be recorded and read back through `/dsh-deepcanary/outcome` and `/dsh-deepcanary/outcomes` without storing session content;
- an explicit trial or time cutoff can withdraw OutcomeReceipts through `DELETE /dsh-deepcanary/outcomes`;

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
- [x] Create and push the immutable `v0.1.0-rc.4` tag for this revision.
- [x] Install from the public tag in fresh isolated `web` and `headless` profiles and repeat the Web installation checks; keep the authorized-profile model smoke evidence separate.
- [ ] Publish `dsh-deepcanary@0.1.0-rc.4` to the official npm registry under the `next` channel and verify its dist-tags and integrity metadata when npm publication is authorized.
- [x] Create a separate GitHub Release entry with release notes and the artifact digest.
- [x] Verify the GitHub repository retains the `dsh` topic and that the README installation URL resolves to the published tag.
