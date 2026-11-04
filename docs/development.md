# Development

[简体中文](development.zh-CN.md) · [Contributing](../CONTRIBUTING.md)

Use Node 24.9 or later, npm, and the committed lockfile. The development host is DSH 0.2.2-alpha.3. Retain an actual RC5 installation for compatibility checks.

## Prepare the source

```sh
git clone https://github.com/Oscar-Williams/dsh-deepcanary.git
cd dsh-deepcanary
npm ci
```

Keep host runtimes, test homes, and credentials outside the repository. Use separate profiles for development and daily work.

## Test and build

Choose the test affected by your change.

```sh
npm exec -- vitest run test/settings-migration.spec.ts
npm run build
```

The build checks direct dependency versions, compiles TypeScript, and bundles the client as a DSH module factory. Commit generated `lib/` with source changes.

## Check both hosts

Prepare runtime directories that contain `node_modules/@deepseek-ai/dsh`. Pass their actual paths to the aggregate entry.

```sh
npm run verify:candidate -- --alpha-runtime /absolute/alpha3-runtime --rc5-runtime /absolute/rc5-runtime
```

It checks application and test types, the test suite, the build, policy replay, and contracts against both hosts. Results are cached by input and runtime identity.

For one host contract, set `DSH_RUNTIME` to the relevant runtime directory and run the corresponding `:host` script. On PowerShell, for example:

```powershell
$env:DSH_RUNTIME = "<absolute path to the runtime directory>"
npm run settings:host
```

Use the host's CLI or manager to install the built package into an isolated profile. Run real interface checks for changed behavior. [Web and Desktop acceptance](dual-host-acceptance.md) explains the cases.

## Prepare a package

Check documentation and distribution after the final changes.

```sh
npm run verify:docs
npm run verify:distribution
```

Commit reviewed source, documentation, and `lib/`, then freeze the version in `package.json`.

```sh
node scripts/freeze-local-candidate.mjs 0.1.9-rc.1
```

The output directory contains one tgz, its file manifest, checksums, and local validation metadata. Keep generated reports outside Git. See the [release guide](release-checklist.md) for publication.
