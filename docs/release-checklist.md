# RC release checklist

This checklist is for `dsh-deepcanary` `0.1.0-rc.1`. The upstream runtime must be the exact official `dsh-v0.1.2-alpha.1` tag; an older npm runtime must not silently become the test baseline.

## 1. Source and documentation

- [ ] Confirm `package.json`, `package-lock.json`, `CHANGELOG.md`, README files, compatibility matrix, surface audit, and release receipt use the same plugin version and DSH tag.
- [ ] Confirm `设计思路(不提交)/` is ignored and no design guide is tracked or present in the package artifact.
- [ ] Confirm the public README uses the immutable GitHub tag only after that tag exists.
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

## 3. Exact DSH alpha.1 gates

Use a clean checkout or verify the existing checkout before installing the plugin:

```powershell
git clone --depth 1 --branch dsh-v0.1.2-alpha.1 https://github.com/deepseek-ai/deepseek-harness.git dsh-runtime-alpha1
Set-Location .\dsh-runtime-alpha1
npx --yes pnpm@11.7.0 install
npx --yes pnpm@11.7.0 run build
npx --yes pnpm@11.7.0 dsh --version
npx --yes pnpm@11.7.0 dsh --profile web --dump-config
```

The version must be `0.1.2-alpha.1`, and the checkout must resolve to commit `cd5ef8148158c3a752a658978873241fdf8e2bbc`.

## 4. Public distribution and Web E2E

After the plugin build has been committed and pushed:

```powershell
npx --yes pnpm@11.7.0 dsh plugin --profile web add https://codeload.github.com/Oscar-Williams/dsh-deepcanary/tar.gz/refs/tags/v0.1.0-rc.1
npx --yes pnpm@11.7.0 dsh --profile web --dump-config
npx --yes pnpm@11.7.0 dsh web --no-open
```

Verify from the running local Web host:

- the bundle patch is active;
- all eight `deepcanary_*` tools are registered once;
- `/dsh-deepcanary/health`, `/state`, `/settings`, and `/client.js` return 200;
- the body index injection contains exactly one client script;
- a C2 Inbox item can be acknowledged, snoozed, muted, and rated;
- settings update and validation behave as documented;
- a clean unload/restart leaves no duplicate routes, tools, timers, or client injection;
- browser permission denial still leaves the Web Inbox and model tools available.

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
- [ ] Confirm the package contains `lib/`, docs, benchmark fixtures, release receipt, license, and bundle patch, and excludes `src/`, tests, local design notes, `.dsh` state, and credentials.
- [ ] Update `benchmark/release-receipt.json` only with gates that actually passed on the exact runtime and artifact.
- [ ] Commit and push `main`.
- [ ] Create and push the immutable tag `v0.1.0-rc.1`.
- [ ] Install from the public tag in a fresh isolated DSH Web profile and repeat the Web checks.
- [ ] Create the GitHub release with the release notes and artifact digest.
- [ ] Verify the GitHub repository retains the `dsh` topic and that the README installation URL resolves to the published tag.
