# Compatibility

DeepCanary 0.1.8 uses the same package on these hosts.

| DSH version | WebUI | Windows Desktop | WebUI Node.js requirement |
| --- | --- | --- | --- |
| 0.2.1-rc.5 | Verified | Official application verified | ^22.19.0 or >=24.0.0 |
| 0.2.2-alpha.3 | Verified | Fixed source build verified | >=24.9.0 |

The alpha.3 Desktop build uses source commit `05b1cae8db6e674c5685101494d4eec24652424a` and is unsigned. The tested official RC5 Desktop reports build commit `d4db512a969fccf0c5cc7ec8fe38e9c1d27af916`. The RC5 source tag is `b830ec950faba0a46dda564be3e2d854afed94f1`.

The package declares `engines.dsh = "0.2.1-rc.5 || >=0.2.2-alpha.3"`. Later releases can install without a whitelist change. A release is added to this verification table after actual use. Older DSH versions fall outside the supported range.

## Interface and notifications

Both hosts provide Pending, Snoozed, Activity, settings, session return, and the same window controls. alpha.3 adds its unified context menu and settings icon. RC5 uses its public session slots and the inbox menu.

Web notifications require permission for the DSH origin and a running page. Desktop notifications require a running application. Minimized and hidden Desktop operation, system notifications, and return to the corresponding reminder have been observed. Fully exiting the application stops its host and renderer.

Actual Edge browser zoom at 200% was checked at a 772×330 CSS viewport, with the panel and its controls inside the visible area. Zoom was restored to 100%. Trusted touch input was exercised through browser emulation. Physical touchscreen hardware and other operating systems have separate coverage.

## Host integration

| Area | Integration |
| --- | --- |
| Sessions | Public snapshots, lifecycle events, and sequence watermarks |
| Questions and approvals | Public authoritative state, exact call identity, and independent closure |
| Jobs and subagents | Native ownership, lifecycle, and settlement |
| Automation | Schedule occurrence, delivered message, and matching execution boundary |
| Settings | Revision checks through the host's ConfigForm |
| Transport | Authenticated Connection Fetch routes |
| Cleanup | Disposers release registrations, subscriptions, and effects |

The plugin supplies no second DSH service graph. Optional alpha.3 services are loaded by capability so RC5 can import the package. Developer details are in [Public DSH surfaces](dsh-surface-audit.md).
