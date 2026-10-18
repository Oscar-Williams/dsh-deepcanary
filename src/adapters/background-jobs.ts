import { createHash } from 'node:crypto'
import type { CanarySignal } from '../types.js'

export const MAX_BACKGROUND_WATCHES = 256
const WATCH_RETENTION_MS = 7 * 24 * 60 * 60 * 1_000
type BackgroundKind = 'shell' | 'workflow' | 'subagent' | 'other'
type JobStatus = 'running' | 'stopping' | 'completed' | 'failed' | 'killed'

/** Only opaque navigation identity, enums and times belong in reminder state. */
export interface BackgroundWatch {
  jobRef: string
  sessionId: string
  kind: BackgroundKind
  startedAt: number
  state: 'running' | 'stopping' | 'unknown' | 'settled'
}
interface JobFact extends Omit<BackgroundWatch, 'state'> {
  status: JobStatus
  finishedAt?: number
}
export interface BackgroundSettlement extends JobFact {
  status: 'completed' | 'failed'
  catchup: boolean
}
export interface BackgroundSummary {
  available: boolean
  running: number
  unknown: number
  limited: boolean
}
interface JobRegistryLike { list(owner: string): unknown }
const record = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value)
const opaque = (value: unknown): value is string => typeof value === 'string' && value.length > 0 && value.length <= 256 && !/[\u0000-\u001f\u007f]/.test(value)
const timestamp = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 && value <= 8.64e15
const kindOf = (kind: unknown): BackgroundKind => kind === 'bash' ? 'shell' : kind === 'workflow' ? 'workflow' : kind === 'subagent' ? 'subagent' : 'other'

export function isBackgroundWatch(value: unknown): value is BackgroundWatch {
  return record(value) && typeof value.jobRef === 'string' && /^[a-f0-9]{16}$/.test(value.jobRef)
    && opaque(value.sessionId) && ['shell', 'workflow', 'subagent', 'other'].includes(String(value.kind))
    && timestamp(value.startedAt) && ['running', 'stopping', 'unknown', 'settled'].includes(String(value.state))
}

export function copyBackgroundWatch(value: BackgroundWatch): BackgroundWatch {
  return { jobRef: value.jobRef, sessionId: value.sessionId, kind: value.kind, startedAt: value.startedAt, state: value.state }
}

/** A synchronous public roster read keeps turn-end facts current within the same event burst. */
export function countRunningBackgroundJobs(registry: JobRegistryLike | undefined, owner: string): number | undefined {
  try {
    const rows = registry?.list(owner)
    if (!Array.isArray(rows)) return undefined
    return rows.filter(value => record(value) && value.owner === owner && (value.status === 'running' || value.status === 'stopping')).length
  } catch { return undefined }
}

/** Select fields individually: labels, progress text, output and detail remain unread. */
function jobFact(value: unknown): JobFact | undefined {
  if (!record(value) || !opaque(value.id) || !opaque(value.owner) || !timestamp(value.startedAt)
    || !['running', 'stopping', 'completed', 'failed', 'killed'].includes(String(value.status))) return undefined
  if (value.status !== 'running' && value.status !== 'stopping' && (!timestamp(value.finishedAt) || value.finishedAt < value.startedAt)) return undefined
  return { jobRef: createHash('sha256').update(value.id).digest('hex').slice(0, 16), sessionId: value.owner, kind: kindOf(value.kind), startedAt: value.startedAt,
    status: value.status as JobStatus, ...(timestamp(value.finishedAt) ? { finishedAt: value.finishedAt } : {}) }
}

/** Strip a public event before an asynchronous consumer retains it. */
export function selectBackgroundEvent(value: unknown): Record<string, unknown> | undefined {
  if (!record(value)) return undefined
  if (value.type === 'output') {
    if (!opaque(value.id) || !opaque(value.owner) || typeof value.total !== 'number' || !Number.isSafeInteger(value.total) || value.total < 0) return undefined
    return { type: 'output', id: value.id, owner: value.owner, total: value.total }
  }
  if (value.type !== 'registered' && value.type !== 'stopping' && value.type !== 'settled') return undefined
  const fact = jobFact(value.job)
  if (fact === undefined || !record(value.job)) return undefined
  return { type: value.type, job: { id: value.job.id, owner: fact.sessionId,
    kind: fact.kind === 'shell' ? 'bash' : fact.kind, status: fact.status, startedAt: fact.startedAt,
    ...(fact.finishedAt === undefined ? {} : { finishedAt: fact.finishedAt }) },
    ...(value.cause === 'producer' || value.cause === 'kill' || value.cause === 'teardown' ? { cause: value.cause } : {}),
    ...(typeof value.awaited === 'boolean' ? { awaited: value.awaited } : {}) }
}

/** Durable lifecycle facts retain the original owner even in copied/forked history. */
function settlementsFromSession(session: unknown): Map<string, { job: JobFact; cause: string }> {
  const result = new Map<string, { job: JobFact; cause: string }>()
  if (!record(session) || !opaque(session.id) || typeof session.snapshotEvents !== 'function') return result
  try {
    const events: unknown = session.snapshotEvents()
    if (!Array.isArray(events)) return result
    for (const event of events) {
      if (!record(event) || event.type !== 'job/settled' || !record(event.data)) continue
      const data = event.data
      if (data.owner !== session.id) continue
      const job = jobFact({ id: data.jobId, owner: data.owner, kind: data.kind, startedAt: data.startedAt,
        status: data.status, finishedAt: data.finishedAt })
      if (job === undefined || !['producer', 'kill', 'teardown'].includes(String(data.cause))) continue
      result.set(job.jobRef, { job, cause: String(data.cause) })
      if (result.size > MAX_BACKGROUND_WATCHES) result.delete(result.keys().next().value!)
    }
  } catch { /* Missing history leaves the watch unknown. */ }
  return result
}

/** Observe public job lifecycles without controlling jobs or consuming their output. */
export class BackgroundJobTracker {
  private readonly watches = new Map<string, BackgroundWatch>()
  private readonly progress = new Map<string, { total: number; at: number }>()
  private available = false
  private limited = false

  restore(values: readonly BackgroundWatch[]): void {
    for (const value of values.slice(-MAX_BACKGROUND_WATCHES)) {
      if (isBackgroundWatch(value)) this.watches.set(value.jobRef, { ...copyBackgroundWatch(value), state: value.state === 'settled' ? 'settled' : 'unknown' })
    }
  }

  snapshot(): BackgroundWatch[] { return [...this.watches.values()].map(value => ({ ...value })) }
  summary(): BackgroundSummary {
    const values = [...this.watches.values()]
    return { available: this.available, running: values.filter(value => value.state === 'running' || value.state === 'stopping').length,
      unknown: values.filter(value => value.state === 'unknown').length, limited: this.limited }
  }
  runningFor(sessionId: string): number {
    return [...this.watches.values()].filter(value => value.sessionId === sessionId && (value.state === 'running' || value.state === 'stopping')).length
  }
  lastActivityFor(sessionId: string): number | undefined {
    let latest: number | undefined
    for (const watch of this.watches.values()) {
      if (watch.sessionId !== sessionId || (watch.state !== 'running' && watch.state !== 'stopping')) continue
      const at = this.progress.get(watch.jobRef)?.at
      if (at !== undefined && (latest === undefined || at > latest)) latest = at
    }
    return latest
  }
  unavailable(): void {
    this.available = false
    this.progress.clear()
    for (const value of this.watches.values()) if (value.state !== 'settled') value.state = 'unknown'
  }

  reconcile(registry: JobRegistryLike, sessions: readonly unknown[], now = Date.now()): BackgroundSettlement[] {
    this.limited = false
    const previous = new Map(this.watches)
    const sessionMap = new Map(sessions.filter(record).filter(value => opaque(value.id)).map(value => [value.id as string, value]))
    const owners = new Set([...sessionMap.keys(), ...[...previous.values()].map(value => value.sessionId)])
    const current = new Map<string, JobFact>()
    const readable = new Set<string>()
    for (const owner of owners) {
      try {
        const rows = registry.list(owner)
        if (!Array.isArray(rows)) continue
        readable.add(owner)
        for (const row of rows) {
          const job = jobFact(row)
          if (job?.sessionId !== owner) continue
          if (job.status !== 'running' && job.status !== 'stopping' && !previous.has(job.jobRef)) continue
          if (current.size < MAX_BACKGROUND_WATCHES || previous.has(job.jobRef)) current.set(job.jobRef, job)
          else this.limited = true
        }
      } catch { /* Failed reads cannot prove completion or failure. */ }
    }
    this.available = readable.size > 0 || owners.size === 0
    const settled: BackgroundSettlement[] = []
    const history = new Map<string, ReturnType<typeof settlementsFromSession>>()
    for (const [ref, watch] of previous) {
      if (watch.state === 'settled') {
        if (now - watch.startedAt > WATCH_RETENTION_MS) { this.watches.delete(ref); this.progress.delete(ref) }
        continue
      }
      const live = current.get(ref)
      if (live?.status === 'running' || live?.status === 'stopping') { this.keep(live); continue }
      if (!history.has(watch.sessionId)) history.set(watch.sessionId, settlementsFromSession(sessionMap.get(watch.sessionId)))
      const durable = history.get(watch.sessionId)?.get(ref)
      const terminal = durable?.job ?? live
      if (terminal !== undefined && terminal.status !== 'running' && terminal.status !== 'stopping' && durable !== undefined) {
        this.markSettled(terminal)
        if (durable.cause === 'producer' && (terminal.status === 'completed' || terminal.status === 'failed')) {
          settled.push({ ...terminal, status: terminal.status, catchup: true })
        }
      } else if (now - watch.startedAt > WATCH_RETENTION_MS) { this.watches.delete(ref); this.progress.delete(ref) }
      else this.watches.set(ref, { ...watch, state: 'unknown' })
    }
    // Existing terminal jobs are a baseline, rather than a new arrival.
    for (const job of current.values()) if (job.status === 'running' || job.status === 'stopping') this.keep(job)
    return settled
  }

  observe(event: unknown): BackgroundSettlement | undefined {
    if (!record(event) || event.type === 'progress') return undefined
    if (event.type === 'output') {
      if (!opaque(event.id) || !opaque(event.owner) || typeof event.total !== 'number' || !Number.isSafeInteger(event.total) || event.total < 0) return undefined
      const ref = createHash('sha256').update(event.id).digest('hex').slice(0, 16)
      const watch = this.watches.get(ref)
      const previous = this.progress.get(ref)
      if (watch?.sessionId === event.owner && (watch.state === 'running' || watch.state === 'stopping')
        && previous !== undefined && event.total > previous.total) this.progress.set(ref, { total: event.total, at: Date.now() })
      return undefined
    }
    const job = jobFact(event.job)
    if (job === undefined) return undefined
    this.available = true
    if (event.type === 'registered' || event.type === 'stopping') { this.keep(job); return undefined }
    if (event.type !== 'settled') return undefined
    if (this.watches.get(job.jobRef)?.state === 'settled') return undefined
    this.markSettled(job)
    if (event.cause !== 'producer' || event.awaited !== false || (job.status !== 'completed' && job.status !== 'failed')) return undefined
    return { ...job, status: job.status, catchup: false }
  }

  private keep(job: JobFact): void {
    if (job.status !== 'running' && job.status !== 'stopping') return
    if (this.watches.size >= MAX_BACKGROUND_WATCHES && !this.watches.has(job.jobRef)) {
      const discard = [...this.watches.values()].find(value => value.state === 'settled')
        ?? [...this.watches.values()].find(value => value.state === 'unknown')
      if (discard === undefined) { this.limited = true; return }
      if (discard.state === 'unknown') this.limited = true
      this.watches.delete(discard.jobRef)
      this.progress.delete(discard.jobRef)
    }
    this.watches.set(job.jobRef, { jobRef: job.jobRef, sessionId: job.sessionId, kind: job.kind,
      startedAt: job.startedAt, state: job.status })
    if (!this.progress.has(job.jobRef)) this.progress.set(job.jobRef, { total: 0, at: Date.now() })
  }

  private markSettled(job: JobFact): void {
    this.progress.delete(job.jobRef)
    if (this.watches.size >= MAX_BACKGROUND_WATCHES && !this.watches.has(job.jobRef)) {
      const previous = [...this.watches.values()].find(value => value.state === 'settled')
      if (previous === undefined) return
      this.watches.delete(previous.jobRef)
    }
    this.watches.set(job.jobRef, { jobRef: job.jobRef, sessionId: job.sessionId, kind: job.kind,
      startedAt: job.startedAt, state: 'settled' })
  }
}

export function signalFromBackgroundSettlement(job: BackgroundSettlement): CanarySignal {
  const kind = job.status === 'failed' ? 'TASK_FAILED' : 'TASK_COMPLETED'
  return { schemaVersion: 1, id: `background-${job.jobRef}-${job.status}`,
    occurredAt: new Date(job.catchup ? Date.now() : job.finishedAt ?? Date.now()).toISOString(), source: 'tool', kind, sessionId: job.sessionId,
    severityHint: job.status === 'failed' ? 2 : 1,
    evidence: [{ type: 'runtime-probe', authority: 'runtime', ref: `background:${job.jobRef}`,
      summary: `DSH reported a ${job.status} background task (${job.kind}).` }],
    dedupeKey: `background:${job.jobRef}:${job.status}`,
    bundleKey: job.status === 'failed' ? `${job.sessionId}:failure` : `${job.sessionId}:background:completed`,
    data: { backgroundJob: true, backgroundKind: job.kind, catchup: job.catchup } }
}
