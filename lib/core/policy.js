function cloneTrace(trace, verdict) {
    return {
        schemaVersion: 1,
        policyVersion: verdict.policyVersion,
        verdictId: verdict.eventId,
        matchedRules: [...(trace?.matchedRules ?? [])],
        appliedScopes: [...(trace?.appliedScopes ?? ['global'])],
        suppressedBy: [...(trace?.suppressedBy ?? [])],
        ...(trace?.bundledWith === undefined ? {} : {
            bundledWith: {
                eventCount: trace.bundledWith.eventCount,
                reasonCodes: [...trace.bundledWith.reasonCodes],
            },
        }),
        authoritySummary: trace?.authoritySummary ?? {
            strongest: 'heuristic',
            counts: { host: 0, runtime: 0, derived: 0, heuristic: 0 },
        },
        finalLevel: verdict.level,
        finalAction: verdict.action,
        ...(trace?.recoveryRule === undefined ? {} : { recoveryRule: trace.recoveryRule }),
    };
}
function isQuietHours(config, timestamp) {
    if (!config.quietHours.enabled)
        return false;
    const time = new Date(timestamp).toTimeString().slice(0, 5);
    const { start, end } = config.quietHours;
    if (start === end)
        return true;
    return start < end ? time >= start && time < end : time >= start || time < end;
}
function levelValue(level) {
    return level === 'C0' ? 0 : level === 'C1' ? 1 : level === 'C2' ? 2 : 3;
}
/**
 * Apply the delivery policy after deterministic classification.
 * This function is pure: it never consumes budget, writes state, or contacts DSH.
 */
export function applyDeliveryPolicy(verdict, config, now, options) {
    if (verdict.level === 'C0')
        return verdict;
    let action = verdict.action;
    const trace = cloneTrace(verdict.decisionTrace, verdict);
    const appliedScopes = new Set(trace.appliedScopes);
    const suppressedBy = new Set(trace.suppressedBy);
    if (options.candidate === true)
        appliedScopes.add('candidate-policy');
    if (isQuietHours(config, now) && action === 'INTERRUPT') {
        action = 'DIGEST';
        appliedScopes.add('quiet-hours');
        suppressedBy.add('quiet-hours');
    }
    if (levelValue(verdict.level) > levelValue(config.notificationLevel) && action !== 'INBOX') {
        action = 'INBOX';
        appliedScopes.add('notification-level');
        suppressedBy.add('notification-level');
    }
    if (action === 'INTERRUPT' && !options.budgetAvailable) {
        action = 'DIGEST';
        appliedScopes.add('interrupt-budget');
        suppressedBy.add('interrupt-budget');
    }
    else if (action === 'INTERRUPT' && options.budgetConsumed === true) {
        appliedScopes.add('interrupt-budget');
    }
    const decisionTrace = {
        ...trace,
        appliedScopes: [...appliedScopes],
        suppressedBy: [...suppressedBy],
        finalLevel: verdict.level,
        finalAction: action,
    };
    return { ...verdict, action, decisionTrace };
}
export function withBundleTrace(trace, eventCount, reasonCodes) {
    if (trace === undefined)
        return undefined;
    return {
        ...trace,
        appliedScopes: [...new Set([...trace.appliedScopes, 'decision-bundle'])],
        bundledWith: { eventCount, reasonCodes: [...new Set(reasonCodes)] },
    };
}
export function mergeBundleTrace(previous, next, eventCount, reasonCodes, finalLevel, finalAction) {
    const trace = next ?? previous;
    if (trace === undefined)
        return undefined;
    const authorityCounts = {
        host: Math.max(previous?.authoritySummary.counts.host ?? 0, 0) + (next?.authoritySummary.counts.host ?? 0),
        runtime: Math.max(previous?.authoritySummary.counts.runtime ?? 0, 0) + (next?.authoritySummary.counts.runtime ?? 0),
        derived: Math.max(previous?.authoritySummary.counts.derived ?? 0, 0) + (next?.authoritySummary.counts.derived ?? 0),
        heuristic: Math.max(previous?.authoritySummary.counts.heuristic ?? 0, 0) + (next?.authoritySummary.counts.heuristic ?? 0),
    };
    const strongest = authorityCounts.host > 0
        ? 'host'
        : authorityCounts.runtime > 0
            ? 'runtime'
            : authorityCounts.derived > 0
                ? 'derived'
                : 'heuristic';
    const recoveryRule = next?.recoveryRule ?? previous?.recoveryRule;
    return {
        ...trace,
        matchedRules: [...new Set([...(previous?.matchedRules ?? []), ...(next?.matchedRules ?? [])])],
        appliedScopes: [...new Set([...(previous?.appliedScopes ?? []), ...(next?.appliedScopes ?? []), 'decision-bundle'])],
        suppressedBy: [...new Set([...(previous?.suppressedBy ?? []), ...(next?.suppressedBy ?? [])])],
        bundledWith: { eventCount, reasonCodes: [...new Set(reasonCodes)] },
        authoritySummary: { strongest, counts: authorityCounts },
        finalLevel,
        finalAction,
        ...(recoveryRule === undefined ? {} : { recoveryRule }),
    };
}
export function withRecoveryTrace(trace, recoveryRule) {
    if (trace === undefined)
        return undefined;
    return {
        ...trace,
        appliedScopes: [...new Set([...trace.appliedScopes, 'recovery'])],
        recoveryRule,
    };
}
//# sourceMappingURL=policy.js.map