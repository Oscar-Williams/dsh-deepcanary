/** Delivery sinks currently implemented by the plugin. */
export type DeliverySink = 'browser';
/** Monotonic delivery states shared by browser and future OS sink evidence. */
export type DeliveryState = 'planned' | 'attempted' | 'browser-constructed' | 'browser-shown' | 'os-observed' | 'clicked' | 'failed' | 'superseded';
export interface PersistedDeliveryEntry {
    /** Hash of verdictId + conditionGeneration + sink. */
    logicalKeyHash: string;
    sink: DeliverySink;
    /** Hash of the opaque notification attempt identity. */
    attemptHash?: string;
    /** Bounded set of attempts already seen for this logical delivery. */
    attemptHashes: string[];
    state: DeliveryState;
    attempts: number;
    firstObservedAt: string;
    updatedAt: string;
    /** Hash of the short-lived client owner holding the send claim. */
    claimOwnerHash?: string;
    /** Expiry of the short-lived send claim. */
    claimExpiresAt?: string;
    /** Number of server-side claim opportunities consumed for this delivery. */
    claimAttempts?: number;
}
export interface DeliveryRecordInput {
    verdictId: string;
    conditionGeneration: string;
    sink: DeliverySink;
    attemptId: string;
    stage: 'attempted' | 'constructed' | 'click-handler-attached' | 'clicked' | 'error';
    observedAt: string;
}
export type DeliveryClaimOutcome = 'granted' | 'already-claimed' | 'already-complete' | 'unavailable';
export interface DeliveryClaimInput {
    verdictId: string;
    conditionGeneration: string;
    sink: DeliverySink;
    clientInstance: string;
    expiresAt: string;
    claimedAt?: string;
}
export interface DeliveryClaimResult {
    outcome: DeliveryClaimOutcome;
    logicalKeyHash?: string;
    claimExpiresAt?: string;
}
/**
 * Bounded, privacy-safe delivery state. It records only hashes, enums and
 * timestamps, and treats delayed browser callbacks as idempotent transitions.
 */
export declare class DeliveryLedger {
    private readonly entries;
    /**
     * Atomically reserve one logical browser delivery for a short window.
     * Only hashes, enums and timestamps cross the persistence boundary.
     */
    claim(input: DeliveryClaimInput): DeliveryClaimResult;
    record(input: DeliveryRecordInput): void;
    restore(entries: readonly PersistedDeliveryEntry[]): void;
    snapshot(): PersistedDeliveryEntry[];
    size(): number;
    private trim;
}
//# sourceMappingURL=delivery.d.ts.map