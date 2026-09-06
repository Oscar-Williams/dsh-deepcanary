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
  attemptHash?: string
  /** Bounded set of attempts already seen for this logical delivery. */
  attemptHashes: string[]
  state: DeliveryState
  attempts: number
  firstObservedAt: string
  updatedAt: string
  /** Hash of the short-lived client owner holding the send claim. */
  claimOwnerHash?: string
  /** Expiry of the short-lived send claim. */
  claimExpiresAt?: string
  /** Number of server-side claim opportunities consumed for this delivery. */
  claimAttempts?: number
}

export interface DeliveryRecordInput {
  verdictId: string
  conditionGeneration: string
  sink: DeliverySink
  attemptId: string
  stage: 'attempted' | 'constructed' | 'click-handler-attached' | 'clicked' | 'error'
  observedAt: string
}

export type DeliveryClaimOutcome = 'granted' | 'already-claimed' | 'already-complete' | 'unavailable'

export interface DeliveryClaimInput {
  verdictId: string
  conditionGeneration: string
  sink: DeliverySink
  clientInstance: string
  expiresAt: string
  claimedAt?: string
}

export interface DeliveryClaimResult {
  outcome: DeliveryClaimOutcome
  logicalKeyHash?: string
  claimExpiresAt?: string
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
  const planned = value.state === 'planned'
  return /^[a-f0-9]{16}$/.test(value.logicalKeyHash)
    && value.sink === 'browser'
    && (value.attemptHash === undefined || /^[a-f0-9]{16}$/.test(value.attemptHash))
    && Array.isArray(value.attemptHashes)
    && (planned ? value.attemptHashes.length === 0 : value.attemptHashes.length > 0)
    && value.attemptHashes.length <= 16
    && value.attemptHashes.every(candidate => /^[a-f0-9]{16}$/.test(candidate))
    && (planned ? value.attemptHash === undefined : value.attemptHash !== undefined)
    && isDeliveryState(value.state)
    && Number.isSafeInteger(value.attempts)
    && value.attempts >= 0
    && (planned ? value.attempts === 0 : value.attempts >= 1)
    && value.attempts <= MAX_ENTRIES
    && isIsoDate(value.firstObservedAt)
    && isIsoDate(value.updatedAt)
    && (value.claimOwnerHash === undefined || /^[a-f0-9]{16}$/.test(value.claimOwnerHash))
    && (value.claimExpiresAt === undefined || isIsoDate(value.claimExpiresAt))
    && ((value.claimOwnerHash === undefined) === (value.claimExpiresAt === undefined))
    && (value.claimAttempts === undefined
      || (Number.isSafeInteger(value.claimAttempts) && value.claimAttempts >= 0 && value.claimAttempts <= MAX_DELIVERY_ATTEMPTS))
}

/**
 * Bounded, privacy-safe delivery state. It records only hashes, enums and
 * timestamps, and treats delayed browser callbacks as idempotent transitions.
 */
export class DeliveryLedger {
  private readonly entries = new Map<string, PersistedDeliveryEntry>()

  /**
   * Atomically reserve one logical browser delivery for a short window.
   * Only hashes, enums and timestamps cross the persistence boundary.
   */
  claim(input: DeliveryClaimInput): DeliveryClaimResult {
    if (!isPrintable(input.verdictId)
      || !isPrintable(input.conditionGeneration)
      || input.sink !== 'browser'
      || !isPrintable(input.clientInstance)) return { outcome: 'unavailable' }
    const claimedAt = input.claimedAt ?? new Date().toISOString()
    const claimedAtMs = Date.parse(claimedAt)
    const expiresAtMs = Date.parse(input.expiresAt)
    if (!Number.isFinite(claimedAtMs)
      || !Number.isFinite(expiresAtMs)
      || expiresAtMs <= claimedAtMs
      || expiresAtMs - claimedAtMs > MAX_CLAIM_MS) return { outcome: 'unavailable' }

    const logicalKeyHash = logicalHash(input.verdictId, input.conditionGeneration, input.sink)
    const current = this.entries.get(logicalKeyHash)
    if (current !== undefined) {
      if (isComplete(current.state)) return { outcome: 'already-complete', logicalKeyHash }
      const currentExpiry = current.claimExpiresAt === undefined ? Number.NaN : Date.parse(current.claimExpiresAt)
      if (current.claimOwnerHash !== undefined && Number.isFinite(currentExpiry) && currentExpiry > claimedAtMs) {
        const ownerHash = hash(input.clientInstance)
        if (ownerHash !== current.claimOwnerHash) {
          return {
            outcome: 'already-claimed',
            logicalKeyHash,
            ...(current.claimExpiresAt === undefined ? {} : { claimExpiresAt: current.claimExpiresAt }),
          }
        }
        // A retry from the same tab is idempotent and may continue its claim.
        return {
          outcome: 'granted',
          logicalKeyHash,
          ...(current.claimExpiresAt === undefined ? {} : { claimExpiresAt: current.claimExpiresAt }),
        }
      }
      const claimAttempts = current.claimAttempts ?? 0
      if (claimAttempts >= MAX_DELIVERY_ATTEMPTS) return { outcome: 'unavailable', logicalKeyHash }
      current.claimOwnerHash = hash(input.clientInstance)
      current.claimExpiresAt = input.expiresAt
      current.claimAttempts = claimAttempts + 1
      current.updatedAt = claimedAt
      this.entries.set(logicalKeyHash, current)
      this.trim()
      return { outcome: 'granted', logicalKeyHash, claimExpiresAt: input.expiresAt }
    }

    this.entries.set(logicalKeyHash, {
      logicalKeyHash,
      sink: input.sink,
      attemptHashes: [],
      state: 'planned',
      attempts: 0,
      firstObservedAt: claimedAt,
      updatedAt: claimedAt,
      claimOwnerHash: hash(input.clientInstance),
      claimExpiresAt: input.expiresAt,
      claimAttempts: 1,
    })
    this.trim()
    return { outcome: 'granted', logicalKeyHash, claimExpiresAt: input.expiresAt }
  }

  record(input: DeliveryRecordInput): void {
    const observedAt = Date.parse(input.observedAt)
    if (!Number.isFinite(observedAt)) return
    const logicalKeyHash = logicalHash(input.verdictId, input.conditionGeneration, input.sink)
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
    // A callback from an older browser attempt must not mutate a fresh
    // planned claim (or invalidate its planned-entry shape) after another
    // tab has taken over. The newer claimant remains authoritative.
    if (current.state === 'planned' && current.claimOwnerHash !== undefined && !incomingIsNewer) return
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

    if (incomingState === 'failed' && incomingIsNewer && canAdvance(current.state, incomingState)) {
      delete next.claimOwnerHash
      delete next.claimExpiresAt
    } else if (incomingState !== 'failed' && isComplete(next.state)) {
      delete next.claimOwnerHash
      delete next.claimExpiresAt
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

const MAX_CLAIM_MS = 5 * 60 * 1000
const MAX_DELIVERY_ATTEMPTS = 3

function isPrintable(value: unknown): value is string {
  return typeof value === 'string'
    && value.length > 0
    && value.length <= 256
    && !/[\u0000-\u001f\u007f]/.test(value)
}

function logicalHash(verdictId: string, conditionGeneration: string, sink: DeliverySink): string {
  return hash(`${verdictId}\u0000${conditionGeneration}\u0000${sink}`)
}

function isComplete(state: DeliveryState): boolean {
  return state === 'browser-constructed'
    || state === 'browser-shown'
    || state === 'os-observed'
    || state === 'clicked'
}
