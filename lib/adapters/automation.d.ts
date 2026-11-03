import type { CanarySignal, TaskContext } from '../types.js';
export interface AutomationRun {
    runRef: string;
    scheduleRef: string;
    executionGeneration: string;
    sessionId: string;
    messageRef: string;
    scheduledAt: string;
    deliveredAt: string;
    phase: 'delivered' | 'running' | 'completed' | 'failed' | 'aborted' | 'unknown';
    triggerSeq?: number;
    turn?: number;
    lastSeq?: number;
}
/** Select receipt metadata from either public catalog; never copy title, prompt or failure text. */
export declare function selectAutomationDelivery(value: unknown): AutomationRun | undefined;
export declare function isAutomationRun(value: unknown): value is AutomationRun;
export declare class AutomationTracker {
    private readonly runs;
    limited: boolean;
    restore(values: readonly AutomationRun[]): void;
    snapshot(): AutomationRun[];
    observeCatalog(values: readonly unknown[]): void;
    observeSession(sessionId: string, events: readonly unknown[]): void;
    taskForEvent(sessionId: string, seq: number): TaskContext | undefined;
    contextualize(signal: CanarySignal, seq: number): CanarySignal;
}
//# sourceMappingURL=automation.d.ts.map