# Compatibility

DeepCanary is a prerelease plugin for DSH Web. The current default is `0.1.1-rc.5`, available through both npm `latest` and `next`. Use a pinned plugin version when you need reproducible behavior. `latest` selects the default installation; it does not certify Stable readiness.

## Runtime coverage

| Host | Coverage | Scope |
| --- | --- | --- |
| DSH `0.1.2-alpha.5` | Build and CI baseline | Published npm types, public Session API tests, Windows/Ubuntu on Node 22 and 24, and an Ubuntu WebUI smoke test |
| DSH `0.1.3-alpha.1` | Separately verified with RC4 | Public Session v2 contract, frozen-package installation, authenticated Windows/Edge WebUI, and lifecycle checks using the official source checkout |
| Other DSH versions | Not validated for this release | Shared version ranges or a successful install alone do not establish compatibility |

The official source pins are:

- `dsh-v0.1.2-alpha.5`: `db6bdc3576c2d4e7c965e8e3ed0c2a731eed87f5`.
- `dsh-v0.1.3-alpha.1`: `d347e703908d0406b7a7ef80e3a0e594d86b2215`. This is called the **alpha.13 lane** in the development scripts.

RC5 improves documentation, interface wording, build validation, test portability, and experimental Supervisor startup/shutdown ordering. Its adapter and notification policy are unchanged from RC4. The alpha.13 WebUI and Windows desktop observations remain RC4 evidence, not new RC5 device tests. See the [release records](https://github.com/Oscar-Williams/dsh-deepcanary/tree/main/benchmark) and [CI](https://github.com/Oscar-Williams/dsh-deepcanary/actions/workflows/ci.yml) for version-specific results.

## Platform coverage

| Environment | What is covered | What is not established |
| --- | --- | --- |
| Windows x64 + Edge | Web Inbox; RC4 OS-visible notifications, notification-center retention, and click-to-session behavior | Delivery under every permission, focus, sleep, or browser lifecycle state |
| Ubuntu CI + Chromium | Automated WebUI and package checks | Linux desktop notification delivery |
| WSL2 + Windows browser | Path normalization and capability-detected interop in tests | Current-runtime end-to-end desktop delivery; this lane remains pending |
| macOS or other browsers | No release-level device validation | Native notification and accessibility behavior |

Requires Node.js `22.19+`; CI uses `22.19.0` and `24.19.0`. Source-checkout commands use pnpm `11.7.0`.

## Notification behavior

The Web Inbox is the baseline. Browser notifications are an optional delivery surface that needs both browser permission and operating-system permission.

- DSH and the web page must remain running. DeepCanary does not deliver through a closed page or provide a separate tray daemon.
- Competing tabs use a bounded server-side claim to reduce duplicate notifications. Retries are finite; delivery is not guaranteed exactly once across crashes or OS boundaries.
- A constructed notification is not proof of on-screen visibility. Unknown delivery remains unknown.
- Suspected stalls are conservative check-in suggestions. Host-failure escalation requires an actual host-health observation.
- Old Inbox entries without a stored local session handle remain readable but cannot link directly to the original session.
- Persistent Supervisor is experimental and off by default. Restart continuity, resource behavior, and long-duration operation still need broader validation before a Stable claim.
- Physical touch and screen-reader output remain unvalidated; automated checks of roles, keyboard interaction, forced colors, and responsive layout do not replace those device checks.

## Troubleshooting

**No DeepCanary entry:** confirm that the plugin was installed into the profile you run. Use `dsh --profile web --dump-config` to check the bundle. After finishing active tasks, restart DSH and open its newly printed URL.

**The page reconnects after a restart:** every DSH Web start creates a new launch token. An old bookmarked launch URL may no longer authenticate. Use the URL from the current process; do not share it in an issue.

**Inbox works but desktop notifications do not:** check the browser permission, OS notification settings, focus/do-not-disturb mode, and whether the DSH page is still open. The Inbox remains available when desktop delivery is unavailable.

**npm cannot find the version:** a registry mirror may lag. Select the official npm registry (`https://registry.npmjs.org/`) for your installation or use the fixed `.tgz` from [GitHub Releases](https://github.com/Oscar-Williams/dsh-deepcanary/releases).

## Integration details

The [DSH surface audit](dsh-surface-audit.md) lists required and optional services, public APIs, and fallbacks. The [development guide](development.md) explains isolated runtime checks. Compatibility results belong to their exact plugin artifact and DSH revision; historical receipts are retained without being relabeled as current tests.
