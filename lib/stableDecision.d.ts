export type StableDecision = 'STABLE_READY' | 'STABLE_WITH_EXCEPTIONS' | 'CONTINUE_RC' | 'HOLD';
export interface StableDecisionInput {
    gateDReady: boolean;
    gateEReady: boolean;
    implementationPresent: boolean;
    replayPass: boolean;
    replayObserved: boolean;
    supervisorSmokePass: boolean;
    supervisorSmokeObserved: boolean;
    realDogfoodStatus: string;
    optionalExceptions: readonly string[];
}
export interface StableDecisionResult {
    decision: StableDecision;
    reasons: string[];
}
/**
 * Apply the four-state release boundary without treating missing evidence as a
 * product failure or allowing an optional gap to look like Stable.
 */
export declare function decideStableDecision(input: StableDecisionInput): StableDecisionResult;
//# sourceMappingURL=stableDecision.d.ts.map