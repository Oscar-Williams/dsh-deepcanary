import type { AttentionAction, AttentionLevel, AttentionVerdict, DeepCanaryConfig, PolicyDecisionTrace, ReasonCode } from '../types.js'

export interface PolicyApplicationOptions {
  /** The current rolling C2 budget state. Dry-run passes this without mutating it. */
  budgetAvailable: boolean
  /** Marks a real budget reservation in the trace after the caller consumes it. */
  budgetConsumed?: boolean
  /** Marks a read-only candidate policy in the trace. */
  candidate?: boolean
}

function cloneTrace(trace: PolicyDecisionTrace | undefined, verdict: AttentionVerdict): PolicyDecisionTrace {
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
  }
}

function isQuietHours(config: Pick<DeepCanaryConfig, 'quietHours'>, timestamp: number): boolean {
  if (!config.quietHours.enabled) return false
  const time = new Date(timestamp).toTimeString().slice(0, 5)
  const { start, end } = config.quietHours
  // Equal endpoints describe a full-day quiet window. The explicit enabled
  // flag provides the separate way to turn quiet hours off.
  if (start === end) return true
  return start < end ? time >= start && time < end : time >= start || time < end
}

function levelValue(level: AttentionVerdict['level']): number {
  return level === 'C0' ? 0 : level === 'C1' ? 1 : level === 'C2' ? 2 : 3
}

/**
 * Apply the delivery policy after deterministic classification.
 * This function is pure: it never consumes budget, writes state, or contacts DSH.
 */
export function applyDeliveryPolicy(
  verdict: AttentionVerdict,
  config: Pick<DeepCanaryConfig, 'notificationLevel' | 'quietHours'>,
  now: number,
  options: PolicyApplicationOptions,
): AttentionVerdict {
  if (verdict.level === 'C0') return verdict

  let action: AttentionAction = verdict.action
  const trace = cloneTrace(verdict.decisionTrace, verdict)
  const appliedScopes = new Set(trace.appliedScopes)
  const suppressedBy = new Set(trace.suppressedBy)
  if (options.candidate === true) appliedScopes.add('candidate-policy')

  if (isQuietHours(config, now) && action === 'INTERRUPT') {
    action = 'DIGEST'
    appliedScopes.add('quiet-hours')
    suppressedBy.add('quiet-hours')
  }
  // C3 is the safety floor for authoritative, high-impact conditions. The
  // ordinary notification-level preference only caps C1/C2 delivery.
  if (verdict.level !== 'C3' && levelValue(verdict.level) > levelValue(config.notificationLevel) && action !== 'INBOX') {
    action = 'INBOX'
    appliedScopes.add('notification-level')
    suppressedBy.add('notification-level')
  }
  if (action === 'INTERRUPT' && !options.budgetAvailable) {
    action = 'DIGEST'
    appliedScopes.add('interrupt-budget')
    suppressedBy.add('interrupt-budget')
  } else if (action === 'INTERRUPT' && options.budgetConsumed === true) {
    appliedScopes.add('interrupt-budget')
  }

  const decisionTrace: PolicyDecisionTrace = {
    ...trace,
    appliedScopes: [...appliedScopes],
    suppressedBy: [...suppressedBy],
    finalLevel: verdict.level,
    finalAction: action,
  }
  return { ...verdict, action, decisionTrace }
}

export function withBundleTrace(
  trace: PolicyDecisionTrace | undefined,
  eventCount: number,
  reasonCodes: readonly AttentionVerdict['reasonCode'][],
): PolicyDecisionTrace | undefined {
  if (trace === undefined) return undefined
  return {
    ...trace,
    appliedScopes: [...new Set([...trace.appliedScopes, 'decision-bundle'])],
    bundledWith: { eventCount, reasonCodes: [...new Set(reasonCodes)] },
  }
}

export function mergeBundleTrace(
  previous: PolicyDecisionTrace | undefined,
  next: PolicyDecisionTrace | undefined,
  eventCount: number,
  reasonCodes: readonly ReasonCode[],
  finalLevel: AttentionLevel,
  finalAction: AttentionAction,
): PolicyDecisionTrace | undefined {
  const trace = next ?? previous
  if (trace === undefined) return undefined
  const authorityCounts = {
    host: Math.max(previous?.authoritySummary.counts.host ?? 0, 0) + (next?.authoritySummary.counts.host ?? 0),
    runtime: Math.max(previous?.authoritySummary.counts.runtime ?? 0, 0) + (next?.authoritySummary.counts.runtime ?? 0),
    derived: Math.max(previous?.authoritySummary.counts.derived ?? 0, 0) + (next?.authoritySummary.counts.derived ?? 0),
    heuristic: Math.max(previous?.authoritySummary.counts.heuristic ?? 0, 0) + (next?.authoritySummary.counts.heuristic ?? 0),
  }
  const strongest = authorityCounts.host > 0
    ? 'host'
    : authorityCounts.runtime > 0
      ? 'runtime'
      : authorityCounts.derived > 0
        ? 'derived'
        : 'heuristic'
  const recoveryRule = next?.recoveryRule ?? previous?.recoveryRule
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
  }
}

export function withRecoveryTrace(trace: PolicyDecisionTrace | undefined, recoveryRule: string): PolicyDecisionTrace | undefined {
  if (trace === undefined) return undefined
  return {
    ...trace,
    appliedScopes: [...new Set([...trace.appliedScopes, 'recovery'])],
    recoveryRule,
  }
}
