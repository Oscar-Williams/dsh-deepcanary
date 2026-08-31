# RC release checklist

This checklist is for the `dsh-deepcanary` `v0.1.0-rc.2` candidate. The upstream runtime must be the exact official `dsh-v0.1.2-alpha.2` tag; an older npm runtime must not silently become the test baseline. The public `v0.1.0-rc.1` remains a historical artifact until this client-module and settings-card revision is released under a new tag.

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

After the client-module revision has been reviewed, the design guide has been completed, and a new immutable public RC tag has been published. Do not use the historical `v0.1.0-rc.1` tag for the current Web UI gates. Before publication, use the local tarball installation path in `README.md` and record the result as a local candidate check:

```powershell
npx --yes pnpm@11.7.0 dsh plugin --profile web remove dsh-deepcanary
npx --yes pnpm@11.7.0 dsh plugin --profile web add https://codeload.github.com/Oscar-Williams/dsh-deepcanary/tar.gz/refs/tags/<new-rc-tag>
npx --yes pnpm@11.7.0 dsh --profile web --dump-config
npx --yes pnpm@11.7.0 dsh web --no-open
```

Before the new tag exists, `benchmark/release-receipt.json` must use `status: "CANDIDATE"` and keep only `publicTagInstall` as a false pending gate. The receipt verifier accepts that explicit pre-publication state but rejects any other missing gate. After the immutable tag has been published, repeat the installation from that tag, change the gate to `true`, and promote the receipt to `PASS` only when the public-tag run succeeds.

Verify from the running local Web host:

- the bundle patch is active;
- all eight `deepcanary_*` tools are registered once;
- `/dsh-deepcanary/health`, `/state`, `/settings`, and `/action` return the documented status codes;
- the installed package exposes `exports["./client"]`, declares `dsh.client`, and the DSH boot graph includes the plugin client module;
- the Web UI starts with no DeepCanary panel covering the page, opens from `sidebar.footer.action`, closes through its button/`Esc`/outside click, reopens from the entry, and leaves the page underneath usable;
- width and height change through both pointer handles and keyboard controls, with the constrained size reflected in `aria-valuenow`;
- switching DSH between Chinese and English updates the DeepCanary panel without a page reload;
- a C2 Inbox item can be acknowledged, snoozed, muted, and rated;
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

- [ ] Run `npm pack` once and record the SHA-256 digest.
- [ ] Confirm the package contains `lib/`, user-facing docs, AttentionGold fixtures, license, and bundle patch, and excludes the repository-only release receipt, `src/`, tests, local design notes, `.dsh` state, and credentials.
- [ ] Confirm `benchmark/release-receipt.json` remains tracked in the repository as release evidence and is not included in the npm runtime package; this keeps the artifact digest independently verifiable.
- [ ] Update `benchmark/release-receipt.json` only with gates that actually passed on the exact runtime and artifact.
- [ ] Commit and push `main` after the design guide is complete and the user authorizes synchronization.
- [ ] Create and push the new immutable RC tag selected for this revision.
- [ ] Install from the public tag in a fresh isolated DSH Web profile and repeat the Web checks.
- [ ] Create the GitHub release with the release notes and artifact digest.
- [ ] Verify the GitHub repository retains the `dsh` topic and that the README installation URL resolves to the published tag.
