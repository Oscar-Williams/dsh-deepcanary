export class DedupeLedger {
    windowMs;
    seen = new Map();
    constructor(windowMs) {
        this.windowMs = windowMs;
    }
    setWindowMs(windowMs) {
        this.windowMs = Math.max(0, windowMs);
    }
    accept(key, now = Date.now()) {
        const previous = this.seen.get(key);
        if (previous !== undefined && now - previous < this.windowMs)
            return false;
        this.seen.set(key, now);
        this.prune(now);
        return true;
    }
    remember(key, now = Date.now()) {
        this.seen.set(key, now);
        this.prune(now);
    }
    clear() {
        this.seen.clear();
    }
    prune(now) {
        for (const [key, time] of this.seen) {
            if (now - time >= this.windowMs)
                this.seen.delete(key);
        }
    }
}
export class InterruptBudget {
    maxPerHour;
    windowMs;
    consumed = [];
    constructor(maxPerHour, windowMs = 60 * 60 * 1000) {
        this.maxPerHour = maxPerHour;
        this.windowMs = windowMs;
    }
    setMaxPerHour(maxPerHour) {
        this.maxPerHour = Math.max(0, maxPerHour);
    }
    canInterrupt(now = Date.now()) {
        this.prune(now);
        return this.consumed.length < this.maxPerHour;
    }
    consume(now = Date.now()) {
        if (!this.canInterrupt(now))
            return false;
        this.consumed.push(now);
        return true;
    }
    remaining(now = Date.now()) {
        this.prune(now);
        return Math.max(0, this.maxPerHour - this.consumed.length);
    }
    used(now = Date.now()) {
        this.prune(now);
        return this.consumed.length;
    }
    limit() {
        return this.maxPerHour;
    }
    prune(now) {
        const cutoff = now - this.windowMs;
        while (this.consumed[0] !== undefined && this.consumed[0] <= cutoff)
            this.consumed.shift();
    }
}
//# sourceMappingURL=dedupe.js.map