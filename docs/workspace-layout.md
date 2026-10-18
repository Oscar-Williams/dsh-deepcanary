# Versions and workspace layout

## Current identities

| Item | Version or identity |
| --- | --- |
| Current release candidate | 0.1.6-rc.4 |
| npm channels | `latest` and `next`: 0.1.6-rc.4 |
| Web Host | published DSH 0.2.1-rc.2 npm packages |
| Official Windows Desktop | released DSH 0.2.1-rc.2; release tag `687f282e8625c6b8d11ff58211a90524be2e4317` |
| Development Cordis / Schemastery | 4.0.5 / 3.18.5 |
| Plugin package manager | npm with `package-lock.json` |
| Host package manager | released runtime's own package manager; existing source checkouts retain their pins |
| CI Node lanes | 22.19.0 and 24.19.0 |

`npm run verify:environment` checks installed direct dependencies against the lockfile before a build. Profiles resolve shared Host services from the Host installation, preserving one Cordis instance; use actual service loading to assess profile integration.

## Repository roles

```text
src/, test/, scripts/       implementation and generic maintenance tools
lib/                       committed generated distribution
assets/, docs/             public screenshots and documentation
benchmark/                 schemas, sanitized regression fixtures, historical receipts
output/releases/<version>/ immutable local tgz and sidecar
output/dogfood/, replay/    local sanitized analysis
output/archive/            retained historical candidates
```

Runtime checkouts and test homes belong outside the maintained plugin repository. Homes retain separate profiles, state, sessions and credentials. Active and historical evidence-bound homes preserve their identity. Private design notes, local cleanup lists and machine-specific tools remain local and outside Git/npm.

## Artifact rules

Freeze after committing source and `lib`, with a clean tracked snapshot. The freezer hashes tracked source inputs and binds the actual commit. Verification selects an explicit artifact or `output/releases/<version>/`; published versions are never repacked.

Installation comparison checks package bytes. Runtime validation additionally checks the active module/server/client after restart. Reports distinguish natural/controlled/replay/unknown data and installation/runtime/OS observation scope.

Historical receipts retain their Host pins. Current README commands pin the release candidate explicitly. `DSH_RUNTIME` selects the actual released installation for development contracts.
