# Contributing to dsh-deepcanary

Thank you for helping improve `dsh-deepcanary`. Contributions are most useful when they preserve the plugin's evidence-first behavior, keep the local privacy boundary explicit, and remain compatible with the exact DeepSeek Harness surface under test.

## Development baseline

Use Node.js 22.19.0 or 24.19.0. The RC release baseline is the official `dsh-v0.1.2-alpha.1` tag of DeepSeek Harness, commit `cd5ef8148158c3a752a658978873241fdf8e2bbc`. Do not use the older `0.1.1-rc.2` runtime as an integration-test substitute.

Install dependencies and run the complete local gate from the repository root:

```powershell
npm ci
npm run typecheck
npm run typecheck:tests
npm test
npm run build
npm run verify:distribution
npm pack --dry-run
```

The release branch tracks the generated `lib/` directory because DSH installs a public Git tag without running this repository's TypeScript toolchain. After changing `src/`, run `npm run build` and include the resulting `lib/` changes in the same commit. CI rejects stale generated output.

## Design and testing expectations

- Keep C3 decisions tied to Host or Runtime authority. A heuristic or model-shaped summary must not promote an event to C3 by itself.
- Preserve deduplication, Decision Bundle merging, hourly budget, quiet-hour behavior, and bounded evidence summaries when adding providers.
- Do not persist raw prompts, transcripts, tool arguments, session identifiers, workspace paths, credentials, or opaque runtime payloads.
- Add or update AttentionGold fixtures and focused tests for new event mappings, including normal completion and recovery paths.
- Keep Web routes same-origin and `no-store`; render untrusted values with safe DOM APIs.
- Do not add shell, file-write, process-control, approval, or rejection capabilities to the plugin tools.

## Pull requests

Describe the user-visible behavior, the DSH event or API surface involved, and the tests run. For changes that affect compatibility, update `docs/dsh-surface-audit.md` and `docs/compatibility.md`. Keep the local design notes under `设计思路(不提交)/`; they are intentionally excluded from commits and release artifacts.
