import { createHash } from 'node:crypto'
import type { ReasonCode, CanarySignal, EvidenceRef } from './types.js'

export interface SessionFacts {
  toolFailures: number
  activeSubagents: number
  lastEventAt: number
  startedAt: number
  contextCompactions?: number
  lastToolName?: string
  sameToolFailures?: number
}

export interface SessionLike {
  id: string
  header?: { cwd?: string }
}

export interface SessionEventLike {
  type: string
  seq?: number
  time?: number
  /** DSH marks routine extension events so observers do not treat them as progress facts. */
  ignorable?: boolean
  data?: Record<string, unknown>
}

const approvalPattern = /approval|approve|ask[-_ ]?user|permission|confirm|clarif|question/i
const explicitQuestionTool = /^ask[_-]user[_-]question$/i

function shortHash(value: string): string {
  return createHash('sha256').update(value).digest('hex').slice(0, 12)
}

function evidence(type: EvidenceRef['type'], authority: EvidenceRef['authority'], ref: string, summary: string): EvidenceRef {
  return { type, authority, ref, summary }
}

function signal(
  source: CanarySignal['source'],
  kind: ReasonCode,
  session: SessionLike | undefined,
  event: SessionEventLike | undefined,
  facts: SessionFacts | undefined,
  item: EvidenceRef,
  data: CanarySignal['data'] = {},
  severityHint?: 0 | 1 | 2 | 3,
  bundleKey?: string,
): CanarySignal {
  const sessionId = session?.id
  const eventRef = event?.type ? `${event.type}:${event.seq ?? 'na'}` : kind
  const id = `${kind.toLowerCase()}-${shortHash(`${sessionId ?? 'host'}:${eventRef}:${event?.time ?? Date.now()}`)}`
  return {
    schemaVersion: 1,
    id,
    occurredAt: new Date(event?.time ?? Date.now()).toISOString(),
    source,
    kind,
    ...(sessionId ? { sessionId } : {}),
    ...(session?.header?.cwd ? { workspaceId: shortHash(session.header.cwd) } : {}),
    ...(severityHint !== undefined ? { severityHint } : {}),
    evidence: [item],
    dedupeKey: `${kind}:${sessionId ?? 'host'}:${event?.type ?? 'probe'}:${String(data.toolName ?? '')}`,
    ...(bundleKey ? { bundleKey } : {}),
    data: {
      ...data,
      ...(facts ? {
        activeSubagents: facts.activeSubagents,
        ...(facts.contextCompactions === undefined ? {} : { contextCompactions: facts.contextCompactions }),
        ...(facts.lastToolName === undefined ? {} : { lastToolName: facts.lastToolName }),
        ...(facts.toolFailures === undefined ? {} : { toolFailures: facts.toolFailures }),
      } : {}),
    },
  }
}

function turnEndReason(event: SessionEventLike): string | undefined {
  const reason = event.data?.reason
  if (typeof reason === 'string') return reason
  if (reason !== null && typeof reason === 'object' && 'kind' in reason) {
    const kind = (reason as { kind?: unknown }).kind
    return typeof kind === 'string' ? kind : undefined
  }
  return undefined
}

export function signalsFromSessionEvent(session: SessionLike, event: SessionEventLike, facts: SessionFacts): CanarySignal[] {
  if (event.ignorable === true) return []
  const eventType = event.type
  const data = event.data ?? {}
  const ref = `session-event:${eventType}`
  const result: CanarySignal[] = []
  const toolName = typeof data.name === 'string' ? data.name : typeof data.toolName === 'string' ? data.toolName : 'unknown-tool'
  const humanMarker = `${eventType} ${toolName} ${typeof data.kind === 'string' ? data.kind : ''}`
  const visibilityData: CanarySignal['data'] = data.userViewing === true || data.dshVisible === true ? { userViewing: true } : {}

  if (eventType === 'turn/end') {
    const reason = turnEndReason(event)
    if (reason === 'completed') {
      const suspicious = data.completionSuspicious === true
        || data.unresolvedApproval === true
        || data.failedAcceptanceProbe === true
        || data.waitingHumanAcceptance === true
        || data.verificationPassed === false
      if (suspicious) {
        result.push(signal('session', 'COMPLETION_SUSPICIOUS', session, event, facts, evidence('session-event', 'runtime', ref, 'DSH reported completion while a structured acceptance or human-needed condition remained unresolved.'), visibilityData, 2, `${session.id}:completion`))
      } else {
        result.push(signal('session', 'TASK_COMPLETED', session, event, facts, evidence('session-event', 'runtime', ref, 'DSH reported a normal turn completion.'), visibilityData, 1))
      }
    } else if (reason === 'aborted' || reason === 'interrupted') {
      result.push(signal('session', 'TASK_ABORTED', session, event, facts, evidence('session-event', 'runtime', ref, `DSH reported a ${reason} turn.`), visibilityData, 2, `${session.id}:human-needed`))
    } else if (reason === 'blocked') {
      result.push(signal('session', 'HUMAN_QUESTION_PENDING', session, event, facts, evidence('session-event', 'runtime', ref, 'DSH reported a blocked turn that may require human input.'), visibilityData, 2, `${session.id}:human-needed`))
    } else if (reason === 'error' || reason === 'max-tokens') {
      result.push(signal('session', 'TASK_FAILED', session, event, facts, evidence('session-event', 'runtime', ref, `DSH reported a terminal turn reason: ${reason}.`), visibilityData, 2, `${session.id}:failure`))
    }
  }

  // `approval/asked` is emitted by DSH immediately before its scoped
  // answerer waterfall waits for a decision. `approval/decided` is the
  // terminal audit event and must stay silent. The exact `ask_user_question`
  // tool is likewise a runtime-backed wait for an answer; approval-like tool
  // names remain a useful C2 heuristic until DSH supplies an authoritative
  // approval boundary for them.
  const authoritativeHumanWait = eventType === 'approval/asked'
    || data.humanNeeded === true
    || data.requiresApproval === true
    || (eventType === 'tool/call' && explicitQuestionTool.test(toolName))
    || eventType === 'user-questions/request'
  const heuristicHumanWait = eventType === 'tool/call' && approvalPattern.test(toolName)
  if (authoritativeHumanWait || heuristicHumanWait) {
    const question = /ask[-_ ]?user|question|clarif|human[-_ ]?input/i.test(humanMarker)
    const reasonCode = question ? 'HUMAN_QUESTION_PENDING' : 'HUMAN_APPROVAL_REQUIRED'
    const evidenceType = eventType === 'approval/asked' ? 'session-event' : 'tool-history'
    const evidenceAuthority = authoritativeHumanWait ? 'runtime' : 'heuristic'
    const evidenceSummary = authoritativeHumanWait
      ? 'DSH reported an active human interaction boundary and the session may be waiting for a decision.'
      : 'A tool boundary suggests that human input may be required.'
    result.push(signal('tool', reasonCode, session, event, facts, evidence(evidenceType, evidenceAuthority, ref, evidenceSummary), { ...visibilityData, toolName }, authoritativeHumanWait ? 3 : 2, `${session.id}:human-needed`))
  }

  const failureCount = facts.sameToolFailures ?? facts.toolFailures
  if (eventType === 'tool/result' && data.error !== undefined && failureCount >= 3) {
    result.push(signal('tool', 'TOOL_FAILURE_LOOP', session, event, facts, evidence('tool-history', 'derived', ref, 'The same tool has produced repeated structured failures.'), { ...visibilityData, failureCount, toolName: facts.lastToolName ?? toolName }, 2, `${session.id}:tool-failure-loop`))
  }

  const contextMarker = `${eventType} ${typeof data.kind === 'string' ? data.kind : ''}`
  if (/compaction|context[-_/]?(pressure|overflow)|token[-_/]?limit/i.test(contextMarker)) {
    const pressure = /pressure|overflow|token[-_/]?limit/i.test(contextMarker)
      || ((facts.contextCompactions ?? 0) >= 2 && /compaction/i.test(contextMarker))
    result.push(signal('session', pressure ? 'CONTEXT_PRESSURE' : 'COMPACTION_OCCURRED', session, event, facts, evidence('session-event', 'runtime', ref, 'DSH reported a context lifecycle event.'), visibilityData, pressure ? 2 : 1, `${session.id}:context`))
  }

  if (data.healthy !== true && (data.progress === false || data.meaningfulProgress === false || /no[-_/]?progress|stuck|idle/i.test(eventType))) {
    result.push(signal('session', 'NO_MEANINGFUL_PROGRESS', session, event, facts, evidence('runtime-probe', 'derived', ref, 'The session reported no meaningful progress during an active run.'), visibilityData, 2, `${session.id}:progress`))
  }

  return result
}

export function signalFromAgentError(payload: { agent?: { id?: string }; turn?: number; step?: number }): CanarySignal {
  const sessionId = payload.agent?.id
  return signal('agent', 'TASK_FAILED', sessionId ? { id: sessionId } : undefined, undefined, undefined, evidence('runtime-probe', 'runtime', 'agent/error', 'DSH reported an agent error.'), { turn: payload.turn ?? -1, step: payload.step ?? -1 }, 2, sessionId ? `${sessionId}:failure` : 'host:failure')
}

export function signalFromSubagentPressure(activeSubagents: number, threshold: number, now = Date.now()): CanarySignal {
  return signal('subagent', 'SUBAGENT_PRESSURE', undefined, { type: 'subagent/active', time: now }, undefined, evidence('subagent-state', 'runtime', `active:${threshold}`, `Active subagent count crossed the configured threshold (${threshold}).`), { activeSubagents, threshold }, threshold >= 24 ? 3 : threshold >= 12 ? 2 : 1, `host:subagent-pressure:${threshold}`)
}

export function signalFromHostProbe(ok: boolean, detail: string, now = Date.now(), outageId?: string): CanarySignal | undefined {
  if (ok) return undefined
  return signal('host', 'HOST_UNREACHABLE', undefined, { type: 'host/probe', time: now }, undefined, evidence('http-probe', 'host', `webserver/probe:${outageId ?? 'legacy'}`, detail), outageId === undefined ? {} : { outageId }, 3, outageId === undefined ? 'host:unreachable' : `host:unreachable:${outageId}`)
}

export function signalFromStall(session: SessionLike, facts: SessionFacts, thresholdMs: number, now = Date.now()): CanarySignal | undefined {
  if (now - facts.lastEventAt < thresholdMs) return undefined
  return signal('host', 'HOST_SUSPECTED_STALL', session, { type: 'host/stall', time: now }, facts, evidence('runtime-probe', 'runtime', 'session/heartbeat', 'No new DSH session event arrived within the configured liveness window.'), { idleMs: now - facts.lastEventAt }, 2, `${session.id}:stall`)
}

export function signalFromStallRecovery(session: SessionLike, now = Date.now()): CanarySignal {
  return signal('host', 'HOST_STALL_RECOVERED', session, { type: 'host/recovered', time: now }, undefined, evidence('runtime-probe', 'runtime', 'session/heartbeat', 'A new DSH session event arrived after a suspected stall.'), {}, 1, `${session.id}:stall`)
}

export function signalFromHostRecovery(outageId?: string, now = Date.now()): CanarySignal {
  return signal('host', 'HOST_STALL_RECOVERED', undefined, { type: 'host/recovered', time: now }, undefined, evidence('http-probe', 'host', `webserver/probe:${outageId ?? 'legacy'}`, 'The local DSH WebServer responded after a failed probe.'), outageId === undefined ? {} : { outageId }, 1, outageId === undefined ? 'host:unreachable' : `host:unreachable:${outageId}`)
}
