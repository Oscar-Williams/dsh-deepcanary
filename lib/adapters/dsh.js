const MAX_RECONCILE_BUFFER = 4096;
/** Context-backed adapter used by the plugin host; all DSH event wiring lives here. */
export class ContextDshAdapter {
    hostVersion;
    ctx;
    listeners = new Set();
    snapshots = new Map();
    runtimeHealth;
    sessionStore;
    started = false;
    reconciling = false;
    reconcileEpoch = 0;
    bufferedEvents = [];
    reconciliationEventKeys = new Set();
    bufferOverflowed = false;
    reconciliationPromise;
    startPromise;
    reconciliationStatus = {
        epoch: 0,
        phase: 'unavailable',
        authoritative: false,
        verified: false,
        listedSessions: 0,
        bufferedEvents: 0,
        skippedBufferedEvents: 0,
        detail: 'The composed DSH runtime does not expose ctx.sessions.list().',
    };
    constructor(ctx, options = {}) {
        this.ctx = ctx;
        this.hostVersion = options.hostVersion ?? process.env.DSH_VERSION ?? 'unknown';
        this.sessionStore = options.sessionStore ?? this.ctx.sessions ?? this.ctx.get?.('sessions');
        this.runtimeHealth = options.runtimeHealth ?? (async () => ({
            status: 'unknown',
            authoritative: false,
            checkedAt: new Date().toISOString(),
            detail: 'The composed DSH runtime does not expose a health provider to DeepCanary.',
        }));
    }
    async start() {
        if (this.startPromise !== undefined)
            return this.startPromise;
        if (this.started)
            return;
        this.started = true;
        const on = this.ctx.on;
        if (typeof on === 'function') {
            on.call(this.ctx, 'session/created', (session) => this.publish({ type: 'session/created', session }));
            on.call(this.ctx, 'session/event', (session, event) => this.publish({ type: 'session/event', session, event }));
            on.call(this.ctx, 'session/disposed', (session) => this.publish({ type: 'session/disposed', session }));
        }
        this.startPromise = this.reconcile().then(() => undefined);
        try {
            await this.startPromise;
        }
        finally {
            this.startPromise = undefined;
        }
    }
    async reconcile() {
        if (this.reconciliationPromise !== undefined)
            return this.reconciliationPromise;
        if (typeof this.sessionStore?.list !== 'function')
            return this.reconciliationStatus;
        this.reconciliationPromise = this.performReconcile();
        try {
            return await this.reconciliationPromise;
        }
        finally {
            this.reconciliationPromise = undefined;
        }
    }
    getReconciliationStatus() {
        return { ...this.reconciliationStatus };
    }
    subscribe(listener) {
        this.listeners.add(listener);
        return { dispose: () => this.listeners.delete(listener) };
    }
    async getSessionSnapshot(sessionId) {
        return this.snapshots.get(sessionId) ?? null;
    }
    getRuntimeHealth() {
        return this.runtimeHealth();
    }
    publish(event) {
        if (this.reconciling) {
            if (this.bufferedEvents.length < MAX_RECONCILE_BUFFER)
                this.bufferedEvents.push(event);
            else
                this.bufferOverflowed = true;
            return;
        }
        this.publishLive(event);
    }
    publishLive(event) {
        const snapshot = applyEventToSnapshot(this.snapshots, event);
        const delivered = snapshot === undefined ? event : { ...event, snapshot };
        for (const listener of this.listeners)
            listener(delivered);
    }
    async performReconcile() {
        const epoch = ++this.reconcileEpoch;
        this.reconciling = true;
        this.bufferedEvents = [];
        this.reconciliationEventKeys.clear();
        this.bufferOverflowed = false;
        let listedSessions;
        let skippedBufferedEvents = 0;
        try {
            this.reconciliationStatus = {
                epoch,
                phase: 'reconciling',
                authoritative: true,
                verified: false,
                listedSessions: 0,
                bufferedEvents: 0,
                skippedBufferedEvents: 0,
            };
            listedSessions = normalizeSessionList(await this.sessionStore.list());
            const baseline = new Map();
            const authoritative = new Map();
            const previouslyActive = new Set([...this.snapshots.values()]
                .filter(snapshot => snapshot.active)
                .map(snapshot => snapshot.sessionId));
            for (const session of listedSessions) {
                const snapshot = snapshotFromSession(session, true);
                if (snapshot === undefined)
                    continue;
                authoritative.set(snapshot.sessionId, { session, snapshot });
                baseline.set(snapshot.sessionId, snapshot.eventCount);
                this.snapshots.set(snapshot.sessionId, snapshot);
            }
            // SessionStore.list() is the authoritative live-session set. A session
            // that was previously live and is now absent has converged to the
            // disposal edge; publish that edge so the service can expire its
            // session-scoped pending items without relying on a missed firehose
            // event. This only runs after a successful authoritative read.
            for (const sessionId of previouslyActive) {
                if (authoritative.has(sessionId))
                    continue;
                const previous = this.snapshots.get(sessionId);
                if (previous === undefined || !previous.active)
                    continue;
                const disposed = { ...previous, active: false };
                this.snapshots.set(sessionId, disposed);
                this.emit({ type: 'session/disposed', session: { id: sessionId }, snapshot: disposed });
            }
            // Publish authoritative startup state while the incremental source is
            // still buffered. This gives subscribers a complete baseline before any
            // post-baseline event is released.
            for (const { session, snapshot } of authoritative.values()) {
                this.emit({ type: 'session/created', session, snapshot });
            }
            skippedBufferedEvents += this.drainBuffered(baseline);
            // A second authoritative read closes the interval around the first
            // snapshot. Events observed during this read remain in the buffer and
            // are released through the same idempotent sequence check.
            const verifiedSessions = normalizeSessionList(await this.sessionStore.list());
            skippedBufferedEvents += this.drainBuffered(baseline);
            const verified = sameAuthoritativeSessionSet(verifiedSessions, authoritative.keys(), this.snapshots);
            this.reconciling = false;
            // Drain once more after switching the phase so an event delivered at the
            // boundary becomes an ordinary live event rather than a lost edge.
            const trailing = this.bufferedEvents.splice(0);
            for (const event of trailing)
                this.publishLive(event);
            const status = {
                epoch,
                phase: 'ready',
                authoritative: true,
                verified: verified && trailing.length === 0 && !this.bufferOverflowed,
                listedSessions: authoritative.size,
                bufferedEvents: 0,
                skippedBufferedEvents,
                ...(!this.bufferOverflowed && verified && trailing.length === 0
                    ? {}
                    : { detail: this.bufferOverflowed
                            ? 'The bounded incremental event buffer overflowed during reconciliation.'
                            : 'The post-reconcile session set changed while the boundary was closing.' }),
            };
            this.reconciliationStatus = status;
            return { ...status };
        }
        catch (error) {
            // The event source remains useful if the optional authoritative list is
            // temporarily unavailable. Release every buffered edge in order and
            // expose the degraded identity to callers.
            this.reconciling = false;
            const buffered = this.bufferedEvents.splice(0);
            for (const event of buffered)
                this.publishLive(event);
            const status = {
                epoch,
                phase: 'unavailable',
                authoritative: false,
                verified: false,
                listedSessions: 0,
                bufferedEvents: buffered.length,
                skippedBufferedEvents,
                detail: error instanceof Error ? error.message : 'Authoritative session reconciliation failed.',
            };
            this.reconciliationStatus = status;
            return { ...status };
        }
    }
    emit(event) {
        for (const listener of this.listeners)
            listener(event);
    }
    drainBuffered(baseline) {
        let skipped = 0;
        while (this.bufferedEvents.length > 0) {
            const batch = this.bufferedEvents.splice(0);
            for (const event of batch) {
                if (isBaselineEvent(event, baseline)) {
                    applyEventToSnapshot(this.snapshots, event);
                    skipped += 1;
                    continue;
                }
                const key = reconciliationEventKey(event);
                if (key !== undefined && this.reconciliationEventKeys.has(key)) {
                    skipped += 1;
                    continue;
                }
                if (key !== undefined)
                    this.reconciliationEventKeys.add(key);
                this.publishLive(event);
            }
        }
        return skipped;
    }
}
function reconciliationEventKey(event) {
    const id = idOf(event.session);
    if (id === undefined)
        return undefined;
    if (event.type === 'session/event' && isRecord(event.event)) {
        const seq = safeInteger(event.event.seq);
        return seq === undefined ? undefined : `${id}:event:${seq}`;
    }
    if (event.type === 'session/disposed')
        return `${id}:disposed`;
    if (event.type === 'session/created')
        return `${id}:created`;
    return undefined;
}
function normalizeSessionList(value) {
    if (!Array.isArray(value))
        throw new TypeError('Authoritative session list did not return an array.');
    return value;
}
function isRecord(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
}
function sessionEvents(value) {
    if (!isRecord(value) || typeof value.snapshotEvents !== 'function')
        return undefined;
    try {
        const events = value.snapshotEvents();
        return Array.isArray(events) ? events.filter(isRecord) : undefined;
    }
    catch {
        return undefined;
    }
}
function numberValue(value) {
    return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}
function safeInteger(value) {
    return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : undefined;
}
function toolNameOf(data) {
    return typeof data.name === 'string' ? data.name : typeof data.toolName === 'string' ? data.toolName : undefined;
}
function snapshotFromSession(value, active) {
    const id = idOf(value);
    if (id === undefined)
        return undefined;
    const session = isRecord(value) ? value : {};
    const header = isRecord(session.header) ? session.header : {};
    const events = sessionEvents(value);
    const now = Date.now();
    const createdAt = numberValue(header.createdAt) ?? now;
    let startedAt = createdAt;
    let lastEventAt = createdAt;
    let lastEventSeq;
    let running = false;
    let waitingForHuman = false;
    let humanNeededReason;
    let humanNeededSeq;
    let toolFailures = 0;
    let sameToolFailures = 0;
    let contextCompactions = 0;
    let lastToolName;
    for (const event of events ?? []) {
        const type = typeof event.type === 'string' ? event.type : undefined;
        const time = numberValue(event.time);
        const seq = safeInteger(event.seq);
        if (time !== undefined)
            lastEventAt = time;
        if (seq !== undefined)
            lastEventSeq = seq;
        if (event.ignorable === true || type === undefined)
            continue;
        const data = isRecord(event.data) ? event.data : {};
        if (type === 'turn/start') {
            running = true;
            waitingForHuman = false;
            humanNeededReason = undefined;
            humanNeededSeq = undefined;
            startedAt = time ?? startedAt;
            toolFailures = 0;
            sameToolFailures = 0;
            contextCompactions = 0;
            lastToolName = undefined;
        }
        const observedToolName = toolNameOf(data) ?? lastToolName;
        const humanRequested = type === 'approval/asked'
            || data.humanNeeded === true
            || data.requiresApproval === true
            || (type === 'tool/call' && typeof observedToolName === 'string' && /^ask[_-]user[_-]question$/i.test(observedToolName))
            || type === 'user-questions/request';
        const humanResolved = type === 'approval/decided'
            || type === 'user-questions/response'
            || type === 'user-questions/answered'
            || (type === 'tool/result' && typeof observedToolName === 'string' && /^ask[_-]user[_-]question$/i.test(observedToolName))
            || data.humanNeeded === false
            || data.requiresApproval === false;
        if (humanRequested) {
            waitingForHuman = true;
            humanNeededReason = /ask[-_ ]?user|question|clarif/i.test(`${type} ${observedToolName ?? ''} ${String(data.kind ?? '')}`) ? 'question' : 'approval';
            humanNeededSeq = seq;
        }
        if (humanResolved) {
            waitingForHuman = false;
            humanNeededReason = undefined;
            humanNeededSeq = undefined;
        }
        if (type === 'tool/call' && observedToolName !== undefined)
            lastToolName = observedToolName;
        if (type === 'tool/result') {
            if (data.error !== undefined) {
                toolFailures += 1;
                sameToolFailures = observedToolName !== undefined && observedToolName === lastToolName ? sameToolFailures + 1 : 1;
                if (observedToolName !== undefined)
                    lastToolName = observedToolName;
            }
            else {
                toolFailures = 0;
                sameToolFailures = 0;
            }
        }
        if (type === 'compaction/start')
            contextCompactions += 1;
        if (type === 'turn/end') {
            running = false;
            waitingForHuman = false;
            humanNeededReason = undefined;
            humanNeededSeq = undefined;
        }
    }
    const cwd = typeof header.cwd === 'string' && header.cwd.length > 0 ? header.cwd : undefined;
    const eventCount = events?.length;
    return {
        sessionId: id,
        active,
        ...(cwd === undefined ? {} : { cwd }),
        startedAt,
        lastEventAt,
        ...(lastEventSeq === undefined ? {} : { lastEventSeq }),
        ...(eventCount === undefined ? {} : { eventCount }),
        running,
        waitingForHuman,
        ...(humanNeededReason === undefined ? {} : { humanNeededReason }),
        ...(humanNeededSeq === undefined ? {} : { humanNeededSeq }),
        toolFailures,
        sameToolFailures,
        contextCompactions,
        ...(lastToolName === undefined ? {} : { lastToolName }),
    };
}
function applyEventToSnapshot(snapshots, event) {
    const id = idOf(event.session);
    if (id === undefined)
        return undefined;
    if (event.snapshot !== undefined) {
        snapshots.set(id, { ...event.snapshot });
        return event.snapshot;
    }
    if (event.type === 'session/disposed') {
        const previous = snapshots.get(id);
        const snapshot = previous === undefined
            ? snapshotFromSession(event.session, false)
            : { ...previous, active: false };
        if (snapshot !== undefined)
            snapshots.set(id, snapshot);
        return snapshot;
    }
    const previous = snapshots.get(id);
    const snapshot = snapshotFromSession(event.session, true) ?? (previous === undefined ? undefined : { ...previous });
    if (snapshot !== undefined && event.type === 'session/event' && isRecord(event.event)) {
        const occurredAt = numberValue(event.event.time);
        const seq = safeInteger(event.event.seq);
        if (occurredAt !== undefined)
            snapshot.lastEventAt = occurredAt;
        if (seq !== undefined) {
            snapshot.lastEventSeq = seq;
            if (snapshot.eventCount !== undefined)
                snapshot.eventCount = Math.max(snapshot.eventCount, seq + 1);
        }
    }
    if (snapshot !== undefined)
        snapshots.set(id, snapshot);
    return snapshot;
}
function isBaselineEvent(event, baseline) {
    const id = idOf(event.session);
    if (id === undefined)
        return false;
    if (event.type === 'session/created')
        return baseline.has(id);
    if (event.type !== 'session/event')
        return false;
    const count = baseline.get(id);
    const eventValue = isRecord(event.event) ? safeInteger(event.event.seq) : undefined;
    return count !== undefined && eventValue !== undefined && eventValue < count;
}
function sameAuthoritativeSessionSet(sessions, expectedIds, snapshots) {
    const listed = new Map();
    for (const session of sessions) {
        const snapshot = snapshotFromSession(session, true);
        if (snapshot !== undefined)
            listed.set(snapshot.sessionId, snapshot);
    }
    const expected = new Set(expectedIds);
    if (listed.size !== expected.size)
        return false;
    for (const id of expected)
        if (!listed.has(id))
            return false;
    for (const [id, snapshot] of listed) {
        const current = snapshots.get(id);
        if (current === undefined || current.eventCount !== snapshot.eventCount || current.lastEventSeq !== snapshot.lastEventSeq)
            return false;
    }
    return true;
}
function idOf(value) {
    if (typeof value === 'string' && value.length > 0)
        return value;
    if (typeof value === 'number' && Number.isSafeInteger(value))
        return String(value);
    if (value !== null && typeof value === 'object' && 'id' in value)
        return idOf(value.id);
    return undefined;
}
//# sourceMappingURL=dsh.js.map