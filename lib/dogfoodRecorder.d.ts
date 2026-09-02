import { DogfoodLedger } from './dogfood.js';
import type { DogfoodDecisionDisposition, DogfoodDeliveryChannel, DogfoodNotificationDelivery, DogfoodRun } from './dogfood.js';
import type { AttentionVerdict, CanarySignal, OutcomeReceipt, FeedbackValue } from './types.js';
/**
 * Runtime dogfood recording is deliberately opt-in. The environment contract
 * is consumed only when every run identity field is present, so an ordinary
 * DSH session never creates an evaluation ledger by accident.
 */
export declare const DOGFOOD_ENVIRONMENT: {
    readonly enabled: "DSH_DEEPCANARY_DOGFOOD";
    readonly runId: "DSH_DEEPCANARY_DOGFOOD_RUN_ID";
    readonly trialId: "DSH_DEEPCANARY_DOGFOOD_TRIAL_ID";
    readonly taskFamily: "DSH_DEEPCANARY_DOGFOOD_TASK_FAMILY";
    readonly scenario: "DSH_DEEPCANARY_DOGFOOD_SCENARIO";
    readonly runtimeTag: "DSH_DEEPCANARY_DOGFOOD_RUNTIME_TAG";
};
export declare function dogfoodRunFromEnvironment(pluginVersion: string, defaultRuntimeTag: string, startedAt?: string): DogfoodRun | undefined;
export interface DogfoodRuntimeRecord {
    signal: CanarySignal;
    verdict: AttentionVerdict;
    disposition: DogfoodDecisionDisposition;
    deliveryChannel: DogfoodDeliveryChannel;
    deliveryUnit?: string;
    bundleKey?: string;
    recoveredBeforeOpen?: boolean;
}
/** Persisted observation state for one explicitly enabled real trial. */
export declare class DogfoodRuntimeRecorder {
    readonly run: DogfoodRun;
    readonly ledger: DogfoodLedger;
    readonly file: string;
    private sequence;
    private saveChain;
    constructor(stateDir: string, run: DogfoodRun);
    load(): Promise<void>;
    record(input: DogfoodRuntimeRecord): void;
    /** Record a quiet, healthy checkpoint for a long-running session. */
    recordHealthyHeartbeat(sessionId: string, occurredAt?: string): void;
    private append;
    setReceipts(receipts: readonly OutcomeReceipt[]): void;
    recordUserFeedback(itemId: string, useful: boolean, value?: FeedbackValue): void;
    /** Record browser Notification construction/click stages without content. */
    recordNotificationDelivery(itemId: string, delivery: DogfoodNotificationDelivery): void;
    finish(endedAt?: string): void;
    flush(): Promise<void>;
    private queueSave;
}
//# sourceMappingURL=dogfoodRecorder.d.ts.map