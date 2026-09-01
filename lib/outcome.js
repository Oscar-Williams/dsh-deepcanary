import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { hashMetadata, resolveStateDir } from './persistence.js';
import { OUTCOME_RECEIPT_SCHEMA_VERSION } from './types.js';
export const MAX_OUTCOME_RECEIPTS = 2_000;
const outcomeSources = new Set(['real', 'controlled', 'replay']);
const outcomeFeedback = new Set(['unrated', 'useful', 'not-useful']);
const outcomeLaterOutcomes = new Set(['unknown', 'continued', 'completed', 'failed', 'aborted', 'recovered', 'user-stopped']);
const outcomeLatencyBuckets = new Set(['unknown', 'not-opened', 'under-1m', '1-5m', '5-15m', 'over-15m']);
const outcomeReviewFlags = new Set([
    'missed-human-needed',
    'false-stall',
    'wrong-level',
    'duplicate-final-interrupt',
    'provider-error',
    'sink-error',
    'dropped-event',
]);
const reasonCodes = new Set([
    'HUMAN_APPROVAL_REQUIRED',
    'HUMAN_QUESTION_PENDING',
    'HOST_UNREACHABLE',
    'HOST_SUSPECTED_STALL',
    'TOOL_FAILURE_LOOP',
    'NO_MEANINGFUL_PROGRESS',
    'SUBAGENT_PRESSURE',
    'CONTEXT_PRESSURE',
    'COMPACTION_OCCURRED',
    'TASK_COMPLETED',
    'TASK_FAILED',
    'TASK_ABORTED',
    'COMPLETION_SUSPICIOUS',
    'HOST_STALL_RECOVERED',
]);
const attentionLevels = new Set(['C0', 'C1', 'C2', 'C3']);
const attentionActions = new Set(['IGNORE', 'INBOX', 'DIGEST', 'INTERRUPT', 'ESCALATE']);
const evidenceAuthorities = new Set(['host', 'runtime', 'derived', 'heuristic']);
const outcomeReceiptFields = new Set([
    'schemaVersion',
    'receiptId',
    'attentionRef',
    'trialId',
    'source',
    'policyVersion',
    'eventClass',
    'reasonCode',
    'level',
    'action',
    'sourceAuthority',
    'opened',
    'acknowledged',
    'snoozed',
    'muted',
    'feedback',
    'laterOutcome',
    'recoveredBeforeOpen',
    'latencyBucket',
    'reviewFlags',
    'recordedAt',
]);
const trialIdPattern = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const printablePattern = /^[^\u0000-\u001f\u007f]+$/;
export function normalizeOutcomeInput(value) {
    if (value === null || typeof value !== 'object')
        throw new TypeError('outcome payload must be an object');
    const raw = value;
    const allowed = new Set([
        'source',
        'trialId',
        'opened',
        'acknowledged',
        'snoozed',
        'muted',
        'feedback',
        'laterOutcome',
        'recoveredBeforeOpen',
        'latencyBucket',
        'reviewFlags',
    ]);
    for (const key of Object.keys(raw))
        if (!allowed.has(key))
            throw new TypeError(`unsupported outcome field: ${key}`);
    if (!isOutcomeSource(raw.source))
        throw new TypeError('outcome.source must be real, controlled, or replay');
    if (typeof raw.trialId !== 'string' || !trialIdPattern.test(raw.trialId)) {
        throw new TypeError('outcome.trialId must use 1-128 letters, numbers, dots, underscores, colons, or hyphens');
    }
    const booleans = ['opened', 'acknowledged', 'snoozed', 'muted', 'recoveredBeforeOpen'];
    for (const key of booleans) {
        if (raw[key] !== undefined && typeof raw[key] !== 'boolean')
            throw new TypeError(`outcome.${key} must be boolean`);
    }
    if (raw.feedback !== undefined && !isOutcomeFeedback(raw.feedback))
        throw new TypeError('outcome.feedback is unsupported');
    if (raw.laterOutcome !== undefined && !isOutcomeLaterOutcome(raw.laterOutcome))
        throw new TypeError('outcome.laterOutcome is unsupported');
    if (raw.latencyBucket !== undefined && !isOutcomeLatencyBucket(raw.latencyBucket))
        throw new TypeError('outcome.latencyBucket is unsupported');
    let reviewFlags;
    if (raw.reviewFlags !== undefined) {
        if (!Array.isArray(raw.reviewFlags) || raw.reviewFlags.length > 7 || !raw.reviewFlags.every(isOutcomeReviewFlag)) {
            throw new TypeError('outcome.reviewFlags must contain at most seven supported values');
        }
        reviewFlags = [...new Set(raw.reviewFlags)];
    }
    return {
        source: raw.source,
        trialId: raw.trialId,
        ...(typeof raw.opened === 'boolean' ? { opened: raw.opened } : {}),
        ...(typeof raw.acknowledged === 'boolean' ? { acknowledged: raw.acknowledged } : {}),
        ...(typeof raw.snoozed === 'boolean' ? { snoozed: raw.snoozed } : {}),
        ...(typeof raw.muted === 'boolean' ? { muted: raw.muted } : {}),
        ...(isOutcomeFeedback(raw.feedback) ? { feedback: raw.feedback } : {}),
        ...(isOutcomeLaterOutcome(raw.laterOutcome) ? { laterOutcome: raw.laterOutcome } : {}),
        ...(typeof raw.recoveredBeforeOpen === 'boolean' ? { recoveredBeforeOpen: raw.recoveredBeforeOpen } : {}),
        ...(isOutcomeLatencyBucket(raw.latencyBucket) ? { latencyBucket: raw.latencyBucket } : {}),
        ...(reviewFlags === undefined ? {} : { reviewFlags }),
    };
}
/** Validate a deliberately scoped local deletion/retention selector. */
export function normalizeOutcomeDeleteFilter(value) {
    if (value === null || typeof value !== 'object')
        throw new TypeError('outcome delete filter must be an object');
    const raw = value;
    const allowed = new Set(['source', 'trialId', 'before']);
    for (const key of Object.keys(raw))
        if (!allowed.has(key))
            throw new TypeError(`unsupported outcome delete field: ${key}`);
    if (raw.source !== undefined && !isOutcomeSource(raw.source))
        throw new TypeError('outcome delete source is unsupported');
    if (raw.trialId !== undefined && (typeof raw.trialId !== 'string' || !trialIdPattern.test(raw.trialId))) {
        throw new TypeError('outcome delete trialId has an invalid format');
    }
    if (raw.before !== undefined && (typeof raw.before !== 'string' || !Number.isFinite(Date.parse(raw.before)))) {
        throw new TypeError('outcome delete before must be an ISO date');
    }
    if (raw.trialId === undefined && raw.before === undefined) {
        throw new TypeError('outcome delete requires trialId or before');
    }
    return {
        ...(isOutcomeSource(raw.source) ? { source: raw.source } : {}),
        ...(typeof raw.trialId === 'string' ? { trialId: raw.trialId } : {}),
        ...(typeof raw.before === 'string' ? { before: new Date(raw.before).toISOString() } : {}),
    };
}
export function eventClassForReason(reasonCode) {
    switch (reasonCode) {
        case 'HUMAN_APPROVAL_REQUIRED':
        case 'HUMAN_QUESTION_PENDING':
            return 'human-needed';
        case 'HOST_UNREACHABLE':
        case 'HOST_STALL_RECOVERED':
            return 'host-health';
        case 'HOST_SUSPECTED_STALL':
        case 'TOOL_FAILURE_LOOP':
        case 'NO_MEANINGFUL_PROGRESS':
            return 'stuck-progress';
        case 'SUBAGENT_PRESSURE':
            return 'subagent-pressure';
        case 'CONTEXT_PRESSURE':
        case 'COMPACTION_OCCURRED':
            return 'context-pressure';
        case 'TASK_COMPLETED':
        case 'TASK_FAILED':
        case 'TASK_ABORTED':
        case 'COMPLETION_SUSPICIOUS':
            return 'completion';
    }
}
export function strongestEvidenceAuthority(item) {
    const authorityRank = { heuristic: 0, derived: 1, runtime: 2, host: 3 };
    return item.evidence.reduce((strongest, evidence) => authorityRank[evidence.authority] > authorityRank[strongest] ? evidence.authority : strongest, 'heuristic');
}
export function buildOutcomeReceipt(item, input, previous, recordedAt = new Date().toISOString()) {
    const attentionRef = hashMetadata(item.id);
    if (previous !== undefined && (previous.attentionRef !== attentionRef || previous.source !== input.source || previous.trialId !== input.trialId)) {
        throw new Error('outcome record belongs to a different attention reference, source, or trial');
    }
    const openedByStatus = item.seenAt !== undefined || item.acknowledgedAt !== undefined || item.feedback !== undefined;
    const defaultOpened = previous?.opened ?? openedByStatus;
    const defaultAcknowledged = previous?.acknowledged ?? item.acknowledgedAt !== undefined;
    const defaultSnoozed = previous?.snoozed ?? item.status === 'snoozed';
    const mutedUntil = item.mutedUntil === undefined ? Number.NaN : Date.parse(item.mutedUntil);
    const defaultMuted = previous?.muted ?? (item.status === 'muted' || (Number.isFinite(mutedUntil) && mutedUntil > Date.now()));
    const defaultRecoveredBeforeOpen = previous?.recoveredBeforeOpen ?? (item.status === 'recovered' && !openedByStatus);
    const defaultFeedback = previous?.feedback
        ?? (item.feedback === undefined ? 'unrated' : item.feedback.useful ? 'useful' : 'not-useful');
    const receiptId = previous?.receiptId ?? `outcome-${hashMetadata(`${item.id}:${input.trialId}`)}`;
    return {
        schemaVersion: OUTCOME_RECEIPT_SCHEMA_VERSION,
        receiptId,
        attentionRef,
        trialId: input.trialId,
        source: input.source,
        policyVersion: item.policyVersion,
        eventClass: eventClassForReason(item.reasonCode),
        reasonCode: item.reasonCode,
        level: item.level,
        action: item.action,
        sourceAuthority: previous?.sourceAuthority ?? strongestEvidenceAuthority(item),
        opened: input.opened ?? defaultOpened,
        acknowledged: input.acknowledged ?? defaultAcknowledged,
        snoozed: input.snoozed ?? defaultSnoozed,
        muted: input.muted ?? defaultMuted,
        feedback: input.feedback ?? defaultFeedback,
        laterOutcome: input.laterOutcome ?? previous?.laterOutcome ?? 'unknown',
        recoveredBeforeOpen: input.recoveredBeforeOpen ?? defaultRecoveredBeforeOpen,
        latencyBucket: input.latencyBucket ?? previous?.latencyBucket ?? 'unknown',
        reviewFlags: input.reviewFlags ?? previous?.reviewFlags ?? [],
        recordedAt,
    };
}
export class OutcomeStore {
    directory;
    file;
    constructor(stateDir) {
        this.directory = resolveStateDir(stateDir);
        this.file = path.join(this.directory, 'outcomes.json');
    }
    async load() {
        try {
            const raw = JSON.parse(await readFile(this.file, 'utf8'));
            if (raw.schemaVersion !== OUTCOME_RECEIPT_SCHEMA_VERSION || !Array.isArray(raw.receipts))
                return [];
            return raw.receipts.filter(isOutcomeReceipt).slice(-MAX_OUTCOME_RECEIPTS).map(cloneOutcomeReceipt);
        }
        catch (error) {
            if (isNodeError(error, 'ENOENT'))
                return [];
            throw error;
        }
    }
    async save(receipts) {
        const payload = {
            schemaVersion: OUTCOME_RECEIPT_SCHEMA_VERSION,
            receipts: receipts.slice(-MAX_OUTCOME_RECEIPTS).map(cloneOutcomeReceipt),
        };
        await mkdir(this.directory, { recursive: true });
        const temporary = `${this.file}.${process.pid}.tmp`;
        await writeFile(temporary, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
        await rename(temporary, this.file);
    }
}
export function isOutcomeReceipt(value) {
    if (value === null || typeof value !== 'object')
        return false;
    if (Object.keys(value).some(key => !outcomeReceiptFields.has(key)))
        return false;
    const receipt = value;
    return receipt.schemaVersion === OUTCOME_RECEIPT_SCHEMA_VERSION
        && typeof receipt.receiptId === 'string' && /^outcome-[a-f0-9]{16}$/.test(receipt.receiptId)
        && typeof receipt.attentionRef === 'string' && /^[a-f0-9]{16}$/.test(receipt.attentionRef)
        && typeof receipt.trialId === 'string' && trialIdPattern.test(receipt.trialId)
        && isOutcomeSource(receipt.source)
        && typeof receipt.policyVersion === 'string' && boundedPrintable(receipt.policyVersion, 128)
        && isOutcomeEventClass(receipt.eventClass)
        && isReasonCode(receipt.reasonCode)
        && isAttentionLevel(receipt.level)
        && isAttentionAction(receipt.action)
        && isEvidenceAuthority(receipt.sourceAuthority)
        && typeof receipt.opened === 'boolean'
        && typeof receipt.acknowledged === 'boolean'
        && typeof receipt.snoozed === 'boolean'
        && typeof receipt.muted === 'boolean'
        && isOutcomeFeedback(receipt.feedback)
        && isOutcomeLaterOutcome(receipt.laterOutcome)
        && typeof receipt.recoveredBeforeOpen === 'boolean'
        && isOutcomeLatencyBucket(receipt.latencyBucket)
        && isReviewFlagArray(receipt.reviewFlags)
        && typeof receipt.recordedAt === 'string'
        && Number.isFinite(Date.parse(receipt.recordedAt));
}
function cloneOutcomeReceipt(receipt) {
    return { ...receipt, reviewFlags: [...receipt.reviewFlags] };
}
function isOutcomeSource(value) {
    return typeof value === 'string' && outcomeSources.has(value);
}
function isOutcomeFeedback(value) {
    return typeof value === 'string' && outcomeFeedback.has(value);
}
function isOutcomeLaterOutcome(value) {
    return typeof value === 'string' && outcomeLaterOutcomes.has(value);
}
function isOutcomeLatencyBucket(value) {
    return typeof value === 'string' && outcomeLatencyBuckets.has(value);
}
function isOutcomeReviewFlag(value) {
    return typeof value === 'string' && outcomeReviewFlags.has(value);
}
function isOutcomeEventClass(value) {
    return value === 'human-needed'
        || value === 'host-health'
        || value === 'stuck-progress'
        || value === 'subagent-pressure'
        || value === 'context-pressure'
        || value === 'completion';
}
function isReasonCode(value) {
    return typeof value === 'string' && reasonCodes.has(value);
}
function isAttentionLevel(value) {
    return typeof value === 'string' && attentionLevels.has(value);
}
function isAttentionAction(value) {
    return typeof value === 'string' && attentionActions.has(value);
}
function isEvidenceAuthority(value) {
    return typeof value === 'string' && evidenceAuthorities.has(value);
}
function isReviewFlagArray(value) {
    return Array.isArray(value) && value.length <= 7 && value.every(isOutcomeReviewFlag);
}
function boundedPrintable(value, max) {
    return value.length > 0 && value.length <= max && printablePattern.test(value);
}
function isNodeError(error, code) {
    return error instanceof Error && 'code' in error && error.code === code;
}
//# sourceMappingURL=outcome.js.map