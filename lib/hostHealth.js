import { createHash } from 'node:crypto';
function opaqueRef(value) {
    return createHash('sha256').update(value).digest('hex').slice(0, 16);
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
    failureThreshold;
    identity;
    stateValue = 'healthy';
    failures = 0;
    sequence = 0;
    outageIdValue;
    lastCheckedAtValue;
    recoveredAtValue;
    constructor(failureThreshold = 2, identity = 'dsh-webserver') {
        this.failureThreshold = failureThreshold;
        this.identity = identity;
        if (!Number.isSafeInteger(failureThreshold) || failureThreshold < 1)
            throw new RangeError('failureThreshold must be a positive integer');
    }
    observe(ok, now = Date.now()) {
        const checkedAt = new Date(now).toISOString();
        this.lastCheckedAtValue = checkedAt;
        let transition = 'none';
        if (ok) {
            this.failures = 0;
            if (this.stateValue === 'outage-open') {
                this.stateValue = 'recovered';
                this.recoveredAtValue = checkedAt;
                transition = 'recovered';
            }
            else if (this.stateValue === 'recovered') {
                this.stateValue = 'recovery-continued';
                transition = 'recovery-continued';
            }
        }
        else {
            // A post-recovery failure starts a new epoch, so recovery evidence never
            // gets attached to a later outage.
            if (this.stateValue === 'recovered' || this.stateValue === 'recovery-continued') {
                this.stateValue = 'healthy';
                this.outageIdValue = undefined;
                this.recoveredAtValue = undefined;
            }
            this.failures += 1;
            if (this.stateValue === 'healthy' && this.failures >= this.failureThreshold) {
                this.sequence += 1;
                this.outageIdValue = opaqueRef(`${this.identity}:${this.sequence}:${now}`);
                this.stateValue = 'outage-open';
                transition = 'outage-opened';
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
        };
    }
    status(now = Date.now()) {
        return {
            state: this.stateValue,
            healthy: this.stateValue !== 'outage-open',
            consecutiveFailures: this.failures,
            ...(this.outageIdValue === undefined ? {} : { outageId: this.outageIdValue }),
            lastCheckedAt: this.lastCheckedAtValue ?? new Date(now).toISOString(),
            ...(this.recoveredAtValue === undefined ? {} : { recoveredAt: this.recoveredAtValue }),
            transition: 'none',
        };
    }
}
//# sourceMappingURL=hostHealth.js.map