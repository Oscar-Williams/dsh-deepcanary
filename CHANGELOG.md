# Changelog

## 0.1.6-rc.3 — complete copy for historical and grouped reminders

- Show factual summary text when historical reminder metadata lacks duration, tool or count parameters. Grouped notification reasons use the same readable summaries; known values retain their detail.
- Retain the scheduled follow-up, durable state, authoritative escalation and background supervision capabilities below.

## 0.1.6-rc.2 — local candidate with scheduled follow-up and durable continuity

- Add scheduled work inside Inbox with due times, 5/15/30/60-minute rescheduling and restore-to-pending actions. Preserve the schedule while the user inspects its session.
- Give each explicit arrangement a delivery generation. Rearm due reminders under current quiet hours, budget and authoritative task state; reject stale claims and callbacks from earlier generations.
- Give an authoritative level escalation a fresh notification opportunity, including C2-to-C3 transitions after an earlier notification or snooze.
- Persist bounded dedupe, rolling budget and delivery claims in the existing atomic Inbox state during ordinary operation. Save a claim before authorizing notification construction.
- Continue dispatch beyond completed or exhausted claims, bound each pass and retry claim takeover through normal refreshes. Show exhausted delivery attempts while retaining the pending item. Recheck the current item before construction and keep stale clicks within Inbox.
- Retain human waits and scheduled work ahead of routine updates when Inbox reaches capacity. Keep C3 classification and task ownership in the existing deterministic core.

## 0.1.6-rc.1 — local candidate with background supervision and Inbox follow-up

- Follow owned background jobs through the released Job Registry and durable Session lifecycle. Keep running work quiet, summarize uncollected completions at C1 and surface producer failures at C2 with their exact owning session.
- Restore background watches after plugin replacement, collect missed outcomes once and retain unknown state when authority is unavailable. Bound watch metadata and recent settlement identities to 256 records with a seven-day observation window.
- Recognize increasing output byte counts as background activity, distinguish reply completion from ongoing background work and release progress grace when jobs settle.
- Order pending Inbox items by urgency and make further pages accessible. Explicit already-resolved feedback also marks its reminder handled while preserving later Human Needed generations.
- Read public tool-result error metadata and keep consecutive failure identity independent of tools being started. Genuine repeated failures are detected; distinct-tool failures retain their own counts.
- Align WebUI, official Windows Desktop, development dependencies and Host contracts with released DSH 0.2.1-rc.2.

## 0.1.5-rc.2 — local candidate, not published

- Correct the Desktop settings instructions after device use confirmed the **Built-in plugins** page on both supported hosts.
- Retain the RC1 runtime adaptation and awaited unload repair. RC1's frozen bytes remain available as the first local candidate.

## 0.1.5-rc.1 — local candidate, unpublished

- Target released DSH 0.2.1-rc.1 for Web and the current official Windows Desktop build, 0.2.0-rc.2; declare supported hosts with engines.dsh.
- Await pending reminder persistence during plugin teardown using the public Cordis effect lifecycle. Repeated disposal shares its completion, so replacement reads settled state.
- Exercise stopped and forked turn semantics, settings revisions, question recovery and authenticated transport against the selected runtime.
- Refresh local-candidate installation, manager update guidance, development checks and workspace entry points.


## 0.1.4-rc.1

- Protect all HTTP contributions through DSH's public authenticated Connection API; remove the legacy direct routes. Bound streaming JSON writes at 32,000 bytes and sanitize error responses.
- Read in-process Host facts for self-checks and remove local paths from public runtime status.
- Preserve revision-fenced settings, authoritative question lifecycle, parallel long-tool progress and completion recovery from the local 0.2 migration.
- Unify source ownership, feedback aggregation and independent policy evaluation; preserve unknown data and explicit adoption/rollback identity. Live thresholds remain unchanged.
- Refine opaque light/dark Inbox presentation, clean conflicting styles and document the current installation/profile workflow.
- Return completion summaries to retained history using exact public session-catalog membership; refuse absent or unready targets.
- Pin DSH 0.2.0-rc.2 contracts and retain RC limits for OS delivery, hidden-window wake-up, Supervisor and selective Judge.

## 0.1.3-rc.1 — local development, unpublished

- Preserve capture provenance independently of task origin; bind natural live recording, feedback and export to hashed task ownership. Legacy unknown records stay unknown. Aggregate separate natural, controlled, replay and unknown cohorts.
- Repair candidate evaluation: independent task holdout, bound code/package/settings identity, scope-aware passing and explicit adoption/rollback records. Evaluation does not adopt policy.
- Add a sanitized source-hashed case audit, failure taxonomy, negative-opportunity review and Judge feasibility screening. No qualifying model case exists yet; no model or Desktop private bridge is added.
- Redesign Inbox with opaque light/dark surfaces, clearer cards, blue primary actions, compact policy details and less repeated text. Preserve navigation, evidence, recovery and existing deterministic safety boundaries.
- Retain the 0.1.2-rc.2 parallel-tool fix and all historical frozen packages. No publication is authorized.

## 0.1.2-rc.2 — local development, unpublished

- Fix parallel-tool liveness: classify the tools still executing in both live events and restored Session snapshots. A short call no longer removes a running long tool's bounded grace, and a finished long tool no longer delays checking an ordinary call.
- Preserve the existing notification policy, metadata boundaries and UI. No new Inbox/history interface or storage is introduced.
- Frozen 0.1.2-rc.1 bytes and its device receipts remain historical evidence; rc.2 has independent checks and is not yet installed or frozen.


The entries below retain their historical version and release context.

## 0.1.2-rc.1 — 2026-10-01, local candidate, not published

- Bind a dirty settings draft to its original Host revision. Mirror refreshes, conflicts and communication failures retain that draft; discard or an accepted save starts a new baseline. Inheritance reset uses the same revision fence and repeated submission is disabled while saving.
- Cap count-only subagent pressure at C2, including authoritative counts. C3 requires a distinct blocking or failure fact. Current gold expectations reflect this policy; historical release artifacts and reports retain their identities.
- Parameterize local freezing by exact candidate version and installed-file verification by its immutable receipt, manifest and hash. No GitHub or npm publication is authorized.

## 0.1.1-rc.7 — frozen failed local candidate, not published

Real Web acceptance found a stale-draft overwrite after a remote mirror refresh. Its frozen bytes are preserved; the corrected development line starts at 0.1.2-rc.1.

- Prefer the optional `uiWorkspace.openSession()` navigation owner, resolving it at click time, while retaining the alpha.5 `sessions.open()` path. A native rejection does not fall back to a guessed URL.
- Track timed questions separately using the watermark-checked public `userQuestions` projection: timeout downgrades to C1 Inbox; turn completion does not imply an answer; an admitted reply or removal from the authoritative active set resolves the reminder.
- Persist only an optional lifecycle enum and the hashed question bundle join, never question text, answers, tool arguments, or results. Missing/stale projections do not resolve managed questions.
- Require DSH `0.2.0-rc.2` or later; migrate settings to `deepcanary` ConfigForms / `settings.plugins.tab`, revision-fenced Host writes, and live volatile fields. Failed writes retain drafts, and HTTP writes never silently fall back to memory.
- Import recognized legacy settings once, preserving explicit target fields and source files; isolate metadata by profile/instance and refuse cross-profile custom state sharing. Legacy shared Inbox adoption is Desktop-only, with navigation disabled until Host reconciliation.
- Add real pinned Host settings/session checks and schema-v4 notification evidence that distinguishes Edge from Electron. Web and Desktop package/device acceptance are independent; no Stable or full dual-host claim follows from unit tests.

## 0.1.1-rc.6 — 2026-09-06

- Add README navigation, update/removal instructions, a concise FAQ, and acknowledgments; clarify the DSH-compatible Node.js range in user and contributor guidance.
- Include the updated English and Simplified Chinese guides in the npm package, with consistent default-channel and pinned-version installation instructions.
- Check all direct installed dependencies against the lockfile and document the different plugin, runtime, compiler, and package-manager versions.
- Use one version-specific frozen-artifact location, reject ambiguous or mismatched package bytes, and prevent ordinary repacking of published versions.
- Make compatibility checks explicit about their runtime/profile and artifact identity; stop verification from silently creating a replacement tarball.

Runtime behavior is unchanged from RC5; only its reported plugin version changes. This release packages the documentation and maintainer-tooling improvements made since RC5. Historical packages and evidence retain their original identities.

## 0.1.1-rc.5 — 2026-09-06

### Improved

- Make English the main README language, with a full Simplified Chinese guide and a compatibility link from the previous English path.
- Rewrite installation, usage, compatibility, privacy, and contribution guidance around user tasks and clearly scoped limitations.
- Simplify panel and settings wording in both languages.
- Describe suspected stalls as an absence of observed activity, not proof that a task has stopped.
- Include both README languages and the contribution guide in the package, and check documentation links during distribution validation.

### Fixed

- Use a platform-appropriate absolute path in the SessionStore integration test so it works on Linux as well as Windows.
- Wait for an in-flight Supervisor startup before completing shutdown, share concurrent startup/shutdown transactions, and make standby tests wait for observable state with reliable cleanup.
- Validate installed TypeScript and esbuild versions against the lockfile and include actual tool versions in the build cache identity.
- Regenerate distribution output with the locked toolchain and add publication-receipt validation for the current release line.

The DSH adapter and notification policy are unchanged from RC4. DSH `0.1.2-alpha.5` remains the build/CI baseline; the separate alpha.13 and Windows desktop observations remain RC4 evidence. Persistent Supervisor stays experimental and off by default.

## 0.1.1-rc.4 — 2026-09-06

- Correlate Session v2 tool results with their public call identity.
- Close Human Needed reminders only when the matching authoritative condition is resolved.
- Route child-task completion summaries to the parent session.
- Reduce duplicate browser notifications with bounded server-side claims and finite retry opportunities.
- Add separate compatibility checks for official DSH `0.1.3-alpha.1`, while keeping `0.1.2-alpha.5` as the build baseline.
- Distinguish observed delivery, unknown visibility, review quality, and actual usefulness in local evaluation records.
- Add source/runtime-aware build caching and explicit artifact identity checks.

## 0.1.1-rc.3 — 2026-09-05

- Serialize Supervisor heartbeat renewal and snapshot writes to preserve ownership during concurrent persistence.
- Clear standby heartbeat timers and prevent duplicate timers after startup.
- Cover delayed persistence and lease release with a deterministic regression test.

Persistent Supervisor remains experimental and disabled by default.

## 0.1.1-rc.2 — 2026-09-04

Unpublished prerelease; its changes are included in subsequent versions.

- Reconcile existing sessions at startup through public Session APIs before releasing buffered live events.
- Restore unresolved Human Needed items and retain explicit degraded status when authoritative session state is unavailable.
- Add bounded orphan grace and recovery when a session returns.
- Persist a bounded browser-delivery ledger and restore notification policy state across Supervisor restarts.
- Add supplemental virtual-clock tests for ownership, restart continuity, and resource bounds.

## 0.1.1-rc.1 — 2026-09-02

- Update the compatibility baseline to official DSH `0.1.2-alpha.5`.
- Debounce host-health failures and recovery to avoid repeat alerts for one outage.
- Reduce unnecessary state polling and clean up timed-out requests.
- Add notification-attempt tracking, bounded policy persistence, and Supervisor standby retry.
- Publish the fixed artifact through npm and GitHub Releases.

## 0.1.0-rc.4 — 2026-09-01

- Update compatibility to official DSH `0.1.2-alpha.4`.
- Preserve authoritative approval/question boundaries and conservative severity rules.
- Retain a bounded local session handle for native DSH navigation.
- Improve feedback, mute/restore, suppression, and historical-session states.

Available as a historical GitHub prerelease; this version was not published to npm.

## 0.1.0-rc.3 — 2026-09-01

- Add inspectable decision traces and read-only policy previews.
- Focus DSH and open the target Inbox item when a browser notification is clicked.
- Add redacted outcome records and source-filtered reports.
- Expand classification, recovery, responsive-layout, forced-colors, and WebUI coverage for DSH `0.1.2-alpha.3`.
- Add bilingual screenshots and an ecosystem screenshot manifest.

The GitHub tag remains historical. This npm version was withdrawn and is not an installation target.

## 0.1.0-rc.2 — 2026-08-31

- Adopt the DSH `0.1.2-alpha.2` client-module system, sidebar entry, overlay panel, and plugin settings card.
- Keep the Inbox hidden until opened; add close/reopen, pointer/keyboard resize, and live language switching.
- Version Web state and action responses, with conditional reads and request replay protection.
- Add explicit reminder recovery and expiry states.

## 0.1.0-rc.1 — 2026-08-30

First public prerelease.

- Add deterministic attention policy for Human Needed, Host Health, Stuck/Progress, Subagent Pressure, Context Pressure, and Completion.
- Add deduplication, related-event grouping, quiet hours, and notification budgets.
- Store bounded local metadata with hashed references.
- Provide an Inbox, browser notifications, model-visible tools, local actions, and settings.
- Include Windows/WSL path normalization, capability detection, and prebuilt distribution files.

Model-assisted judgment, completion verification, independent tray persistence, and organization-wide policy are not included.

Historical validation and publication records are kept in the [benchmark directory](https://github.com/Oscar-Williams/dsh-deepcanary/tree/main/benchmark).
