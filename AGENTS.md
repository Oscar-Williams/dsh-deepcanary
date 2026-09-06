# Contributor notes

## Scope

dsh-deepcanary is a standalone DeepSeek Harness external bundle. Keep its DSH package conventions separate from Codex plugin manifests: this repository intentionally does not add .codex-plugin/plugin.json.

The implementation must preserve these boundaries:

- DSH runtime facts belong in providers; attention interpretation belongs in the deterministic core.
- A provider may summarize facts, but it must not copy prompts, model output, tool arguments, credentials, or transcript content into local state.
- C3 requires authoritative Host or Runtime evidence.
- User actions are limited to local metadata and navigation hints. Never add an automatic terminate, restart, approval, rejection, shell, or destructive tool.
- Keep explicit runtime lanes: the historical RC.2 receipt uses official alpha.2 at its pinned commit; the current RC6 release line and published RC4/RC5 use official alpha.5 at tag `dsh-v0.1.2-alpha.5`, commit `db6bdc3576c2d4e7c965e8e3ed0c2a731eed87f5`; the independent compatibility canary uses official alpha.13 (`dsh-v0.1.3-alpha.1`) at commit `d347e703908d0406b7a7ef80e3a0e594d86b2215` from a local checkout. Never relabel one lane's evidence as another.
- Dogfood task intent is separate from capture provenance. User-facing review coverage counts only unique final delivery units with explicit visible-delivery evidence; review source/basis/confidence and unknown visibility remain explicit and never imply usefulness automatically.

## Commands

    npm ci
    npm run verify:environment
    npm run typecheck
    npm run typecheck:tests
    npm test
    npm run build
    npm run verify:distribution
    npm run verify:release-receipt
    npm run quality:report
    npm run benchmark:attention
    npm pack --dry-run

For current development end-to-end checks, use the official alpha.5 checkout documented in `docs/compatibility.md`, verify `dsh --version` is `0.1.2-alpha.5`, install the current built package into the isolated web profile, run `dsh web`, and check HTTP 200 on the DeepCanary health route. Run `npm run compatibility:alpha13` only for the separate local alpha.13 compatibility canary after binding its exact runtime, profile, package, and sanitized UI evidence. Use the alpha.2 checkout only when reproducing the historical RC.2 receipt.

The repository tracks the built `lib/` output because DSH installs a public Git tag without running this repository's TypeScript toolchain. Every source change must therefore be followed by `npm run build`, and CI must fail if the committed `lib/` output is stale.

The WSL2 verification lane uses the isolated Conda environment named `dsh-deepcanary`. Keep its DSH profile home separate from the environment directory when running end-to-end checks.

## Documentation

Use `docs/workspace-layout.md` for version and artifact identities. Verification consumes a frozen tgz from `output/releases/<version>/` or an explicit path; never repack a published version, silently use a historical profile, or promote an npm-package smoke to source-checkout evidence. Post-release tooling changes on main do not change immutable release bytes.

When behavior changes, keep README.md (English), README.zh-CN.md (Chinese), CHANGELOG.md, docs/architecture.md, docs/compatibility.md, docs/security.md, and docs/release-checklist.md consistent. Separate implemented behavior from planned work. Use the official runtime tag and exact command sequence when describing installation.
