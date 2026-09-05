# Compatibility matrix

## Verification scope

DeepCanary records the current RC3 release, the immutable RC1 result, historical releases, and distribution-package checks separately. This keeps each identity reproducible while compatibility with DSH advances:

1. **0.1.1-rc.3 release** — the RC3 source, built `lib/`, alpha.5 public session APIs, reconciliation tests, and the package identity recorded by the release receipt.
2. **0.1.1-rc.1 published prerelease** — the exact official `dsh-v0.1.2-alpha.5` source tag, the immutable `v0.1.1-rc.1` plugin revision, and the verified package contents.
3. **RC.4 public prerelease** — the exact official `dsh-v0.1.2-alpha.4` source tag, the public `v0.1.0-rc.4` plugin tag and Release asset, and its historical receipt.
4. **Historical RC.2** — the exact official `dsh-v0.1.2-alpha.2` source tag and public `v0.1.0-rc.2` plugin tag.
5. **Distribution package** — the package layout, built `lib/`, bundle patch, immutable Git tag, npm metadata, and peer ranges consumed by DSH.

`0.1.1-rc.3` is the current release identity and `0.1.1-rc.1` remains available as an immutable historical installation baseline. The RC4 and earlier results remain available for comparison. The alpha.5 RC1 evidence is recorded in [`benchmark/alpha5-compatibility-receipt.json`](../benchmark/alpha5-compatibility-receipt.json); the RC4 evidence remains in [`benchmark/release-candidate-receipt.json`](../benchmark/release-candidate-receipt.json). The earlier alpha.3 browser record remains in [`benchmark/alpha3-compatibility-receipt.json`](../benchmark/alpha3-compatibility-receipt.json).

The previous v0.1.0-rc.3 tag remains historical for comparison; its npm version was withdrawn and cannot be reused.

The official upstream tag and Release for alpha.5 were verified on 2026-09-02. The current test baseline is `dsh-v0.1.2-alpha.5` at the immutable commit `db6bdc3576c2d4e7c965e8e3ed0c2a731eed87f5`; the alpha.5 release notes identify upgrade-time startup and session-title recovery as the upstream focus. The plugin's required WebUI and tool surfaces were revalidated against this runtime.

| Component | 0.1.1-rc.3 release | 0.1.1-rc.1 historical prerelease | RC.4 / historical RC.2 |
| --- | --- | --- | --- |
| DSH | `dsh-v0.1.2-alpha.5` | `dsh-v0.1.2-alpha.5` | RC.4 uses alpha.4; historical RC.2 uses alpha.2 |
| DSH commit | `db6bdc3576c2d4e7c965e8e3ed0c2a731eed87f5` | `db6bdc3576c2d4e7c965e8e3ed0c2a731eed87f5` | Immutable upstream commits used for reproducibility |
| Plugin | `v0.1.1-rc.3` GitHub tag, Release asset, and npm `next` | `v0.1.1-rc.1` GitHub tag, Release asset, and npm history | Keep each plugin revision and DSH runtime in the same acceptance record |
| Node.js | `22.19+` | `22.19+` | Local Windows verification uses `v24.19.0`; current DSH packages declare the same supported range |
| pnpm | `11.7.0` | `11.7.0` | Invoke as `npx --yes pnpm@11.7.0` |
| Windows x64 | supported | supported | Browser Notification and Web Inbox are the baseline sinks |
| WSL2 Ubuntu | supported | supported | `/mnt/<drive>` paths normalize to the Windows workspace identity; interop is capability-detected |
| Historical npm `0.1.1-rc.2` / plugin `v0.1.0-rc.1` | historical | historical | Use only with its matching historical runtime record |

## DSH interfaces used

| Interface | Required for mount | Behavior when present | Fallback |
| --- | --- | --- | --- |
| `@deepseek-ai/dsh-session` | yes | Session lifecycle and event feed | Plugin does not claim a valid mount without Session |
| `ctx.sessions.list()` / `Session.snapshotEvents()` | supplied by alpha.5 Session service | RC3 authoritative startup reconciliation, Human Needed reconstruction, orphan grace, and exact event-sequence metadata | Reconciliation status remains `unavailable` when the host composition omits the public list surface |
| `@deepseek-ai/dsh-tools` | yes for model tools | Registers the nine `deepcanary_*` tools, including explanation and read-only dry-run | Web and local service remain usable if tool registration is unavailable |
| `@deepseek-ai/dsh-agent` | no | Agent error provider | Session facts remain available |
| `@deepseek-ai/dsh-subagent` | no | Active Subagent pressure provider | Pressure signals remain inactive |
| `@deepseek-ai/dsh-host-webserver` | no | State, settings, health, action, OutcomeReceipt, Supervisor, and client routes | Model tools and local persistence remain available |
| `@deepseek-ai/dsh-settings` | no | Live `dsh-deepcanary` namespace | Bundle configuration remains authoritative |

## Windows and WSL behavior

`getWorkspaceIdentity()` exposes a canonical ID plus optional host and WSL paths. The implementation covers Windows drive paths, `/mnt/c/...` paths, CJK directories, WSL interop availability, and an explicit `DSH_DEEPCANARY_WINDOWS_INTEROP=0` fallback override.

The supported notification path is:

1. Browser Notification API after user permission;
2. Windows OS-visible browser notification delivery when the browser and Windows notification settings allow it;
3. the DSH client-module Web Inbox;
4. model-visible status and Inbox tools.

The Web path remains independent of a native companion. `nativeToast` and `windowsInterop` are capability fields that describe the current host surface.

The Web UI uses the DSH alpha.5 client-module interfaces: the plugin manifest exposes `dsh.client` and `./client`, and the host provides the `sidebar.footer.action`, `shell.overlay`, and `settings.plugin.item` slots. The state response also exposes the RC3 reconciliation phase, epoch, authoritative flag, verification flag, and bounded event counts. Historical packages retain their original interface scope; the RC3 package provides the current four interaction gates and the standard settings card.

For `0.1.1-rc.3` verification, use the immutable GitHub tag, Release asset, or npm `next` package and bind its package hash to the release receipt. The immutable `0.1.1-rc.1` package remains available for historical comparison. Verify `dsh --profile web --dump-config`, the DeepCanary health, state/reconciliation, and OutcomeReceipt routes, the nine registered tools, and the client-module boot graph in a fresh isolated profile. The alpha.5 receipt records the RC1 runtime, profiles, package digest, public-tag installation, npm metadata, and regression result. The RC4 and historical RC2 installation commands remain tied to their original runtimes and are retained for reproduction.

## Known limitations

- Historical RC2 evidence is tied to the alpha.2 source tag. RC4 evidence is tied to the alpha.4 tag and its exact package/profile. Published RC1 evidence is tied to the alpha.5 tag and the exact package/profile recorded by the immutable receipt. RC3 release evidence is tied to its source commit and package digest.
- New Inbox items retain a bounded opaque local DSH session handle when the host provides one. The jump action uses the native `sessions.open(SessionId)` contract; historical items created before the handle was stored remain available in Inbox and show that a direct session link is unavailable.
- Liveness is conservative: session heartbeat silence produces a suspected-stall C2; a C3 host failure requires a failed local HTTP probe.
- Windows OS-visible browser notification delivery is a documented evidence gate; the Web Inbox remains available across notification-permission states.
- Each `dsh web` start creates a fresh launch token. After restarting DSH, open the URL printed by the new process so the browser can exchange the new token for its session cookie. The alpha.5 Gateway retains the 2-second Ping/Pong heartbeat; a brief host event-loop or network stall can therefore produce a reconnect indicator.
- The Persistent Supervisor prototype writes a bounded snapshot and short-lived lease, exposes read-only diagnostics, retries while a fresh lease is held by another instance, and protects against competing owners. Its snapshot includes versioned dedupe hashes, interrupt-budget timestamps, and a bounded logical browser delivery ledger with idempotent attempt transitions. The prototype is experimental and off by default; Windows OS-visible evidence still requires a real observation bound to that attempt. RC3 adds the first public alpha.5 session-list reconciliation slice, startup Human Needed reconstruction, previously observed-session disposal convergence, timestamp-only orphan grace, immediate authoritative-return cleanup, and three-restart policy continuity regression coverage. The virtual-clock soak report supplies supplemental boundedness evidence; real elapsed-time soak, OS delivery-state convergence, and cross-process orphan handling remain Gate E work.
- The RC4 WebUI checks cover emulated touch input, forced-colors rendering, semantic roles, six viewport sizes, and the notification return handler with target-item positioning. Physical touch hardware, real Screen Reader output, and Windows OS-visible browser notification delivery remain separate supplemental checks.
- Model-assisted judgment, Done Verification, Watcher Swarm, tray persistence, and organization policy are intentionally deferred to later versions; deterministic policy is complete for this RC's defined feature set.
- Alpha.5 includes the upstream persistence compatibility repair for upgrades from older DSH runtimes while keeping `sessions.open(SessionId)` available to this plugin. If a future DSH release changes an event payload, Settings scope, Tool contract, or WebServer API, update this matrix and `docs/dsh-surface-audit.md` before changing the provider, then rerun the full release receipt.
