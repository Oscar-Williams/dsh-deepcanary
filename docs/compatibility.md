# Compatibility matrix

## Verification scope

DeepCanary records the public RC4 result, the historical RC2 result, and the distribution-package checks separately. This keeps each published result reproducible while compatibility with DSH advances:

1. **RC.4 candidate** — the exact official `dsh-v0.1.2-alpha.4` source tag, the prepared `v0.1.0-rc.4` plugin tag, and the locally verified package contents.
2. **Historical RC.2** — the exact official `dsh-v0.1.2-alpha.2` source tag and public `v0.1.0-rc.2` plugin tag.
3. **Distribution package** — the package layout, built `lib/`, bundle patch, immutable Git tag, npm metadata, and peer ranges consumed by DSH.

RC4 is the required baseline for new development and compatibility tests. The historical RC2 result remains available for comparison. The RC4 candidate evidence is recorded in [`benchmark/release-candidate-receipt.json`](../benchmark/release-candidate-receipt.json); npm publication is currently paused and public GitHub evidence is recorded only after the corresponding operation succeeds. The earlier alpha.3 browser record remains in [`benchmark/alpha3-compatibility-receipt.json`](../benchmark/alpha3-compatibility-receipt.json).

The previous v0.1.0-rc.3 tag remains historical for comparison; its npm version was withdrawn and cannot be reused.

| Component | RC.4 candidate | Historical RC.2 | Notes |
| --- | --- | --- | --- |
| DSH | `dsh-v0.1.2-alpha.4` | `dsh-v0.1.2-alpha.2` | Official source checkout; verify the matching `dsh --version` output |
| DSH commit | `4e84901e6471b79ec0338099867ebb4606d12bb5` | `0a53fb55bea101816fa226bb964ae2bed71c343b` | Immutable upstream commits used for reproducibility |
| Plugin | `v0.1.0-rc.4` and npm `0.1.0-rc.4` | `v0.1.0-rc.2` | RC4 package contents and artifact-specific checks are ready for public publication |
| Node.js | `22.19+` | `22.19+` | Local Windows verification uses `v24.19.0`; current DSH packages declare the same supported range |
| pnpm | `11.7.0` | `11.7.0` | Invoke as `npx --yes pnpm@11.7.0` |
| Windows x64 | supported | primary host | Browser Notification and Web Inbox are the baseline sinks |
| WSL2 Ubuntu | supported | alternate host | `/mnt/<drive>` paths normalize to the Windows workspace identity; interop is capability-detected |
| npm `0.1.1-rc.2` / plugin `v0.1.0-rc.1` | historical | not supported for this RC | Remove or replace from the test profile before testing |

## DSH interfaces used

| Interface | Required for mount | Behavior when present | Fallback |
| --- | --- | --- | --- |
| `@deepseek-ai/dsh-session` | yes | Session lifecycle and event feed | Plugin does not claim a valid mount without Session |
| `@deepseek-ai/dsh-tools` | yes for model tools | Registers the nine `deepcanary_*` tools, including explanation and read-only dry-run | Web and local service remain usable if tool registration is unavailable |
| `@deepseek-ai/dsh-agent` | no | Agent error provider | Session facts remain available |
| `@deepseek-ai/dsh-subagent` | no | Active Subagent pressure provider | Pressure signals remain inactive |
| `@deepseek-ai/dsh-host-webserver` | no | State, settings, health, action, OutcomeReceipt, client routes | Model tools and local persistence remain available |
| `@deepseek-ai/dsh-settings` | no | Live `dsh-deepcanary` namespace | Bundle configuration remains authoritative |

## Windows and WSL behavior

`getWorkspaceIdentity()` exposes a canonical ID plus optional host and WSL paths. The implementation covers Windows drive paths, `/mnt/c/...` paths, CJK directories, WSL interop availability, and an explicit `DSH_DEEPCANARY_WINDOWS_INTEROP=0` fallback override.

The supported notification order is:

1. Browser Notification API after user permission;
2. Windows-native notification when a future host adapter advertises it;
3. the DSH client-module Web Inbox;
4. model-visible status and Inbox tools.

This RC deliberately keeps the Web path independent of a native toast dependency. `nativeToast` and `windowsInterop` are capability fields, not hidden claims that a native companion is installed.

The Web UI requires the DSH client-module interfaces used by alpha.4: the plugin manifest must expose `dsh.client` and `./client`, and the host must provide the `sidebar.footer.action`, `shell.overlay`, and `settings.plugin.item` slots. A profile that only installs the historical `v0.1.0-rc.1` package cannot verify the current four interaction gates or the standard settings card.

For RC4 verification, use the locally generated `dsh-deepcanary-0.1.0-rc.4.tgz` while npm publication is paused; after a public GitHub tag or npm package becomes available, repeat the installation in a fresh isolated profile. Verify `dsh --profile web --dump-config`, the DeepCanary health and OutcomeReceipt routes, the nine registered tools, and the client-module boot graph. The RC4 receipt records the exact runtime, profiles, package digest, and each public-install result as it becomes available. The historical RC2 installation commands remain tied to alpha.2 and are retained for reproduction.

## Known limitations

- RC2 evidence is tied to the alpha.2 source tag. RC4 evidence is tied to the alpha.4 tag and the exact local package/profile recorded by the active receipt.
- New Inbox items retain a bounded opaque local DSH session handle when the host provides one. The jump action uses the native `sessions.open(SessionId)` contract; historical items created before the handle was stored remain available in Inbox and show that a direct session link is unavailable.
- Liveness is conservative: session heartbeat silence produces a suspected-stall C2; a C3 host failure requires a failed local HTTP probe.
- Native Windows Toast is not a hard dependency in this RC. Browser and Web fallback behavior is the supported cross-platform path.
- The RC4 WebUI checks cover emulated touch input, forced-colors rendering, semantic roles, six viewport sizes, and the notification return handler with target-item positioning. Physical touch hardware, real Screen Reader output, and OS-level notification delivery remain post-release supplemental checks.
- Model-assisted judgment, Done Verification, Watcher Swarm, tray persistence, and organization policy are intentionally deferred to later versions; deterministic policy is complete for this RC's defined feature set.
- Alpha.4 introduces branded Session sequence types for internal session loading while keeping `sessions.open(SessionId)` available to this plugin. If a future DSH release changes an event payload, Settings scope, Tool contract, or WebServer API, update this matrix and `docs/dsh-surface-audit.md` before changing the provider, then rerun the full release receipt.
