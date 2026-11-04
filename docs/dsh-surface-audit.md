# Public DSH interfaces

[简体中文](dsh-surface-audit.zh-CN.md) · [Architecture](architecture.md)

The integration targets DSH 0.2.2-alpha.3 and 0.2.1-rc.5 on WebUI and Windows Desktop. Runtime contracts select an actual installation through `DSH_RUNTIME`.

| Interface | DeepCanary use |
| --- | --- |
| Session store and lifecycle | Read snapshots, sequence boundaries, turn outcomes, and retained session identity |
| Question and approval projections | Track each current human request and its authoritative settlement |
| Job Registry | Observe native ownership, lifecycle, output counts, and settlement |
| Agent and subagent events | Associate parentage and execution failures |
| Automation | Associate schedule occurrence, delivery, target session, and admitted execution |
| Settings and ConfigForm | Read configuration and submit transactions with an expected revision |
| Connection Fetch | Register authenticated routes with bounded requests and owner disposal |
| Session navigation | Validate the current catalog target and open its session |
| UI slots | Contribute the inbox, sidebar entry, and settings |
| alpha.3 context menu and icon | Register mouse and keyboard menus and a settings navigation icon |
| Cordis effects | Dispose registrations and await pending state writes |

RC5 uses public extension slots for equivalent actions. Optional alpha.3 services are resolved by capability and released with their owner.

## Transport

Routes under `/api/dsh-deepcanary/` use the host's authenticated Connection Fetch registry. Writes have a 32,000-byte body cap. Client actions use relative endpoints, request identities, revision checks, and notification generations.

Desktop forwards the same paths through its `dsh-app://app` origin. Notifications and navigation use public renderer capabilities. Fully quitting Desktop stops the host and renderer.

## Updating an integration

Inspect changes to the public interfaces used here. Run affected contracts against the new installation and test changed behavior in the application. Add a host to the tested range after these checks. [Compatibility](compatibility.md) lists source pins and tested Desktop builds.
