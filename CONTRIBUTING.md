# Contributing to dsh-deepcanary

Thank you for helping improve `dsh-deepcanary`. Contributions are most useful when they preserve the plugin's evidence-first behavior, keep the local privacy boundary explicit, and remain compatible with the exact DeepSeek Harness interfaces under test.

## Development baseline

Use Node.js 22.19.0 or 24.19.0. The published RC.2 evidence uses the official `dsh-v0.1.2-alpha.2` tag of DeepSeek Harness, commit `0a53fb55bea101816fa226bb964ae2bed71c343b`. New changes and compatibility tests use the latest official `dsh-v0.1.2-alpha.5` tag, commit `db6bdc3576c2d4e7c965e8e3ed0c2a731eed87f5`. The older `0.1.1-rc.2` runtime is reserved for historical environment diagnosis.

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

The repository tracks the generated `lib/` directory because DSH installs a public Git tag without running this repository's TypeScript toolchain. After changing `src/`, run `npm run build` and include the resulting `lib/` changes in the same commit. CI rejects stale generated output.

## Design and testing expectations

- Keep C3 decisions tied to Host or Runtime authority. A heuristic or model-shaped summary must not promote an event to C3 by itself.
- Preserve deduplication, Decision Bundle merging, hourly budget, quiet-hour behavior, and bounded evidence summaries when adding providers.
- Persisted state contains only bounded metadata. Session and Workspace references remain hashed; a bounded opaque DSH session handle may be retained locally when the host provides it, solely to reopen the native DSH session. Never persist prompts, transcripts, tool arguments, workspace paths, credentials, or opaque runtime payloads.
- Add or update AttentionGold fixtures and focused tests for new event mappings, including normal completion and recovery paths.
- Keep Web routes same-origin and `no-store`; render untrusted values with safe DOM APIs.
- Do not add shell, file-write, process-control, approval, or rejection capabilities to the plugin tools.

## Pull requests

Describe the user-visible behavior, the DSH event or API interface involved, and the tests run. For changes that affect compatibility, update `docs/dsh-surface-audit.md` and `docs/compatibility.md`. Keep the local design notes under `设计思路(不提交)/`; they are intentionally excluded from commits and release artifacts.
