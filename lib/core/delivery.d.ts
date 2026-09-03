/** Delivery sinks currently implemented by the plugin. */
export type DeliverySink = 'browser';
/** Monotonic delivery states shared by browser and future OS sink evidence. */
export type DeliveryState = 'planned' | 'attempted' | 'browser-constructed' | 'browser-shown' | 'os-observed' | 'clicked' | 'failed' | 'superseded';
export interface PersistedDeliveryEntry {
    /** Hash of verdictId + conditionGeneration + sink. */
    logicalKeyHash: string;
    sink: DeliverySink;
    /** Hash of the opaque notification attempt identity. */
    attemptHash: string;
    /** Bounded set of attempts already seen for this logical delivery. */
    attemptHashes: string[];
    state: DeliveryState;
    attempts: number;
    firstObservedAt: string;
    updatedAt: string;
}
export interface DeliveryRecordInput {
    verdictId: string;
    conditionGeneration: string;
    sink: DeliverySink;
    attemptId: string;
    stage: 'attempted' | 'constructed' | 'click-handler-attached' | 'clicked' | 'error';
    observedAt: string;
}
/**
 * Bounded, privacy-safe delivery state. It records only hashes, enums and
 * timestamps, and treats delayed browser callbacks as idempotent transitions.
 */
export declare class DeliveryLedger {
    private readonly entries;
    record(input: DeliveryRecordInput): void;
    restore(entries: readonly PersistedDeliveryEntry[]): void;
    snapshot(): PersistedDeliveryEntry[];
    size(): number;
    private trim;
}
//# sourceMappingURL=delivery.d.ts.map