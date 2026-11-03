# Contributor notes

## Scope

0.1.8 development uses DSH `0.2.2-alpha.3` (05b1cae8db6e674c5685101494d4eec24652424a) and fully supports `0.2.1-rc.5` (b830ec950faba0a46dda564be3e2d854afed94f1), on WebUI and Windows Desktop. Record actual Desktop build identity separately from the tag. Use `DSH_RUNTIME` for targeted Host contracts and `verify:candidate` for one aggregate verification against both actual installations. Install the same frozen tgz on all four combinations. Publication and remote CI require a later explicit user instruction.

dsh-deepcanary is a standalone DeepSeek Harness external bundle. Keep its DSH package conventions separate from Codex plugin manifests: this repository intentionally does not add .codex-plugin/plugin.json.

The implementation must preserve these boundaries:

- DSH runtime facts belong in providers; attention interpretation belongs in the deterministic core.
- A provider may summarize facts, but it must not copy prompts, model output, tool arguments, credentials, or transcript content into local state.
- C3 requires current authoritative blocking human-interaction evidence. Connection loss, counts and tool failures cannot independently produce C3.
- Background observation reads only public owner/lifecycle/count metadata. Labels, progress text, output and terminal detail remain with DSH. The Job Registry subscription declares both jobs and sessions dependencies.
- User actions are limited to local metadata and navigation hints. Never add an automatic terminate, restart, approval, rejection, shell, or destructive tool.
- Scheduled follow-up preserves the existing verdict and evidence. Persist generation-scoped claims before authorizing construction; retain current authority checks, bounded retries and default-mode runtime metadata in the existing Inbox file.
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
