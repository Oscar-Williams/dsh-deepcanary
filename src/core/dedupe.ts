import { createHash } from 'node:crypto'

export interface PersistedDedupeEntry {
  keyHash: string
  acceptedAt: string
}

function keyHash(key: string): string {
  return createHash('sha256').update(key).digest('hex').slice(0, 16)
}

export class DedupeLedger {
  private readonly seen = new Map<string, number>()

  constructor(private windowMs: number) {}

  setWindowMs(windowMs: number): void {
    this.windowMs = Math.max(0, windowMs)
  }

  accept(key: string, now = Date.now()): boolean {
    const hashed = keyHash(key)
    const previous = this.seen.get(hashed)
    if (previous !== undefined && now - previous < this.windowMs) return false
    this.seen.set(hashed, now)
    this.prune(now)
    return true
  }

  remember(key: string, now = Date.now()): void {
    this.seen.set(keyHash(key), now)
    this.prune(now)
  }

  snapshot(now = Date.now(), limit = 512): PersistedDedupeEntry[] {
    // Snapshotting may happen from a wall-clock status refresh while the
    // newest signal carries an event timestamp. Keep entries here and let
    // restore/accept apply the policy window in the clock domain of use.
    void now
    return [...this.seen.entries()]
      .sort((left, right) => right[1] - left[1])
      .slice(0, Math.max(0, limit))
      .map(([hash, timestamp]) => ({ keyHash: hash, acceptedAt: new Date(timestamp).toISOString() }))
  }

  restore(entries: readonly PersistedDedupeEntry[], now = Date.now()): void {
    for (const entry of entries) {
      const timestamp = Date.parse(entry.acceptedAt)
      if (!/^[a-f0-9]{16}$/.test(entry.keyHash) || !Number.isFinite(timestamp) || timestamp > now || now - timestamp >= this.windowMs) continue
      this.seen.set(entry.keyHash, timestamp)
    }
    this.prune(now)
  }

  clear(): void {
    this.seen.clear()
  }

  private prune(now: number): void {
    for (const [key, time] of this.seen) {
      if (now - time >= this.windowMs) this.seen.delete(key)
    }
  }
}

export class InterruptBudget {
  private readonly consumed: number[] = []

  constructor(private maxPerHour: number, private readonly windowMs = 60 * 60 * 1000) {}

  setMaxPerHour(maxPerHour: number): void {
    this.maxPerHour = Math.max(0, maxPerHour)
  }

  canInterrupt(now = Date.now()): boolean {
    this.prune(now)
    return this.consumed.length < this.maxPerHour
  }

  consume(now = Date.now()): boolean {
    if (!this.canInterrupt(now)) return false
    this.consumed.push(now)
    return true
  }

  remaining(now = Date.now()): number {
    this.prune(now)
    return Math.max(0, this.maxPerHour - this.consumed.length)
  }

  used(now = Date.now()): number {
    this.prune(now)
    return this.consumed.length
  }

  snapshot(now = Date.now()): string[] {
    // See DedupeLedger.snapshot: a status refresh must not age out a
    // just-consumed event whose provider timestamp is being replayed.
    void now
    return [...this.consumed].map(timestamp => new Date(timestamp).toISOString())
  }

  restore(timestamps: readonly string[], now = Date.now()): void {
    for (const timestampValue of timestamps) {
      const timestamp = Date.parse(timestampValue)
      if (!Number.isFinite(timestamp) || timestamp > now || now - timestamp >= this.windowMs) continue
      this.consumed.push(timestamp)
    }
    this.consumed.sort((left, right) => left - right)
    this.prune(now)
  }

  limit(): number {
    return this.maxPerHour
  }

  private prune(now: number): void {
    const cutoff = now - this.windowMs
    while (this.consumed[0] !== undefined && this.consumed[0] <= cutoff) this.consumed.shift()
  }
}
