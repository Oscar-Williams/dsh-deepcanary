# Public DSH surfaces

DeepCanary 0.1.6-rc.4 uses released DSH 0.2.1-rc.2 for WebUI and official Windows Desktop, release tag `687f282e8625c6b8d11ff58211a90524be2e4317`. The generic Host contracts resolve the selected installation through `DSH_RUNTIME`.

| Public surface | Use and degradation |
| --- | --- |
| Session store/events and question projection | Subscribe/reconcile at public sequence watermarks; preserve unknown authority and pending question identities. |
| Public Job Registry and Session job lifecycle | Observe owner-scoped registration/settlement and output byte counts; reconcile durable owner-matched facts after replacement. Waited outcomes, cancellation and teardown remain quiet. |
| Tools | Bounded metadata reads, explicit reminder actions and read-only dry-run. |
| Optional Agent/Subagent events | Normalize runtime failures and bounded pressure; missing services leave their providers inactive. |
| Settings / ConfigForm | Host-owned schema, volatile snapshots and expected-revision transactions. Missing persistence is explicit. |
| Host Connection Fetch | Exact authenticated `/api/dsh-deepcanary/*` registrations, owner-scoped disposal and Host/Origin admission. Missing service gives no public fallback. |
| UI workspace | Open the exact live/historical session through the public `openSession()` capability and validate pending target identity. |
| UI layout/sidebar/settings/locale | Additive overlay/sidebar slots, keyed plugin settings and bilingual messages. |
| Cordis effects | Await subscription/timer cleanup and pending profile writes during plugin unload or replacement. |

## HTTP transport

GET routes expose bounded state, settings, health, explanation, outcomes and Supervisor status. POST routes perform existing actions, explicit feedback, dry-run and filtered receipt withdrawal at `/outcomes/delete`. Read routes use Host buffering. Write routes use the public streaming mode with a 32,000-byte plugin cap, so the Host's larger image/RPC buffer does not precede validation. Internal errors and arbitrary absent-item inputs are omitted from response bodies.

Client transport uses relative allowlisted endpoints. The released Desktop shell's `dsh-app://app` protocol forwards Host-backed requests through its product-owned authenticated carrier. DeepCanary invokes the same-origin path and imports no Electron implementation. Actual device coverage remains separate from this published-source observation.

## Desktop capability gap

The released Job Registry supports background work within the running Host. Renderer notifications and public session return provide the current reminder path. Native notification delivery, hidden-window reveal and execution after full application exit require a released third-party Desktop interface and device observations.

## Audit rule

Update this audit when a released Host contract changes. Recheck the fixed public type, Session, Settings and Connection seams, relevant lifecycle cases and the affected renderer. Preserve historical alpha.5 and alpha.13 results with their original pins.
