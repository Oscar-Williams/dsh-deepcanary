# Release checklist

This is the maintainer workflow. Installation instructions belong in the [README](../README.md); release-specific results belong in immutable, versioned records in the repository's [benchmark directory](https://github.com/Oscar-Williams/dsh-deepcanary/tree/main/benchmark).

## 1. Source and documentation

- Keep `package.json`, both lockfile version fields, the runtime version, and current installation examples aligned.
- Review the English and Chinese README, changelog, compatibility matrix, and package description for accuracy and user relevance.
- Preserve historical version labels and receipts. Never overwrite an existing tag, npm version, or published artifact.
- Review the diff for credentials, private content, personal paths, and unrelated changes.
- Use the normal alpha.5 build for release output. Separate alpha.13 checks must retain their own runtime/profile/artifact identities.

## 2. Code and package checks

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

The locked toolchain must produce the committed `lib/` output. Require passing CI for the release commit on Windows and Ubuntu with Node 22 and 24, plus the alpha.5 WebUI smoke. A cache hit alone does not prove reproducibility; a clean CI build is required.

For behavior changes, also run focused provider, lifecycle, policy, privacy, recovery, and notification tests. AttentionGold must cover both positive decisions and healthy/suppressed/recovered cases. Run the quality report and attention benchmark when policy or resource behavior changes.

## 3. Runtime and UI scope

Use an isolated profile and the exact artifact being evaluated. Verify:

- plugin registration, required services, nine model-visible tools, and health/state/settings/action/outcome routes;
- the DSH client-module entry, sidebar trigger, settings card, and on-demand Inbox;
- close/reopen, Escape/outside-click behavior, focus return, pointer/keyboard resize, narrow viewports, and language changes;
- acknowledge, snooze, mute, feedback, outcome retention/withdrawal, and session navigation;
- permission-denied fallback, unload/restart cleanup, and no duplicate listeners, tools, or routes.

Separate automated browser results from physical touch, screen-reader output, and OS notification observations. A live-model smoke, when needed, uses an authorized credential profile and records only a bounded result; it must not inspect or copy workspace data.

For alpha.13, use the exact source pin and commands in [development](development.md). The canary requires package-byte identity plus separately captured, sanitized authenticated UI evidence. Do not promote that check into Windows, WSL, natural-use, or Stable evidence.

## 4. Stable qualification

An RC can remain useful without meeting Stable criteria. Keep Persistent Supervisor experimental and off by default until its operational criteria are met.

- **Gate D — usefulness and delivery:** validated multi-run natural-use evidence, required task families and opportunities, independent qualified DSH audit, and reviewed visible final delivery units. Task intent, capture provenance, review source/basis/confidence, policy correctness, usefulness, and unknown visibility remain distinct.
- **Windows notification observation:** bind OS display, notification-center retention, and click-back to the exact run, attempt, delivery unit, screenshots, and observation hashes. Browser construction is not OS visibility.
- **Gate E — operational continuity:** authoritative reconciliation, post-restart pending/recovery convergence, cross-process ownership and fencing, orphan convergence, resource bounds, and real elapsed-time soak. A virtual-clock soak is supplemental only.

See the [evaluation protocol](dogfood-protocol.md) and the checked-in schemas for thresholds and evidence fields. Missing evidence stays pending. The four outcomes remain `STABLE_READY`, `STABLE_WITH_EXCEPTIONS`, `CONTINUE_RC`, and `HOLD`; prototype readiness is separate from `stableEligible`.

For a Stable assessment, generate relevant evidence once and bind the evaluation to the frozen artifact:

```sh
npm run replay:policy
npm run adapter:smoke
npm run supervisor:smoke
npm run supervisor:soak
node scripts/evaluate-stable-gates.mjs --package-tgz <frozen-tgz>
```

Do not restart active user work, re-enable a paused WSL/long-soak lane, or invent missing observations merely to complete a checklist.

## 5. Freeze and publish

1. Commit the verified source and generated output. Require passing CI on that commit.
2. Pack once into `output/releases/<version>/`. Use a new version if a published or frozen identity already exists; the prepack guard rejects reuse. Record SHA-256, npm shasum/integrity, byte size, and source commit; keep receipts outside the package.
3. Confirm the archive contains the built entry, client module, bundle patch, both README languages, docs, images, schemas, and license. Exclude source/tests, local profiles, private notes, and observation logs.
4. With publication authorized, push the immutable version tag and create a GitHub prerelease with the exact tarball.
5. Verify the remote tag, Release asset identity, and digest. Publish that same tarball to the official npm registry with `--tag next --ignore-scripts`.
6. Independently verify npm version, dist-tag, shasum/integrity, and tarball bytes. If the CLI ends ambiguously, read the registry before retrying: publication may already have committed. Leave `latest` unchanged unless a default-install channel change was explicitly authorized; that alias does not itself certify Stable readiness.
7. Record publication results in a follow-up commit and run `npm run verify:release-receipt`. Do not change the tag or repack the published version.

Release notes should explain user-visible changes, installation, compatibility scope, and important limitations. Gate detail and working-environment state belong in maintainer records, not the release headline.
