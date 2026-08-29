# Contributor notes

## Scope

dsh-deepcanary is a standalone DeepSeek Harness external bundle. Keep its DSH package conventions separate from Codex plugin manifests: this repository intentionally does not add .codex-plugin/plugin.json.

The implementation must preserve these boundaries:

- DSH runtime facts belong in providers; attention interpretation belongs in the deterministic core.
- A provider may summarize facts, but it must not copy prompts, model output, tool arguments, credentials, or transcript content into local state.
- C3 requires authoritative Host or Runtime evidence.
- User actions are limited to local metadata and navigation hints. Never add an automatic terminate, restart, approval, rejection, shell, or destructive tool.
- Keep the official alpha.1 source checkout as the only test runtime until the compatibility gate explicitly changes.

## Commands

    npm install
    npm run typecheck
    npm run typecheck:tests
    npm test
    npm run build
    npm run verify:distribution
    npm pack --dry-run

For an end-to-end check, use the official DSH checkout documented in README.md, verify dsh --version is 0.1.2-alpha.1, install this package into the isolated web profile, run dsh web, and check HTTP 200 on the DeepCanary health route.

Generated lib/ output is ignored locally. The package gate must still verify that the built entry points and tarball contents are correct.

## Documentation

When behavior changes, keep README.md, README.en.md, CHANGELOG.md, docs/architecture.md, docs/compatibility.md, docs/security.md, and docs/release-checklist.md consistent. Separate implemented behavior from planned work. Use the official runtime tag and exact command sequence when describing installation.
