import { createHash } from 'node:crypto'
import type { ReasonCode, CanarySignal, EvidenceRef } from './types.js'

export interface SessionFacts {
  toolFailures: number
  activeSubagents: number
  lastEventAt: number
  startedAt: number
}

export interface SessionLike {
  id: string
  header?: { cwd?: string }
}

export interface SessionEventLike {
  type: string
  seq?: number
  time?: number
  data?: Record<string, unknown>
}

const approvalPattern = /approval|approve|ask[-_ ]?user|permission|confirm|clarif|question/i

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
    data: {
      ...data,
      ...(facts ? { activeSubagents: facts.activeSubagents } : {}),
    },
  }
}

function turnEndReason(event: SessionEventLike): string | undefined {
  const reason = event.data?.reason
  return typeof reason === 'string' ? reason : undefined
}

export function signalsFromSessionEvent(session: SessionLike, event: SessionEventLike, facts: SessionFacts): CanarySignal[] {
  const eventType = event.type
  const data = event.data ?? {}
  const ref = `session-event:${eventType}`
  const result: CanarySignal[] = []

  if (eventType === 'turn/end') {
    const reason = turnEndReason(event)
    if (reason === 'completed') {
      result.push(signal('session', 'TASK_COMPLETED', session, event, facts, evidence('session-event', 'runtime', ref, 'DSH reported a normal turn completion.'), {}, 1))
    } else if (reason === 'aborted' || reason === 'interrupted') {
      result.push(signal('session', 'TASK_ABORTED', session, event, facts, evidence('session-event', 'runtime', ref, `DSH reported a ${reason} turn.`), {}, 2))
    } else if (reason === 'blocked') {
      result.push(signal('session', 'HUMAN_QUESTION_PENDING', session, event, facts, evidence('session-event', 'runtime', ref, 'DSH reported a blocked turn that may require human input.'), {}, 2))
    } else if (reason === 'error' || reason === 'max-tokens') {
      result.push(signal('session', 'TASK_FAILED', session, event, facts, evidence('session-event', 'runtime', ref, `DSH reported a terminal turn reason: ${reason}.`), {}, 2))
    }
  }

  if (eventType === 'tool/call') {
    const toolName = typeof data.name === 'string' ? data.name : 'unknown-tool'
    if (approvalPattern.test(toolName)) {
      result.push(signal('tool', toolName.toLowerCase().includes('question') ? 'HUMAN_QUESTION_PENDING' : 'HUMAN_APPROVAL_REQUIRED', session, event, facts, evidence('tool-history', 'runtime', ref, 'A tool call name indicates an approval or human-question boundary.'), { toolName }, 2))
    }
  }

  if (eventType === 'tool/result' && data.error !== undefined && facts.toolFailures >= 3) {
    result.push(signal('tool', 'TOOL_FAILURE_LOOP', session, event, facts, evidence('tool-history', 'derived', ref, 'The same session has produced repeated tool failures.'), { failureCount: facts.toolFailures }, 2))
  }

  if (/compaction|context[-_/]?(pressure|overflow)|token[-_/]?limit/i.test(eventType)) {
    result.push(signal('session', eventType.includes('pressure') || eventType.includes('overflow') ? 'CONTEXT_PRESSURE' : 'COMPACTION_OCCURRED', session, event, facts, evidence('session-event', 'runtime', ref, 'DSH reported a context lifecycle event.'), {}, eventType.includes('pressure') ? 2 : 1))
  }

  return result
}

export function signalFromAgentError(payload: { agent?: { id?: string }; turn?: number; step?: number }): CanarySignal {
  const sessionId = payload.agent?.id
  return signal('agent', 'TASK_FAILED', sessionId ? { id: sessionId } : undefined, undefined, undefined, evidence('runtime-probe', 'runtime', 'agent/error', 'DSH reported an agent error.'), { turn: payload.turn ?? -1, step: payload.step ?? -1 }, 2)
}

export function signalFromSubagentPressure(activeSubagents: number, threshold: number, now = Date.now()): CanarySignal {
  return signal('subagent', 'SUBAGENT_PRESSURE', undefined, { type: 'subagent/active', time: now }, undefined, evidence('subagent-state', 'runtime', `active:${threshold}`, `Active subagent count crossed the configured threshold (${threshold}).`), { activeSubagents, threshold }, threshold >= 24 ? 3 : threshold >= 12 ? 2 : 1)
}

export function signalFromHostProbe(ok: boolean, detail: string, now = Date.now()): CanarySignal | undefined {
  if (ok) return undefined
  return signal('host', 'HOST_UNREACHABLE', undefined, { type: 'host/probe', time: now }, undefined, evidence('http-probe', 'host', 'webserver/probe', detail), {}, 3)
}

export function signalFromStall(session: SessionLike, facts: SessionFacts, thresholdMs: number, now = Date.now()): CanarySignal | undefined {
  if (now - facts.lastEventAt < thresholdMs) return undefined
  return signal('host', 'HOST_SUSPECTED_STALL', session, { type: 'host/stall', time: now }, facts, evidence('runtime-probe', 'runtime', 'session/heartbeat', 'No new DSH session event arrived within the configured liveness window.'), { idleMs: now - facts.lastEventAt }, 2)
}
