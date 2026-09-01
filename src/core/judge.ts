import { ATTENTION_POLICY_VERSION, ATTENTION_PROTOCOL_VERSION } from '../types.js'
import type { AttentionAction, AttentionLevel, AttentionVerdict, CanarySignal, EvidenceAuthority, MessageParams, PolicyDecisionTrace, ReasonCode } from '../types.js'

const c2Reasons = new Set<ReasonCode>([
  'HUMAN_APPROVAL_REQUIRED',
  'HUMAN_QUESTION_PENDING',
  'HOST_SUSPECTED_STALL',
  'TOOL_FAILURE_LOOP',
  'NO_MEANINGFUL_PROGRESS',
  'SUBAGENT_PRESSURE',
  'CONTEXT_PRESSURE',
  'TASK_FAILED',
  'TASK_ABORTED',
  'COMPLETION_SUSPICIOUS',
])

function levelFor(signal: CanarySignal): { level: AttentionLevel; matchedRules: string[] } {
  const matchedRules: string[] = []
  const authoritative = signal.evidence.some(item => item.authority === 'host' || item.authority === 'runtime')
  if (signal.data.healthy === true) {
    matchedRules.push('signal.healthy-c0')
    return { level: 'C0', matchedRules }
  }
  if (signal.kind === 'HOST_UNREACHABLE') {
    matchedRules.push(signal.evidence.some(item => item.authority === 'host' || item.authority === 'runtime') ? 'host.authoritative-c3' : 'host.heuristic-c2')
    return { level: signal.evidence.some(item => item.authority === 'host' || item.authority === 'runtime') ? 'C3' : 'C2', matchedRules }
  }
  if (signal.kind === 'SUBAGENT_PRESSURE') {
    matchedRules.push('subagent.pressure-threshold')
    if (signal.severityHint === 3) return { level: 'C3', matchedRules }
    if (signal.severityHint === 2) return { level: 'C2', matchedRules }
    return { level: 'C1', matchedRules }
  }
  if (signal.kind === 'HUMAN_APPROVAL_REQUIRED' && authoritative && signal.severityHint === 3) {
    matchedRules.push('human.approval-authoritative-c3')
    return { level: 'C3', matchedRules }
  }
  if (signal.kind === 'HUMAN_QUESTION_PENDING' && authoritative && signal.severityHint === 3) {
    matchedRules.push('human.question-blocking-c3')
    return { level: 'C3', matchedRules }
  }
  if (signal.severityHint === 3 && authoritative) {
    matchedRules.push('severity.authoritative-c3')
    return { level: 'C3', matchedRules }
  }
  if (signal.data.userViewing === true && signal.severityHint !== 0) {
    matchedRules.push('context.user-viewing-downgrade')
    return { level: 'C1', matchedRules }
  }
  if (c2Reasons.has(signal.kind)) {
    matchedRules.push('reason.default-c2')
    return { level: 'C2', matchedRules }
  }
  if (signal.kind === 'TASK_COMPLETED' || signal.kind === 'COMPACTION_OCCURRED') {
    matchedRules.push('reason.status-c1')
    return { level: 'C1', matchedRules }
  }
  matchedRules.push(signal.severityHint === 0 ? 'severity.zero-c0' : 'severity.default-c1')
  return { level: signal.severityHint === 0 ? 'C0' : 'C1', matchedRules }
}

function actionFor(level: AttentionLevel): AttentionAction {
  switch (level) {
    case 'C0': return 'IGNORE'
    case 'C1': return 'INBOX'
    case 'C2': return 'INTERRUPT'
    case 'C3': return 'ESCALATE'
  }
}

function confidenceFor(signal: CanarySignal, level: AttentionLevel): number {
  const authoritative = signal.evidence.some(item => item.authority === 'host' || item.authority === 'runtime')
  if (level === 'C3') return authoritative ? 0.98 : 0.78
  if (authoritative) return 0.94
  if (signal.evidence.some(item => item.authority === 'derived')) return 0.82
  return 0.68
}

function suggestionFor(reason: ReasonCode): string | undefined {
  switch (reason) {
    case 'HUMAN_APPROVAL_REQUIRED': return 'Review the pending approval in DSH and approve or reject it.'
    case 'HUMAN_QUESTION_PENDING': return 'Answer the pending question in DSH when you are ready.'
    case 'HOST_UNREACHABLE': return 'Check the DSH host and browser connection before continuing.'
    case 'HOST_SUSPECTED_STALL': return 'Inspect the session before deciding whether to resume or stop it.'
    case 'TOOL_FAILURE_LOOP': return 'Review the repeated tool failure and adjust the task or environment.'
    case 'NO_MEANINGFUL_PROGRESS': return 'Review the session and decide whether the task needs adjustment.'
    case 'SUBAGENT_PRESSURE': return 'Review active subagents and their budgets; no automatic cancellation is performed.'
    case 'CONTEXT_PRESSURE': return 'Review the context state and consider a concise continuation.'
    case 'COMPLETION_SUSPICIOUS': return 'Check the final evidence before accepting the task as complete.'
    case 'TASK_FAILED': return 'Inspect the failure evidence and decide whether to retry.'
    case 'TASK_ABORTED': return 'Confirm whether the aborted task should be resumed.'
    case 'HOST_STALL_RECOVERED': return 'The session is producing events again; review the recovered item if the interruption was unexpected.'
    default: return undefined
  }
}

function messageKeyFor(reason: ReasonCode): string {
  return `item.reason.${reason}`
}

function suggestionKeyFor(reason: ReasonCode): string {
  return `item.suggestion.${reason}`
}

function messageParamsFor(signal: CanarySignal): MessageParams | undefined {
  const params: MessageParams = {}
  for (const key of ['threshold', 'failureCount', 'activeSubagents', 'idleMs', 'contextCompactions'] as const) {
    const value = signal.data[key]
    if (typeof value === 'number' && Number.isFinite(value)) params[key] = value
  }
  const idleMs = signal.data.idleMs
  if (typeof idleMs === 'number' && Number.isFinite(idleMs)) {
    params.idleMinutes = Math.max(1, Math.round(idleMs / 60_000))
  }
  const toolName = signal.data.toolName
  if (typeof toolName === 'string') {
    const safeToolName = toolName.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80)
    if (safeToolName) params.toolName = safeToolName
  }
  return Object.keys(params).length > 0 ? params : undefined
}

function authoritySummary(signal: CanarySignal): PolicyDecisionTrace['authoritySummary'] {
  const counts: Record<EvidenceAuthority, number> = { host: 0, runtime: 0, derived: 0, heuristic: 0 }
  for (const evidence of signal.evidence) counts[evidence.authority] += 1
  const strongest: EvidenceAuthority = counts.host > 0
    ? 'host'
    : counts.runtime > 0
      ? 'runtime'
      : counts.derived > 0
        ? 'derived'
        : 'heuristic'
  return { strongest, counts }
}

export function judgeSignal(signal: CanarySignal): AttentionVerdict {
  const classification = levelFor(signal)
  const level = classification.level
  const suggestedAction = suggestionFor(signal.kind)
  const messageParams = messageParamsFor(signal)
  const why = signal.kind === 'TASK_COMPLETED'
    ? 'The session reported a normal turn completion.'
    : signal.kind === 'COMPACTION_OCCURRED'
      ? 'DSH reported a context compaction event; this is recorded for status visibility.'
      : signal.kind === 'SUBAGENT_PRESSURE'
        ? `Active subagent pressure crossed the configured ${signal.data.threshold ?? 'standard'} threshold.`
        : signal.evidence[0]?.summary ?? 'A DeepCanary provider observed an attention-worthy runtime fact.'
  const action = actionFor(level)
  const decisionTrace: PolicyDecisionTrace = {
    schemaVersion: 1,
    policyVersion: ATTENTION_POLICY_VERSION,
    verdictId: signal.id,
    matchedRules: classification.matchedRules,
    appliedScopes: ['global'],
    suppressedBy: [],
    authoritySummary: authoritySummary(signal),
    finalLevel: level,
    finalAction: action,
    ...(signal.kind === 'HOST_STALL_RECOVERED' ? { recoveryRule: 'recovery.host-stall-closes-root-cause' } : {}),
  }
  return {
    schemaVersion: ATTENTION_PROTOCOL_VERSION,
    eventId: signal.id,
    level,
    action,
    confidence: confidenceFor(signal, level),
    reasonCode: signal.kind,
    messageKey: messageKeyFor(signal.kind),
    ...(messageParams === undefined ? {} : { messageParams }),
    ...(suggestedAction === undefined ? {} : { suggestionKey: suggestionKeyFor(signal.kind) }),
    policyVersion: ATTENTION_POLICY_VERSION,
    why,
    ...(suggestedAction === undefined ? {} : { suggestedAction }),
    evidence: signal.evidence,
    decisionTrace,
  }
}
