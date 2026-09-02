import type { AttentionLevel } from './types.js';
export declare const SUPERVISOR_SCHEMA_VERSION: 1;
export declare const SUPERVISOR_POLICY_STATE_SCHEMA_VERSION: 1;
export type SupervisorHostStatus = 'ready' | 'degraded' | 'unreachable';
export type SupervisorState = 'inactive' | 'starting' | 'standby' | 'running' | 'degraded' | 'blocked' | 'stopped';
export interface SupervisorSessionState {
    sessionRef: string;
    attentionLevel: AttentionLevel;
    pendingCount: number;
    lastEvidenceAt?: string;
}
export interface SupervisorPolicyState {
    schemaVersion: typeof SUPERVISOR_POLICY_STATE_SCHEMA_VERSION;
    policyVersion: string;
    dedupe: Array<{
        keyHash: string;
        acceptedAt: string;
    }>;
    interruptConsumedAt: string[];
}
export interface SupervisorSnapshot {
    schemaVersion: typeof SUPERVISOR_SCHEMA_VERSION;
    revision: number;
    generatedAt: string;
    host: {
        runtimeVersion: string;
        status: SupervisorHostStatus;
    };
    sessions: SupervisorSessionState[];
    pending: string[];
    policyState?: SupervisorPolicyState;
}
export interface SupervisorLease {
    schemaVersion: typeof SUPERVISOR_SCHEMA_VERSION;
    instanceId: string;
    pid: number;
    startedAt: string;
    heartbeatAt: string;
}
export interface SupervisorMetrics {
    startupMs: number | null;
    restoreMs: number | null;
    writeCount: number;
    heartbeatCount: number;
    wakeCount: number;
    stateBytes: number;
    stateDirectoryBytes: number;
    rssBytes: number;
    peakRssBytes: number;
}
export interface PersistentSupervisorStatus {
    schemaVersion: typeof SUPERVISOR_SCHEMA_VERSION;
    state: SupervisorState;
    instanceId: string;
    leaseHeld: boolean;
    restored: boolean;
    staleLeaseRecovered: boolean;
    revision: number;
    lastSnapshotAt?: string;
    lastHeartbeatAt?: string;
    metrics: SupervisorMetrics;
}
export interface PersistentSupervisorOptions {
    stateDir: string;
    runtimeVersion: string;
    staleLeaseMs?: number;
    /** Retry interval while another live supervisor owns the lease. */
    standbyRetryMs?: number;
    heartbeatMs?: number;
    maxSessions?: number;
    maxPending?: number;
    now?: () => number;
    pid?: number;
    instanceId?: string;
}
export declare class SupervisorStore {
    readonly directory: string;
    readonly snapshotFile: string;
    readonly leaseFile: string;
    readonly lockFile: string;
    constructor(stateDir: string);
    load(runtimeVersion: string, now: number, maxSessions?: number, maxPending?: number): Promise<SupervisorSnapshot | undefined>;
    /**
     * Commit a snapshot while holding the same local filesystem lock used by
     * lease changes. The lease check and the atomic rename therefore form one
     * fenced operation: a stale owner cannot write after a takeover has won the
     * lock.
     */
    saveOwned(snapshot: SupervisorSnapshot, expected: SupervisorLease): Promise<number | undefined>;
    loadLease(): Promise<SupervisorLease | undefined>;
    private loadLeaseUnlocked;
    tryCreateLease(lease: SupervisorLease): Promise<boolean>;
    replaceLease(expected: SupervisorLease, next: SupervisorLease): Promise<boolean>;
    archiveStaleLease(expected: SupervisorLease, now: number): Promise<boolean>;
    releaseLease(expected: SupervisorLease): Promise<boolean>;
    measureStateBytes(): Promise<number>;
    private writeAtomic;
    private quarantine;
    private withOperationLock;
}
export declare class PersistentSupervisor {
    readonly store: SupervisorStore;
    readonly instanceId: string;
    readonly runtimeVersion: string;
    private readonly options;
    private snapshotValue;
    private lease;
    private lifecycle;
    private restored;
    private staleLeaseRecovered;
    private lastSnapshotAt;
    private lastHeartbeatAt;
    private startupMs;
    private restoreMs;
    private writeCount;
    private heartbeatCount;
    private wakeCount;
    private stateBytes;
    private stateDirectoryBytes;
    private peakRssBytes;
    private heartbeatTimer;
    private standbyTimer;
    private persistTimer;
    private saveChain;
    private disposed;
    private stopping;
    constructor(options: PersistentSupervisorOptions);
    start(): Promise<boolean>;
    update(snapshot: SupervisorSnapshot): void;
    snapshot(): SupervisorSnapshot;
    status(): PersistentSupervisorStatus;
    flush(): Promise<void>;
    stop(): Promise<void>;
    private isStale;
    private scheduleStandbyRetry;
    private schedulePersist;
    private persistNow;
    private heartbeat;
}
export declare function supervisorSnapshotFor(runtimeVersion: string, hostStatus: SupervisorHostStatus, revision: number, sessions: readonly SupervisorSessionState[], pending: readonly string[], now?: number, maxPending?: number, policyState?: SupervisorPolicyState): SupervisorSnapshot;
//# sourceMappingURL=supervisor.d.ts.map