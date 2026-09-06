import type { CanarySignal } from './types.js';
export interface SessionFacts {
    toolFailures: number;
    activeSubagents: number;
    lastEventAt: number;
    /** Last boundary that proves the task made meaningful progress. */
    lastMeaningfulAt?: number;
    startedAt: number;
    /** Number of tools that have been called without a matching result. */
    activeToolCount?: number;
    /** The class of the currently active/most recent tool, without its arguments. */
    toolClass?: ToolClass;
    waitingForHuman?: boolean;
    turnState?: TurnState;
    contextCompactions?: number;
    lastToolName?: string;
    sameToolFailures?: number;
}
export type ToolClass = 'long-running' | 'ordinary' | 'unknown';
export type TurnState = 'running' | 'terminal' | 'unknown';
export interface SessionLike {
    id: string;
    header?: {
        cwd?: string;
        parentSession?: string;
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
/** Classify only the public tool name; arguments and result content are never inspected. */
export declare function toolClassForName(name: string | undefined): ToolClass;
/** Read the public tool identity, never the model-facing result content. */
export declare function toolCallIdOf(data: Record<string, unknown>): string | undefined;
/** Whether an event is a bounded, structured progress boundary for liveness. */
export declare function isMeaningfulSessionEvent(eventType: string, data?: Record<string, unknown>): boolean;
export declare function signalsFromSessionEvent(session: SessionLike, event: SessionEventLike, facts: SessionFacts): CanarySignal[];
/**
 * Recreate a Human Needed observation from an authoritative startup snapshot.
 * The event sequence remains an opaque evidence join key; no event payload is
 * copied into the signal or its persistence path.
 */
export declare function signalFromAuthoritativeHumanWait(session: SessionLike, reason: 'approval' | 'question', eventSeq?: number, occurredAt?: number): CanarySignal;
export declare function signalFromAgentError(payload: {
    agent?: {
        id?: string;
    };
    turn?: number;
    step?: number;
}): CanarySignal;
export declare function signalFromSubagentPressure(activeSubagents: number, threshold: number, now?: number): CanarySignal;
export declare function signalFromHostProbe(ok: boolean, detail: string, now?: number, outageId?: string): CanarySignal | undefined;
export declare function signalFromStall(session: SessionLike, facts: SessionFacts, thresholdMs: number, now?: number): CanarySignal | undefined;
export declare function signalFromStallRecovery(session: SessionLike, now?: number): CanarySignal;
export declare function signalFromHostRecovery(outageId?: string, now?: number): CanarySignal;
//# sourceMappingURL=providers.d.ts.map