# Development and verification

## Current lane

DeepCanary 0.1.6-rc.2 uses released DSH 0.2.1-rc.2 on WebUI and official Windows Desktop. Direct development packages are pinned, with the npm lockfile owning the toolchain. Use Node 22.19+ in the 22.x line or Node 24+. DSH checkouts use their own pinned pnpm workflow.

```sh
npm ci
npm run verify:environment
npm run typecheck
npm run typecheck:tests
npm test
npm run build
npm run verify:distribution
npm run pack:check
```

The repository tracks `lib/` so DSH can consume a Git tag directly. Every source change needs a matching build; CI compares generated output with committed bytes.

Set `DSH_RUNTIME` to the selected published runtime installation (a directory with `node_modules/@deepseek-ai/dsh`) or the existing built Desktop source checkout, then run:

```sh
npm run typecheck:host
npm run adapter:host
npm run background:host
npm run reminders:host
npm run settings:host
npm run connection:host
```

The Session contract exercises question timeout, accepted replies, parallel long tools and public failure metadata. The background contract uses released Session, Agent and Local Job registries with a controlled owner carrier to exercise healthy silence, waiter semantics, exact ownership and missed-outcome recovery. Settings checks use public revision-aware forms. Connection checks use the actual Host transport with ephemeral test authentication: 401/403 admission, authorized version, legacy-route removal, malformed and chunked request limits, path privacy and scoped registration disposal.

## Device work

The reminder contract uses released Session and question projections with a controlled deadline clock. It checks scheduled ownership, C3 revalidation, stale-generation rejection, renderer arbitration, default-mode restart continuity and answer closure. These controlled cases supply regression evidence for the new capability.

Use independent homes/profile state and candidate ports. Preserve an existing service and active work. WebUI development can attach Playwright to the user's existing Edge; Desktop targeted common-code checks use the official application. Current package bytes, actual loaded module and source identity must agree after a restart. Separate installation-file comparison from runtime observation.

Follow [feedback calibration](feedback-calibration.md) for necessary sequential development tasks. Record natural, controlled, replay and unknown cohorts according to their facts. Repeated controlled runs add regression coverage within their own scope. Keep private raw artifacts local.

## Freeze and publish

Commit the reviewed source and generated output first. With a clean tracked snapshot, freeze once:

```sh
node scripts/freeze-local-candidate.mjs 0.1.6-rc.2
node scripts/verify-installed-candidate.mjs output/releases/0.1.6-rc.2/local-candidate.json <isolated-home> web <local-receipt.json>
```

The freezer binds the committed source and refuses an existing artifact. Installation verification checks the manifest, archive identity and every installed file. Repeat for the separate Desktop profile and observe actual loading.

Scan the staged snapshot, every pending push commit and the actual archive. The scanner reports locations and categories without matched values:

```sh
node scripts/scan-publication.mjs staged
node scripts/scan-publication.mjs commits origin/main..HEAD
node scripts/scan-publication.mjs package <frozen-package.tgz>
```

[Release checklist](release-checklist.md) governs CI, immutable prerelease assets, npm byte verification and dist-tags. Publishing requires explicit authorization. Historical alpha.5/alpha.13 scripts reproduce their named artifacts and retain those historical identities.

`gate:stable` reports evidence sufficiency and does not publish or automatically adopt policy. Windows-only development, native notification coverage and experimental Supervisor remain separately bounded.
