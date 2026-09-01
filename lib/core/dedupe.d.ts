export declare class DedupeLedger {
    private windowMs;
    private readonly seen;
    constructor(windowMs: number);
    setWindowMs(windowMs: number): void;
    accept(key: string, now?: number): boolean;
    remember(key: string, now?: number): void;
    clear(): void;
    private prune;
}
export declare class InterruptBudget {
    private maxPerHour;
    private readonly windowMs;
    private readonly consumed;
    constructor(maxPerHour: number, windowMs?: number);
    setMaxPerHour(maxPerHour: number): void;
    canInterrupt(now?: number): boolean;
    consume(now?: number): boolean;
    remaining(now?: number): number;
    used(now?: number): number;
    limit(): number;
    private prune;
}
//# sourceMappingURL=dedupe.d.ts.map