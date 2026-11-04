# Preparing a release

A candidate has one source commit and one frozen package. Record its version, checksum, validation, and installation results before publication.

## Finish local preparation

1. Complete the intended behavior and fix defects that affect it. Preserve valid historical state during migration.
2. Run `verify:candidate` for the final inputs. Run additional checks only for changed behavior, a failed result, or an uncovered risk.
3. Update the English and Chinese READMEs, compatibility, changelog, and screenshots. Keep installation commands consistent with the actual host CLI.
4. Review the intended Git changes and commit source, documentation, and generated `lib/`.
5. Run `node scripts/freeze-local-candidate.mjs <version>` once. Keep the resulting `.tgz` and `local-candidate.json`.
6. Install that file in the target profiles and confirm the loaded version after restart. Record behavior covered by earlier candidates with those candidates' identities.
7. Back up daily configuration and state before upgrading daily profiles. Confirm sessions and workspace registrations remain available.

The current host matrix is alpha.3 and RC5, each on WebUI and Windows Desktop. Use the official RC5 Desktop and the fixed source alpha.3 build. Record the latter as unsigned.

A documentation or version change requires a new RC and package checks. It does not require replaying unchanged UI interactions or generating another load sample.

## Choose the publication channel

Publish a prerelease with an explicit npm tag such as `next`. Review the current registry tags before changing them. Moving `latest` requires an explicit release decision.

Keep a short release note that explains visible changes, supported hosts, installation, and any coverage limits. Attach the frozen package and its SHA-256 file to the GitHub prerelease.

## Publish after authorization

Use the reviewed commit and the existing package. The following is the order for an authorized release.

1. Confirm the intended remote branch and commit, then push it.
2. Wait for the required remote CI jobs. Fix failures before proceeding.
3. Create the version tag at the reviewed commit and a GitHub prerelease with the prepared notes and files.
4. Publish the frozen `.tgz` to npm with the selected tag.
5. Download the registry tarball once and compare its SHA-256 with the frozen package. Confirm the GitHub asset has the same checksum.
6. Record the published URLs, tag, source commit, package integrity, and CI result.

`npm publish <frozen-file.tgz> --tag next --access public` publishes the existing file. Running `npm publish` from the source directory would create another archive.

Publication credentials remain in the user's normal authentication flow. If npm requests an OTP or another authentication step, complete it through that flow.

## Preserve the release

Keep earlier candidate bytes and receipts. A published version is immutable. Fixes use a new version, and their records describe the checks they actually passed.
