# DeepCanary development roadmap

DeepCanary helps people leave tasks running with confidence, notice when their help is needed and return to the correct work. Development follows that outcome across foreground turns, background jobs and plugin lifecycle changes.

## Current capability: 0.1.6-rc.4

WebUI and official Windows Desktop use released DSH 0.2.1-rc.2. The current release candidate adds:

- Track background work through public registration, output counts and completion events. Running tasks stay quiet; an uncollected result reaches C1 on completion or C2 on failure.
- Retain bounded tracking records and reconcile each job with its original owner. Plugin replacement collects missed outcomes once and shows uncertainty when authority is unavailable.
- Place urgent Inbox work first, provide additional pages and complete a reminder when the user chooses **Already resolved**.
- Public tool failure normalization shared by live events and startup recovery.
- Keep scheduled work in Inbox with due times and controls to reschedule it or restore it to pending. Current authority and delivery policy govern each reminder.
- Persistence during ordinary operation of dedupe, rolling budget and claims for each delivery generation. Fair bounded client passes continue beyond completed deliveries.
- Capacity retention that protects active human waits and deliberately scheduled work from routine update bursts.

These capabilities build on the existing question and approval lifecycle, progress grace, settings revision checks, authenticated communication and return to the correct session.

## Next product outcomes

| Outcome | Work and deliverable | Entry and completion conditions |
| --- | --- | --- |
| More dependable sustained work | Improve background/child task reconciliation and interruption recovery from observed use. Extend the public fact adapter when another released lifecycle exposes a material gap. | An actual task demonstrates the missing behavior; the fix preserves original ownership, bounded state and quiet healthy work. |
| Better reminder quality | Convert confirmed missed, false, late or duplicate reminders into sanitized reproducible cases and targeted fixes. | A concrete failure has enough facts to reproduce; its fix resolves that case and preserves the safety suite. |
| Outcome calibration | Compare a versioned candidate against the current policy on independent tasks, with explicit local adoption and rollback. | Natural coverage spans independent tasks and workdays; benefit and interruption cost can be assessed together. |
| Continuous supervision | Complete authority reconciliation, restart continuity and takeover between observers for actual continuous use. | The required lifecycle works on the affected Host; ownership, shutdown and resource bounds hold. Supervisor remains experimental until its own evidence supports promotion. |
| Native Desktop continuity | Use released public capabilities for notifications, window reveal and background operation; verify click return and failure handling. | A public interface available to plugins meets an actual need. Current renderer notifications retain their documented lifecycle scope. |
| Selective model assistance | Compare offline enum suggestions on difficult cases whose allowlisted metadata distinguishes the outcome. | Deterministic rules have a demonstrated gap. Limit each round to 20 attempts, concurrency one, 256 output tokens and a deadline of eight seconds including cancellation. Independent evaluation must establish a benefit before integration. |
| Additional Harness and active assistance | Add a second real adapter and explainable recommendations. Design permissions for any consequential action. | The DSH experience is dependable, a second sustained need exists and maintenance cost is justified. |

## Decisions and progress

The current release delivers background supervision within the running Host and plugin replacement lifecycle. The shared deterministic core owns live attention, C3 authority and interruption policy. Natural task coverage still needs further independent use before threshold calibration. Selective Judge enters when difficult cases and metadata establish its benefit. Official native bridging depends on a released public capability.

The [offline evaluation](offline-evaluation.md) records supported changes; [compatibility](compatibility.md) explains current operating scope. Local development receipts bind actual code, package and device results. Publication follows the [release checklist](release-checklist.md) after explicit authorization.
