# Web and Desktop verification

DeepCanary 0.1.4-rc.1 targets official DSH 0.2.0-rc.2 at commit `639ed015397290b3745d163aafe02ffee4aa3f84`. Both surfaces use authenticated Connection Fetch routes, Host settings and the deterministic attention core. Each profile owns its state.

## Development checks

- Public Connection integration verifies authentication, trusted Host/Origin, bounded bodies, route disposal and removal of legacy endpoints.
- Public Settings integration verifies revision conflicts, preserved drafts, discard, inherited values and reload. Only an accepted Host transaction counts as a save.
- Session integration verifies authoritative questions, timeout degradation, answer closure and parallel long-tool progress.
- Desktop official-manager installation and a cold restart load the new routes and synchronize the retained Inbox.
- Completed-session navigation checks exact membership in the public client catalog before returning to retained history. Missing targets show an unavailable notice.
- Web development uses an independent profile and port. Frozen-package installation and runtime observations are recorded separately in the release receipt.

Byte verification establishes installed contents; foreground observations establish loading and navigation. OS delivery requires its own observations.

## Notification scope

Renderer notifications depend on permission, a running renderer, quiet hours, budget and page arbitration. Notification construction and click-handler attachment retain their own evidence stages. OS Toast delivery, notification-center retention, hidden-window reveal and full-exit operation have no guarantee in this RC.

The released Desktop exposes same-origin forwarding for authenticated requests. Third-party notification, window-reveal and background capabilities remain an upstream bridge gap. Supervisor remains experimental and disabled by default. Windows is the current development platform; extended soak and additional platforms require separate evidence.

## Installation boundary

Use the official Desktop plugin manager for Desktop packages. The source CLI manages Web profiles. Keep daily settings, sessions and credentials in place; use an isolated test profile for development. Historical candidate receipts and frozen bytes retain their original identities.
