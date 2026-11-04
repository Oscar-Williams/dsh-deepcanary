# Development

Use Node 24.9 or later, npm, and the committed package lock. The development host is DSH 0.2.2-alpha.3. Keep an actual RC5 runtime for compatibility checks.

Host runtimes, source checkouts, test homes, and private records belong outside the plugin repository. Keep each test profile separate from daily data.

## Make a change

```sh
npm ci
npm exec -- vitest run test/execution-boundaries.spec.ts
npm run build
```

Choose the test that exercises your change. The example checks execution boundaries. Fix a failure at its source, run the affected regression, then continue implementation.

Commit generated `lib/` with source changes. DSH can install the Git tag directly, so the repository includes its distribution.

## Verify the candidate

When the intended changes are complete, run the aggregate entry once with the actual runtime directories.

```sh
npm run verify:candidate -- --alpha-runtime /absolute/alpha3-runtime --rc5-runtime /absolute/rc5-runtime
```

It checks types, the test suite, the build, policy replay, and contracts against both hosts. Results are cached by input and runtime identity. Run a check again when a relevant change or failure invalidates it.

Check user flows in the real host. The [acceptance guide](dual-host-acceptance.md) describes which observations establish installation, behavior, and notification delivery. Reuse existing results for unchanged behavior with their original version identity.

## Freeze the package

After reviewing and committing source, documentation, and `lib/`, run the freezer for the version in `package.json`.

```sh
node scripts/freeze-local-candidate.mjs 0.1.8-rc.3
```

It creates `output/releases/0.1.8-rc.3/dsh-deepcanary-0.1.8-rc.3.tgz` and `local-candidate.json`. The sidecar records the source commit, validation, public file manifest, and checksums.

The freezer checks the package whitelist and scans package contents and new Git blobs. Keep this artifact unchanged. Increment the RC before changing package contents.

Install the frozen file through the intended host's manager or CLI. Use `verify-installed-candidate.mjs` to compare the installation with the frozen manifest. Confirm the loaded plugin version after a cold start.

Publication instructions are in the [release checklist](release-checklist.md).
