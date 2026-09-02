import { createHash } from 'node:crypto'

/** Lifecycle of one locally observed DSH WebServer outage epoch. */
export type HostProbeState = 'healthy' | 'outage-open' | 'recovered' | 'recovery-continued'

export type HostProbeTransition = 'none' | 'outage-opened' | 'recovered' | 'recovery-continued'

export interface HostProbeObservation {
  state: HostProbeState
  healthy: boolean
  consecutiveFailures: number
  outageId?: string
  lastCheckedAt: string
  recoveredAt?: string
  transition: HostProbeTransition
}

function opaqueRef(value: string): string {
  return createHash('sha256').update(value).digest('hex').slice(0, 16)
}

/**
 * Debounces a local probe into one outage epoch and one recovery edge.
 *
 * The state is intentionally independent of a single HTTP result. A brief
 * event-loop delay contributes to the failure counter, while only the
 * threshold crossing opens a user-facing outage. A later success closes that
 * same epoch and the next healthy sample records continued recovery.
 */
export class HostProbeEpoch {
  private stateValue: HostProbeState = 'healthy'
  private failures = 0
  private sequence = 0
  private outageIdValue: string | undefined
  private lastCheckedAtValue: string | undefined
  private recoveredAtValue: string | undefined

  constructor(
    private readonly failureThreshold = 2,
    private readonly identity = 'dsh-webserver',
  ) {
    if (!Number.isSafeInteger(failureThreshold) || failureThreshold < 1) throw new RangeError('failureThreshold must be a positive integer')
  }

  observe(ok: boolean, now = Date.now()): HostProbeObservation {
    const checkedAt = new Date(now).toISOString()
    this.lastCheckedAtValue = checkedAt
    let transition: HostProbeTransition = 'none'

    if (ok) {
      this.failures = 0
      if (this.stateValue === 'outage-open') {
        this.stateValue = 'recovered'
        this.recoveredAtValue = checkedAt
        transition = 'recovered'
      } else if (this.stateValue === 'recovered') {
        this.stateValue = 'recovery-continued'
        transition = 'recovery-continued'
      }
    } else {
      // A post-recovery failure starts a new epoch, so recovery evidence never
      // gets attached to a later outage.
      if (this.stateValue === 'recovered' || this.stateValue === 'recovery-continued') {
        this.stateValue = 'healthy'
        this.outageIdValue = undefined
        this.recoveredAtValue = undefined
      }
      this.failures += 1
      if (this.stateValue === 'healthy' && this.failures >= this.failureThreshold) {
        this.sequence += 1
        this.outageIdValue = opaqueRef(`${this.identity}:${this.sequence}:${now}`)
        this.stateValue = 'outage-open'
        transition = 'outage-opened'
      }
    }

    return {
      state: this.stateValue,
      healthy: this.stateValue !== 'outage-open',
      consecutiveFailures: this.failures,
      ...(this.outageIdValue === undefined ? {} : { outageId: this.outageIdValue }),
      lastCheckedAt: checkedAt,
      ...(this.recoveredAtValue === undefined ? {} : { recoveredAt: this.recoveredAtValue }),
      transition,
    }
  }

  status(now = Date.now()): HostProbeObservation {
    return {
      state: this.stateValue,
      healthy: this.stateValue !== 'outage-open',
      consecutiveFailures: this.failures,
      ...(this.outageIdValue === undefined ? {} : { outageId: this.outageIdValue }),
      lastCheckedAt: this.lastCheckedAtValue ?? new Date(now).toISOString(),
      ...(this.recoveredAtValue === undefined ? {} : { recoveredAt: this.recoveredAtValue }),
      transition: 'none',
    }
  }
}
