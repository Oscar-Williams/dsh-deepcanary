import type { Context } from '@deepseek-ai/cordis';
import type { SessionEventLike, SessionLike } from '../providers.js';
export interface Disposable {
    dispose(): void;
}
export interface DeepCanaryEvent {
    type: 'session/created' | 'session/event' | 'session/disposed';
    session: unknown;
    event?: unknown;
}
export interface SessionSnapshot {
    sessionId: string;
    active: boolean;
    cwd?: string;
    lastEventAt: number;
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
    subscribe(listener: (event: DeepCanaryEvent) => void): Disposable;
    getSessionSnapshot(sessionId: string): Promise<SessionSnapshot | null>;
    getRuntimeHealth(): Promise<RuntimeHealth>;
}
interface DshAdapterOptions {
    hostVersion?: string;
    runtimeHealth?: () => Promise<RuntimeHealth>;
}
/** Context-backed adapter used by the plugin host; all DSH event wiring lives here. */
export declare class ContextDshAdapter implements DshAdapter {
    readonly hostVersion: string;
    private readonly ctx;
    private readonly listeners;
    private readonly snapshots;
    private readonly runtimeHealth;
    private started;
    constructor(ctx: Context, options?: DshAdapterOptions);
    start(): Promise<void>;
    subscribe(listener: (event: DeepCanaryEvent) => void): Disposable;
    getSessionSnapshot(sessionId: string): Promise<SessionSnapshot | null>;
    getRuntimeHealth(): Promise<RuntimeHealth>;
    private publish;
}
export type { SessionEventLike, SessionLike };
//# sourceMappingURL=dsh.d.ts.map