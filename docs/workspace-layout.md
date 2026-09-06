# Versions, dependencies, and artifacts

Use explicit identities when building, installing, or comparing results. A directory name, an `rc` suffix without its full version, or a green historical report is not sufficient evidence of what is installed.

## Version map

| Component | Current reference | Meaning |
| --- | --- | --- |
| Published plugin | `dsh-deepcanary@0.1.1-rc.5` | Immutable Git tag, GitHub asset, and npm version; a prerelease. |
| Normal DSH build/CI lane | `0.1.2-alpha.5` / `dsh-v0.1.2-alpha.5` | Eleven DSH development dependencies are pinned to this npm version. |
| Separate `alpha13` script lane | `0.1.3-alpha.1` / `dsh-v0.1.3-alpha.1` | A pinned source-checkout compatibility test; **not** `0.1.2-alpha.13`. |
| Earlier plugin called “RC4” | `0.1.0-rc.4` | Historical alpha.4 release; different from `0.1.1-rc.4`. Write the full version. |
| Plugin dependency manager | npm + `package-lock.json` | Use `npm ci`; do not introduce a competing pnpm/yarn lockfile. |
| Pinned DSH checkout manager | pnpm `11.7.0` | Invoke `npx --yes pnpm@11.7.0` in that checkout, regardless of global pnpm. |
| Development Node | CI: `22.19.0` and `24.19.0` | DSH's range is `^22.19.0 || >=24.0.0`; Node 23 is outside it. |

The lockfile currently resolves TypeScript `5.9.3`, esbuild `0.21.5`, Vitest `2.1.9`, React `18.3.1`, `@types/react` `18.3.31`, `@types/node` `22.20.1`, Cordis `4.0.2`, and Schemastery `3.18.2`. For example, `typescript: ^5.6.0` is an allowed range, not the installed compiler version. The lockfile is authoritative for a checkout; `npm run verify:environment` checks all direct installed dependencies against it. Builds run that check too.

Do not install arbitrary newer DSH peers into a runtime profile to silence standalone `npm ls` warnings. DSH profiles deliberately use a hoisted linker with automatic peer installation disabled; their missing shared peers resolve through the host installation fallback, preserving one Cordis instance. Check actual DSH launch/service registration, not only a profile's isolated npm dependency listing. This behavior is defined in the [pinned host profile implementation](https://github.com/deepseek-ai/DeepSeek-Harness/blob/db6bdc3576c2d4e7c965e8e3ed0c2a731eed87f5/packages/boot/app-boot/src/profile.ts).

## Directory roles

```text
repository/
  src/, test/, scripts/     maintained implementation, tests, and tooling
  lib/                     tracked generated distribution; normal alpha.5 build
  benchmark/               tracked schemas and historical release receipts
  output/
    releases/<version>/    frozen tgz and release-specific verification results
    archive/<label>/       retired candidates; never the default install source
    build/                 disposable build-cache stamp
    gates/, dogfood/, .../  local, provenance-bound evaluation records
```

Keep runtime checkouts and DSH homes outside this repository. New homes should use `deepcanary-<full-plugin-version>-dsh-<full-runtime-version>-<purpose>-<YYYYMMDD>`; the `web` profile lives inside that home. Do not rename an active or evidence-bound historical home merely for cosmetic consistency. Maintain a local inventory mapping its old name to its actual installed version, purpose, and retention reason. Never merge credentials or sessions between homes.

## Frozen package selection

`verify:artifact`, the adapter and compatibility checks, the Supervisor process/soak checks, and the Stable evaluator default only to `output/releases/<version>/dsh-deepcanary-<version>.tgz`. Explicit artifact arguments remain available (`DSH_U7_PACKAGE_TGZ` for Supervisor checks). They never search an old `local-pack` directory or create a new tgz while evaluating evidence. Missing bytes, a mismatched internal package version, or a receipt digest mismatch stops the check. Real elapsed-time soak also requires an explicit `DSH_U7_SOAK_STATE_DIR`; it never silently reuses an old local state directory.

`npm run verify:artifact` checks the archive's name, internal version, and receipt identity. `npm run verify:release-receipt` verifies the publication record. The alpha.5 smoke and Stable evaluator reject a local `lib/` that differs from the artifact whose hash they report. The alpha.5 smoke uses locked npm packages; it does not claim to have executed a DSH source checkout.

The `prepack` guard blocks ordinary packing of a recorded published version or one with an already-frozen canonical archive. `npm run pack:check` remains a non-writing inventory check. This guard prevents accidents; it is not a security boundary. `--ignore-scripts` bypasses lifecycle hooks: use it to **publish an existing verified tgz**, not to manufacture different bytes under a published version.

On a fresh checkout, download missing published artifacts from their exact GitHub Release or npm version and validate the receipt. Never reconstruct a missing published tarball by running `npm pack` again. Main may contain post-release tooling/documentation changes; the release tag and frozen archive identify the published version.

## Three kinds of tag

- Git `v0.1.1-rc.5` identifies an immutable source commit.
- npm `next` and `latest` are movable distribution aliases. `latest` controls default installation, not this project's Stable qualification.
- GitHub Release's prerelease/latest presentation is separate from npm aliases.

Changing npm `latest` affects unqualified installs as well as default package presentation. It does not rewrite a Git tag, publish new bytes, or change a receipt's historical `distTagAtPublication`. Treat channel changes as explicit publication decisions and verify the live registry afterwards. See [npm's distribution-tag rules](https://docs.npmjs.com/cli/v11/commands/npm-dist-tag/).
