# Compatibility matrix

## Verification scope

DeepCanary records the current RC4 engineering candidate, the published RC3/immutable RC1 results, historical releases, and distribution-package checks separately. This keeps each identity reproducible while compatibility with DSH advances:

1. **0.1.1-rc.4 engineering candidate** — the current alpha.5 build, Session v2 adapter changes, cached build identity, and independent alpha.13 canary.
2. **0.1.1-rc.3 published baseline** — the published alpha.5 source/build and package identity used by the `next` channel.
3. **0.1.1-rc.1 published prerelease** — the exact official `dsh-v0.1.2-alpha.5` source tag, immutable plugin revision, and verified package contents.
4. **Historical RC.4 / RC.2** — the exact official alpha.4/alpha.2 source tags and their matching plugin records.
5. **Distribution package** — the package layout, built `lib/`, bundle patch, candidate tarball, and peer ranges consumed by DSH.

`0.1.1-rc.4` is the current local candidate; it has no remote publication identity. `0.1.1-rc.3` is the published baseline and `0.1.1-rc.1` remains available as an immutable historical installation baseline. Historical RC4 and earlier results remain available for comparison. The alpha.5 evidence is recorded in [`benchmark/alpha5-compatibility-receipt.json`](../benchmark/alpha5-compatibility-receipt.json); the historical alpha.4 evidence remains in [`benchmark/release-candidate-receipt.json`](../benchmark/release-candidate-receipt.json). The earlier alpha.3 browser record remains in [`benchmark/alpha3-compatibility-receipt.json`](../benchmark/alpha3-compatibility-receipt.json).

The previous v0.1.0-rc.3 tag remains historical for comparison; its npm version was withdrawn and cannot be reused.

The official upstream tag and Release for alpha.5 were verified on 2026-09-02. The current test baseline is `dsh-v0.1.2-alpha.5` at the immutable commit `db6bdc3576c2d4e7c965e8e3ed0c2a731eed87f5`; the alpha.5 release notes identify upgrade-time startup and session-title recovery as the upstream focus. The plugin's required WebUI and tool surfaces were revalidated against this runtime.

## Independent alpha.13 compatibility lane

The alpha.13 lane is intentionally separate from the alpha.5 build and release lane. It uses the official DSH `dsh-v0.1.3-alpha.1` tag at commit `d347e703908d0406b7a7ef80e3a0e594d86b2215`, a local source checkout, and a fresh isolated Web profile. Run `npm run build:alpha13`, create one frozen `output/local-pack/dsh-deepcanary-0.1.1-rc.4.tgz`, install that exact package in the isolated profile, complete the authenticated Edge/WebUI observation, write a sanitized UI evidence JSON, and then run `npm run compatibility:alpha13` with `DSH_ALPHA13_RUNTIME`, `DSH_ALPHA13_PROFILE`, `DSH_ALPHA13_PACKAGE`, and `DSH_ALPHA13_UI_EVIDENCE` set for the actual paths. The script records runtime version/commit, package-byte identity, public session-list and `snapshotEvents()` surfaces, the public runtime contract, Web response, UI observation, and privacy flags separately.

This canary proves a compatibility composition only. It does not change the alpha.5 runtime baseline, does not promote alpha.5 dogfood or Windows evidence, and does not assume that the `0.1.3-alpha.1` DSH prerelease is available from npm. Keep the resulting report under the local ignored output area or bind it to a new candidate record; never edit historical receipts to add alpha.13 facts.

| Component | 0.1.1-rc.4 candidate | 0.1.1-rc.3 published baseline | Historical records |
| --- | --- | --- | --- |
| DSH | alpha.5 build; alpha.13 isolated canary | `dsh-v0.1.2-alpha.5` | RC4 uses alpha.4; RC2 uses alpha.2 |
| DSH commit | alpha.5 `db6bdc3576c2d4e7c965e8e3ed0c2a731eed87f5`; alpha.13 `d347e703908d0406b7a7ef80e3a0e594d86b2215` | `db6bdc3576c2d4e7c965e8e3ed0c2a731eed87f5` | Keep each immutable upstream commit with its evidence |
| Plugin | local `0.1.1-rc.4` tgz; no remote tag/release | `v0.1.1-rc.3` GitHub/npm `next` | Historical tags/assets remain immutable |
| Node.js | `22.19+` | `22.19+` | Local Windows verification uses `v24.19.0`; current DSH packages declare the same supported range |
| pnpm | `11.7.0` | `11.7.0` | Invoke as `npx --yes pnpm@11.7.0` |
| Windows x64 | supported | supported | Browser Notification and Web Inbox are the baseline sinks |
| WSL2 Ubuntu | supported | supported | `/mnt/<drive>` paths normalize to the Windows workspace identity; interop is capability-detected |
| Historical npm `0.1.1-rc.2` / plugin `v0.1.0-rc.1` | historical | historical | Use only with its matching historical runtime record |

## DSH interfaces used

| Interface | Required for mount | Behavior when present | Fallback |
| --- | --- | --- | --- |
| `@deepseek-ai/dsh-session` | yes | Session lifecycle and event feed | Plugin does not claim a valid mount without Session |
| `ctx.sessions.list()` / `Session.snapshotEvents()` | verified against alpha.5 and alpha.13 public Session v2 | RC3 authoritative startup reconciliation, Human Needed reconstruction, orphan grace, and exact event-sequence metadata | Reconciliation status remains `unavailable` when the host composition omits the public list surface |
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

The Web UI uses the DSH alpha.5 client-module interfaces: the plugin manifest exposes `dsh.client` and `./client`, and the host provides the `sidebar.footer.action`, `shell.overlay`, and `settings.plugin.item` slots. The state response also exposes the reconciliation phase, epoch, authoritative flag, verification flag, and bounded event counts. The RC4 candidate adds no private alpha.13 client API; its alpha.13 canary confirms the installed package and public Session v2 contract separately.

For the current candidate, build and freeze one local tgz, bind its hash to the canary and Gate report, and verify `dsh --profile web --dump-config`, the DeepCanary health, state/reconciliation, and OutcomeReceipt routes, the nine registered tools, and the client-module boot graph in the isolated alpha.13 profile. For the published baseline, use its immutable GitHub tag, Release asset, or npm `next` package; do not use the candidate to amend the published receipt. The alpha.5 receipt records the historical published runtime, profiles, package digest, public-tag installation, npm metadata, and regression result. Historical RC4 and RC2 installation commands remain tied to their original runtimes.

## Known limitations

- Historical RC2 evidence is tied to the alpha.2 source tag. Historical RC4 evidence is tied to the alpha.4 tag and its exact package/profile. Published RC1 and RC3 evidence is tied to alpha.5 and its exact package/profile. The current RC4 candidate is local-only and must use a fresh package/profile identity.
- New Inbox items retain a bounded opaque local DSH session handle when the host provides one. The jump action uses the native `sessions.open(SessionId)` contract; historical items created before the handle was stored remain available in Inbox and show that a direct session link is unavailable.
- Liveness is conservative: session heartbeat silence produces a suspected-stall C2; a C3 host failure requires a failed local HTTP probe.
- Windows OS-visible browser notification delivery is a documented evidence gate; the Web Inbox remains available across notification-permission states.
- Browser delivery uses a bounded server-side logical claim with at most three claim opportunities and finite retry states; a constructed notification without observed visibility remains `unknown`, and no cross-crash or cross-OS exactly-once guarantee is made.
- Dogfood review coverage uses only unique final delivery units with explicit visible-delivery evidence. Review source/basis/confidence and task intent remain separate from usefulness and capture provenance; materialized units and unknown visibility do not satisfy the visible denominator.
- Each `dsh web` start creates a fresh launch token. After restarting DSH, open the URL printed by the new process so the browser can exchange the new token for its session cookie. The alpha.5 Gateway retains the 2-second Ping/Pong heartbeat; a brief host event-loop or network stall can therefore produce a reconnect indicator.
- The Persistent Supervisor prototype writes a bounded snapshot and short-lived lease, exposes read-only diagnostics, retries while a fresh lease is held by another instance, and protects against competing owners. Its snapshot includes versioned dedupe hashes, interrupt-budget timestamps, and a bounded logical browser delivery ledger with idempotent attempt transitions. The prototype is experimental and off by default; Windows OS-visible evidence still requires a real observation bound to that attempt. The current candidate retains the public session-list reconciliation slice, startup Human Needed reconstruction, previously observed-session disposal convergence, timestamp-only orphan grace, immediate authoritative-return cleanup, parent-session completion summaries, and three-restart policy continuity regression coverage. The virtual-clock soak report supplies supplemental boundedness evidence; real elapsed-time soak, OS delivery-state convergence, and cross-process orphan handling remain Gate E work.
- The RC4 WebUI checks cover emulated touch input, forced-colors rendering, semantic roles, six viewport sizes, and the notification return handler with target-item positioning. Physical touch hardware, real Screen Reader output, and Windows OS-visible browser notification delivery remain separate supplemental checks.
- Model-assisted judgment, Done Verification, Watcher Swarm, tray persistence, and organization policy are intentionally deferred to later versions; deterministic policy is complete for this RC's defined feature set.
- Alpha.5 includes the upstream persistence compatibility repair for upgrades from older DSH runtimes while keeping `sessions.open(SessionId)` available to this plugin. If a future DSH release changes an event payload, Settings scope, Tool contract, or WebServer API, update this matrix and `docs/dsh-surface-audit.md` before changing the provider, then rerun the full release receipt.
