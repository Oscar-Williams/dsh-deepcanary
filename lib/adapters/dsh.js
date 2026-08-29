/** Context-backed adapter used by the plugin host; all DSH event wiring lives here. */
export class ContextDshAdapter {
    hostVersion;
    ctx;
    listeners = new Set();
    snapshots = new Map();
    runtimeHealth;
    started = false;
    constructor(ctx, options = {}) {
        this.ctx = ctx;
        this.hostVersion = options.hostVersion ?? process.env.DSH_VERSION ?? 'unknown';
        this.runtimeHealth = options.runtimeHealth ?? (async () => ({
            status: 'unknown',
            authoritative: false,
            checkedAt: new Date().toISOString(),
            detail: 'The composed DSH runtime does not expose a health provider to DeepCanary.',
        }));
    }
    async start() {
        if (this.started)
            return;
        this.started = true;
        const on = this.ctx.on;
        if (typeof on !== 'function')
            return;
        on.call(this.ctx, 'session/created', (session) => this.publish({ type: 'session/created', session }));
        on.call(this.ctx, 'session/event', (session, event) => this.publish({ type: 'session/event', session, event }));
        on.call(this.ctx, 'session/disposed', (session) => this.publish({ type: 'session/disposed', session }));
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
        const id = idOf(event.session);
        if (id !== undefined) {
            const previous = this.snapshots.get(id);
            const session = event.session;
            const cwd = session.header?.cwd;
            this.snapshots.set(id, {
                sessionId: id,
                active: event.type !== 'session/disposed',
                ...(cwd ? { cwd } : previous?.cwd ? { cwd: previous.cwd } : {}),
                lastEventAt: event.type === 'session/event' ? Date.now() : previous?.lastEventAt ?? Date.now(),
            });
        }
        for (const listener of this.listeners)
            listener(event);
    }
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