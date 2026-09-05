import { randomUUID } from 'node:crypto'
import { mkdir, readFile, readdir, rename, stat, unlink, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { resolveStateDir } from './persistence.js'
import type { PersistedDeliveryEntry } from './core/delivery.js'
import type { AttentionLevel } from './types.js'

export const SUPERVISOR_SCHEMA_VERSION = 1 as const
export const SUPERVISOR_POLICY_STATE_SCHEMA_VERSION = 1 as const

export type SupervisorHostStatus = 'ready' | 'degraded' | 'unreachable'
export type SupervisorState = 'inactive' | 'starting' | 'standby' | 'running' | 'degraded' | 'blocked' | 'stopped'

export interface SupervisorSessionState {
  sessionRef: string
  attentionLevel: AttentionLevel
  pendingCount: number
  lastEvidenceAt?: string
}

export interface SupervisorPolicyState {
  schemaVersion: typeof SUPERVISOR_POLICY_STATE_SCHEMA_VERSION
  policyVersion: string
  dedupe: Array<{ keyHash: string; acceptedAt: string }>
  interruptConsumedAt: string[]
}

export interface SupervisorSnapshot {
  schemaVersion: typeof SUPERVISOR_SCHEMA_VERSION
  revision: number
  generatedAt: string
  host: {
    runtimeVersion: string
    status: SupervisorHostStatus
  }
  sessions: SupervisorSessionState[]
  pending: string[]
  policyState?: SupervisorPolicyState
  /** Bounded cross-sink delivery state; values contain hashes, enums and time only. */
  deliveryLedger?: PersistedDeliveryEntry[]
}

export interface SupervisorLease {
  schemaVersion: typeof SUPERVISOR_SCHEMA_VERSION
  instanceId: string
  pid: number
  startedAt: string
  heartbeatAt: string
}

export interface SupervisorMetrics {
  startupMs: number | null
  restoreMs: number | null
  writeCount: number
  heartbeatCount: number
  wakeCount: number
  stateBytes: number
  stateDirectoryBytes: number
  rssBytes: number
  peakRssBytes: number
}

export interface PersistentSupervisorStatus {
  schemaVersion: typeof SUPERVISOR_SCHEMA_VERSION
  state: SupervisorState
  instanceId: string
  leaseHeld: boolean
  restored: boolean
  staleLeaseRecovered: boolean
  revision: number
  lastSnapshotAt?: string
  lastHeartbeatAt?: string
  metrics: SupervisorMetrics
}

export interface PersistentSupervisorOptions {
  stateDir: string
  runtimeVersion: string
  staleLeaseMs?: number
  /** Retry interval while another live supervisor owns the lease. */
  standbyRetryMs?: number
  heartbeatMs?: number
  maxSessions?: number
  maxPending?: number
  now?: () => number
  pid?: number
  instanceId?: string
}

interface PersistedSupervisorState {
  schemaVersion: typeof SUPERVISOR_SCHEMA_VERSION
  snapshot: SupervisorSnapshot
}

const DEFAULT_STALE_LEASE_MS = 45_000
const DEFAULT_HEARTBEAT_MS = 10_000
const DEFAULT_MAX_SESSIONS = 256
const DEFAULT_MAX_PENDING = 2_000
const OPERATION_LOCK_STALE_MS = 30_000
const OPERATION_LOCK_WAIT_MS = 5_000

function isNodeError(error: unknown, code: string): error is NodeJS.ErrnoException {
  return error instanceof Error && 'code' in error && (error as NodeJS.ErrnoException).code === code
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function isSafeRef(value: unknown): value is string {
  return typeof value === 'string'
    && value.length > 0
    && value.length <= 128
    && !/[\u0000-\u001f\u007f]/.test(value)
}

function isIsoDate(value: unknown): value is string {
  return typeof value === 'string' && Number.isFinite(Date.parse(value))
}

function isAttentionLevel(value: unknown): value is AttentionLevel {
  return value === 'C0' || value === 'C1' || value === 'C2' || value === 'C3'
}

function isHostStatus(value: unknown): value is SupervisorHostStatus {
  return value === 'ready' || value === 'degraded' || value === 'unreachable'
}

function isPolicyState(value: unknown): value is SupervisorPolicyState {
  if (!isRecord(value)
    || value.schemaVersion !== SUPERVISOR_POLICY_STATE_SCHEMA_VERSION
    || !isSafeRef(value.policyVersion)
    || !Array.isArray(value.dedupe)
    || !Array.isArray(value.interruptConsumedAt)) return false
  const dedupe = value.dedupe
  if (dedupe.length > 512 || !dedupe.every(entry => isRecord(entry)
    && typeof entry.keyHash === 'string' && /^[a-f0-9]{16}$/.test(entry.keyHash)
    && isIsoDate(entry.acceptedAt))) return false
  if (value.interruptConsumedAt.length > 256 || !value.interruptConsumedAt.every(isIsoDate)) return false
  return true
}

function clonePolicyState(policyState: SupervisorPolicyState | undefined): SupervisorPolicyState | undefined {
  if (policyState === undefined) return undefined
  return {
    schemaVersion: SUPERVISOR_POLICY_STATE_SCHEMA_VERSION,
    policyVersion: policyState.policyVersion,
    dedupe: policyState.dedupe.map(entry => ({ ...entry })),
    interruptConsumedAt: [...policyState.interruptConsumedAt],
  }
}

function cloneSnapshot(snapshot: SupervisorSnapshot): SupervisorSnapshot {
  return {
    schemaVersion: SUPERVISOR_SCHEMA_VERSION,
    revision: snapshot.revision,
    generatedAt: snapshot.generatedAt,
    host: { ...snapshot.host },
    sessions: snapshot.sessions.map(session => ({ ...session })),
    pending: [...snapshot.pending],
    ...(snapshot.policyState === undefined ? {} : { policyState: clonePolicyState(snapshot.policyState) as SupervisorPolicyState }),
    ...(snapshot.deliveryLedger === undefined ? {} : { deliveryLedger: snapshot.deliveryLedger.map(entry => ({ ...entry, attemptHashes: [...entry.attemptHashes] })) }),
  }
}

function isDeliveryEntry(value: unknown): value is PersistedDeliveryEntry {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false
  const entry = value as Partial<PersistedDeliveryEntry>
  return typeof entry.logicalKeyHash === 'string' && /^[a-f0-9]{16}$/.test(entry.logicalKeyHash)
    && entry.sink === 'browser'
    && typeof entry.attemptHash === 'string' && /^[a-f0-9]{16}$/.test(entry.attemptHash)
    && Array.isArray(entry.attemptHashes)
    && entry.attemptHashes.length > 0
    && entry.attemptHashes.length <= 16
    && entry.attemptHashes.every(candidate => typeof candidate === 'string' && /^[a-f0-9]{16}$/.test(candidate))
    && (entry.state === 'planned'
      || entry.state === 'attempted'
      || entry.state === 'browser-constructed'
      || entry.state === 'browser-shown'
      || entry.state === 'os-observed'
      || entry.state === 'clicked'
      || entry.state === 'failed'
      || entry.state === 'superseded')
    && typeof entry.attempts === 'number' && Number.isSafeInteger(entry.attempts) && entry.attempts >= 1 && entry.attempts <= 512
    && typeof entry.firstObservedAt === 'string' && isIsoDate(entry.firstObservedAt)
    && typeof entry.updatedAt === 'string' && isIsoDate(entry.updatedAt)
}

function emptySnapshot(runtimeVersion: string, now: number): SupervisorSnapshot {
  return {
    schemaVersion: SUPERVISOR_SCHEMA_VERSION,
    revision: 0,
    generatedAt: new Date(now).toISOString(),
    host: { runtimeVersion, status: 'degraded' },
    sessions: [],
    pending: [],
  }
}

function normalizeSnapshot(
  value: unknown,
  runtimeVersion: string,
  now: number,
  maxSessions: number,
  maxPending: number,
): SupervisorSnapshot | undefined {
  if (!isRecord(value) || value.schemaVersion !== SUPERVISOR_SCHEMA_VERSION) return undefined
  const host = value.host
  if (!isRecord(host) || !isSafeRef(host.runtimeVersion) || !isHostStatus(host.status)) return undefined
  const revision = value.revision
  if (typeof revision !== 'number' || !Number.isSafeInteger(revision) || revision < 0) return undefined
  const generatedAt = isIsoDate(value.generatedAt) ? value.generatedAt : new Date(now).toISOString()
  const sessions = Array.isArray(value.sessions)
    ? value.sessions.flatMap(candidate => {
      if (!isRecord(candidate) || !isSafeRef(candidate.sessionRef) || !isAttentionLevel(candidate.attentionLevel)) return []
      const pendingCount = candidate.pendingCount
      if (typeof pendingCount !== 'number' || !Number.isSafeInteger(pendingCount) || pendingCount < 0) return []
      return [{
        sessionRef: candidate.sessionRef,
        attentionLevel: candidate.attentionLevel,
        pendingCount: Math.min(pendingCount, maxPending),
        ...(isIsoDate(candidate.lastEvidenceAt) ? { lastEvidenceAt: candidate.lastEvidenceAt } : {}),
      }]
    }).slice(0, maxSessions)
    : []
  const pending = Array.isArray(value.pending)
    ? [...new Set(value.pending.filter(isSafeRef))].slice(0, maxPending)
    : []
  const policyState = value.policyState === undefined ? undefined : isPolicyState(value.policyState) ? value.policyState : undefined
  const deliveryLedger = value.deliveryLedger === undefined
    ? undefined
    : Array.isArray(value.deliveryLedger)
      ? value.deliveryLedger.filter(isDeliveryEntry).slice(0, 512)
      : undefined
  return {
    schemaVersion: SUPERVISOR_SCHEMA_VERSION,
    revision,
    generatedAt,
    host: {
      // The current process is the authority after restore. The persisted
      // runtime version remains useful only when it is a safe string.
      runtimeVersion: isSafeRef(runtimeVersion) ? runtimeVersion : host.runtimeVersion,
      status: host.status,
    },
    sessions,
    pending,
    ...(policyState === undefined ? {} : { policyState: clonePolicyState(policyState) as SupervisorPolicyState }),
    ...(deliveryLedger === undefined ? {} : { deliveryLedger: deliveryLedger.map(entry => ({ ...entry, attemptHashes: [...entry.attemptHashes] })) }),
  }
}

function normalizeLease(value: unknown): SupervisorLease | undefined {
  if (!isRecord(value)
    || value.schemaVersion !== SUPERVISOR_SCHEMA_VERSION
    || !isSafeRef(value.instanceId)
    || typeof value.pid !== 'number'
    || !Number.isSafeInteger(value.pid)
    || value.pid < 0
    || !isIsoDate(value.startedAt)
    || !isIsoDate(value.heartbeatAt)) return undefined
  return {
    schemaVersion: SUPERVISOR_SCHEMA_VERSION,
    instanceId: value.instanceId,
    pid: value.pid,
    startedAt: value.startedAt,
    heartbeatAt: value.heartbeatAt,
  }
}

export class SupervisorStore {
  readonly directory: string
  readonly snapshotFile: string
  readonly leaseFile: string
  readonly lockFile: string

  constructor(stateDir: string) {
    this.directory = resolveStateDir(stateDir)
    this.snapshotFile = path.join(this.directory, 'supervisor.json')
    this.leaseFile = path.join(this.directory, 'supervisor.lease')
    this.lockFile = path.join(this.directory, 'supervisor.lock')
  }

  async load(runtimeVersion: string, now: number, maxSessions = DEFAULT_MAX_SESSIONS, maxPending = DEFAULT_MAX_PENDING): Promise<SupervisorSnapshot | undefined> {
    try {
      let raw: unknown
      try {
        raw = JSON.parse(await readFile(this.snapshotFile, 'utf8')) as unknown
      } catch (error: unknown) {
        if (isNodeError(error, 'ENOENT')) return undefined
        await this.quarantine(this.snapshotFile, now, 'corrupt')
        return undefined
      }
      if (!isRecord(raw) || raw.schemaVersion !== SUPERVISOR_SCHEMA_VERSION) {
        await this.quarantine(this.snapshotFile, now, 'unsupported')
        return undefined
      }
      const snapshot = normalizeSnapshot(raw.snapshot, runtimeVersion, now, maxSessions, maxPending)
      if (snapshot === undefined) {
        await this.quarantine(this.snapshotFile, now, 'invalid')
        return undefined
      }
      return snapshot
    } catch (error: unknown) {
      if (isNodeError(error, 'ENOENT')) return undefined
      throw error
    }
  }

  /**
   * Commit a snapshot while holding the same local filesystem lock used by
   * lease changes. The lease check and the atomic rename therefore form one
   * fenced operation: a stale owner cannot write after a takeover has won the
   * lock.
   */
  async saveOwned(snapshot: SupervisorSnapshot, expected: SupervisorLease): Promise<number | undefined> {
    return this.withOperationLock(async () => {
      const current = await this.loadLeaseUnlocked()
      if (!sameLease(current, expected)) return undefined
      const payload: PersistedSupervisorState = { schemaVersion: SUPERVISOR_SCHEMA_VERSION, snapshot: cloneSnapshot(snapshot) }
      return this.writeAtomic(this.snapshotFile, payload)
    })
  }

  async loadLease(): Promise<SupervisorLease | undefined> {
    return this.withOperationLock(() => this.loadLeaseUnlocked())
  }

  private async loadLeaseUnlocked(): Promise<SupervisorLease | undefined> {
    try {
      let raw: unknown
      try {
        raw = JSON.parse(await readFile(this.leaseFile, 'utf8')) as unknown
      } catch (error: unknown) {
        if (isNodeError(error, 'ENOENT')) return undefined
        await this.quarantine(this.leaseFile, Date.now(), 'corrupt')
        return undefined
      }
      const lease = normalizeLease(raw)
      if (lease === undefined) {
        await this.quarantine(this.leaseFile, Date.now(), 'invalid')
        return undefined
      }
      return lease
    } catch (error: unknown) {
      if (isNodeError(error, 'ENOENT')) return undefined
      throw error
    }
  }

  async tryCreateLease(lease: SupervisorLease): Promise<boolean> {
    return this.withOperationLock(async () => {
      await mkdir(this.directory, { recursive: true })
      try {
        await writeFile(this.leaseFile, `${JSON.stringify(lease, null, 2)}\n`, { encoding: 'utf8', flag: 'wx' })
        return true
      } catch (error: unknown) {
        if (isNodeError(error, 'EEXIST')) return false
        throw error
      }
    })
  }

  async replaceLease(expected: SupervisorLease, next: SupervisorLease): Promise<boolean> {
    return this.withOperationLock(async () => {
      const current = await this.loadLeaseUnlocked()
      if (!sameLease(current, expected)) return false
      await this.writeAtomic(this.leaseFile, next)
      return true
    })
  }

  async archiveStaleLease(expected: SupervisorLease, now: number): Promise<boolean> {
    return this.withOperationLock(async () => {
      const current = await this.loadLeaseUnlocked()
      if (!sameLease(current, expected)) return false
      const suffix = `${now}-${randomUUID().slice(0, 8)}`
      try {
        await rename(this.leaseFile, `${this.leaseFile}.stale-${suffix}`)
        return true
      } catch (error: unknown) {
        if (isNodeError(error, 'ENOENT')) return false
        throw error
      }
    })
  }

  async releaseLease(expected: SupervisorLease): Promise<boolean> {
    return this.withOperationLock(async () => {
      const current = await this.loadLeaseUnlocked()
      if (!sameLease(current, expected)) return false
      try {
        await unlink(this.leaseFile)
        return true
      } catch (error: unknown) {
        if (isNodeError(error, 'ENOENT')) return false
        throw error
      }
    })
  }

  async measureStateBytes(): Promise<number> {
    try {
      const entries = await readdir(this.directory, { withFileTypes: true })
      let total = 0
      for (const entry of entries) {
        if (!entry.isFile()) continue
        try { total += (await stat(path.join(this.directory, entry.name))).size } catch { /* concurrent cleanup */ }
      }
      return total
    } catch (error: unknown) {
      if (isNodeError(error, 'ENOENT')) return 0
      throw error
    }
  }

  private async writeAtomic(file: string, value: unknown): Promise<number> {
    await mkdir(this.directory, { recursive: true })
    const temporary = `${file}.${process.pid}.${randomUUID()}.tmp`
    const body = `${JSON.stringify(value, null, 2)}\n`
    await writeFile(temporary, body, 'utf8')
    await rename(temporary, file)
    return Buffer.byteLength(body)
  }

  private async quarantine(file: string, now: number, reason: string): Promise<void> {
    const quarantineFile = `${file}.${reason}-${now}-${randomUUID().slice(0, 8)}`
    try {
      await rename(file, quarantineFile)
    } catch (error: unknown) {
      if (!isNodeError(error, 'ENOENT')) throw error
    }
  }

  private async withOperationLock<T>(operation: () => Promise<T>): Promise<T> {
    await mkdir(this.directory, { recursive: true })
    const deadline = Date.now() + OPERATION_LOCK_WAIT_MS
    while (true) {
      try {
        await writeFile(this.lockFile, `${process.pid}\n`, { encoding: 'utf8', flag: 'wx' })
        break
      } catch (error: unknown) {
        if (!isNodeError(error, 'EEXIST')) throw error
        try {
          const lockStat = await stat(this.lockFile)
          if (Date.now() - lockStat.mtimeMs > OPERATION_LOCK_STALE_MS) {
            await unlink(this.lockFile)
            continue
          }
        } catch (statError: unknown) {
          if (isNodeError(statError, 'ENOENT')) continue
          throw statError
        }
        if (Date.now() >= deadline) throw new Error('supervisor operation lock timeout')
        await new Promise(resolve => setTimeout(resolve, 5))
      }
    }
    try {
      return await operation()
    } finally {
      try { await unlink(this.lockFile) } catch (error: unknown) {
        if (!isNodeError(error, 'ENOENT')) throw error
      }
    }
  }
}

function sameLease(left: SupervisorLease | undefined, right: SupervisorLease): boolean {
  return left !== undefined
    && left.instanceId === right.instanceId
    && left.startedAt === right.startedAt
    && left.heartbeatAt === right.heartbeatAt
}

export class PersistentSupervisor {
  readonly store: SupervisorStore
  readonly instanceId: string
  readonly runtimeVersion: string

  private readonly options: Required<Pick<PersistentSupervisorOptions, 'staleLeaseMs' | 'standbyRetryMs' | 'heartbeatMs' | 'maxSessions' | 'maxPending' | 'now' | 'pid'>>
  private snapshotValue: SupervisorSnapshot
  private lease: SupervisorLease | undefined
  private lifecycle: SupervisorState = 'inactive'
  private restored = false
  private staleLeaseRecovered = false
  private lastSnapshotAt: string | undefined
  private lastHeartbeatAt: string | undefined
  private startupMs: number | null = null
  private restoreMs: number | null = null
  private writeCount = 0
  private heartbeatCount = 0
  private wakeCount = 0
  private stateBytes = 0
  private stateDirectoryBytes = 0
  private peakRssBytes = process.memoryUsage().rss
  private heartbeatTimer: ReturnType<typeof setInterval> | undefined
  private standbyTimer: ReturnType<typeof setTimeout> | undefined
  private persistTimer: ReturnType<typeof setTimeout> | undefined
  private saveChain = Promise.resolve()
  private disposed = false
  private stopping = false

  constructor(options: PersistentSupervisorOptions) {
    this.store = new SupervisorStore(options.stateDir)
    this.instanceId = options.instanceId ?? `dcs-${process.pid}-${randomUUID()}`
    this.runtimeVersion = options.runtimeVersion
    const staleLeaseMs = options.staleLeaseMs ?? DEFAULT_STALE_LEASE_MS
    this.options = {
      staleLeaseMs,
      standbyRetryMs: options.standbyRetryMs ?? Math.min(staleLeaseMs / 3, 10_000),
      heartbeatMs: options.heartbeatMs ?? DEFAULT_HEARTBEAT_MS,
      maxSessions: options.maxSessions ?? DEFAULT_MAX_SESSIONS,
      maxPending: options.maxPending ?? DEFAULT_MAX_PENDING,
      now: options.now ?? Date.now,
      pid: options.pid ?? process.pid,
    }
    this.snapshotValue = emptySnapshot(this.runtimeVersion, this.options.now())
  }

  async start(): Promise<boolean> {
    if (this.lifecycle === 'running' || this.lifecycle === 'degraded') return this.lease !== undefined
    if (this.disposed) return false
    const started = this.options.now()
    this.lifecycle = 'starting'
    try {
      const restoreStarted = this.options.now()
      const restored = await this.store.load(this.runtimeVersion, this.options.now(), this.options.maxSessions, this.options.maxPending)
      this.restoreMs = Math.max(0, this.options.now() - restoreStarted)
      if (restored !== undefined) {
        this.snapshotValue = restored
        this.restored = true
      }
      const nowIso = new Date(this.options.now()).toISOString()
      const candidate: SupervisorLease = {
        schemaVersion: SUPERVISOR_SCHEMA_VERSION,
        instanceId: this.instanceId,
        pid: this.options.pid,
        startedAt: nowIso,
        heartbeatAt: nowIso,
      }
      let acquired = await this.store.tryCreateLease(candidate)
      if (!acquired) {
        const existing = await this.store.loadLease()
        if (existing !== undefined && this.isStale(existing)) {
          this.staleLeaseRecovered = await this.store.archiveStaleLease(existing, this.options.now())
          if (this.staleLeaseRecovered) acquired = await this.store.tryCreateLease(candidate)
        } else if (existing === undefined) {
          // A malformed or empty lease is quarantined by loadLease(). Retry
          // creation once so a recoverable state directory starts in a
          // healthy running state during the same startup transaction.
          acquired = await this.store.tryCreateLease(candidate)
        }
      }
      if (!acquired) {
        this.lifecycle = 'standby'
        this.startupMs = Math.max(0, this.options.now() - started)
        this.scheduleStandbyRetry()
        return false
      }
      if (this.standbyTimer !== undefined) {
        clearTimeout(this.standbyTimer)
        this.standbyTimer = undefined
      }
      this.lease = candidate
      this.lifecycle = 'running'
      this.startupMs = Math.max(0, this.options.now() - started)
      this.snapshotValue = normalizeSnapshot(this.snapshotValue, this.runtimeVersion, this.options.now(), this.options.maxSessions, this.options.maxPending) ?? emptySnapshot(this.runtimeVersion, this.options.now())
      this.lastSnapshotAt = this.snapshotValue.generatedAt
      await this.persistNow()
      if (this.stopping || this.disposed || this.lease === undefined) return false
      if (this.heartbeatTimer !== undefined) clearInterval(this.heartbeatTimer)
      this.heartbeatTimer = setInterval(() => { void this.heartbeat() }, this.options.heartbeatMs)
      this.heartbeatTimer.unref?.()
      return true
    } catch {
      this.lifecycle = 'degraded'
      this.startupMs = Math.max(0, this.options.now() - started)
      return false
    }
  }

  update(snapshot: SupervisorSnapshot): void {
    if (this.stopping || this.disposed) return
    const normalized = normalizeSnapshot(snapshot, this.runtimeVersion, this.options.now(), this.options.maxSessions, this.options.maxPending)
    if (normalized === undefined) return
    if (normalized.revision < this.snapshotValue.revision) return
    this.snapshotValue = normalized
    this.lastSnapshotAt = normalized.generatedAt
    this.wakeCount += 1
    if (this.lease !== undefined && (this.lifecycle === 'running' || this.lifecycle === 'degraded')) this.schedulePersist()
  }

  snapshot(): SupervisorSnapshot {
    return cloneSnapshot(this.snapshotValue)
  }

  status(): PersistentSupervisorStatus {
    return {
      schemaVersion: SUPERVISOR_SCHEMA_VERSION,
      state: this.lifecycle,
      instanceId: this.instanceId,
      leaseHeld: this.lease !== undefined,
      restored: this.restored,
      staleLeaseRecovered: this.staleLeaseRecovered,
      revision: this.snapshotValue.revision,
      ...(this.lastSnapshotAt === undefined ? {} : { lastSnapshotAt: this.lastSnapshotAt }),
      ...(this.lastHeartbeatAt === undefined ? {} : { lastHeartbeatAt: this.lastHeartbeatAt }),
      metrics: {
        startupMs: this.startupMs,
        restoreMs: this.restoreMs,
        writeCount: this.writeCount,
        heartbeatCount: this.heartbeatCount,
        wakeCount: this.wakeCount,
        stateBytes: this.stateBytes,
        stateDirectoryBytes: this.stateDirectoryBytes,
        rssBytes: process.memoryUsage().rss,
        peakRssBytes: this.peakRssBytes,
      },
    }
  }

  async flush(): Promise<void> {
    if (this.persistTimer !== undefined) {
      clearTimeout(this.persistTimer)
      this.persistTimer = undefined
      await this.persistNow()
    }
    await this.saveChain
  }

  async stop(): Promise<void> {
    if (this.disposed || this.lifecycle === 'stopped') return
    if (this.stopping) {
      await this.saveChain
      return
    }
    this.stopping = true
    if (this.heartbeatTimer !== undefined) clearInterval(this.heartbeatTimer)
    this.heartbeatTimer = undefined
    if (this.standbyTimer !== undefined) clearTimeout(this.standbyTimer)
    this.standbyTimer = undefined
    try {
      // Flush while the lease is still held. This keeps the latest bounded
      // snapshot durable when stop follows a just-observed session event.
      await this.flush()
      if (this.lease !== undefined) {
        try { await this.store.releaseLease(this.lease) } catch { /* best effort during shutdown */ }
        this.lease = undefined
      }
    } finally {
      this.disposed = true
      this.stopping = false
      this.lifecycle = 'stopped'
    }
  }

  private isStale(lease: SupervisorLease): boolean {
    const heartbeat = Date.parse(lease.heartbeatAt)
    return Number.isFinite(heartbeat) && this.options.now() - heartbeat > this.options.staleLeaseMs
  }

  private scheduleStandbyRetry(): void {
    if (this.heartbeatTimer !== undefined) clearInterval(this.heartbeatTimer)
    this.heartbeatTimer = undefined
    if (this.disposed || this.stopping || this.standbyTimer !== undefined) return
    this.standbyTimer = setTimeout(() => {
      this.standbyTimer = undefined
      if (!this.disposed && !this.stopping && this.lifecycle === 'standby') void this.start()
    }, this.options.standbyRetryMs)
    this.standbyTimer.unref?.()
  }

  private schedulePersist(): void {
    if (this.persistTimer !== undefined) return
    this.persistTimer = setTimeout(() => {
      this.persistTimer = undefined
      void this.persistNow()
    }, 50)
    this.persistTimer.unref?.()
  }

  private async persistNow(): Promise<void> {
    if (this.lease === undefined || this.disposed) return
    const snapshot = cloneSnapshot(this.snapshotValue)
    this.saveChain = this.saveChain
      .then(async () => {
        const lease = this.lease
        if (lease === undefined || this.disposed) return
        const bytes = await this.store.saveOwned(snapshot, lease)
        if (bytes === undefined) {
          this.lease = undefined
          this.lifecycle = 'standby'
          this.scheduleStandbyRetry()
          return
        }
        this.stateBytes = bytes
        this.stateDirectoryBytes = await this.store.measureStateBytes()
        this.writeCount += 1
        this.peakRssBytes = Math.max(this.peakRssBytes, process.memoryUsage().rss)
      })
      .catch(() => {
        this.lifecycle = 'degraded'
      })
    await this.saveChain
  }

  private async heartbeat(): Promise<void> {
    if (this.lease === undefined || this.disposed || this.stopping) return
    // Serialize renewal with snapshot commits so each operation captures the
    // current lease inside the queue, after earlier renewals have completed.
    this.saveChain = this.saveChain.then(async () => {
      if (this.lease === undefined || this.disposed || this.stopping) return
      this.wakeCount += 1
      const heartbeatAt = new Date(this.options.now()).toISOString()
      const next: SupervisorLease = { ...this.lease, heartbeatAt }
      const replaced = await this.store.replaceLease(this.lease, next)
      if (!replaced) {
        this.lease = undefined
        this.lifecycle = 'standby'
        this.scheduleStandbyRetry()
        return
      }
      this.lease = next
      this.lastHeartbeatAt = heartbeatAt
      this.heartbeatCount += 1
      if (this.lifecycle === 'degraded') this.lifecycle = 'running'
    }).catch(() => { this.lifecycle = 'degraded' })
    await this.saveChain
  }
}

export function supervisorSnapshotFor(
  runtimeVersion: string,
  hostStatus: SupervisorHostStatus,
  revision: number,
  sessions: readonly SupervisorSessionState[],
  pending: readonly string[],
  now = Date.now(),
  maxPending = DEFAULT_MAX_PENDING,
  policyState?: SupervisorPolicyState,
  deliveryLedger?: readonly PersistedDeliveryEntry[],
): SupervisorSnapshot {
  return {
    schemaVersion: SUPERVISOR_SCHEMA_VERSION,
    revision: Number.isSafeInteger(revision) && revision >= 0 ? revision : 0,
    generatedAt: new Date(now).toISOString(),
    host: { runtimeVersion: isSafeRef(runtimeVersion) ? runtimeVersion : 'unknown', status: hostStatus },
    sessions: sessions.filter(session => isSafeRef(session.sessionRef) && isAttentionLevel(session.attentionLevel)).slice(0, DEFAULT_MAX_SESSIONS).map(session => ({
      sessionRef: session.sessionRef,
      attentionLevel: session.attentionLevel,
      pendingCount: Number.isSafeInteger(session.pendingCount) && session.pendingCount >= 0 ? Math.min(session.pendingCount, DEFAULT_MAX_PENDING) : 0,
      ...(isIsoDate(session.lastEvidenceAt) ? { lastEvidenceAt: session.lastEvidenceAt } : {}),
    })),
    pending: [...new Set(pending.filter(isSafeRef))].slice(0, Math.max(0, Math.min(maxPending, DEFAULT_MAX_PENDING))),
    ...(policyState === undefined || !isPolicyState(policyState) ? {} : { policyState: clonePolicyState(policyState) as SupervisorPolicyState }),
    ...(deliveryLedger === undefined ? {} : { deliveryLedger: deliveryLedger.filter(isDeliveryEntry).slice(0, 512).map(entry => ({ ...entry, attemptHashes: [...entry.attemptHashes] })) }),
  }
}
