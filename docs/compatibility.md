# Compatibility matrix

## Verification lanes

DeepCanary maintains two lanes:

1. Upstream canary lane — the exact official dsh-v0.1.2-alpha.1 source tag. This is the current required test lane.
2. Public distribution lane — the external package shape and peer ranges used by a released plugin. It must not be presented as a replacement for the upstream canary lane.

| Component | Current value | Role | Notes |
| --- | --- | --- | --- |
| DSH | dsh-v0.1.2-alpha.1 | required test runtime | Source checkout at the immutable official tag; verify dsh --version |
| DSH commit | cd5ef8148158c3a752a658978873241fdf8e2bbc | reproducibility receipt | Recorded from the local checkout used for verification |
| Node.js | 22.19+ | runtime requirement | Local verification used Node.js 24 |
| pnpm | 11.7.0 | official source install | Use npx --yes pnpm@11.7.0 for the alpha checkout |
| Windows x64 | supported target | host runtime | Browser notification is the baseline |
| WSL | supported target | path identity | Host/WSL paths are normalized; native Toast is optional |
| npm 0.1.1-rc.2 | historical | type/development reference | Not the current integration test baseline |

## Known limitations

- The alpha.1 source tag is the tested runtime because the corresponding npm package was not available during this verification. Do not replace the source checkout with a guessed npm install command.
- Native Windows Toast is capability-detected only. Browser notification and the Web inbox are the supported notification surfaces.
- The jump action returns a local navigation hint. The DSH host decides whether the suggested session URL is available.
- Host health is conservative: a suspected stall is derived from session heartbeat silence; a C3 host failure requires an explicit host probe.
- Optional model judgment and watcher-swarm evaluation are not enabled in this release. Deterministic rules remain complete and authoritative.
- UI integration uses a standalone same-origin client script. A future slot-native client can be added without changing the server contract.
