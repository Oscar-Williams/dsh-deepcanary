# Contributing

[简体中文](CONTRIBUTING.zh-CN.md) · [Documentation](docs/README.md)

Bug reports, documentation improvements, translations, and focused patches are welcome. For a substantial feature, open an issue describing the task and the behavior you want.

## Set up

Use Git, npm, and Node 24.9 or later. DSH alpha.3 is the development host; RC5 remains a supported host.

```sh
git clone https://github.com/Oscar-Williams/dsh-deepcanary.git
cd dsh-deepcanary
npm ci
```

Create an isolated DSH home and profile for tests. Keep daily conversations, credentials, and reminder state outside the repository. [Development](docs/development.md) explains how to select actual host runtimes.

## Make and check a change

Run the test that exercises the behavior you changed.

```sh
npm exec -- vitest run test/settings-migration.spec.ts
npm run build
```

The example checks settings migration. Use a regression for a reproduced defect, including recovery when relevant. Commit generated `lib/` with source changes; DSH uses that distribution when installing a Git tag.

Before submitting, run the checks relevant to your change. For changes to host integration or package behavior, follow the aggregate validation in [Development](docs/development.md). Documentation changes need valid links, matching translations, and readable rendering.

## Design boundaries

- Providers select public DSH facts; the deterministic core decides attention.
- C3 requires a current authoritative question or approval.
- Preserve task ownership, deduplication, quiet hours, budgets, and recovery.
- Keep prompts, conversation text, tool arguments, credentials, and raw failure text out of the reminder ledger.
- Use authenticated host routes, revision checks, bounded state, and safe DOM rendering.
- Keep task execution, approvals, and answers in DSH's native flow.

See [Architecture](docs/architecture.md) and [Public DSH interfaces](docs/dsh-surface-audit.md) when changing those contracts.

## Report a bug

Include the DSH and DeepCanary versions, operating system, reproduction steps, expected behavior, and observed result. Use a small sample with private content removed. Report vulnerabilities through [Security](SECURITY.md).

## Submit a pull request

Keep the change focused. Explain the problem, resulting behavior, and checks run. Update the changelog and relevant documentation, including its Chinese counterpart. Screenshots help when a visible interaction changes.

Keep private data, credentials, host profiles, and local process logs out of the patch. Follow the existing code style and package lock.

## Documentation and translation

English documents use the base filename; Chinese counterparts use `.zh-CN.md`. Keep language navigation and command examples aligned. Preserve code identifiers, version strings, and CLI option spelling.

User instructions belong in the READMEs. Put implementation details and contributor commands in the documentation directory. The project uses the [MIT license](LICENSE).
