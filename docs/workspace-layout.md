# Repository layout

[简体中文](workspace-layout.zh-CN.md) · [Development](development.md)

## Source and distribution

| Directory | Contents |
| --- | --- |
| `src/` | Plugin service, providers, policy, persistence, and client source |
| `test/` | Regressions and controlled fixtures |
| `scripts/` | Build, host contract, package, and maintenance commands |
| `lib/` | Generated distribution committed with source changes |
| `assets/` | Public interface screenshots |
| `docs/` | User and contributor documentation |
| `benchmark/` | Regression inputs and schemas used by development tools |
| `output/` | Ignored build output, candidate packages, and local reports |

Keep DSH installations, source checkouts, profiles, and credentials outside this repository. Each test profile has its own state. Use existing project instructions when choosing a local test directory.

## Versions

The development host is DSH 0.2.2-alpha.3; RC5 is the compatibility host. The source pins and actual Desktop build identities are listed in [Compatibility](compatibility.md).

npm and `package-lock.json` manage this repository. Host profiles use the package manager supplied by that host. Host services resolve from its own installation.

## Packages

Freeze the reviewed commit with synchronized `lib/`. Output goes to `output/releases/<version>/`. The local manifest binds the source commit, package contents, and checksums.

A package file comparison establishes installed contents. A cold start establishes which version was loaded. Use the real application to verify changed behavior.

Generated receipts, local paths, authentication links, and private samples stay in local output. Release assets contain the distributable package and its checksum.
