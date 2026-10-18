# Security and privacy

Scheduled reminders store bounded generations and timestamps alongside the existing Inbox metadata. Dedupe, budget and delivery state use hashes, enums and times with fixed record limits. A send claim must persist before construction is authorized. Current item state, generation, mute, quiet policy and restored C3 authority constrain delivery. Late callbacks cannot update a newer arrangement.

## Stored data

DeepCanary stores bounded reminder metadata in the current Host profile's state directory: event classes, levels, lifecycle timestamps, hashed references, explicit feedback and the local session handle required for navigation. Optional capture stores sanitized observations with provenance and task ownership. Supervisor stores bounded projections and lease metadata when explicitly enabled.

Conversation text, prompts, model output, tool arguments and API credentials remain outside captured reminder state. Feedback uses bounded enums; optional note content is reduced by the existing privacy-safe handling. Atomic writes replace local state. Retention caps bound Inbox, receipts, delivery claims and action idempotency records.

Background watches share the atomic Inbox file. At most 256 records retain hashed job references, local owner-session handles, kind/state enums and start times. Increasing byte counts and activity times remain in bounded memory. Job labels, progress strings, output, spill paths and terminal detail stay in DSH. Reconciliation requires original-owner matches; missing facts preserve uncertainty. The observer uses list and lifecycle subscriptions, and leaves job execution controls with the Host.

## Authenticated interfaces

All plugin HTTP routes use the Host's public `connection.fetch.register()` beneath `/api/dsh-deepcanary/*`. DSH applies browser authentication and Host/Origin trust checks before dispatch. The previous direct, unauthenticated WebServer routes are closed. The plugin reads no authentication tokens and supplies no alternative authentication or configuration store.

Reads use `cache-control: no-store`. JSON mutation requests require `application/json`, an object payload and a maximum of 32,000 bytes; write routes use the public streaming mode, stop consumption at that bound and let the Host bridge close unread requests after responding. This avoids the Host's larger RPC/image buffering allowance. Read routes retain the buffered Host mode. Error responses use fixed public messages, preserving internal errors and local paths outside responses. Missing-item responses omit arbitrary submitted identifiers.

`GET /state`, `/settings`, `/health`, `/explain`, `/outcomes` and `/supervisor` are bounded reads. `POST /action`, `/outcome`, `/dry-run` and filtered `/outcomes/delete` use existing service validation. All paths above are relative to `/api/dsh-deepcanary`. Outcome withdrawal requires an explicit trial or cutoff; malformed filters produce no mutation. Settings writes use the Host ConfigForm service with revision fencing.

Authenticated clients may inspect local metadata and apply allowed reminder actions. These actions cover acknowledgement, snooze, mute, suppression, feedback, refresh, navigation and notification delivery accounting. Dry-run operates on allowlisted facts and policy fields. Host self-checks read in-process service facts and perform no credential-dependent HTTP probe.

## Client and navigation

Runtime values enter DOM through `textContent`. Client requests permit only exact plugin endpoints on the current origin. Navigation uses the public Host workspace capability and actual stored session identity. An unavailable target produces an availability message.

Browser notification permission is explicit. Server-owned expiring claims arbitrate pages, with bounded attempts. Constructor success and callback attachment retain their limited meaning; OS-visible delivery remains unknown until observed. The renderer and Host must remain running for the notification path.

## Evidence and policy

C3 requires Host/runtime authority. Heuristic and model suggestions cannot independently create C3 or weaken authoritative Human Needed. Captured source, declared task origin and task ownership remain explicit; unknown and controlled records stay outside qualified natural counts. User usefulness is supplied through explicit feedback. Offline evaluation and local policy adoption have distinct identities.

The model-Judge gate permits only categorical facts, authority, counts, time buckets and rule results. Future offline use additionally requires bounded attempts, timeout/cancellation and enum-only output. Current release uses deterministic live policy.

## Upgrade lifecycle

Plugin unload uses a public Cordis effect that awaits pending profile-state and receipt writes. The replacement service reads committed state before reconciling current Host facts. Write failure retains its existing error reporting and cannot become a successful persistence claim.

## Deployment and reporting

DSH owns the authentication and trust boundary. Deployments should preserve its admission checks and use protected transport where needed. Credentials remain with the Host's credential service. Desktop uses public renderer transport; signed application resources and private Electron APIs are outside plugin implementation.

Before publication, review the explicit Git snapshot, complete pending push range and actual tgz for secrets, private paths, raw samples and authentication URLs. Publish only allowlisted package files; local design material, machine-specific maintenance files and raw browser logs remain local. Scanner output records file locations and issue categories without secret values.

Report security issues through the repository's private security reporting facility when available. Supply affected versions and a sanitized reproduction.
