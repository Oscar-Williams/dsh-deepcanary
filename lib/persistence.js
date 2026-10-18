import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import os from 'node:os';
import path from 'node:path';
import { ATTENTION_POLICY_VERSION } from './types.js';
import { SUPPRESSIBLE_REASON_CODES } from './types.js';
import { copyBackgroundWatch, isBackgroundWatch, MAX_BACKGROUND_WATCHES } from './adapters/background-jobs.js';
import { DeliveryLedger } from './core/delivery.js';
import { MAX_NOTIFICATION_GENERATION } from './core/reminders.js';
function runtimeState(value) {
    if (value === null || typeof value !== 'object')
        return undefined;
    const raw = value;
    if (raw.policyVersion !== ATTENTION_POLICY_VERSION)
        return undefined;
    const ledger = new DeliveryLedger();
    ledger.restore(Array.isArray(raw.deliveryLedger) ? raw.deliveryLedger.slice(-512) : []);
    return { policyVersion: ATTENTION_POLICY_VERSION,
        dedupe: Array.isArray(raw.dedupe) ? raw.dedupe.filter(entry => entry !== null && typeof entry === 'object'
            && typeof entry.keyHash === 'string' && /^[a-f0-9]{16}$/.test(entry.keyHash)
            && typeof entry.acceptedAt === 'string' && Number.isFinite(Date.parse(entry.acceptedAt))).slice(-512)
            .map(entry => ({ keyHash: entry.keyHash, acceptedAt: entry.acceptedAt })) : [],
        interruptConsumedAt: Array.isArray(raw.interruptConsumedAt) ? raw.interruptConsumedAt
            .filter(value => typeof value === 'string' && Number.isFinite(Date.parse(value))).slice(-256) : [],
        deliveryLedger: ledger.snapshot() };
}
function reminderMetadata(item) {
    return { ...(Number.isSafeInteger(item.notificationGeneration) && item.notificationGeneration >= 0 && item.notificationGeneration <= MAX_NOTIFICATION_GENERATION
            ? { notificationGeneration: item.notificationGeneration } : {}),
        ...(item.reminderPending === true ? { reminderPending: true } : {}),
        ...(typeof item.lastReminderAt === 'string' && Number.isFinite(Date.parse(item.lastReminderAt)) ? { lastReminderAt: item.lastReminderAt } : {}) };
}
export function hashMetadata(value) {
    return createHash('sha256').update(value).digest('hex').slice(0, 16);
}
export function resolveStateDir(value) {
    if (value === '~')
        return os.homedir();
    if (value.startsWith('~/') || value.startsWith('~\\'))
        return path.join(os.homedir(), value.slice(2));
    return path.resolve(value);
}
function toPersisted(item) {
    return {
        id: item.id,
        ...(item.sessionId ? { sessionId: item.sessionId } : {}),
        ...(item.sessionRef || item.sessionId ? { sessionRef: item.sessionRef ?? hashMetadata(item.sessionId) } : {}),
        ...(item.workspaceRef || item.workspaceId ? { workspaceRef: item.workspaceRef ?? hashMetadata(item.workspaceId) } : {}),
        occurredAt: item.occurredAt,
        level: item.level,
        action: item.action,
        confidence: item.confidence,
        reasonCode: item.reasonCode,
        ...(item.messageKey === undefined ? {} : { messageKey: item.messageKey }),
        ...(item.messageParams === undefined ? {} : { messageParams: { ...item.messageParams } }),
        ...(item.suggestionKey === undefined ? {} : { suggestionKey: item.suggestionKey }),
        ...(item.policyVersion === undefined ? {} : { policyVersion: item.policyVersion }),
        why: item.why.slice(0, 500),
        ...(item.suggestedAction ? { suggestedAction: item.suggestedAction.slice(0, 500) } : {}),
        evidence: item.evidence.map(item => ({
            type: item.type,
            authority: item.authority,
            code: hashMetadata(item.ref),
            summary: item.summary.slice(0, 240),
        })),
        ...(item.decisionTrace === undefined ? {} : { decisionTrace: persistDecisionTrace(item.decisionTrace) }),
        status: item.status,
        ...reminderMetadata(item),
        ...(item.snoozedUntil ? { snoozedUntil: item.snoozedUntil } : {}),
        ...(item.seenAt ? { seenAt: item.seenAt } : {}),
        ...(item.acknowledgedAt ? { acknowledgedAt: item.acknowledgedAt } : {}),
        ...(item.recoveredAt ? { recoveredAt: item.recoveredAt } : {}),
        ...(item.expiredAt ? { expiredAt: item.expiredAt } : {}),
        ...(item.orphanedAt ? { orphanedAt: item.orphanedAt } : {}),
        ...(item.mutedUntil ? { mutedUntil: item.mutedUntil } : {}),
        ...(item.targetAvailable === undefined ? {} : { targetAvailable: item.targetAvailable }),
        ...(item.taskState === undefined ? {} : { taskState: item.taskState }),
        ...(item.questionState === undefined ? {} : { questionState: item.questionState }),
        ...(item.feedback ? { feedback: { ...item.feedback, ...(item.feedback.note ? { note: item.feedback.note.slice(0, 200) } : {}) } } : {}),
        ...(item.bundleKey ? { bundleKey: item.bundleKey } : {}),
        bundleCount: item.bundleCount,
        reasonCodes: [...item.reasonCodes],
    };
}
function fromPersisted(item) {
    const feedback = isPersistedFeedback(item.feedback) ? item.feedback : undefined;
    return {
        eventId: item.id,
        id: item.id,
        ...(isSafeOpaqueId(item.sessionId) ? { sessionId: item.sessionId } : {}),
        ...(item.sessionRef ? { sessionRef: item.sessionRef } : {}),
        ...(item.workspaceRef ? { workspaceRef: item.workspaceRef } : {}),
        occurredAt: item.occurredAt,
        level: item.level,
        action: item.action,
        confidence: item.confidence,
        reasonCode: item.reasonCode,
        schemaVersion: 2,
        messageKey: item.messageKey ?? `item.reason.${item.reasonCode}`,
        ...(item.messageParams === undefined ? {} : { messageParams: { ...item.messageParams } }),
        ...(item.suggestionKey === undefined && item.suggestedAction === undefined
            ? {}
            : { suggestionKey: item.suggestionKey ?? `item.suggestion.${item.reasonCode}` }),
        policyVersion: item.policyVersion ?? ATTENTION_POLICY_VERSION,
        why: item.why,
        ...(item.suggestedAction ? { suggestedAction: item.suggestedAction } : {}),
        evidence: item.evidence.map(evidence => ({
            type: evidence.type,
            authority: evidence.authority,
            ref: `metadata:${evidence.code}`,
            summary: evidence.summary,
        })),
        ...(item.decisionTrace === undefined || !isDecisionTrace(item.decisionTrace) ? {} : { decisionTrace: item.decisionTrace }),
        status: item.status,
        ...reminderMetadata(item),
        ...(item.snoozedUntil ? { snoozedUntil: item.snoozedUntil } : {}),
        ...(item.seenAt ? { seenAt: item.seenAt } : {}),
        ...(item.acknowledgedAt ? { acknowledgedAt: item.acknowledgedAt } : {}),
        ...(item.recoveredAt ? { recoveredAt: item.recoveredAt } : {}),
        ...(item.expiredAt ? { expiredAt: item.expiredAt } : {}),
        ...(item.orphanedAt ? { orphanedAt: item.orphanedAt } : {}),
        ...(item.mutedUntil ? { mutedUntil: item.mutedUntil } : {}),
        ...(item.targetAvailable === undefined ? {} : { targetAvailable: item.targetAvailable }),
        ...(item.taskState === undefined ? {} : { taskState: item.taskState }),
        ...(item.questionState === undefined ? {} : { questionState: item.questionState }),
        ...(feedback === undefined ? {} : { feedback }),
        ...(item.bundleKey ? { bundleKey: item.bundleKey } : {}),
        bundleCount: typeof item.bundleCount === 'number' && Number.isSafeInteger(item.bundleCount) && item.bundleCount > 0 ? item.bundleCount : 1,
        reasonCodes: Array.isArray(item.reasonCodes) && item.reasonCodes.length > 0 ? item.reasonCodes : [item.reasonCode],
    };
}
export class MetadataStore {
    directory;
    file;
    constructor(stateDir) {
        this.directory = resolveStateDir(stateDir);
        this.file = path.join(this.directory, 'inbox.json');
    }
    async load() {
        return (await this.loadState()).items;
    }
    async loadState() {
        try {
            const raw = JSON.parse(await readFile(this.file, 'utf8'));
            if (raw.schemaVersion !== 1 || !Array.isArray(raw.items))
                return { items: [], backgroundWatches: [] };
            const runtime = runtimeState(raw.runtime);
            return { items: raw.items.filter(isPersistedItem).map(fromPersisted), backgroundWatches: Array.isArray(raw.backgroundWatches)
                    ? raw.backgroundWatches.filter(isBackgroundWatch).slice(-MAX_BACKGROUND_WATCHES).map(copyBackgroundWatch) : [],
                ...(runtime === undefined ? {} : { runtime }) };
        }
        catch (error) {
            if (isNodeError(error, 'ENOENT'))
                return { items: [], backgroundWatches: [] };
            throw error;
        }
    }
    async save(items, backgroundWatches = [], runtime) {
        const sanitizedRuntime = runtimeState(runtime);
        const payload = { schemaVersion: 1, items: items.map(toPersisted),
            backgroundWatches: backgroundWatches.filter(isBackgroundWatch).slice(-MAX_BACKGROUND_WATCHES).map(copyBackgroundWatch),
            ...(sanitizedRuntime === undefined ? {} : { runtime: sanitizedRuntime }) };
        await mkdir(this.directory, { recursive: true });
        const temporary = `${this.file}.${process.pid}.tmp`;
        await writeFile(temporary, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
        await rename(temporary, this.file);
    }
}
/** Durable, reason-code-only notification preferences. No session or workspace data is stored here. */
export class SuppressionStore {
    directory;
    file;
    constructor(stateDir) {
        this.directory = resolveStateDir(stateDir);
        this.file = path.join(this.directory, 'suppressions.json');
    }
    async load() {
        try {
            const raw = JSON.parse(await readFile(this.file, 'utf8'));
            if (raw.schemaVersion !== 1 || !Array.isArray(raw.reasonCodes))
                return [];
            return [...new Set(raw.reasonCodes.filter(isSuppressibleReasonCode))];
        }
        catch (error) {
            if (isNodeError(error, 'ENOENT'))
                return [];
            throw error;
        }
    }
    async save(reasonCodes) {
        const payload = {
            schemaVersion: 1,
            reasonCodes: [...new Set(reasonCodes)].filter(isSuppressibleReasonCode),
        };
        await mkdir(this.directory, { recursive: true });
        const temporary = `${this.file}.${process.pid}.tmp`;
        await writeFile(temporary, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
        await rename(temporary, this.file);
    }
}
function isNodeError(error, code) {
    return error instanceof Error && 'code' in error && error.code === code;
}
function isPersistedItem(value) {
    if (value === null || typeof value !== 'object')
        return false;
    const item = value;
    return typeof item.id === 'string'
        && (item.sessionId === undefined || isSafeOpaqueId(item.sessionId))
        && typeof item.occurredAt === 'string'
        && typeof item.level === 'string'
        && typeof item.action === 'string'
        && typeof item.confidence === 'number'
        && typeof item.reasonCode === 'string'
        && typeof item.why === 'string'
        && Array.isArray(item.evidence)
        && typeof item.status === 'string'
        && isInboxStatus(item.status)
        && (item.targetAvailable === undefined || typeof item.targetAvailable === 'boolean')
        && (item.taskState === undefined || isTaskState(item.taskState))
        && (item.questionState === undefined || item.questionState === 'open' || item.questionState === 'continued');
}
function isSafeOpaqueId(value) {
    return typeof value === 'string'
        && value.length > 0
        && value.length <= 256
        && !/[\u0000-\u001f\u007f]/.test(value);
}
function persistDecisionTrace(trace) {
    return {
        ...trace,
        matchedRules: trace.matchedRules.slice(0, 32),
        appliedScopes: trace.appliedScopes.slice(0, 16),
        suppressedBy: trace.suppressedBy.slice(0, 16),
        ...(trace.bundledWith === undefined ? {} : {
            bundledWith: {
                eventCount: trace.bundledWith.eventCount,
                reasonCodes: [...new Set(trace.bundledWith.reasonCodes)].slice(0, 32),
            },
        }),
        authoritySummary: {
            strongest: trace.authoritySummary.strongest,
            counts: { ...trace.authoritySummary.counts },
        },
    };
}
function isDecisionTrace(value) {
    if (value === null || typeof value !== 'object')
        return false;
    const trace = value;
    const counts = trace.authoritySummary?.counts;
    const bundle = trace.bundledWith;
    return trace.schemaVersion === 1
        && typeof trace.policyVersion === 'string' && trace.policyVersion.length > 0 && trace.policyVersion.length <= 128
        && typeof trace.verdictId === 'string' && trace.verdictId.length > 0 && trace.verdictId.length <= 128
        && isBoundedStringArray(trace.matchedRules, 32)
        && isBoundedStringArray(trace.appliedScopes, 16)
        && isBoundedStringArray(trace.suppressedBy, 16)
        && (bundle === undefined || (typeof bundle === 'object' && bundle !== null
            && Number.isSafeInteger(bundle.eventCount) && bundle.eventCount > 0
            && isReasonCodeArray(bundle.reasonCodes)))
        && (trace.recoveryRule === undefined || (typeof trace.recoveryRule === 'string' && trace.recoveryRule.length > 0 && trace.recoveryRule.length <= 128))
        && trace.authoritySummary !== undefined
        && (trace.authoritySummary.strongest === 'host' || trace.authoritySummary.strongest === 'runtime' || trace.authoritySummary.strongest === 'derived' || trace.authoritySummary.strongest === 'heuristic')
        && counts !== undefined
        && Number.isSafeInteger(counts.host) && counts.host >= 0
        && Number.isSafeInteger(counts.runtime) && counts.runtime >= 0
        && Number.isSafeInteger(counts.derived) && counts.derived >= 0
        && Number.isSafeInteger(counts.heuristic) && counts.heuristic >= 0
        && (trace.finalLevel === 'C0' || trace.finalLevel === 'C1' || trace.finalLevel === 'C2' || trace.finalLevel === 'C3')
        && (trace.finalAction === 'IGNORE' || trace.finalAction === 'INBOX' || trace.finalAction === 'DIGEST' || trace.finalAction === 'INTERRUPT' || trace.finalAction === 'ESCALATE');
}
function isBoundedStringArray(value, max) {
    return Array.isArray(value)
        && value.length <= max
        && value.every(item => typeof item === 'string' && item.length > 0 && item.length <= 128 && !/[\u0000-\u001f]/.test(item));
}
function isReasonCodeArray(value) {
    return Array.isArray(value)
        && value.length > 0
        && value.length <= 32
        && value.every(item => typeof item === 'string' && isReasonCode(item));
}
function isReasonCode(value) {
    return value === 'HUMAN_APPROVAL_REQUIRED'
        || value === 'HUMAN_QUESTION_PENDING'
        || value === 'HOST_UNREACHABLE'
        || value === 'HOST_SUSPECTED_STALL'
        || value === 'TOOL_FAILURE_LOOP'
        || value === 'NO_MEANINGFUL_PROGRESS'
        || value === 'SUBAGENT_PRESSURE'
        || value === 'CONTEXT_PRESSURE'
        || value === 'COMPACTION_OCCURRED'
        || value === 'TASK_COMPLETED'
        || value === 'TASK_FAILED'
        || value === 'TASK_ABORTED'
        || value === 'COMPLETION_SUSPICIOUS'
        || value === 'HOST_STALL_RECOVERED';
}
function isSuppressibleReasonCode(value) {
    return typeof value === 'string' && SUPPRESSIBLE_REASON_CODES.includes(value);
}
function isFeedbackValue(value) {
    return value === 'useful'
        || value === 'not-relevant'
        || value === 'wrong-level'
        || value === 'already-resolved';
}
function isPersistedFeedback(value) {
    if (value === null || typeof value !== 'object')
        return false;
    const feedback = value;
    return typeof feedback.useful === 'boolean'
        && typeof feedback.at === 'string'
        && feedback.at.length > 0
        && feedback.at.length <= 64
        && (feedback.value === undefined || isFeedbackValue(feedback.value))
        && (feedback.note === undefined || (typeof feedback.note === 'string' && feedback.note.length <= 200));
}
function isInboxStatus(value) {
    return value === 'open'
        || value === 'seen'
        || value === 'acknowledged'
        || value === 'snoozed'
        || value === 'muted'
        || value === 'recovered'
        || value === 'expired';
}
function isTaskState(value) {
    return value === 'running'
        || value === 'waiting-human'
        || value === 'completed'
        || value === 'failed'
        || value === 'aborted'
        || value === 'disposed'
        || value === 'unknown';
}
//# sourceMappingURL=persistence.js.map