import type { CanarySignal } from '../types.js';
export declare const MAX_BACKGROUND_WATCHES = 256;
type BackgroundKind = 'shell' | 'workflow' | 'subagent' | 'other';
type JobStatus = 'running' | 'stopping' | 'completed' | 'failed' | 'killed';
/** Only opaque navigation identity, enums and times belong in reminder state. */
export interface BackgroundWatch {
    jobRef: string;
    sessionId: string;
    kind: BackgroundKind;
    startedAt: number;
    state: 'running' | 'stopping' | 'unknown' | 'settled';
}
interface JobFact extends Omit<BackgroundWatch, 'state'> {
    status: JobStatus;
    finishedAt?: number;
}
export interface BackgroundSettlement extends JobFact {
    status: 'completed' | 'failed';
    catchup: boolean;
}
export interface BackgroundSummary {
    available: boolean;
    running: number;
    unknown: number;
    limited: boolean;
}
interface JobRegistryLike {
    list(owner: string): unknown;
}
export declare function isBackgroundWatch(value: unknown): value is BackgroundWatch;
export declare function copyBackgroundWatch(value: BackgroundWatch): BackgroundWatch;
/** A synchronous public roster read keeps turn-end facts current within the same event burst. */
export declare function countRunningBackgroundJobs(registry: JobRegistryLike | undefined, owner: string): number | undefined;
/** Strip a public event before an asynchronous consumer retains it. */
export declare function selectBackgroundEvent(value: unknown): Record<string, unknown> | undefined;
/** Observe public job lifecycles without controlling jobs or consuming their output. */
export declare class BackgroundJobTracker {
    private readonly watches;
    private readonly progress;
    private available;
    private limited;
    restore(values: readonly BackgroundWatch[]): void;
    snapshot(): BackgroundWatch[];
    summary(): BackgroundSummary;
    runningFor(sessionId: string): number;
    lastActivityFor(sessionId: string): number | undefined;
    unavailable(): void;
    reconcile(registry: JobRegistryLike, sessions: readonly unknown[], now?: number): BackgroundSettlement[];
    observe(event: unknown): BackgroundSettlement | undefined;
    private keep;
    private markSettled;
}
export declare function signalFromBackgroundSettlement(job: BackgroundSettlement): CanarySignal;
export {};
//# sourceMappingURL=background-jobs.d.ts.map