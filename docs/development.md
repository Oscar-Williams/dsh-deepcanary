# Development

Use the repository's package lock and Node 24.9+ for alpha.3 development. RC5 compatibility also has a Node 22.19+ check. Keep Host runtimes, fixed upstream sources, test homes, private logs and published artifacts in their designated workspaces.

The current pinned upstream references are alpha.3 05b1cae8db6e674c5685101494d4eec24652424a and RC5 b830ec950faba0a46dda564be3e2d854afed94f1. Actual Desktop build identity is recorded independently.

```sh
npm ci
npm exec -- vitest run test/execution-boundaries.spec.ts
npm run build
```

During implementation, run only the test or script affected by the edit. Tracked lib must match source. Repair failures at their cause and run the affected regression before continuing.

After features are complete, stage intended new implementation files so the input digest includes them, then run one aggregate verification:

```sh
npm run verify:candidate -- --alpha-runtime /absolute/alpha3-runtime --rc5-runtime /absolute/rc5-runtime
```

It runs application and test types, the complete test suite, one build, policy replay and both actual Host contract lanes. Unchanged successful gates are reused by input and runtime identity; a changed input invalidates the relevant evidence.

After committing reviewed source, documentation and synchronized lib:

```sh
node scripts/freeze-local-candidate.mjs 0.1.8-rc.2
```

The freeze performs package preparation, Git/public-content scans, package whitelist checks and hash calculation once. It creates output/releases/0.1.8-rc.2/dsh-deepcanary-0.1.8-rc.2.tgz and local-candidate.json. Never replace these bytes. A later fix increments the RC.

Install that exact tgz through each actual Host. verify-installed-candidate.mjs compares the installed package to the frozen file manifest; behavioral acceptance still requires the real application. Record actual loaded versions and distinguish source-built unsigned Desktop from official signed Desktop.

The acceptance matrix is alpha.3/RC5 × Web/Desktop, with separate homes and profiles. Daily data is upgraded only after this matrix passes and after its configuration/state backup. A local commit or freeze does not authorize GitHub push, remote CI, Release or npm publication.
