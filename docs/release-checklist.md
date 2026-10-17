# Release checklist

## Prepare the release snapshot

Use the current published Host baseline documented in [compatibility](compatibility.md). Align package/lockfile versions, runtime identity, generated output, README installation commands, changelog and capability descriptions. Preserve historical frozen artifacts and receipts.

Review the explicit Git staging list, every pending push commit and the actual npm archive. Public files must exclude private design material, machine-specific scripts, original samples, browser logs, authenticated URLs, credentials and personal configuration. Report security findings as locations/categories, with secret values omitted.

## Local checks

```sh
npm ci
npm run verify:environment
npm run typecheck
npm run typecheck:tests
npm test
npm run typecheck:host
npm run adapter:host
npm run settings:host
npm run connection:host
npm run build
npm run verify:distribution
npm run pack:check
```

Supply `DSH_RUNTIME` for the selected released runtime installation or clean built source checkout. Run relevant policy replay and necessary device checks. Preserve C3/Human Needed boundaries, health/progress grace, recovery, completion summaries, budget, navigation, settings conflicts and source attribution. Missing native delivery evidence stays explicit.

## Commit and freeze

Commit an explicit public file list, including `lib`. Freeze one tgz from that clean tracked commit. Bind commit, Host identity, archive SHA-256, SHA-1, SHA-512, byte length and actual installed files. Install those same bytes into independent profiles and confirm the actual running server/client identity after startup.

A frozen package is immutable. A subsequent package fix uses a new candidate version. Local receipts remain outside the archive to keep the package hash independent of its evidence.

## CI and remote release

After explicit publication authorization:

1. Push the reviewed public commit. Require all existing CI checks on that exact commit, including generated-output consistency and pinned Host/browser contracts.
2. Create an immutable version tag and GitHub prerelease. Upload the verified frozen tgz and checksum summary.
3. Publish that same tgz to the official npm registry with `next`.
4. Query the remote version and integrity, download its tarball and compare bytes with the GitHub asset and local freeze.
5. Update `latest` to the intended RC, then query both `latest` and `next` again.
6. Write a publication receipt binding source commit, CI, tag/assets, npm integrity and final tag targets. Keep the RC designation and measured device scope visible.

0.1.5-rc.1 is a local development candidate. Publication and remote CI require fresh user authorization. Query ambiguous remote outcomes before retrying. Interactive authentication and 2FA belong to the user in their existing browser; credentials remain in their owning service.

## Post-release evidence

Remote receipts and documentation-only follow-ups can be separate commits. Immutable package bytes, source tags and release assets retain their original identities. Historical command lanes remain labeled by full plugin/Host versions.
