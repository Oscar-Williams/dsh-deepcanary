# Compatibility and troubleshooting

## Current baseline

DeepCanary **0.1.6-rc.1** is a local candidate for released DSH **0.2.1-rc.2** on WebUI and official Windows Desktop. The release tag points to `687f282e8625c6b8d11ff58211a90524be2e4317`. `engines.dsh` declares this version. Runtime checks resolve the explicitly selected installation through `DSH_RUNTIME`.

| Surface | Coverage and scope |
| --- | --- |
| Deterministic core | Human Needed authority, C3 boundaries, parallel long tools, recovery, deduplication, completion summaries and notification arbitration have regression coverage. |
| Host integration | Public Session/question projection, revision-aware Settings and authenticated Connection Fetch contracts use the selected released runtime. Public Cordis effects await state writes during plugin replacement. |
| Background work | Public owned Job Registry events supply progress counts and outcomes. Replacement restores bounded watches; authoritative Session lifecycle facts resolve missed outcomes. Missing authority stays unknown. |
| Windows WebUI / Edge | Current development entry; authenticated communication, loading, settings and Inbox presentation receive device checks for this release. |
| Windows Desktop | Shared core and public same-origin renderer communication; targeted loading/settings/navigation checks accompany common-code changes. |
| Native Windows notifications | Permission, OS settings and Host/renderer lifecycle affect delivery. Toast visibility, Notification Center retention and real click return require device observations for the exact package. |
| Hidden Desktop window | Native window reveal and OS background delivery await a public plugin bridge. Host-owned background Job tracking follows the running Host lifecycle. |
| Other systems | CI source checks provide the scope named by their jobs. Native delivery and long-duration acceptance are separate. |
| Supervisor | Experimental, disabled by default, bounded local projection while its owning Host runs. |

This is an RC. Default npm installation channels and automated checks do not establish Stable device guarantees. Release-specific receipts record the package hash and actual observed coverage.

## Installation and restart

Use the official manager on Desktop and an explicit **web** profile with the CLI. Follow the [README](../README.md) commands. A successful installation can require a Host restart before the new module loads. Save active work first; confirm the runtime version and package identity after restart. Installation-file matching and active-module matching are separate checks.

In DSH Settings, select **Built-in plugins → DeepCanary**. Host configuration owns persistence. A revision conflict preserves the draft and the newer saved value. Discarding the draft reads a fresh basis for editing. Missing persistence capability or a communication failure is shown explicitly.

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

Historical alpha.13 script names refer to DSH `0.1.3-alpha.1`, commit `d347e703908d0406b7a7ef80e3a0e594d86b2215`. Current development commands use the released runtime selected through `DSH_RUNTIME`.
