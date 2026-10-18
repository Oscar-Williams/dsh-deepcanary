# DeepCanary development roadmap

DeepCanary helps people leave tasks running with confidence, notice when their help is needed and return to the correct work. Development follows that outcome across foreground turns, background jobs and plugin lifecycle changes.

## Current capability: 0.1.6-rc.1

WebUI and official Windows Desktop use released DSH 0.2.1-rc.2. The current local candidate adds:

- Owned background work tracking through public registration, output-count and settlement events. Running tasks stay quiet; uncollected completion reaches C1 and producer failure reaches C2.
- Bounded persistent watches and original-owner reconciliation. Replacement collects missed outcomes once and shows uncertainty when authority is unavailable.
- Pending Inbox prioritization, accessible additional pages and direct handling through already-resolved feedback.
- Public tool failure normalization shared by live events and startup recovery.

These capabilities extend the existing question/approval lifecycle, progress grace, revision-aware settings, authenticated communication and exact session return.

## Next product outcomes

| Outcome | Work and deliverable | Entry and completion conditions |
| --- | --- | --- |
| More dependable sustained work | Improve background/child task reconciliation and interruption recovery from observed use. Extend the public fact adapter when another released lifecycle exposes a material gap. | An actual task demonstrates the missing behavior; the fix preserves original ownership, bounded state and quiet healthy work. |
| Better reminder quality | Convert confirmed missed, false, late or duplicate reminders into sanitized reproducible cases and targeted fixes. | A concrete failure has enough facts to reproduce; its fix resolves that case and preserves the safety suite. |
| Outcome calibration | Compare a versioned candidate against the current policy on independent tasks, with explicit local adoption and rollback. | Natural coverage spans independent tasks and workdays; benefit and interruption cost can be assessed together. |
| Continuous supervision | Complete authority reconciliation, restart continuity and competing-observer takeover for actual sustained-use requirements. | The required lifecycle works on the affected Host; ownership, shutdown and resource bounds hold. Supervisor remains experimental until its own evidence supports promotion. |
| Native Desktop continuity | Use a released public notification/window-reveal/background capability and verify click return and failure handling. | A published third-party interface meets an actual need. Current renderer notifications retain their documented lifecycle scope. |
| Selective model assistance | Compare offline enum suggestions on difficult cases whose allowlisted metadata distinguishes the outcome. | Deterministic rules have a demonstrated gap. Limit each round to 20 attempts, concurrency one, 256 output tokens and an eight-second deadline including cancellation. Retain independent benefit before integration. |
| Additional Harness and active assistance | Add a second real adapter and explainable recommendations. Design permissions for any consequential action. | The DSH experience is dependable, a second sustained need exists and maintenance cost is justified. |

## Decisions and progress

The current release delivers background supervision within the running Host and plugin replacement lifecycle. The shared deterministic core owns live attention, C3 authority and interruption policy. Natural task coverage still needs further independent use before threshold calibration. Selective Judge enters when difficult cases and metadata establish its benefit. Official native bridging depends on a released public capability.

The [offline evaluation](offline-evaluation.md) records supported changes; [compatibility](compatibility.md) explains current operating scope. Local development receipts bind actual code, package and device results. Publication follows the [release checklist](release-checklist.md) after explicit authorization.
