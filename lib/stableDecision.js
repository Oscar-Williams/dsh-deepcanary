/**
 * Apply the four-state release boundary without treating missing evidence as a
 * product failure or allowing an optional gap to look like Stable.
 */
export function decideStableDecision(input) {
    const hardFailures = [];
    if (!input.implementationPresent)
        hardFailures.push('implementation-incomplete');
    if (input.replayObserved && !input.replayPass)
        hardFailures.push('policy-replay-failed');
    if (input.supervisorSmokeObserved && !input.supervisorSmokePass)
        hardFailures.push('supervisor-smoke-failed');
    if (input.realDogfoodStatus === 'invalid-provenance')
        hardFailures.push('real-dogfood-provenance-invalid');
    if (hardFailures.length > 0)
        return { decision: 'HOLD', reasons: hardFailures };
    if (!input.gateDReady || !input.gateEReady) {
        return {
            decision: 'CONTINUE_RC',
            reasons: [
                ...(input.gateDReady ? [] : ['gate-d-not-ready']),
                ...(input.gateEReady ? [] : ['gate-e-not-ready']),
            ],
        };
    }
    if (input.optionalExceptions.length > 0) {
        return { decision: 'STABLE_WITH_EXCEPTIONS', reasons: [...input.optionalExceptions] };
    }
    return { decision: 'STABLE_READY', reasons: [] };
}
//# sourceMappingURL=stableDecision.js.map