import { createHash } from 'node:crypto'

/** Delivery sinks currently implemented by the plugin. */
export type DeliverySink = 'browser'

/** Monotonic delivery states shared by browser and future OS sink evidence. */
export type DeliveryState =
  | 'planned'
  | 'attempted'
  | 'browser-constructed'
  | 'browser-shown'
  | 'os-observed'
  | 'clicked'
  | 'failed'
  | 'superseded'

export interface PersistedDeliveryEntry {
  /** Hash of verdictId + conditionGeneration + sink. */
  logicalKeyHash: string
  sink: DeliverySink
  /** Hash of the opaque notification attempt identity. */
  attemptHash: string
  /** Bounded set of attempts already seen for this logical delivery. */
  attemptHashes: string[]
  state: DeliveryState
  attempts: number
  firstObservedAt: string
  updatedAt: string
}

export interface DeliveryRecordInput {
  verdictId: string
  conditionGeneration: string
  sink: DeliverySink
  attemptId: string
  stage: 'attempted' | 'constructed' | 'click-handler-attached' | 'clicked' | 'error'
  observedAt: string
}

const MAX_ENTRIES = 512

const stateRank: Record<DeliveryState, number> = {
  planned: 0,
  attempted: 1,
  'browser-constructed': 2,
  'browser-shown': 3,
  'os-observed': 4,
  clicked: 5,
  failed: 0,
  superseded: -1,
}

function hash(value: string): string {
  return createHash('sha256').update(value).digest('hex').slice(0, 16)
}

function stateForStage(stage: DeliveryRecordInput['stage']): DeliveryState {
  switch (stage) {
    case 'attempted': return 'attempted'
    case 'constructed':
    case 'click-handler-attached': return 'browser-constructed'
    case 'clicked': return 'clicked'
    case 'error': return 'failed'
  }
}

function canAdvance(current: DeliveryState, incoming: DeliveryState): boolean {
  if (incoming === 'failed') {
    // A failure can close a delivery that has not reached a visible or
    // clicked state. Delayed errors cannot erase an observed success.
    return current !== 'browser-shown' && current !== 'os-observed' && current !== 'clicked'
  }
  return current === 'failed' || current === 'superseded' || stateRank[incoming] > stateRank[current]
}

function isIsoDate(value: string): boolean {
  return Number.isFinite(Date.parse(value))
}

function isDeliveryState(value: unknown): value is DeliveryState {
  return value === 'planned'
    || value === 'attempted'
    || value === 'browser-constructed'
    || value === 'browser-shown'
    || value === 'os-observed'
    || value === 'clicked'
    || value === 'failed'
    || value === 'superseded'
}

function validEntry(value: PersistedDeliveryEntry): boolean {
  return /^[a-f0-9]{16}$/.test(value.logicalKeyHash)
    && value.sink === 'browser'
    && /^[a-f0-9]{16}$/.test(value.attemptHash)
    && Array.isArray(value.attemptHashes)
    && value.attemptHashes.length > 0
    && value.attemptHashes.length <= 16
    && value.attemptHashes.every(candidate => /^[a-f0-9]{16}$/.test(candidate))
    && isDeliveryState(value.state)
    && Number.isSafeInteger(value.attempts)
    && value.attempts >= 1
    && value.attempts <= MAX_ENTRIES
    && isIsoDate(value.firstObservedAt)
    && isIsoDate(value.updatedAt)
}

/**
 * Bounded, privacy-safe delivery state. It records only hashes, enums and
 * timestamps, and treats delayed browser callbacks as idempotent transitions.
 */
export class DeliveryLedger {
  private readonly entries = new Map<string, PersistedDeliveryEntry>()

  record(input: DeliveryRecordInput): void {
    const observedAt = Date.parse(input.observedAt)
    if (!Number.isFinite(observedAt)) return
    const logicalKeyHash = hash(`${input.verdictId}\u0000${input.conditionGeneration}\u0000${input.sink}`)
    const attemptHash = hash(input.attemptId)
    const incomingState = stateForStage(input.stage)
    const current = this.entries.get(logicalKeyHash)
    if (current === undefined) {
      this.entries.set(logicalKeyHash, {
        logicalKeyHash,
        sink: input.sink,
        attemptHash,
        attemptHashes: [attemptHash],
        state: incomingState,
        attempts: 1,
        firstObservedAt: input.observedAt,
        updatedAt: input.observedAt,
      })
      this.trim()
      return
    }

    const sameAttempt = current.attemptHashes.includes(attemptHash)
    const currentTime = Date.parse(current.updatedAt)
    const incomingIsNewer = !Number.isFinite(currentTime) || observedAt >= currentTime
    const next = { ...current }
    if (!sameAttempt) {
      next.attempts = Math.min(MAX_ENTRIES, current.attempts + 1)
      next.attemptHashes = [...current.attemptHashes, attemptHash].slice(-16)
      // A new attempt can reopen a failed/superseded logical delivery. A
      // successful terminal state remains visible while the retry is tracked.
      if (incomingIsNewer && canAdvance(current.state, incomingState)) {
        next.state = incomingState
        next.attemptHash = attemptHash
        next.updatedAt = input.observedAt
      }
    } else if (incomingIsNewer && canAdvance(current.state, incomingState)) {
      next.state = incomingState
      next.updatedAt = input.observedAt
    }

    if (observedAt < Date.parse(next.firstObservedAt)) next.firstObservedAt = input.observedAt
    this.entries.set(logicalKeyHash, next)
    this.trim()
  }

  restore(entries: readonly PersistedDeliveryEntry[]): void {
    this.entries.clear()
    for (const entry of entries) {
      if (!validEntry(entry)) continue
      this.entries.set(entry.logicalKeyHash, { ...entry })
    }
    this.trim()
  }

  snapshot(): PersistedDeliveryEntry[] {
    return [...this.entries.values()]
      .sort((left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt))
      .map(entry => ({ ...entry }))
  }

  size(): number {
    return this.entries.size
  }

  private trim(): void {
    if (this.entries.size <= MAX_ENTRIES) return
    const entries = [...this.entries.values()]
      .sort((left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt))
      .slice(0, MAX_ENTRIES)
    this.entries.clear()
    for (const entry of entries) this.entries.set(entry.logicalKeyHash, entry)
  }
}
