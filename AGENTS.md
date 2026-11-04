# Contributor notes

## Scope

Development uses DSH `0.2.2-alpha.3` (05b1cae8db6e674c5685101494d4eec24652424a) and supports `0.2.1-rc.5` (b830ec950faba0a46dda564be3e2d854afed94f1), on WebUI and Windows Desktop. Use `DSH_RUNTIME` for targeted host contracts and `verify:candidate` for aggregate verification against both installations. Install the same frozen tgz on all four combinations. Follow the user's publication instructions.

dsh-deepcanary is a standalone DeepSeek Harness external bundle. Keep its DSH package conventions separate from Codex plugin manifests: this repository intentionally does not add .codex-plugin/plugin.json.

The implementation must preserve these boundaries:

- DSH runtime facts belong in providers; attention interpretation belongs in the deterministic core.
- A provider may summarize facts, but it must not copy prompts, model output, tool arguments, credentials, or transcript content into local state.
- C3 requires current authoritative blocking human-interaction evidence. Connection loss, counts and tool failures cannot independently produce C3.
- Background observation reads only public owner/lifecycle/count metadata. Labels, progress text, output and terminal detail remain with DSH. The Job Registry subscription declares both jobs and sessions dependencies.
- User actions are limited to local metadata and navigation hints. Never add an automatic terminate, restart, approval, rejection, shell, or destructive tool.
- Scheduled follow-up preserves the existing verdict and evidence. Persist generation-scoped claims before authorizing construction; retain current authority checks, bounded retries and default-mode runtime metadata in the existing Inbox file.
- Keep test reports, host profiles, credentials, and process records outside Git and the published package.

## Commands

    npm ci
    npm exec -- vitest run test/execution-boundaries.spec.ts
    npm run build

Select the test affected by the edit. Once the intended changes are complete, run `verify:candidate` against the alpha.3 and RC5 runtime directories, then check distribution and freeze the committed version. Reuse successful unchanged results. `scripts/ci-browser-smoke.mjs` emits the browser flow used by CI and reads the expected version from package.json.

Use the commands in README and docs/development.md. The `/api/dsh-deepcanary/*` routes require host authentication.

The repository tracks the built `lib/` output because DSH installs a public Git tag without running this repository's TypeScript toolchain. Every source change must therefore be followed by `npm run build`, and CI must fail if the committed `lib/` output is stale.

## Documentation

Use `docs/workspace-layout.md` for version and artifact identities. Verification consumes a frozen tgz from `output/releases/<version>/` or an explicit path; never repack a published version, silently use a historical profile, or promote an npm-package smoke to source-checkout evidence. Post-release tooling changes on main do not change immutable release bytes.

Keep current English and Chinese documents aligned. Run `npm run verify:docs` after editing links or examples. Keep implemented behavior distinct from planned work, and describe installation with the actual package channel and host commands.
