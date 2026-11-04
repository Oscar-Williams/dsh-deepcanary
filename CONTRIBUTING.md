# Contributing

[简体中文](CONTRIBUTING.zh-CN.md) · [Documentation](docs/README.md)

Bug reports, documentation improvements, translations, and focused patches are welcome. For a substantial feature, open an issue describing the task and the behavior you want.

## Set up

Use Git, npm, and Node.js 24.9 or later. Develop against DSH `0.2.2-alpha.3` and check changes to DSH integration on `0.2.1-rc.5` as well.

```sh
git clone https://github.com/Oscar-Williams/dsh-deepcanary.git
cd dsh-deepcanary
npm ci
```

Create an isolated DSH home and profile for tests. Keep daily conversations, credentials, and reminder state outside the repository. [Development](docs/development.md) explains how to select actual host runtimes.

## Make and check a change

Run the full suite before submitting. While working on a change, pass the relevant test file to Vitest.

```sh
npm test
npm exec -- vitest run test/settings-migration.spec.ts
npm run build
```

After editing `src/`, run the build and commit the generated `lib/` with your source changes. DSH uses those files when installing from a Git tag, so users can install without a TypeScript build.

Add a regression test when fixing a reproducible bug. Use the development guide for changes that affect DSH integration. For documentation, run `npm run verify:docs` and check both languages. [Development guide](docs/development.md).

## Design boundaries

- Read session and task state through public DSH APIs in the adapters. Use rules in `src/core/` to determine the reminder level from that state.
- Assign C3 only when DSH confirms that an unanswered question or pending approval is blocking progress.
- Store only the metadata needed to restore reminders and return to sessions. Keep prompts, conversation text, tool arguments, raw errors, and credentials out of the reminder files.
- Use DSH's authenticated routes and check the expected revision before applying an update. Keep retained state bounded and render text safely.
- Show reminders and open sessions from DeepCanary. Handle task execution, answers, and approvals in DSH.

[Architecture](docs/architecture.md) · [Public DSH interfaces](docs/dsh-surface-audit.md)

## Report a bug

Include the DSH and DeepCanary versions, operating system, reproduction steps, expected behavior, and observed result. Use a small sample with private content removed. Report vulnerabilities through [Security](SECURITY.md).

## Submit a pull request

Keep the change focused. Explain the problem, resulting behavior, and checks run. Update the changelog and relevant documentation, including its Chinese counterpart. Screenshots help when a visible interaction changes.

Keep private data, credentials, host profiles, and local process logs out of the patch. Follow the existing code style and package lock.

## Documentation and translation

English documents use the base filename. Add `.zh-CN.md` for the Simplified Chinese version. Keep language navigation and command examples aligned. Preserve code identifiers, version strings, and CLI option spelling.

User instructions belong in the READMEs. Put implementation details and contributor commands in the documentation directory. The project uses the [MIT license](LICENSE).
