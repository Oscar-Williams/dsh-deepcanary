# Contributor notes

## Scope

dsh-deepcanary is a standalone DeepSeek Harness external bundle. Keep its DSH package conventions separate from Codex plugin manifests: this repository intentionally does not add .codex-plugin/plugin.json.

The implementation must preserve these boundaries:

- DSH runtime facts belong in providers; attention interpretation belongs in the deterministic core.
- A provider may summarize facts, but it must not copy prompts, model output, tool arguments, credentials, or transcript content into local state.
- C3 requires authoritative Host or Runtime evidence.
- User actions are limited to local metadata and navigation hints. Never add an automatic terminate, restart, approval, rejection, shell, or destructive tool.
- Keep the official alpha.2 source checkout at the pinned tag and commit as the only integration-test runtime until the compatibility gate explicitly changes.

## Commands

    npm install
    npm run typecheck
    npm run typecheck:tests
    npm test
    npm run build
    npm run verify:distribution
    npm run verify:release-receipt
    npm pack --dry-run

For an end-to-end check, use the official DSH checkout documented in README.md, verify dsh --version is 0.1.2-alpha.2, install this package into the isolated web profile, run dsh web, and check HTTP 200 on the DeepCanary health route.

The release branch tracks the built `lib/` output because DSH installs a public Git tag without running this repository's TypeScript toolchain. Every source change must therefore be followed by `npm run build`, and CI must fail if the committed `lib/` output is stale.

The WSL2 verification lane uses the isolated Conda environment at `/home/Oscar/miniconda3/envs/dsh-deepcanary`. Keep its DSH profile home separate from the environment directory when running end-to-end checks.

## Documentation

When behavior changes, keep README.md, README.en.md, CHANGELOG.md, docs/architecture.md, docs/compatibility.md, docs/security.md, and docs/release-checklist.md consistent. Separate implemented behavior from planned work. Use the official runtime tag and exact command sequence when describing installation.
