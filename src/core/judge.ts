import { ATTENTION_POLICY_VERSION, ATTENTION_PROTOCOL_VERSION } from '../types.js'
import type { AttentionAction, AttentionLevel, AttentionVerdict, CanarySignal, MessageParams, ReasonCode } from '../types.js'

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

function levelFor(signal: CanarySignal): AttentionLevel {
  if (signal.data.healthy === true) return 'C0'
  if (signal.data.userViewing === true && signal.severityHint !== 0) return 'C1'
  if (signal.kind === 'HOST_UNREACHABLE') return signal.evidence.some(item => item.authority === 'host' || item.authority === 'runtime') ? 'C3' : 'C2'
  if (signal.kind === 'SUBAGENT_PRESSURE') {
    if (signal.severityHint === 3) return 'C3'
    if (signal.severityHint === 2) return 'C2'
    return 'C1'
  }
  if (signal.severityHint === 3 && signal.evidence.some(item => item.authority === 'host' || item.authority === 'runtime')) return 'C3'
  if (c2Reasons.has(signal.kind)) return 'C2'
  if (signal.kind === 'TASK_COMPLETED' || signal.kind === 'COMPACTION_OCCURRED') return 'C1'
  return signal.severityHint === 0 ? 'C0' : 'C1'
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
  for (const key of ['threshold', 'failureCount', 'activeSubagents', 'idleMs'] as const) {
    const value = signal.data[key]
    if (typeof value === 'number' && Number.isFinite(value)) params[key] = value
  }
  return Object.keys(params).length > 0 ? params : undefined
}

export function judgeSignal(signal: CanarySignal): AttentionVerdict {
  const level = levelFor(signal)
  const suggestedAction = suggestionFor(signal.kind)
  const messageParams = messageParamsFor(signal)
  const why = signal.kind === 'TASK_COMPLETED'
    ? 'The session reported a normal turn completion.'
    : signal.kind === 'COMPACTION_OCCURRED'
      ? 'DSH reported a context compaction event; this is recorded for status visibility.'
      : signal.kind === 'SUBAGENT_PRESSURE'
        ? `Active subagent pressure crossed the configured ${signal.data.threshold ?? 'standard'} threshold.`
        : signal.evidence[0]?.summary ?? 'A DeepCanary provider observed an attention-worthy runtime fact.'
  return {
    schemaVersion: ATTENTION_PROTOCOL_VERSION,
    eventId: signal.id,
    level,
    action: actionFor(level),
    confidence: confidenceFor(signal, level),
    reasonCode: signal.kind,
    messageKey: messageKeyFor(signal.kind),
    ...(messageParams === undefined ? {} : { messageParams }),
    ...(suggestedAction === undefined ? {} : { suggestionKey: suggestionKeyFor(signal.kind) }),
    policyVersion: ATTENTION_POLICY_VERSION,
    why,
    ...(suggestedAction === undefined ? {} : { suggestedAction }),
    evidence: signal.evidence,
  }
}
