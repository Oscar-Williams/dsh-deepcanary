# Development and verification

This page contains the longer commands omitted from the README. Keep the alpha.5 build/release lane and the alpha.13 compatibility lane in separate DSH checkouts, homes, profiles, and evidence records.

## Build lanes

The normal lane uses the published alpha.5 packages in `package.json` and produces the package consumed by the RC4 candidate. The alpha.13 lane overlays the public declarations from a clean local checkout; it does not claim that an alpha.13 npm package exists.

```powershell
Set-Location <pluginDir>
npm ci
npm run typecheck
npm run typecheck:tests
npm test
npm run build
npm run verify:distribution
npm run pack:check

# Against the exact local DSH alpha.13 checkout:
$env:DSH_ALPHA13_RUNTIME = '<path-to-dsh-v0.1.3-alpha.1-checkout>'
npm run typecheck:alpha13
npm run build:alpha13
$env:DSH_ALPHA13_RUNTIME = $null
```

`build.mjs` hashes the source tree, compiler configuration, lockfile, build scripts, dependency graph and selected runtime identity. A matching `output/build/stamp.json` plus matching `lib/` digest makes a repeated build a no-op; `--force` is available when deliberately regenerating output. `pack:check` uses `--ignore-scripts` so a dry-run does not start a second build.

## Alpha.13 public contract

Use a clean checkout at DSH `dsh-v0.1.3-alpha.1`, commit `d347e703908d0406b7a7ef80e3a0e594d86b2215`, and an isolated profile. After `build:alpha13`, run:

```powershell
$env:DSH_ALPHA13_RUNTIME = '<path-to-dsh-v0.1.3-alpha.1-checkout>'
node scripts/adapter-runtime-contract.mjs
```

The contract test uses only public `Context`, `SessionStore`, `ctx.sessions.list()`, `Session.snapshotEvents()`, `prepare/enter/announce`, and append events. It covers a non-empty startup session, Session v2 tool identity, unrelated and matching results, attempt-versus-completion, dispose, seed reopen, abort, and child completion. It does not use `SessionHandle`, `agentLoop.create()`, model output, tool arguments, or transcript content.

## Isolated Web canary

Build one candidate tgz, install that exact file into the alpha.13 profile, and restart `dsh web` only after confirming that no active task is running. Every restart prints a new one-time URL; use that URL in the authenticated browser.

```powershell
$env:DSH_ALPHA13_RUNTIME = '<alpha13 checkout>'
$env:DSH_ALPHA13_PROFILE = '<isolated alpha13 profile home>'
$env:DSH_ALPHA13_PACKAGE = '<exact candidate tgz>'
$env:DSH_ALPHA13_WEB_PORT = '<port>'
$env:DSH_ALPHA13_UI_EVIDENCE = 'output/playwright/alpha13-lifecycle-<date>/ui-observation.json'
$env:DSH_ALPHA13_OUTPUT = 'output/gates/alpha13-compatibility-<date>.json'
npm run compatibility:alpha13
```

The canary fails unless the installed `node_modules/dsh-deepcanary` file set and bytes match the supplied tgz, the public runtime contract passes, the Web process responds, and a separate UI evidence file is bound to the same candidate version/runtime. The old `DSH_ALPHA13_UI_OBSERVED=true` shortcut is intentionally unsupported.

The UI evidence file is a sanitized observation record, not a transcript. Its minimum shape is:

```json
{
  "schemaVersion": 1,
  "status": "observed",
  "surface": "Edge DSH Web UI",
  "pluginVersion": "0.1.1-rc.4",
  "dshTag": "dsh-v0.1.3-alpha.1",
  "checks": {
    "authenticated": true,
    "pluginPanelVisible": true,
    "currentInboxRendered": true
  },
  "screenshotPath": "output/playwright/alpha13-lifecycle-<date>/panel.png",
  "screenshotSha256": "<sha256>"
}
```

## Playwright CLI loop

Use the bundled Playwright CLI from `output/playwright/<label>/`. Keep a named session for the DSH tab, snapshot before using element references, and capture screenshots after meaningful state changes. The browser observation proves browser/UI state; it does not by itself prove Windows notification-center visibility.

```powershell
Set-Location '<pluginDir>\output\playwright\alpha13-lifecycle-<date>'
& 'C:\Program Files\Git\bin\bash.exe' 'C:/Users/Oscar/.codex/skills/playwright/scripts/playwright_cli.sh' --session=deepcanary-alpha13 open '<fresh authenticated DSH URL>' --headed
& 'C:\Program Files\Git\bin\bash.exe' 'C:/Users/Oscar/.codex/skills/playwright/scripts/playwright_cli.sh' --session=deepcanary-alpha13 snapshot
& 'C:\Program Files\Git\bin\bash.exe' 'C:/Users/Oscar/.codex/skills/playwright/scripts/playwright_cli.sh' --session=deepcanary-alpha13 screenshot --filename=panel.png
```

For the current lifecycle window, record only bounded facts: panel loaded, current version/runtime labels, Inbox state, ask/answer closure, child summary routing, pause/abort or reopen result, and any screenshot hash. Do not place credentials, prompts, model output, tool arguments, raw event payloads, or complete local paths into the observation file.

## Alpha.5 regression and gates

The alpha.5 adapter smoke remains the compatibility regression for the published lane:

```powershell
$env:DSH_ALPHA5_RUNTIME = '<path-to-dsh-v0.1.2-alpha.5-checkout>'
npm run adapter:smoke
```

Run the relevant focused tests after provider, adapter, lifecycle, delivery, or Supervisor changes. Before freezing a public candidate, run one integrated set:

```powershell
npm run typecheck
npm run typecheck:tests
npm test
npm run build
npm run verify:distribution
npm run pack:check
npm run gate:stable
```

`gate:stable` is a decision report, not a release command. Missing natural-use, OS-visible, independent audit, or full restart evidence remains pending and yields `CONTINUE_RC`; it must not be converted into Stable by a flag or by reusing a historical receipt. The virtual Supervisor soak is supplemental-only. The current candidate is not published by these commands.

## Release boundary

Before any future public RC, freeze one tgz and bind its SHA-256 to the source/runtime/profile evidence. Check the official GitHub repository and npm registry once, then request the exact publish scope if it has not been explicitly authorized. Never alter historical tags, release assets, receipts, or withdrawn version identities.
