import { createHash } from 'node:crypto';
function keyHash(key) {
    return createHash('sha256').update(key).digest('hex').slice(0, 16);
}
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
        const hashed = keyHash(key);
        const previous = this.seen.get(hashed);
        if (previous !== undefined && now - previous < this.windowMs)
            return false;
        this.seen.set(hashed, now);
        this.prune(now);
        return true;
    }
    remember(key, now = Date.now()) {
        this.seen.set(keyHash(key), now);
        this.prune(now);
    }
    snapshot(now = Date.now(), limit = 512) {
        // Snapshotting may happen from a wall-clock status refresh while the
        // newest signal carries an event timestamp. Keep entries here and let
        // restore/accept apply the policy window in the clock domain of use.
        void now;
        return [...this.seen.entries()]
            .sort((left, right) => right[1] - left[1])
            .slice(0, Math.max(0, limit))
            .map(([hash, timestamp]) => ({ keyHash: hash, acceptedAt: new Date(timestamp).toISOString() }));
    }
    restore(entries, now = Date.now()) {
        for (const entry of entries) {
            const timestamp = Date.parse(entry.acceptedAt);
            if (!/^[a-f0-9]{16}$/.test(entry.keyHash) || !Number.isFinite(timestamp) || timestamp > now || now - timestamp >= this.windowMs)
                continue;
            this.seen.set(entry.keyHash, timestamp);
        }
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
    snapshot(now = Date.now()) {
        // See DedupeLedger.snapshot: a status refresh must not age out a
        // just-consumed event whose provider timestamp is being replayed.
        void now;
        return [...this.consumed].map(timestamp => new Date(timestamp).toISOString());
    }
    restore(timestamps, now = Date.now()) {
        for (const timestampValue of timestamps) {
            const timestamp = Date.parse(timestampValue);
            if (!Number.isFinite(timestamp) || timestamp > now || now - timestamp >= this.windowMs)
                continue;
            this.consumed.push(timestamp);
        }
        this.consumed.sort((left, right) => left - right);
        this.prune(now);
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