/** Lifecycle of one locally observed DSH WebServer outage epoch. */
export type HostProbeState = 'healthy' | 'outage-open' | 'recovered' | 'recovery-continued';
export type HostProbeTransition = 'none' | 'outage-opened' | 'recovered' | 'recovery-continued';
export interface HostProbeObservation {
    state: HostProbeState;
    healthy: boolean;
    consecutiveFailures: number;
    outageId?: string;
    lastCheckedAt: string;
    recoveredAt?: string;
    transition: HostProbeTransition;
}
/**
 * Debounces a local probe into one outage epoch and one recovery edge.
 *
 * The state is intentionally independent of a single HTTP result. A brief
 * event-loop delay contributes to the failure counter, while only the
 * threshold crossing opens a user-facing outage. A later success closes that
 * same epoch and the next healthy sample records continued recovery.
 */
export declare class HostProbeEpoch {
    private readonly failureThreshold;
    private readonly identity;
    private stateValue;
    private failures;
    private sequence;
    private outageIdValue;
    private lastCheckedAtValue;
    private recoveredAtValue;
    constructor(failureThreshold?: number, identity?: string);
    observe(ok: boolean, now?: number): HostProbeObservation;
    status(now?: number): HostProbeObservation;
}
//# sourceMappingURL=hostHealth.d.ts.map