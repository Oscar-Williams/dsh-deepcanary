import { DogfoodLedger } from './dogfood.js';
import { eventClassForReason } from './outcome.js';
import { hashMetadata } from './persistence.js';
/**
 * Runtime dogfood recording is deliberately opt-in. The environment contract
 * is consumed only when every run identity field is present, so an ordinary
 * DSH session never creates an evaluation ledger by accident.
 */
export const DOGFOOD_ENVIRONMENT = {
    enabled: 'DSH_DEEPCANARY_DOGFOOD',
    runId: 'DSH_DEEPCANARY_DOGFOOD_RUN_ID',
    trialId: 'DSH_DEEPCANARY_DOGFOOD_TRIAL_ID',
    taskFamily: 'DSH_DEEPCANARY_DOGFOOD_TASK_FAMILY',
    scenario: 'DSH_DEEPCANARY_DOGFOOD_SCENARIO',
    runtimeTag: 'DSH_DEEPCANARY_DOGFOOD_RUNTIME_TAG',
};
const taskFamilies = new Set(['coding', 'build-test', 'research', 'multi-stage', 'subagent']);
const scenarios = new Set(['approval-boundary', 'network-recovery', 'healthy-long-run', 'normal-completion', 'explicit-failure', 'recovery-continued']);
const runIdPattern = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const printablePattern = /^[^\u0000-\u001f\u007f]{1,128}$/;
function value(name) {
    const candidate = process.env[name];
    return candidate !== undefined && printablePattern.test(candidate) ? candidate : undefined;
}
function enabled() {
    const flag = process.env[DOGFOOD_ENVIRONMENT.enabled];
    return flag === '1' || flag === 'true';
}
export function dogfoodRunFromEnvironment(pluginVersion, defaultRuntimeTag, startedAt = new Date().toISOString()) {
    if (!enabled())
        return undefined;
    const runId = value(DOGFOOD_ENVIRONMENT.runId);
    const trialId = value(DOGFOOD_ENVIRONMENT.trialId);
    const taskFamily = value(DOGFOOD_ENVIRONMENT.taskFamily);
    const scenario = value(DOGFOOD_ENVIRONMENT.scenario);
    if (runId === undefined || !runIdPattern.test(runId) || trialId === undefined || !runIdPattern.test(trialId))
        return undefined;
    if (taskFamily === undefined || !taskFamilies.has(taskFamily) || scenario === undefined || !scenarios.has(scenario))
        return undefined;
    return {
        schemaVersion: 1,
        runId,
        trialId,
        provenance: 'real',
        taskFamily,
        scenario,
        pluginVersion,
        runtimeTag: value(DOGFOOD_ENVIRONMENT.runtimeTag) ?? defaultRuntimeTag,
        policyVersion: 'attention-policy.v1',
        startedAt,
        captureMode: 'service',
        rawContentPersisted: false,
    };
}
function eventSubtypeForReason(reasonCode) {
    return {
        HUMAN_APPROVAL_REQUIRED: 'approval',
        HUMAN_QUESTION_PENDING: 'question',
        HOST_UNREACHABLE: 'unreachable',
        HOST_SUSPECTED_STALL: 'suspected-stall',
        TOOL_FAILURE_LOOP: 'failure-loop',
        NO_MEANINGFUL_PROGRESS: 'no-progress',
        SUBAGENT_PRESSURE: 'pressure',
        CONTEXT_PRESSURE: 'context',
        COMPACTION_OCCURRED: 'compaction',
        TASK_COMPLETED: 'completed',
        TASK_FAILED: 'failed',
        TASK_ABORTED: 'aborted',
        COMPLETION_SUSPICIOUS: 'suspicious',
        HOST_STALL_RECOVERED: 'recovered',
    }[reasonCode];
}
function authorityFor(signal) {
    const ranks = { heuristic: 0, derived: 1, runtime: 2, host: 3 };
    return signal.evidence.reduce((current, evidence) => ranks[evidence.authority] > ranks[current] ? evidence.authority : current, 'heuristic');
}
function phaseFor(signal, disposition) {
    if (disposition === 'recovery-closed' || signal.kind === 'HOST_STALL_RECOVERED')
        return 'recovery';
    const eventClass = eventClassForReason(signal.kind);
    if (eventClass === 'human-needed')
        return 'human-wait';
    if (eventClass === 'completion')
        return 'completion';
    return 'running';
}
function observedDecision(verdict) {
    return { level: verdict.level, action: verdict.action, reasonCode: verdict.reasonCode };
}
function usefulnessPatch(useful, value) {
    if (useful)
        return { reviewLabel: 'correct-useful', policyReview: 'correct', userFeedback: 'useful', usefulnessReason: 'actionable' };
    if (value === 'already-resolved')
        return { reviewLabel: 'already-resolved', policyReview: 'too-late', userFeedback: 'not-useful', usefulnessReason: 'already-resolved' };
    if (value === 'wrong-level')
        return { reviewLabel: 'wrong-level', policyReview: 'wrong-level', userFeedback: 'not-useful', usefulnessReason: 'wrong-level' };
    return { reviewLabel: 'not-relevant', userFeedback: 'not-useful', usefulnessReason: 'not-relevant' };
}
/** Persisted observation state for one explicitly enabled real trial. */
export class DogfoodRuntimeRecorder {
    run;
    ledger;
    file;
    sequence = 0;
    saveChain = Promise.resolve();
    constructor(stateDir, run) {
        this.run = { ...run };
        const fileName = `dogfood-${hashMetadata(run.runId)}.json`;
        this.ledger = new DogfoodLedger(stateDir, this.run, fileName);
        this.file = this.ledger.file;
    }
    async load() {
        const bundle = await this.ledger.load();
        this.sequence = bundle.observations.length;
    }
    record(input) {
        const sequence = this.sequence++;
        const observation = {
            schemaVersion: 1,
            observationRef: hashMetadata(`${this.run.runId}:${sequence}:${input.signal.id}:${input.disposition}`),
            runId: this.run.runId,
            ...(input.deliveryUnit === undefined ? {} : { attentionRef: hashMetadata(input.deliveryUnit) }),
            occurredAt: Number.isFinite(Date.parse(input.signal.occurredAt)) ? input.signal.occurredAt : new Date().toISOString(),
            eventClass: eventClassForReason(input.signal.kind),
            eventSubtype: eventSubtypeForReason(input.signal.kind),
            eventSource: input.signal.source,
            authority: authorityFor(input.signal),
            phase: phaseFor(input.signal, input.disposition),
            decisionDisposition: input.disposition,
            observedDecision: observedDecision(input.verdict),
            deliveryChannel: input.deliveryChannel,
            ...(input.deliveryUnit === undefined ? {} : { deliveryUnitRef: hashMetadata(`${this.run.runId}:delivery:${input.deliveryUnit}`) }),
            ...(input.bundleKey === undefined ? {} : { bundleRef: hashMetadata(`${this.run.runId}:bundle:${input.bundleKey}`) }),
            ...(input.recoveredBeforeOpen === undefined ? {} : { recoveredBeforeOpen: input.recoveredBeforeOpen }),
        };
        this.append(observation);
    }
    /** Record a quiet, healthy checkpoint for a long-running session. */
    recordHealthyHeartbeat(sessionId, occurredAt = new Date().toISOString()) {
        const sequence = this.sequence++;
        const observation = {
            schemaVersion: 1,
            observationRef: hashMetadata(`${this.run.runId}:${sequence}:healthy-heartbeat:${sessionId}`),
            runId: this.run.runId,
            occurredAt: Number.isFinite(Date.parse(occurredAt)) ? occurredAt : new Date().toISOString(),
            eventClass: 'healthy-run',
            eventSubtype: 'healthy-heartbeat',
            eventSource: 'session',
            authority: 'runtime',
            phase: 'running',
            decisionDisposition: 'c0-silent',
            deliveryChannel: 'none',
        };
        this.append(observation);
    }
    append(observation) {
        try {
            this.ledger.record(observation);
            this.queueSave();
        }
        catch {
            // Recording is diagnostic and must never interrupt the DSH attention path.
        }
    }
    setReceipts(receipts) {
        try {
            this.ledger.setReceipts(receipts.filter(receipt => receipt.source === this.run.provenance && receipt.trialId === this.run.trialId));
            this.queueSave();
        }
        catch {
            // A malformed receipt remains outside the dogfood ledger; service state
            // and user-facing actions continue to use their own validated stores.
        }
    }
    recordUserFeedback(itemId, useful, value) {
        try {
            this.ledger.updateObservationsByAttention(hashMetadata(itemId), usefulnessPatch(useful, value));
            this.queueSave();
        }
        catch {
            // Diagnostic review data must never interrupt the user-facing action.
        }
    }
    /** Record browser Notification construction/click stages without content. */
    recordNotificationDelivery(itemId, delivery) {
        try {
            this.ledger.updateNotificationDelivery(hashMetadata(itemId), delivery);
            this.queueSave();
        }
        catch {
            // Delivery telemetry must never interrupt the notification or DSH UI.
        }
    }
    finish(endedAt = new Date().toISOString()) {
        try {
            this.ledger.finish(endedAt);
            this.queueSave();
        }
        catch {
            // A malformed diagnostic timestamp must not affect DSH shutdown.
        }
    }
    async flush() {
        await this.saveChain;
    }
    queueSave() {
        this.saveChain = this.saveChain
            .then(() => this.ledger.save())
            .catch(() => undefined);
    }
}
//# sourceMappingURL=dogfoodRecorder.js.map