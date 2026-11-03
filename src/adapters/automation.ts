import { createHash } from 'node:crypto'
import type { CanarySignal, TaskContext } from '../types.js'

export interface AutomationRun {
  runRef: string
  scheduleRef: string
  executionGeneration: string
  sessionId: string
  messageRef: string
  scheduledAt: string
  deliveredAt: string
  phase: 'delivered' | 'running' | 'completed' | 'failed' | 'aborted' | 'unknown'
  triggerSeq?: number
  turn?: number
  lastSeq?: number
}
const hash = (value: string): string => createHash('sha256').update(value).digest('hex').slice(0, 16)
const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value)
const id = (value: unknown): value is string => typeof value === 'string' && value.length > 0 && value.length <= 256 && !/[\u0000-\u001f\u007f]/.test(value)
const ref = (value: unknown): value is string => typeof value === 'string' && /^[a-f0-9]{16}$/.test(value)
const time = (value: unknown): value is string => typeof value === 'string' && Number.isFinite(Date.parse(value))

/** Select receipt metadata from either public catalog; never copy title, prompt or failure text. */
export function selectAutomationDelivery(value: unknown): AutomationRun | undefined {
  if (!record(value) || !id(value.id) || !record(value.lastDelivery)) return undefined
  const delivery = value.lastDelivery
  const target = delivery.targetSessionId ?? value.sessionId
  if (!id(target) || !id(delivery.messageId) || !time(delivery.scheduledAt) || !time(delivery.deliveredAt)) return undefined
  const runRef = hash(`schedule:${value.id}:${delivery.scheduledAt}:${target}:${delivery.messageId}`)
  return { runRef, scheduleRef: hash(value.id), executionGeneration: runRef, sessionId: target,
    messageRef: hash(delivery.messageId), scheduledAt: delivery.scheduledAt, deliveredAt: delivery.deliveredAt, phase: 'delivered' }
}

export function isAutomationRun(value: unknown): value is AutomationRun {
  if (!record(value)) return false
  return ref(value.runRef) && ref(value.scheduleRef) && ref(value.executionGeneration) && id(value.sessionId)
    && ref(value.messageRef) && time(value.scheduledAt) && time(value.deliveredAt)
    && ['delivered', 'running', 'completed', 'failed', 'aborted', 'unknown'].includes(String(value.phase))
    && ['triggerSeq', 'lastSeq', 'turn'].every(key => value[key] === undefined || Number.isSafeInteger(value[key]) && (value[key] as number) >= 0)
    && Object.keys(value).every(key => ['runRef', 'scheduleRef', 'executionGeneration', 'sessionId', 'messageRef', 'scheduledAt', 'deliveredAt', 'phase', 'triggerSeq', 'lastSeq', 'turn'].includes(key))
}

export class AutomationTracker {
  private readonly runs = new Map<string, AutomationRun>()
  limited = false
  restore(values: readonly AutomationRun[]): void { for (const run of values.filter(isAutomationRun).slice(-256)) this.runs.set(run.runRef, { ...run }) }
  snapshot(): AutomationRun[] { return [...this.runs.values()].map(run => ({ ...run })) }
  observeCatalog(values: readonly unknown[]): void {
    for (const value of values) {
      const run = selectAutomationDelivery(value)
      if (!run || this.runs.has(run.runRef)) continue
      if (this.runs.size >= 256) {
        const settled = [...this.runs.values()].find(item => item.phase !== 'running' && item.phase !== 'delivered')
        if (settled) this.runs.delete(settled.runRef)
        else { this.limited = true; continue }
      }
      this.runs.set(run.runRef, run)
    }
  }
  observeSession(sessionId: string, events: readonly unknown[]): void {
    for (const run of this.runs.values()) {
      if (run.sessionId !== sessionId || !['delivered', 'running'].includes(run.phase)) continue
      let turn: number | undefined
      for (const value of events) {
        if (!record(value) || !Number.isSafeInteger(value.seq) || !record(value.data)) continue
        const seq = value.seq as number
        const data = value.data
        if (value.type === 'turn/start' && Number.isSafeInteger(data.turn)) {
          turn = data.turn as number
          if (run.triggerSeq !== undefined && seq > (run.lastSeq ?? run.triggerSeq) && run.turn !== undefined && turn !== run.turn) {
            run.phase = 'unknown'; break
          }
        }
        if (value.type === 'user/message' && id(data.id) && hash(data.id) === run.messageRef && run.triggerSeq === undefined) {
          run.triggerSeq = seq
          if (turn !== undefined) run.turn = turn
          run.phase = 'running'
        }
        if (run.triggerSeq === undefined || seq <= run.triggerSeq || seq <= (run.lastSeq ?? -1)) continue
        // A turn must contain the exact admitted message. Delivery alone cannot identify a turn.
        if (value.type === 'turn/end' && run.turn !== undefined && data.turn === run.turn) {
          const reason = record(data.reason) ? data.reason.kind : data.reason
          if (reason === 'completed') run.phase = 'completed'
          else if (reason === 'error' || reason === 'max-tokens') run.phase = 'failed'
          else if (reason === 'aborted' || reason === 'interrupted') run.phase = 'aborted'
        }
        run.lastSeq = seq
      }
    }
  }
  taskForEvent(sessionId: string, seq: number): TaskContext | undefined {
    const run = [...this.runs.values()].reverse().find(run => run.sessionId === sessionId && run.triggerSeq !== undefined
      && run.triggerSeq <= seq && (run.phase === 'running' || run.lastSeq !== undefined && run.lastSeq >= seq))
    return run ? { taskRef: hash(`session:${sessionId}`), kind: 'automation', executionGeneration: run.executionGeneration,
      runRef: run.runRef, sourceSeq: seq } : undefined
  }
  contextualize(signal: CanarySignal, seq: number): CanarySignal {
    const task = signal.sessionId === undefined ? undefined : this.taskForEvent(signal.sessionId, seq)
    return task === undefined ? signal : { ...signal, task: { ...signal.task, ...task }, dedupeKey: `${signal.dedupeKey ?? signal.id}:${task.runRef}` }
  }
}
