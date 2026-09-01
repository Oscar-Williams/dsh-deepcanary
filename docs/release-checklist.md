# RC release checklist

This checklist prepares the `dsh-deepcanary` `v0.1.0-rc.4` prerelease and preserves the historical RC2 procedure for reproduction. RC4 is pinned to the exact official `dsh-v0.1.2-alpha.4` tag at commit `4e84901e6471b79ec0338099867ebb4606d12bb5`; RC2 remains tied to `dsh-v0.1.2-alpha.2`. An older DSH npm runtime belongs to historical diagnosis. The public `v0.1.0-rc.1` remains a historical artifact.

RC4 npm publication is currently paused. The local tarball and the exact alpha.4 source checkout provide the active acceptance path; mark public install, tag, Release, and npm dist-tag items only after each external check passes.

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

The version must be `0.1.2-alpha.4` and the checkout must resolve to `4e84901e6471b79ec0338099867ebb4606d12bb5`. Install the locally generated RC4 tarball into isolated `web` and `headless` profiles, then record the plugin package version, health and OutcomeReceipt routes, nine model-visible tools, settings namespace, client-module boot graph, unload/reload result, and model smoke result. Repeat with the immutable GitHub tag or npm package after its public operation succeeds. Keep the alpha.4 result in the active RC4 receipt and preserve alpha.3 evidence in its historical receipt.

RC4 also runs `npm run quality:report` and `npm run benchmark:attention`. These commands provide the frozen replay and local resource baseline. A sanitized trial records OutcomeReceipts through `/dsh-deepcanary/outcome` and produces a source-filtered report with `npm run outcomes:report`; the public schemas are [`benchmark/outcome-receipt.schema.json`](../benchmark/outcome-receipt.schema.json) and [`benchmark/outcome-report.schema.json`](../benchmark/outcome-report.schema.json). The RC4 public receipt is [`benchmark/release-candidate-receipt.json`](../benchmark/release-candidate-receipt.json); the earlier alpha.3 compatibility record remains separate and does not replace the historical RC2 receipt.

The repository CI workflow starts the pinned alpha.4 Web profile in an isolated home and exercises the panel through Playwright CLI. Run [33481882712](https://github.com/Oscar-Williams/dsh-deepcanary/actions/runs/33481882712) passed on the preceding public RC3 revision and supplies the inherited compatibility baseline; a new RC4 run will be recorded after the candidate commit is pushed. Automated checks cover the computer interaction surface; physical touch and real Screen Reader evaluation remain separate device checks.

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

## 4. Public distribution and Web E2E

The client-module revision is verified locally and the RC4 candidate is ready for repository synchronization. npm publication remains paused; create a public tag or GitHub Release only after the repository commit and artifact evidence are complete.

```powershell
npx --yes pnpm@11.7.0 dsh plugin --profile web remove dsh-deepcanary
# 验收时固定使用官方 npm registry，避免镜像同步延迟
$env:npm_config_registry = 'https://registry.npmjs.org/'
npx --yes pnpm@11.7.0 dsh plugin --profile web add dsh-deepcanary@0.1.0-rc.4
npx --yes pnpm@11.7.0 dsh --profile web --dump-config
npx --yes pnpm@11.7.0 dsh web --no-open
```

The active `benchmark/release-candidate-receipt.json` uses `status: "CANDIDATE"` while the public tag, public npm package, and corresponding installation evidence are pending. Set `status: "PASS"` only after the exact public artifact and all claimed gates have been verified. The model smoke evidence is labeled by its exact runtime profile. The historical `benchmark/release-receipt.json` continues to document RC2.

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
- [ ] Commit and push `main` after the design guide was complete and synchronization was authorized.
- [ ] Create and push the immutable `v0.1.0-rc.4` tag for this revision.
- [ ] Install from the public tag in fresh isolated `web` and `headless` profiles and repeat the Web installation checks; keep the authorized-profile model smoke evidence separate.
- [ ] Publish `dsh-deepcanary@0.1.0-rc.4` to the official npm registry under the `next` channel and verify its dist-tags and integrity metadata when npm publication is authorized.
- [ ] Create a separate GitHub Release entry with release notes and the artifact digest.
- [ ] Verify the GitHub repository retains the `dsh` topic and that the README installation URL resolves to the published tag.
