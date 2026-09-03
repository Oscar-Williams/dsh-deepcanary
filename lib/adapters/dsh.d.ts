import type { Context } from '@deepseek-ai/cordis';
import type { SessionEventLike, SessionLike } from '../providers.js';
import type { ReconciliationStatus } from '../types.js';
export interface Disposable {
    dispose(): void;
}
export interface DeepCanaryEvent {
    type: 'session/created' | 'session/event' | 'session/disposed';
    session: unknown;
    event?: unknown;
    /** Authoritative state attached to synthetic startup/reconciliation events. */
    snapshot?: SessionSnapshot;
}
export interface SessionSnapshot {
    sessionId: string;
    active: boolean;
    cwd?: string;
    startedAt: number;
    lastEventAt: number;
    /** The exact last existing event sequence observed in the DSH session log. */
    lastEventSeq?: number;
    /** Count of events in the authoritative snapshot; this is not a SessionSeq. */
    eventCount?: number;
    running?: boolean;
    waitingForHuman?: boolean;
    humanNeededReason?: 'approval' | 'question';
    humanNeededSeq?: number;
    toolFailures?: number;
    sameToolFailures?: number;
    contextCompactions?: number;
    lastToolName?: string;
}
export interface RuntimeHealth {
    status: 'healthy' | 'degraded' | 'unreachable' | 'unknown';
    authoritative: boolean;
    checkedAt: string;
    detail?: string;
}
/** Stable boundary between DSH runtime facts and DeepCanary interpretation. */
export interface DshAdapter {
    hostVersion: string;
    start(): Promise<void>;
    reconcile(): Promise<ReconciliationStatus>;
    getReconciliationStatus(): ReconciliationStatus;
    subscribe(listener: (event: DeepCanaryEvent) => void): Disposable;
    getSessionSnapshot(sessionId: string): Promise<SessionSnapshot | null>;
    getRuntimeHealth(): Promise<RuntimeHealth>;
}
interface DshAdapterOptions {
    hostVersion?: string;
    runtimeHealth?: () => Promise<RuntimeHealth>;
    sessionStore?: SessionStoreLike;
}
interface SessionStoreLike {
    list?: () => readonly unknown[] | Promise<readonly unknown[]>;
}
/** Context-backed adapter used by the plugin host; all DSH event wiring lives here. */
export declare class ContextDshAdapter implements DshAdapter {
    readonly hostVersion: string;
    private readonly ctx;
    private readonly listeners;
    private readonly snapshots;
    private readonly runtimeHealth;
    private readonly sessionStore;
    private started;
    private reconciling;
    private reconcileEpoch;
    private bufferedEvents;
    private reconciliationEventKeys;
    private bufferOverflowed;
    private reconciliationPromise;
    private startPromise;
    private reconciliationStatus;
    constructor(ctx: Context, options?: DshAdapterOptions);
    start(): Promise<void>;
    reconcile(): Promise<ReconciliationStatus>;
    getReconciliationStatus(): ReconciliationStatus;
    subscribe(listener: (event: DeepCanaryEvent) => void): Disposable;
    getSessionSnapshot(sessionId: string): Promise<SessionSnapshot | null>;
    getRuntimeHealth(): Promise<RuntimeHealth>;
    private publish;
    private publishLive;
    private performReconcile;
    private emit;
    private drainBuffered;
}
export type { SessionEventLike, SessionLike };
//# sourceMappingURL=dsh.d.ts.map