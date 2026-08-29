import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import os from 'node:os';
import path from 'node:path';
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
        ...(item.sessionId ? { sessionRef: hashMetadata(item.sessionId) } : {}),
        ...(item.workspaceId ? { workspaceRef: hashMetadata(item.workspaceId) } : {}),
        occurredAt: item.occurredAt,
        level: item.level,
        action: item.action,
        confidence: item.confidence,
        reasonCode: item.reasonCode,
        why: item.why.slice(0, 500),
        ...(item.suggestedAction ? { suggestedAction: item.suggestedAction.slice(0, 500) } : {}),
        evidence: item.evidence.map(item => ({
            type: item.type,
            authority: item.authority,
            code: hashMetadata(item.ref),
            summary: item.summary.slice(0, 240),
        })),
        status: item.status,
        ...(item.snoozedUntil ? { snoozedUntil: item.snoozedUntil } : {}),
        ...(item.feedback ? { feedback: { ...item.feedback, ...(item.feedback.note ? { note: item.feedback.note.slice(0, 200) } : {}) } } : {}),
        ...(item.bundleKey ? { bundleKey: item.bundleKey } : {}),
        bundleCount: item.bundleCount,
        reasonCodes: [...item.reasonCodes],
    };
}
function fromPersisted(item) {
    return {
        eventId: item.id,
        id: item.id,
        occurredAt: item.occurredAt,
        level: item.level,
        action: item.action,
        confidence: item.confidence,
        reasonCode: item.reasonCode,
        why: item.why,
        ...(item.suggestedAction ? { suggestedAction: item.suggestedAction } : {}),
        evidence: item.evidence.map(evidence => ({
            type: evidence.type,
            authority: evidence.authority,
            ref: `metadata:${evidence.code}`,
            summary: evidence.summary,
        })),
        status: item.status,
        ...(item.snoozedUntil ? { snoozedUntil: item.snoozedUntil } : {}),
        ...(item.feedback ? { feedback: item.feedback } : {}),
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
        try {
            const raw = JSON.parse(await readFile(this.file, 'utf8'));
            if (raw.schemaVersion !== 1 || !Array.isArray(raw.items))
                return [];
            return raw.items.filter(isPersistedItem).map(fromPersisted);
        }
        catch (error) {
            if (isNodeError(error, 'ENOENT'))
                return [];
            throw error;
        }
    }
    async save(items) {
        const payload = { schemaVersion: 1, items: items.map(toPersisted) };
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
        && typeof item.occurredAt === 'string'
        && typeof item.level === 'string'
        && typeof item.action === 'string'
        && typeof item.confidence === 'number'
        && typeof item.reasonCode === 'string'
        && typeof item.why === 'string'
        && Array.isArray(item.evidence)
        && typeof item.status === 'string';
}
//# sourceMappingURL=persistence.js.map