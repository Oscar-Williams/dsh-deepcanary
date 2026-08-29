export class DedupeLedger {
  private readonly seen = new Map<string, number>()

  constructor(private windowMs: number) {}

  setWindowMs(windowMs: number): void {
    this.windowMs = Math.max(0, windowMs)
  }

  accept(key: string, now = Date.now()): boolean {
    const previous = this.seen.get(key)
    if (previous !== undefined && now - previous < this.windowMs) return false
    this.seen.set(key, now)
    this.prune(now)
    return true
  }

  remember(key: string, now = Date.now()): void {
    this.seen.set(key, now)
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

  private prune(now: number): void {
    const cutoff = now - this.windowMs
    while (this.consumed[0] !== undefined && this.consumed[0] <= cutoff) this.consumed.shift()
  }
}
