import type { AttentionAction, AttentionLevel, EvidenceAuthority, OutcomeReceipt, OutcomeEventClass, ReasonCode } from './types.js';
export declare const DOGFOOD_SCHEMA_VERSION: 1;
export type DogfoodProvenance = 'real' | 'controlled' | 'replay';
export type DogfoodTaskFamily = 'coding' | 'build-test' | 'research' | 'multi-stage' | 'subagent';
export type DogfoodScenario = 'approval-boundary' | 'network-recovery' | 'healthy-long-run' | 'normal-completion' | 'explicit-failure' | 'recovery-continued';
export type DogfoodEventClass = OutcomeEventClass | 'healthy-run';
export type DogfoodPhase = 'startup' | 'running' | 'human-wait' | 'recovery' | 'completion';
export type DogfoodDecisionDisposition = 'c0-silent' | 'deduped' | 'bundle-merged' | 'suppressed' | 'inbox' | 'digest' | 'interrupt' | 'escalate' | 'recovery-closed' | 'provider-error' | 'sink-error' | 'dropped-event';
export type DogfoodDeliveryChannel = 'none' | 'inbox' | 'browser-notification' | 'native-toast';
export type DogfoodReviewLabel = 'correct-useful' | 'correct-low-value' | 'not-relevant' | 'already-resolved' | 'wrong-level' | 'false-stall' | 'missed-human-needed' | 'duplicate-final-interrupt' | 'too-late' | 'provider-error' | 'sink-error' | 'dropped-event' | 'uncertain';
export type DogfoodPolicyReview = 'correct' | 'wrong-level' | 'false-stall' | 'missed-human-needed' | 'duplicate-final-interrupt' | 'too-late' | 'uncertain';
export type DogfoodUserFeedback = 'useful' | 'not-useful' | 'unrated' | 'not-applicable';
export type DogfoodUsefulnessReason = 'actionable' | 'prevented-block' | 'status-only' | 'not-relevant' | 'already-resolved' | 'wrong-level' | 'too-late' | 'duplicate';
export type DogfoodNotificationStage = 'attempted' | 'constructed' | 'click-handler-attached' | 'clicked' | 'error';
export type DogfoodEventSource = 'session' | 'agent' | 'subagent' | 'tool' | 'host' | 'windows' | 'usage' | 'external';
/** Privacy-safe browser notification delivery facts linked to one Inbox item. */
export interface DogfoodNotificationDelivery {
    /** Server-side attempt identity shared by all browser stages for one try. */
    notificationAttemptId: string;
    notificationRef: string;
    tagRef: string;
    titleKey: string;
    bodyFingerprint: string;
    stages: DogfoodNotificationStage[];
    firstObservedAt: string;
    clickedAt?: string;
}
export interface DogfoodDecision {
    level: AttentionLevel;
    action: AttentionAction;
    reasonCode: ReasonCode;
}
export interface DogfoodRun {
    schemaVersion: typeof DOGFOOD_SCHEMA_VERSION;
    runId: string;
    trialId: string;
    provenance: DogfoodProvenance;
    taskFamily: DogfoodTaskFamily;
    scenario: DogfoodScenario;
    pluginVersion: string;
    runtimeTag: string;
    policyVersion: string;
    startedAt: string;
    endedAt?: string;
    captureMode: 'service' | 'manual' | 'replay';
    rawContentPersisted: false;
}
export interface DogfoodObservation {
    schemaVersion: typeof DOGFOOD_SCHEMA_VERSION;
    observationRef: string;
    runId: string;
    /** Opaque link to the corresponding Inbox item, when one was delivered. */
    attentionRef?: string;
    occurredAt: string;
    eventClass: DogfoodEventClass;
    eventSubtype: string;
    eventSource: DogfoodEventSource;
    authority: EvidenceAuthority;
    phase: DogfoodPhase;
    decisionDisposition: DogfoodDecisionDisposition;
    observedDecision?: DogfoodDecision;
    expectedDecision?: DogfoodDecision;
    deliveryChannel: DogfoodDeliveryChannel;
    deliveryUnitRef?: string;
    bundleRef?: string;
    reviewLabel?: DogfoodReviewLabel;
    /** Structured policy adjudication; reviewLabel remains for v1 compatibility. */
    policyReview?: DogfoodPolicyReview;
    /** User value is kept separate from policy correctness. */
    userFeedback?: DogfoodUserFeedback;
    usefulnessReason?: DogfoodUsefulnessReason;
    /** Browser-sink facts are recorded without notification text or content. */
    notificationDelivery?: DogfoodNotificationDelivery;
    recoveredBeforeOpen?: boolean;
}
export interface DogfoodBundle {
    schemaVersion: typeof DOGFOOD_SCHEMA_VERSION;
    run: DogfoodRun;
    observations: DogfoodObservation[];
    receipts: OutcomeReceipt[];
}
export interface DogfoodMetric {
    numerator: number;
    denominator: number;
    rate: number | null;
    status: 'ok' | 'insufficient-sample' | 'no-data';
}
export interface DogfoodReport {
    reportSchemaVersion: typeof DOGFOOD_SCHEMA_VERSION;
    run: DogfoodRun;
    observationCount: number;
    receiptCount: number;
    taxonomy: {
        byTaskFamily: Record<string, number>;
        byScenario: Record<string, number>;
        byEventClass: Record<string, number>;
        byEventSubtype: Record<string, number>;
        byPhase: Record<string, number>;
        byDisposition: Record<string, number>;
        byReviewLabel: Record<string, number>;
    };
    coverage: {
        reviewedDecisions: number;
        decisions: number;
        deliveryUnits: number;
        /** User-facing review coverage uses unique delivery units as its denominator. */
        userFacingDeliveryUnits: number;
        reviewedUserFacingUnits: number;
        negativeOpportunityUnits: number;
        bundles: number;
        c0Silent: number;
        suppressed: number;
        deduped: number;
        droppedEvents: number;
    };
    metrics: {
        humanNeededRecall: DogfoodMetric;
        usefulnessRate: DogfoodMetric;
        usefulInterruptPrecision: DogfoodMetric;
        wrongLevelRate: DogfoodMetric;
        falseStallRate: DogfoodMetric;
        recoveryBeforeOpenRate: DogfoodMetric;
        attentionCompressionRatio: DogfoodMetric;
        droppedEventRate: DogfoodMetric;
        reviewCoverage: DogfoodMetric;
    };
    generatedAt: string;
    conclusion: string;
}
export declare function isDogfoodBundle(value: unknown): value is DogfoodBundle;
export declare function summarizeDogfood(bundle: DogfoodBundle): DogfoodReport;
export declare class DogfoodLedger {
    readonly directory: string;
    readonly file: string;
    private bundleValue;
    constructor(stateDir: string, run: DogfoodRun, fileName?: string);
    load(): Promise<DogfoodBundle>;
    record(observation: DogfoodObservation): void;
    setReceipts(receipts: readonly OutcomeReceipt[]): void;
    updateObservationsByAttention(attentionRef: string, patch: Pick<DogfoodObservation, 'reviewLabel' | 'policyReview' | 'userFeedback' | 'usefulnessReason'>): number;
    /** Join browser-sink delivery stages to the same privacy-safe observation. */
    updateNotificationDelivery(attentionRef: string, delivery: DogfoodNotificationDelivery): number;
    finish(endedAt?: string): void;
    bundle(): DogfoodBundle;
    save(): Promise<void>;
}
//# sourceMappingURL=dogfood.d.ts.map