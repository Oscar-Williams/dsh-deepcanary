# Feedback and offline calibration — 0.1.4-rc.1

The product goal is timely help when a task needs a person, quiet healthy work and return to the correct session. This iteration repairs the existing evidence chain instead of adding new product entry points.

## Source and ownership

`provenance` / receipt `source` identifies capture provenance. `taskOrigin` identifies natural, controlled, replay or unknown work. Natural qualification requires `real`, service capture, explicit natural origin and a 16-character hashed session `taskRef`. File names, model claims and merely running through DSH prove none of these. Legacy fields remain readable and missing origin remains unknown. Existing bytes are never relabeled.

Enable recording before a necessary task starts, with `DSH_DEEPCANARY_DOGFOOD=1` and the run/trial/family/scenario/runtime/origin environment fields defined in `src/dogfoodRecorder.ts`. Natural runs also require `DSH_DEEPCANARY_DOGFOOD_TASK_REF`, derived from the actual public session identity. Recording excludes other sessions and global Host opportunities from this task cohort; normal reminders still observe them. Export uses `scripts/capture-dogfood-run.mjs` with the exact ledger, identity and bounded timestamps. Manual fallback is never a service capture. Do not restart active work to create evidence.

Receipts retain the trial, task origin and task reference. Existing fields cannot be overwritten by a conflicting update. Open, acknowledge, resume and notification construction are action/delivery evidence, never implicit usefulness feedback. Explicit user feedback, engineering review and model suggestions remain separate.

## Case audit and policy decisions

Run `node scripts/audit-attention-cases.mjs --input <sanitized-bundle> --out <report>` or explicitly name a sanitized top-level JSON directory. Source hashes, duplicate identities, conflicts, unknown delivery and negative opportunities are retained. See [failure taxonomy](failure-taxonomy.md). Task failures are distinct from reminder failures; unknown root causes remain unknown.

Current and candidate policies use `scripts/replay-attention-policy.mjs`. Use genuinely different owned tasks for discovery and holdout, and retain frozen safety cases. `scripts/evaluate-attention-candidate.mjs` rejects missing identity, reused task references and conflicting evidence. Its output distinguishes insufficient evidence, evaluation passed, explicitly locally adopted and explicitly rolled back. Passing never writes policy or an adoption record. A human engineering decision supplies the version-bound adoption/rollback record through `--adoption`; the evaluator only checks it. Cross-workday natural evidence thresholds remain in force. Controlled repetitions cannot fill them.

No policy threshold changed in this iteration: factual/lifecycle defects take precedence, and historical evidence does not justify calibration by reducing overall sensitivity. The local workflow is implemented; sample-driven policy adoption remains gated by confirmed cases and independent evidence. Aggregate summaries expose the classified `taskOrigin` and original `declaredTaskOrigin` separately; a legacy natural declaration without ownership remains readable in the unknown cohort. Missing-origin receipts cannot enter an explicitly natural run.

## Judge and Desktop bridge decisions

A confirmed rule-hard natural case is only screening evidence (`requires-feasibility-review`). Judge additionally requires proof that allowlisted metadata distinguishes the case and deterministic rules remain insufficient. The current audit has no qualifying case. No dormant Judge module, model calls, model configuration or new sensitive storage is added.

If entry later becomes justified, use the public DSH LLM service: at most 20 attempts, concurrency 1, 256 output tokens and an eight-second end-to-end deadline including cancellation. Input permits event categories, authority, counts, time buckets and rule results only. Accept enum/unknown output only. Judge cannot create C3, weaken Human Needed or change live policy. Benefits must survive independent comparison; otherwise leave it offline.

Pinned DSH 0.2.0-rc.2 has no published third-party Desktop notification/window-wake/background bridge. Existing renderer notifications and `uiWorkspace.openSession()` remain. Hidden-window Toast return and fully exited background notifications are not guaranteed. Revisit only a released public interface and an actual need; do not patch Electron, EXE/asar or build a second desktop process/inbox.

Windows WebUI in the existing default Edge is the development entry. Desktop device validation is required only for public bridge adoption or relevant common-code changes. Publishing uses explicit authorization and the CI/frozen-byte checks in the release checklist.
