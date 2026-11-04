# Public DSH interfaces

The current integration targets DSH 0.2.2-alpha.3 and 0.2.1-rc.5. The same package loads in WebUI and Windows Desktop. Runtime contracts select an actual installation through `DSH_RUNTIME`.

| Interface | DeepCanary use |
| --- | --- |
| Session store and lifecycle | Read snapshots, sequence boundaries, turn outcomes, and retained session identity |
| Question and approval projections | Track each current human request and its authoritative settlement |
| Job Registry | Observe native owner, lifecycle, output counts, and settlement |
| Agent and subagent events | Associate native parentage and execution failures |
| Automation | Associate schedule occurrence, delivery, target session, and admitted execution |
| Settings and ConfigForm | Read configuration and submit transactions with an expected revision |
| Connection Fetch | Register authenticated routes with bounded requests and owner disposal |
| Session navigation | Validate the current catalog target and open its exact session |
| UI slots | Contribute the inbox, sidebar entry, and settings |
| alpha.3 context menu and icon | Register unified mouse/keyboard menus and a settings navigation icon |
| Cordis effects | Dispose registrations and await pending state writes |

RC5 uses its public extension slots for equivalent actions. Optional alpha.3 services are resolved by capability and released with their owner.

## HTTP and Desktop transport

Routes under `/api/dsh-deepcanary/` use the host's authenticated Connection Fetch registry. Writes have a 32,000-byte body cap. Client actions use relative endpoints, request identities, revision checks, and notification generations.

Desktop forwards the same paths through its `dsh-app://app` origin. The plugin uses the public renderer notification and session-navigation capabilities. System banners and return from hidden windows have actual device evidence.

Fully exiting the Desktop application stops the host and renderer. Continuous operation after exit would require a separate public host lifecycle and its own implementation.

## Updating a host

Inspect the changed public interfaces and run the affected contracts against the new installation. Verify the changed behavior in the real application. Record a new host as tested only after those observations.

The source pins and actual Desktop build identities are listed in [Compatibility](compatibility.md). Historical records keep their original pins.
