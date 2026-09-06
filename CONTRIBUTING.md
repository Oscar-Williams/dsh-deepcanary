# Contributing to DeepCanary

Bug reports, focused pull requests, and translations are welcome. For a substantial behavior change, open an issue first so the expected runtime signal, user benefit, and compatibility scope are clear.

## Development

Use Node.js `22.19+`. Dependencies are locked to the DSH `0.1.2-alpha.5` compatibility baseline.

```sh
npm ci
npm run typecheck
npm run typecheck:tests
npm test
npm run build
npm run verify:distribution
```

Commit generated `lib/` changes with their source changes. DSH can install the repository's Git tag without running the TypeScript toolchain, so CI rejects stale output. Builds validate the installed compiler and bundler against the lockfile.

For a different DSH revision, use the isolated checks in the [development guide](docs/development.md). Do not mix generated output or evidence from different runtime checkouts.

## Design boundaries

- Keep DSH runtime facts in adapters/providers and attention interpretation in the deterministic core.
- Highest-severity (C3) decisions require host or runtime authority. A heuristic or model summary cannot supply that authority.
- Preserve deduplication, grouping, budgets, quiet hours, recovery, and bounded state.
- Keep persisted data limited to allowlisted metadata. Session/workspace references are hashed; a bounded local session handle is allowed only for navigation. Never persist prompts, transcripts, tool arguments, workspace paths, or credentials.
- Keep Web routes same-origin and `no-store`, and render untrusted values with safe DOM APIs.
- Do not add shell, arbitrary file-write, process-control, approval, or rejection capabilities.

## Tests and documentation

Add focused tests for the behavior you change, including healthy and recovery paths. Update AttentionGold fixtures when event mappings or policy change. Tests must use platform-appropriate paths and must not depend on a contributor's home directory or private runtime state.

Keep [English](README.md) and [Chinese](README.zh-CN.md) user instructions aligned. The main README is English; `README.en.md` remains a compatibility link for existing references. Put implementation details in developer documentation and describe visible changes in the changelog.

## Pull requests

Explain the problem, the user-visible change, relevant DSH APIs, and tests run. Update the [surface audit](docs/dsh-surface-audit.md) and [compatibility matrix](docs/compatibility.md) when those contracts change. Never include private session data, credentials, local runtime profiles, or generated observation logs.

Reports of suspected security issues should omit exploit payloads containing private data. Start from the boundaries described in [security and privacy](docs/security.md).
