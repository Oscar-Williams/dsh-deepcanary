import type { CanarySignal } from './types.js';
export interface SessionFacts {
    toolFailures: number;
    activeSubagents: number;
    lastEventAt: number;
    startedAt: number;
    contextCompactions?: number;
    lastToolName?: string;
    sameToolFailures?: number;
}
export interface SessionLike {
    id: string;
    header?: {
        cwd?: string;
    };
}
export interface SessionEventLike {
    type: string;
    seq?: number;
    time?: number;
    /** DSH marks routine extension events so observers do not treat them as progress facts. */
    ignorable?: boolean;
    data?: Record<string, unknown>;
}
export declare function signalsFromSessionEvent(session: SessionLike, event: SessionEventLike, facts: SessionFacts): CanarySignal[];
export declare function signalFromAgentError(payload: {
    agent?: {
        id?: string;
    };
    turn?: number;
    step?: number;
}): CanarySignal;
export declare function signalFromSubagentPressure(activeSubagents: number, threshold: number, now?: number): CanarySignal;
export declare function signalFromHostProbe(ok: boolean, detail: string, now?: number): CanarySignal | undefined;
export declare function signalFromStall(session: SessionLike, facts: SessionFacts, thresholdMs: number, now?: number): CanarySignal | undefined;
export declare function signalFromStallRecovery(session: SessionLike, now?: number): CanarySignal;
export declare function signalFromHostRecovery(now?: number): CanarySignal;
//# sourceMappingURL=providers.d.ts.map