import type { AttentionAction, AttentionLevel, AttentionVerdict, DeepCanaryConfig, PolicyDecisionTrace, ReasonCode } from '../types.js';
export interface PolicyApplicationOptions {
    /** The current rolling C2 budget state. Dry-run passes this without mutating it. */
    budgetAvailable: boolean;
    /** Marks a real budget reservation in the trace after the caller consumes it. */
    budgetConsumed?: boolean;
    /** Marks a read-only candidate policy in the trace. */
    candidate?: boolean;
}
/**
 * Apply the delivery policy after deterministic classification.
 * This function is pure: it never consumes budget, writes state, or contacts DSH.
 */
export declare function applyDeliveryPolicy(verdict: AttentionVerdict, config: Pick<DeepCanaryConfig, 'notificationLevel' | 'quietHours'>, now: number, options: PolicyApplicationOptions): AttentionVerdict;
export declare function withBundleTrace(trace: PolicyDecisionTrace | undefined, eventCount: number, reasonCodes: readonly AttentionVerdict['reasonCode'][]): PolicyDecisionTrace | undefined;
export declare function mergeBundleTrace(previous: PolicyDecisionTrace | undefined, next: PolicyDecisionTrace | undefined, eventCount: number, reasonCodes: readonly ReasonCode[], finalLevel: AttentionLevel, finalAction: AttentionAction): PolicyDecisionTrace | undefined;
export declare function withRecoveryTrace(trace: PolicyDecisionTrace | undefined, recoveryRule: string): PolicyDecisionTrace | undefined;
//# sourceMappingURL=policy.d.ts.map