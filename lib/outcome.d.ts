import type { EvidenceAuthority, InboxItem, OutcomeDeleteFilter, OutcomeEventClass, OutcomeReceipt, OutcomeReceiptInput, ReasonCode } from './types.js';
export declare const MAX_OUTCOME_RECEIPTS = 2000;
export declare function normalizeOutcomeInput(value: unknown): OutcomeReceiptInput;
/** Validate a deliberately scoped local deletion/retention selector. */
export declare function normalizeOutcomeDeleteFilter(value: unknown): OutcomeDeleteFilter;
export declare function eventClassForReason(reasonCode: ReasonCode): OutcomeEventClass;
export declare function strongestEvidenceAuthority(item: InboxItem): EvidenceAuthority;
export declare function buildOutcomeReceipt(item: InboxItem, input: OutcomeReceiptInput, previous?: OutcomeReceipt, recordedAt?: string): OutcomeReceipt;
export declare class OutcomeStore {
    readonly directory: string;
    readonly file: string;
    constructor(stateDir: string);
    load(): Promise<OutcomeReceipt[]>;
    save(receipts: readonly OutcomeReceipt[]): Promise<void>;
}
export declare function isOutcomeReceipt(value: unknown): value is OutcomeReceipt;
//# sourceMappingURL=outcome.d.ts.map