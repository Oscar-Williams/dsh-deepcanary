# Documentation

Start with the [English quick start](../README.md) or [简体中文](../README.zh-CN.md).

## Using DeepCanary

- [Compatibility and troubleshooting](compatibility.md) — DSH versions, operating systems, notification requirements, and known limits.
- [Security and privacy](security.md) — local data, allowed actions, and deployment boundaries.
- [Changelog](../CHANGELOG.md) — changes between versions.

## Contributing and integration

- [Contributing](../CONTRIBUTING.md) — development workflow and review expectations.
- [Development](development.md) — source builds, isolated profiles, and runtime verification.
- [Versions and workspace layout](workspace-layout.md) — dependency versions, frozen artifacts, directory roles, and release channels.
- [Architecture](architecture.md) — providers, deterministic attention policy, delivery, and persistence.
- [DSH surface audit](dsh-surface-audit.md) — public host interfaces, version pins, and fallbacks.
- [Evaluation protocol](dogfood-protocol.md) — redacted trial data, review criteria, and uncertainty.
- [Release checklist](release-checklist.md) — artifact integrity, validation scope, and publication.

Machine-readable schemas and historical release records are available in the repository's [benchmark directory](https://github.com/Oscar-Williams/dsh-deepcanary/tree/main/benchmark). Published artifacts are available from [GitHub Releases](https://github.com/Oscar-Williams/dsh-deepcanary/releases) and [npm](https://www.npmjs.com/package/dsh-deepcanary). Release receipts are repository-only so that package hashes do not depend on the receipt recording them.
