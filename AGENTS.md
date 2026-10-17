# Contributor notes

## Scope

0.1.5-rc.2 local development uses published DSH `0.2.1-rc.1` packages, with Cordis 4.0.5 and Schemastery 3.18.5. The current official Windows Desktop build is DSH `0.2.0-rc.2` at `639ed015397290b3745d163aafe02ffee4aa3f84`. Select the actual installation with `DSH_RUNTIME`; use `typecheck:host`, `adapter:host`, `settings:host` and `connection:host`. Web/Desktop consume the same frozen candidate and record the behavior of each actual Host. Publication and remote CI require explicit user authorization.

dsh-deepcanary is a standalone DeepSeek Harness external bundle. Keep its DSH package conventions separate from Codex plugin manifests: this repository intentionally does not add .codex-plugin/plugin.json.

The implementation must preserve these boundaries:

- DSH runtime facts belong in providers; attention interpretation belongs in the deterministic core.
- A provider may summarize facts, but it must not copy prompts, model output, tool arguments, credentials, or transcript content into local state.
- C3 requires authoritative Host or Runtime evidence.
- User actions are limited to local metadata and navigation hints. Never add an automatic terminate, restart, approval, rejection, shell, or destructive tool.
- Historical receipts retain their exact plugin and Host identities. Current checks use the latest released runtime available for the affected surface.
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

For current device work, use the released runtime and commands in README and docs/development.md. The `/api/dsh-deepcanary/*` routes require Host authentication. Historical alpha scripts remain available for reproducing their original receipts.

The repository tracks the built `lib/` output because DSH installs a public Git tag without running this repository's TypeScript toolchain. Every source change must therefore be followed by `npm run build`, and CI must fail if the committed `lib/` output is stale.

The paused historical WSL2 verification lane uses the isolated Conda environment named `dsh-deepcanary`. Keep its DSH profile home separate from the environment directory when running end-to-end checks.

## Documentation

Use `docs/workspace-layout.md` for version and artifact identities. Verification consumes a frozen tgz from `output/releases/<version>/` or an explicit path; never repack a published version, silently use a historical profile, or promote an npm-package smoke to source-checkout evidence. Post-release tooling changes on main do not change immutable release bytes.

When behavior changes, keep README.md (English), README.zh-CN.md (Chinese), CHANGELOG.md, docs/architecture.md, docs/compatibility.md, docs/security.md, and docs/release-checklist.md consistent. Separate implemented behavior from planned work. Use the official runtime tag and exact command sequence when describing installation.
