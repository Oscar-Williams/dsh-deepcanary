# Compatibility and troubleshooting

## Current baseline

DeepCanary **0.1.4-rc.1** targets the published DSH **0.2.0-rc.2**, tag `dsh-v0.2.0-rc.2`, commit `639ed015397290b3745d163aafe02ffee4aa3f84`. Runtime contracts and dependencies are checked against this pin. Future host versions require their own compatibility evidence.

| Surface | Coverage and scope |
| --- | --- |
| Deterministic core | Human Needed authority, C3 boundaries, parallel long tools, recovery, deduplication, completion summaries and notification arbitration have regression coverage. |
| Host integration | Public Session/question projection, revision-aware Settings and authenticated Connection Fetch contracts use the pinned source. |
| Windows WebUI / Edge | Current development entry; authenticated communication, loading, settings and Inbox presentation receive device checks for this release. |
| Windows Desktop | Shared core and public same-origin renderer communication; targeted loading/settings/navigation checks accompany common-code changes. |
| Native Windows notifications | Permission, OS settings and Host/renderer lifecycle affect delivery. Toast visibility, Notification Center retention and real click return require device observations for the exact package. |
| Hidden Desktop window | Public plugin window-wake/background capability is unavailable at this baseline. Renderer notifications retain that lifecycle limit. |
| Other systems | CI source checks provide the scope named by their jobs. Native delivery and long-duration acceptance are separate. |
| Supervisor | Experimental, disabled by default, bounded local projection while its owning Host runs. |

This is an RC. Default npm installation channels and automated checks do not establish Stable device guarantees. Release-specific receipts record the package hash and actual observed coverage.

## Installation and restart

Use the official manager on Desktop and an explicit **web** profile with the CLI. Follow the [README](../README.md) commands. A successful installation can require a Host restart before the new module loads. Save active work first; confirm the runtime version and package identity after restart. Installation-file matching and active-module matching are separate checks.

Settings live under **Settings → Plugins → DeepCanary**. Host configuration owns persistence. A revision conflict preserves the draft and the newer saved value. Discarding the draft reads a fresh basis for editing. Missing persistence capability or a communication failure is shown explicitly.

## Troubleshooting

- **The panel reports communication failure:** reopen the authenticated URL printed by DSH, then refresh. Plugin endpoints are protected under `/api/dsh-deepcanary/*`; unauthorized requests return 401 and untrusted Host/Origin requests return 403.
- **A reminder is visible without a notification:** check the configured minimum level, quiet hours, hourly budget, suppression, browser permission and OS notification settings. Inbox remains available when notification permission is denied.
- **A return target is unavailable:** retain the summary and inspect its availability message. Navigation uses the item's actual session and question identity.
- **Installed version differs from runtime:** finish active tasks and follow the Host's restart prompt. Verify the loaded module after restart.
- **A package mirror lags:** use the official npm registry or the exact release tgz.

## Historical lanes

Historical receipts retain their original package and host identities. They provide reproduction context for those versions.

| Plugin | Host lane |
| --- | --- |
| 0.1.1-rc.6 | Published historical RC6, DSH 0.1.2-alpha.5. |
| 0.1.1-rc.7 | Frozen local candidate with a confirmed settings-concurrency defect. |
| 0.1.2-rc.1 / rc.2 | Local DSH 0.2 migration, revision-fenced settings and parallel-tool repair. |
| 0.1.3-rc.1 | Local feedback/source-chain, evaluation and opaque Inbox iteration. |

Historical alpha.13 script names refer to DSH `0.1.3-alpha.1`, commit `d347e703908d0406b7a7ef80e3a0e594d86b2215`. Current release commands use the 0.2 lane.
