# Contributing to DeepCanary

Bug reports, focused patches, and translations are welcome. For a substantial change, open an issue describing the task, the current behavior, and the result you want.

## Development

Use Node 24.9 or later and the committed npm lockfile. Develop against DSH 0.2.2-alpha.3 and retain RC5 compatibility.

```sh
npm ci
npm exec -- vitest run test/execution-boundaries.spec.ts
npm run build
```

Choose tests for the behavior you change. Commit generated `lib/` with source changes. Before freezing a candidate, use the aggregate checks in the [development guide](docs/development.md).

## Design boundaries

- Providers read public DSH facts. The deterministic core decides attention.
- C3 requires a current authoritative question or approval.
- Preserve task ownership, deduplication, budgets, quiet hours, recovery, and bounded state.
- Persist only permitted metadata. Keep prompts, transcripts, tool arguments, credentials, and raw failure text out of the reminder ledger.
- Use authenticated Connection Fetch routes and safe DOM rendering.
- Keep approvals, question answers, process control, and task execution in DSH's native flow.

## Documentation

Keep the [English](README.md) and [Chinese](README.zh-CN.md) installation steps aligned. Use the main README for user tasks and developer documentation for implementation details. `README.en.md` remains a link for existing references.

Describe visible changes in the changelog. Update compatibility and the public-interface reference when host contracts change. Preserve historical release identities.

## Submit a change

Explain the problem, the resulting behavior, and relevant validation. Include a regression when it exercises an actual failure. Keep private session data, credentials, runtime profiles, and local observation logs out of Git.

Report suspected security issues without private payloads. The project's data and action boundaries are described in [Security and privacy](docs/security.md).
