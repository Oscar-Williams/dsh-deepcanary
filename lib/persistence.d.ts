import type { TaskContext } from './types.js';
import type { AutomationRun } from './adapters/automation.js';
import type { BackgroundWatch } from './adapters/background-jobs.js';
import type { PersistedDeliveryEntry } from './core/delivery.js';
import type { PersistedDedupeEntry } from './core/dedupe.js';
import type { InboxItem, SuppressibleReasonCode } from './types.js';
export interface AttentionRuntimeState {
    policyVersion: string;
    dedupe: PersistedDedupeEntry[];
    interruptConsumedAt: string[];
    deliveryLedger: PersistedDeliveryEntry[];
    revision?: number;
    automationRuns?: AutomationRun[];
    deferredSources?: Array<{
        sessionRef: string;
        sourceSeq: number;
    }>;
    rescanAll?: boolean;
}
export declare function hashMetadata(value: string): string;
export declare function resolveStateDir(value: string): string;
export declare class MetadataStore {
    readonly directory: string;
    readonly file: string;
    private writable;
    constructor(stateDir: string);
    load(): Promise<InboxItem[]>;
    loadState(): Promise<{
        items: InboxItem[];
        backgroundWatches: BackgroundWatch[];
        runtime?: AttentionRuntimeState;
    }>;
    save(items: readonly InboxItem[], backgroundWatches?: readonly BackgroundWatch[], runtime?: AttentionRuntimeState): Promise<void>;
}
export declare function isTaskContext(value: unknown): value is TaskContext;
/** Durable, reason-code-only notification preferences. No session or workspace data is stored here. */
export declare class SuppressionStore {
    readonly directory: string;
    readonly file: string;
    constructor(stateDir: string);
    load(): Promise<SuppressibleReasonCode[]>;
    save(reasonCodes: readonly SuppressibleReasonCode[]): Promise<void>;
}
//# sourceMappingURL=persistence.d.ts.map