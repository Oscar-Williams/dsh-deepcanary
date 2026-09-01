# Compatibility matrix

## Verification lanes

DeepCanary maintains separate historical and current lanes so a released result remains reproducible while upstream compatibility moves forward:

1. **RC.2 historical lane** — the exact official `dsh-v0.1.2-alpha.2` source tag and public `v0.1.0-rc.2` plugin tag.
2. **Current upstream lane** — the exact official `dsh-v0.1.2-alpha.3` source tag and the local plugin worktree used for the next release candidate.
3. **Public distribution lane** — the package layout, built `lib/`, bundle patch, immutable Git tag, and peer ranges consumed by DSH.

The current lane is the required baseline for new development and compatibility tests. The public RC.2 lane remains available for comparison and does not imply alpha.3 support for that historical tag. The completed local alpha.3 result is recorded in [`benchmark/alpha3-compatibility-receipt.json`](../benchmark/alpha3-compatibility-receipt.json); it describes the current worktree and is not a public release receipt.

| Component | RC.2 historical | Current compatibility lane | Notes |
| --- | --- | --- | --- |
| DSH | `dsh-v0.1.2-alpha.2` | `dsh-v0.1.2-alpha.3` | Official source checkout; verify the matching `dsh --version` output |
| DSH commit | `0a53fb55bea101816fa226bb964ae2bed71c343b` | `dd6322d604e00eec1ba5e0c8541159906a21094a` | Immutable upstream commits used for reproducibility |
| Plugin | `v0.1.0-rc.2` | local worktree during development | A new public tag requires a new receipt and an artifact-specific install check |
| Node.js | `22.19+` | `22.19+` | Local Windows verification uses `v24.19.0`; current DSH packages declare the same supported range |
| pnpm | `11.7.0` | DSH source installation | Invoke as `npx --yes pnpm@11.7.0` |
| Windows x64 | supported | primary host | Browser Notification and Web Inbox are the baseline sinks |
| WSL2 Ubuntu | supported | alternate host | `/mnt/<drive>` paths normalize to the Windows workspace identity; interop is capability-detected |
| npm `0.1.1-rc.2` / plugin `v0.1.0-rc.1` | historical | not supported for this RC | Remove or replace from the test profile before testing |

## DSH surfaces used

| Surface | Required for mount | Behavior when present | Fallback |
| --- | --- | --- | --- |
| `@deepseek-ai/dsh-session` | yes | Session lifecycle and event feed | Plugin does not claim a valid mount without Session |
| `@deepseek-ai/dsh-tools` | yes for model tools | Registers the nine `deepcanary_*` tools, including explanation and read-only dry-run | Web and local service remain usable if tool registration is unavailable |
| `@deepseek-ai/dsh-agent` | no | Agent error provider | Session facts remain available |
| `@deepseek-ai/dsh-subagent` | no | Active Subagent pressure provider | Pressure signals remain inactive |
| `@deepseek-ai/dsh-host-webserver` | no | State, settings, health, action, client routes | Model tools and local persistence remain available |
| `@deepseek-ai/dsh-settings` | no | Live `dsh-deepcanary` namespace | Bundle configuration remains authoritative |

## Windows and WSL behavior

`getWorkspaceIdentity()` exposes a canonical ID plus optional host and WSL paths. The implementation covers Windows drive paths, `/mnt/c/...` paths, CJK directories, WSL interop availability, and an explicit `DSH_DEEPCANARY_WINDOWS_INTEROP=0` fallback override.

The supported notification order is:

1. Browser Notification API after user permission;
2. Windows-native notification when a future host adapter advertises it;
3. the DSH client-module Web Inbox;
4. model-visible status and Inbox tools.

This RC deliberately keeps the Web path independent of a native toast dependency. `nativeToast` and `windowsInterop` are capability fields, not hidden claims that a native companion is installed.

The Web UI requires the DSH client-module surface used by alpha.2 and alpha.3: the plugin manifest must expose `dsh.client` and `./client`, and the host must provide the `sidebar.footer.action`, `shell.overlay`, and `settings.plugin.item` slots. A profile that only installs the historical `v0.1.0-rc.1` package cannot verify the current four interaction gates or the standard settings card.

For the current alpha.3 lane, install the local built package into the isolated test profile, then verify `dsh --profile web --dump-config`, the DeepCanary health route, the nine registered tools, and the client-module boot graph. The Windows source checkout and the WSL2 official npm runtime have both completed this local compatibility path. Public RC.2 installation commands remain tied to alpha.2 and are retained for historical reproduction.

## Known limitations

- RC.2 evidence is tied to the alpha.2 source tag and cannot be relabeled as alpha.3 evidence. Current development evidence is tied to the alpha.3 tag and the exact local package/profile recorded by the active receipt.
- The jump action returns a local DSH navigation hint; the host decides whether the target session URL is available.
- Liveness is conservative: session heartbeat silence produces a suspected-stall C2; a C3 host failure requires a failed local HTTP probe.
- Native Windows Toast is not a hard dependency in this RC. Browser and Web fallback behavior is the supported cross-platform path.
- The alpha.3 local WebUI lane covers emulated touch input, forced-colors rendering, semantic roles, and six viewport sizes. Physical touch hardware, real Screen Reader output, and browser-notification click positioning remain device-level follow-up checks.
- Model-assisted judgment, Done Verification, Watcher Swarm, tray persistence, and organization policy are intentionally deferred to later release lines; deterministic policy is complete for this RC's declared surface.
- If a future DSH release changes an event payload, Settings scope, Tool contract, or WebServer API, update this matrix and `docs/dsh-surface-audit.md` before changing the provider, then rerun the full release receipt.
