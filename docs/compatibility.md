# Compatibility matrix

## Verification lanes

DeepCanary maintains two explicit lanes:

1. **Upstream canary lane** — the exact official `dsh-v0.1.2-alpha.1` source tag. This is the required integration-test runtime for this RC.
2. **Public distribution lane** — the package layout, built `lib/`, bundle patch, immutable Git tag, and peer ranges consumed by DSH. It verifies installation shape and must not be mistaken for a different DSH runtime.

| Component | RC baseline | Role | Notes |
| --- | --- | --- | --- |
| DSH | `dsh-v0.1.2-alpha.1` | required runtime | Official source checkout; verify `dsh --version` prints `0.1.2-alpha.1` |
| DSH commit | `cd5ef8148158c3a752a658978873241fdf8e2bbc` | reproducibility | Exact commit used for the release receipt |
| Node.js | `22.19+` | runtime requirement | Local Windows verification uses `v24.19.0`; DSH alpha.1 declares `^22.19.0 || >=24.0.0` |
| pnpm | `11.7.0` | DSH source installation | Invoke as `npx --yes pnpm@11.7.0` |
| Windows x64 | supported | primary host | Browser Notification and Web Inbox are the baseline sinks |
| WSL2 Ubuntu | supported | alternate host | `/mnt/<drive>` paths normalize to the Windows workspace identity; interop is capability-detected |
| npm `0.1.1-rc.2` | historical | development type reference only | Not used as the current DSH integration runtime |

## DSH surfaces used

| Surface | Required for mount | Behavior when present | Fallback |
| --- | --- | --- | --- |
| `@deepseek-ai/dsh-session` | yes | Session lifecycle and event feed | Plugin does not claim a valid mount without Session |
| `@deepseek-ai/dsh-tools` | yes for model tools | Registers the eight `deepcanary_*` tools | Web and local service remain usable if tool registration is unavailable |
| `@deepseek-ai/dsh-agent` | no | Agent error provider | Session facts remain available |
| `@deepseek-ai/dsh-subagent` | no | Active Subagent pressure provider | Pressure signals remain inactive |
| `@deepseek-ai/dsh-host-webserver` | no | State, settings, health, action, client routes | Model tools and local persistence remain available |
| `@deepseek-ai/dsh-settings` | no | Live `dsh-deepcanary` namespace | Bundle configuration remains authoritative |

## Windows and WSL behavior

`getWorkspaceIdentity()` exposes a canonical ID plus optional host and WSL paths. The implementation covers Windows drive paths, `/mnt/c/...` paths, CJK directories, WSL interop availability, and an explicit `DSH_DEEPCANARY_WINDOWS_INTEROP=0` fallback override.

The supported notification order is:

1. Browser Notification API after user permission;
2. Windows-native notification when a future host adapter advertises it;
3. the injected Web Inbox;
4. model-visible status and Inbox tools.

This RC deliberately keeps the Web path independent of a native toast dependency. `nativeToast` and `windowsInterop` are capability fields, not hidden claims that a native companion is installed.

## Known limitations

- The alpha.1 source tag is the tested runtime because this baseline is pinned to the official repository tag. Do not substitute an unverified npm package or a stale local DSH installation.
- The jump action returns a local DSH navigation hint; the host decides whether the target session URL is available.
- Liveness is conservative: session heartbeat silence produces a suspected-stall C2; a C3 host failure requires a failed local HTTP probe.
- Native Windows Toast is not a hard dependency in this RC. Browser and Web fallback behavior is the supported cross-platform path.
- Model-assisted judgment, Done Verification, Watcher Swarm, tray persistence, and organization policy are intentionally deferred to later release lines; deterministic policy is complete for this RC's declared surface.
- If a future DSH release changes an event payload, Settings scope, Tool contract, or WebServer API, update this matrix and `docs/dsh-surface-audit.md` before changing the provider, then rerun the full release receipt.
