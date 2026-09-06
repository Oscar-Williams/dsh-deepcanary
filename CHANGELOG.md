# Changelog

User-visible changes and notable compatibility updates. DeepCanary is currently distributed through the `next` prerelease channel.

## 0.1.1-rc.5 — 2026-09-06

### Improved

- Make English the main README language, with a full Simplified Chinese guide and a compatibility link from the previous English path.
- Rewrite installation, usage, compatibility, privacy, and contribution guidance around user tasks and clearly scoped limitations.
- Simplify panel and settings wording in both languages.
- Describe suspected stalls as an absence of observed activity, not proof that a task has stopped.
- Include both README languages and the contribution guide in the package, and check documentation links during distribution validation.

### Fixed

- Use a platform-appropriate absolute path in the SessionStore integration test so it works on Linux as well as Windows.
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
