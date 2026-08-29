import { DedupeLedger, InterruptBudget } from './core/dedupe.js';
import { judgeSignal } from './core/judge.js';
import { Config, normalizeConfig, sanitizeConfigPatch } from './config.js';
import { ContextDshAdapter } from './adapters/dsh.js';
import { getWorkspaceIdentity } from './adapters/windows.js';
import { hashMetadata, MetadataStore } from './persistence.js';
import { signalFromAgentError, signalFromHostRecovery, signalFromHostProbe, signalFromStall, signalFromStallRecovery, signalFromSubagentPressure, signalsFromSessionEvent, } from './providers.js';
const PLUGIN_NAME = 'dsh-deepcanary';
const PLUGIN_VERSION = '0.1.0-rc.1';
const levelValue = { C0: 0, C1: 1, C2: 2, C3: 3 };
const sensitiveSummaryPattern = /prompt|transcript|assistant\/(?:message|output)|user\/(?:message|prompt)|tool\s*(?:argument|input|payload)|api[-_ ]?key|access[-_ ]?token|bearer|password|secret|credential|authorization|private\s+key|```/i;
function idOf(value) {
    if (typeof value === 'string' && value.length > 0)
        return value;
    if (typeof value === 'number' && Number.isSafeInteger(value))
        return String(value);
    if (value !== null && typeof value === 'object' && 'id' in value)
        return idOf(value.id);
    return undefined;
}
function nowIso() {
    return new Date().toISOString();
}
export class DeepCanaryService {
    config;
    store;
    workspace = getWorkspaceIdentity();
    adapter;
    ready;
    ctx;
    sessions = new Map();
    items = [];
    dedupe;
    budget;
    pressureSeen = new Set();
    logger;
    adapterSubscription;
    activeSubagents = 0;
    registeredTools = [];
    interval;
    hostProbeInterval;
    hostProbePort;
    hostProbeFailures = 0;
    hostProbeHealthy = true;
    settingsScope;
    settingsSubscription;
    saveChain = Promise.resolve();
    hydrated = false;
    disposed = false;
    started = false;
    constructor(ctx, input) {
        this.ctx = ctx;
        this.adapter = new ContextDshAdapter(ctx);
        this.config = normalizeConfig(input);
        this.store = new MetadataStore(this.config.stateDir);
        this.dedupe = new DedupeLedger(this.config.dedupeWindowMinutes * 60 * 1000);
        this.budget = new InterruptBudget(this.config.maxInterruptsPerHour);
        this.logger = this.ctx.logger ?? {};
        this.ready = this.hydrate();
    }
    start() {
        if (this.started || this.disposed)
            return;
        this.started = true;
        this.adapterSubscription = this.adapter.subscribe(event => {
            if (event.type === 'session/created')
                this.onSessionCreated(event.session);
            else if (event.type === 'session/event')
                this.onSessionEvent(event.session, event.event);
            else
                this.onSessionDisposed(event.session);
        });
        void this.adapter.start();
        this.ctx.on?.call(this.ctx, 'dispose', () => { void this.dispose(); });
        this.ctx.inject?.(['agents'], (agentCtx) => {
            agentCtx.on?.('agent/error', (payload) => {
                void this.ingest(signalFromAgentError(asRecord(payload)));
            });
        });
        this.ctx.inject?.(['subagents'], (subagentCtx) => {
            subagentCtx.on?.('subagent/start', () => this.onSubagentDelta(1));
            subagentCtx.on?.('subagent/end', () => this.onSubagentDelta(-1));
        });
        this.ctx.inject?.(['settings'], (settingsCtx) => {
            const settings = settingsCtx.settings;
            if (!settings?.register)
                return;
            try {
                const scope = settings.register('dsh-deepcanary', Config, { base: this.config, applies: 'live' });
                this.settingsScope = scope;
                this.applySettings(scope.get());
                const disposeWatch = scope.watch?.(next => this.applySettings(next));
                if (typeof disposeWatch === 'function')
                    this.settingsSubscription = () => { disposeWatch(); };
            }
            catch (error) {
                this.logger.warn?.(`${PLUGIN_NAME}: live settings are unavailable; using composed config`, error);
            }
        });
        this.ctx.inject?.(['webServer'], (webCtx) => {
            const port = webCtx.webServer?.port;
            if (typeof port !== 'number' || port <= 0)
                return;
            this.hostProbePort = port;
            this.resetHostProbeTimer();
            void this.probeHost();
        });
        this.resetLivenessTimer();
        this.logger.info?.(`${PLUGIN_NAME} mounted; evidence-first local attention supervision enabled`);
    }
    setRegisteredTools(names) {
        this.registeredTools = [...names];
    }
    async ingest(signal) {
        await this.ready;
        if (this.disposed || signal.schemaVersion !== 1)
            return undefined;
        const verdict = this.safeVerdict(judgeSignal(signal));
        if (verdict.level === 'C0')
            return undefined;
        const dedupeKey = signal.dedupeKey ?? `${signal.kind}:${signal.sessionId ?? 'host'}`;
        const eventTime = Date.parse(signal.occurredAt);
        const now = Number.isFinite(eventTime) ? eventTime : Date.now();
        if (!this.dedupe.accept(dedupeKey, now))
            return undefined;
        const bundleKey = signal.bundleKey ? hashMetadata(signal.bundleKey) : undefined;
        const existing = bundleKey ? this.findBundle(bundleKey, now) : undefined;
        if (existing) {
            this.mergeBundle(existing, verdict, signal, now);
            this.queueSave();
            return existing;
        }
        let action = verdict.action;
        if (this.isQuietHours(now) && action === 'INTERRUPT')
            action = 'DIGEST';
        if (levelValue[verdict.level] > levelValue[this.config.notificationLevel] && action !== 'INBOX')
            action = 'INBOX';
        if (action === 'INTERRUPT' && !this.budget.consume(now))
            action = 'DIGEST';
        const item = {
            ...verdict,
            id: verdict.eventId,
            ...(signal.sessionId ? { sessionId: signal.sessionId } : {}),
            ...(signal.workspaceId ? { workspaceId: signal.workspaceId } : {}),
            occurredAt: signal.occurredAt,
            action,
            status: 'open',
            ...(bundleKey ? { bundleKey } : {}),
            bundleCount: 1,
            reasonCodes: [signal.kind],
        };
        this.items.unshift(item);
        if (this.items.length > this.config.maxInboxItems)
            this.items.length = this.config.maxInboxItems;
        this.queueSave();
        return item;
    }
    snapshot() {
        const status = this.status();
        const now = Date.now();
        return {
            status,
            settings: this.publicSettings(),
            inbox: this.items
                .filter(item => this.isPending(item, now))
                .map(item => this.toPublic(item)),
        };
    }
    status() {
        const now = Date.now();
        const open = this.items.filter(item => this.isPending(item, now)).map(item => item.level);
        const highest = open.reduce((current, level) => levelValue[level] > levelValue[current] ? level : current, 'C0');
        return {
            plugin: { name: PLUGIN_NAME, version: PLUGIN_VERSION, state: this.hydrated ? 'ready' : 'loading' },
            process: { platform: process.platform, node: process.version },
            workspace: this.workspace,
            sessions: [...this.sessions.values()].filter(session => session.active).length,
            tools: [...this.registeredTools],
            openInbox: open.length,
            indicator: highest === 'C0' ? 'gray' : highest === 'C1' ? 'yellow' : highest === 'C2' ? 'orange' : 'red',
            capabilities: {
                browserNotification: true,
                nativeToast: this.workspace.nativeToast === 'available',
                windowsInterop: this.workspace.windowsInterop,
                destructiveActions: false,
            },
        };
    }
    settings() {
        return this.publicSettings();
    }
    async updateSettings(input) {
        const patch = sanitizeConfigPatch(input);
        if (this.settingsScope?.update) {
            await this.settingsScope.update(patch);
            this.applySettings({ ...this.config, ...patch });
        }
        else {
            this.applySettings({ ...this.config, ...patch });
        }
        return this.publicSettings();
    }
    inbox(limit = 20) {
        const safeLimit = Number.isFinite(limit) ? Math.max(1, Math.min(100, Math.trunc(limit))) : 20;
        return this.items.slice(0, safeLimit).map(item => this.toPublic(item));
    }
    acknowledge(id) {
        const item = this.find(id);
        if (!item)
            return false;
        item.status = 'acknowledged';
        this.queueSave();
        return true;
    }
    snooze(id, minutes = 30) {
        const item = this.find(id);
        if (!item)
            return false;
        const bounded = Number.isFinite(minutes) ? Math.max(1, Math.min(24 * 60, Math.trunc(minutes))) : 30;
        item.status = 'snoozed';
        item.snoozedUntil = new Date(Date.now() + bounded * 60 * 1000).toISOString();
        this.queueSave();
        return true;
    }
    mute(id) {
        const item = this.find(id);
        if (!item)
            return false;
        item.status = 'muted';
        this.queueSave();
        return true;
    }
    feedback(id, useful, note) {
        const item = this.find(id);
        if (!item)
            return false;
        item.feedback = {
            useful: Boolean(useful),
            ...(note ? { note: note.slice(0, 200) } : {}),
            at: nowIso(),
        };
        this.queueSave();
        return true;
    }
    explain(id) {
        const item = this.find(id);
        return item ? this.toPublic(item) : undefined;
    }
    jump(id) {
        const item = this.find(id);
        if (!item?.sessionId)
            return { available: false, note: 'This item has no associated live session.' };
        return {
            sessionId: item.sessionId,
            url: `/?session=${encodeURIComponent(item.sessionId)}`,
            available: true,
            note: 'The URL is a local DSH navigation hint; the host decides whether the session route is available.',
        };
    }
    recordHostProbe(ok, detail = 'The local DSH host probe did not succeed.') {
        const signal = signalFromHostProbe(ok, detail);
        if (signal)
            void this.ingest(signal);
    }
    async probeHost() {
        const port = this.hostProbePort;
        if (port === undefined || this.disposed)
            return;
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 2_500);
        try {
            await fetch(`http://127.0.0.1:${port}/`, { signal: controller.signal });
            const recovered = !this.hostProbeHealthy;
            this.hostProbeFailures = 0;
            this.hostProbeHealthy = true;
            if (recovered)
                void this.ingest(signalFromHostRecovery());
        }
        catch {
            this.hostProbeFailures += 1;
            if (this.hostProbeFailures >= 2 && this.hostProbeHealthy) {
                this.hostProbeHealthy = false;
                this.recordHostProbe(false, `The local DSH WebServer did not answer on port ${port}.`);
            }
        }
        finally {
            clearTimeout(timeout);
        }
    }
    async dispose() {
        if (this.disposed)
            return;
        this.disposed = true;
        this.adapterSubscription?.dispose();
        this.settingsSubscription?.();
        if (this.interval !== undefined)
            clearInterval(this.interval);
        if (this.hostProbeInterval !== undefined)
            clearInterval(this.hostProbeInterval);
        await this.ready.catch(() => undefined);
        await this.saveChain;
    }
    async hydrate() {
        try {
            const restored = await this.store.load();
            this.items.splice(0, this.items.length, ...restored.slice(0, this.config.maxInboxItems));
        }
        catch (error) {
            this.logger.warn?.(`${PLUGIN_NAME}: metadata state could not be loaded; starting with an empty inbox`, error);
        }
        finally {
            this.hydrated = true;
        }
    }
    onSessionCreated(value) {
        const session = asRecord(value);
        const id = idOf(session);
        if (!id)
            return;
        const header = asRecord(session.header);
        const cwd = typeof header.cwd === 'string' ? header.cwd : undefined;
        const now = Date.now();
        this.sessions.set(id, {
            id,
            ...(cwd ? { cwd } : {}),
            startedAt: now,
            lastEventAt: now,
            active: true,
            toolFailures: 0,
            activeSubagents: 0,
            stalled: false,
            contextCompactions: 0,
            sameToolFailures: 0,
        });
    }
    onSessionDisposed(value) {
        const id = idOf(value);
        if (!id)
            return;
        const session = this.sessions.get(id);
        if (session)
            session.active = false;
    }
    onSessionEvent(sessionValue, eventValue) {
        const sessionRecord = asRecord(sessionValue);
        const event = asRecord(eventValue);
        const id = idOf(sessionRecord);
        if (!id || typeof event.type !== 'string')
            return;
        let session = this.sessions.get(id);
        if (!session) {
            this.onSessionCreated(sessionValue);
            session = this.sessions.get(id);
        }
        if (!session)
            return;
        const previousEventAt = session.lastEventAt;
        const now = Date.now();
        const wasStalled = session.stalled;
        if (wasStalled)
            session.stalled = false;
        session.lastEventAt = now;
        const eventData = asRecord(event.data);
        const observedToolName = typeof eventData.name === 'string'
            ? eventData.name
            : typeof eventData.toolName === 'string'
                ? eventData.toolName
                : session.lastToolName;
        if (event.type === 'tool/call' && observedToolName !== undefined)
            session.lastToolName = observedToolName;
        if (event.type === 'tool/result') {
            if (eventData.error !== undefined) {
                session.toolFailures += 1;
                if (observedToolName !== undefined && observedToolName === session.lastToolName)
                    session.sameToolFailures += 1;
                else
                    session.sameToolFailures = 1;
                if (observedToolName !== undefined)
                    session.lastToolName = observedToolName;
            }
            else {
                session.toolFailures = 0;
                session.sameToolFailures = 0;
            }
        }
        if (event.type === 'compaction/start')
            session.contextCompactions += 1;
        const facts = {
            toolFailures: session.toolFailures,
            activeSubagents: session.activeSubagents,
            lastEventAt: session.lastEventAt,
            startedAt: session.startedAt,
            contextCompactions: session.contextCompactions,
            ...(session.lastToolName ? { lastToolName: session.lastToolName } : {}),
            sameToolFailures: session.sameToolFailures,
        };
        const signals = wasStalled
            ? [signalFromStallRecovery({ id, ...(session.cwd ? { header: { cwd: session.cwd } } : {}) }, now)]
            : [];
        if (now - previousEventAt < this.config.longRunThresholdMinutes * 60 * 1000)
            signals.length = 0;
        signals.push(...signalsFromSessionEvent({ id, ...(session.cwd ? { header: { cwd: session.cwd } } : {}) }, { type: event.type, ...(typeof event.seq === 'number' ? { seq: event.seq } : {}), ...(typeof event.time === 'number' ? { time: event.time } : {}), data: asRecord(event.data) }, facts));
        for (const signal of signals)
            void this.ingest(signal);
    }
    onSubagentDelta(delta) {
        this.activeSubagents = Math.max(0, this.activeSubagents + delta);
        const active = this.activeSubagents;
        for (const session of this.sessions.values())
            session.activeSubagents = active;
        const thresholds = this.pressureThresholds();
        for (const threshold of thresholds) {
            if (active >= threshold && !this.pressureSeen.has(threshold)) {
                this.pressureSeen.add(threshold);
                void this.ingest(signalFromSubagentPressure(active, threshold));
            }
            else if (active < threshold) {
                this.pressureSeen.delete(threshold);
            }
        }
    }
    checkStalls() {
        const thresholdMs = this.config.longRunThresholdMinutes * 60 * 1000;
        for (const session of this.sessions.values()) {
            if (!session.active)
                continue;
            const signal = signalFromStall({ id: session.id, ...(session.cwd ? { header: { cwd: session.cwd } } : {}) }, {
                toolFailures: session.toolFailures,
                activeSubagents: session.activeSubagents,
                lastEventAt: session.lastEventAt,
                startedAt: session.startedAt,
            }, thresholdMs);
            if (signal) {
                session.stalled = true;
                void this.ingest(signal);
            }
        }
    }
    findBundle(bundleKey, now) {
        const windowMs = this.config.bundleWindowSeconds * 1000;
        if (windowMs <= 0)
            return undefined;
        return this.items.find(item => {
            if (item.bundleKey !== bundleKey || (item.status !== 'open' && item.status !== 'snoozed'))
                return false;
            const occurredAt = Date.parse(item.occurredAt);
            return Number.isFinite(occurredAt) && Math.abs(now - occurredAt) <= windowMs;
        });
    }
    mergeBundle(item, verdict, signal, now) {
        const previousLevel = item.level;
        item.bundleCount += 1;
        item.reasonCodes = [...new Set([...item.reasonCodes, verdict.reasonCode])];
        item.evidence = [...item.evidence, ...verdict.evidence]
            .filter((candidate, index, all) => all.findIndex(value => value.type === candidate.type && value.authority === candidate.authority && value.ref === candidate.ref) === index)
            .slice(-8);
        if (verdict.why !== item.why)
            item.why = `${item.why} Related signal: ${verdict.why}`.slice(0, 500);
        if (verdict.suggestedAction !== undefined)
            item.suggestedAction = verdict.suggestedAction;
        if (levelValue[verdict.level] > levelValue[item.level]) {
            item.level = verdict.level;
            item.reasonCode = verdict.reasonCode;
            if (verdict.level === 'C3')
                item.action = 'ESCALATE';
            else if (verdict.level === 'C2' && item.action !== 'DIGEST')
                item.action = this.budget.consume(now) ? 'INTERRUPT' : 'DIGEST';
        }
        else if (previousLevel === 'C1' && verdict.level === 'C1' && item.action === 'INBOX') {
            item.action = 'INBOX';
        }
        if (this.isQuietHours(now) && item.action === 'INTERRUPT')
            item.action = 'DIGEST';
        item.confidence = Math.max(item.confidence, verdict.confidence);
        item.occurredAt = signal.occurredAt;
    }
    pressureThresholds() {
        switch (this.config.subagentPressure) {
            case 'relaxed': return [12, 24, 48];
            case 'strict': return [3, 6, 12];
            default: return [6, 12, 24];
        }
    }
    applySettings(value) {
        if (value === null || typeof value !== 'object')
            return;
        const next = normalizeConfig(value);
        if (next.stateDir !== this.config.stateDir) {
            this.logger.warn?.(`${PLUGIN_NAME}: stateDir changes take effect after restart`);
            next.stateDir = this.config.stateDir;
        }
        this.config = next;
        this.dedupe.setWindowMs(next.dedupeWindowMinutes * 60 * 1000);
        this.budget.setMaxPerHour(next.maxInterruptsPerHour);
        if (this.items.length > next.maxInboxItems)
            this.items.length = next.maxInboxItems;
        if (this.started) {
            this.resetLivenessTimer();
            this.resetHostProbeTimer();
        }
    }
    resetLivenessTimer() {
        if (this.interval !== undefined)
            clearInterval(this.interval);
        this.interval = setInterval(() => this.checkStalls(), this.config.healthPollSeconds * 1000);
        this.interval.unref?.();
    }
    resetHostProbeTimer() {
        if (this.hostProbeInterval !== undefined)
            clearInterval(this.hostProbeInterval);
        if (this.hostProbePort === undefined)
            return;
        this.hostProbeInterval = setInterval(() => { void this.probeHost(); }, this.config.healthPollSeconds * 1000);
        this.hostProbeInterval.unref?.();
    }
    publicSettings() {
        return {
            notificationLevel: this.config.notificationLevel,
            maxInterruptsPerHour: this.config.maxInterruptsPerHour,
            dedupeWindowMinutes: this.config.dedupeWindowMinutes,
            bundleWindowSeconds: this.config.bundleWindowSeconds,
            longRunThresholdMinutes: this.config.longRunThresholdMinutes,
            subagentPressure: this.config.subagentPressure,
            quietHours: { ...this.config.quietHours },
            privacySafeSummary: this.config.privacySafeSummary,
            healthPollSeconds: this.config.healthPollSeconds,
            maxInboxItems: this.config.maxInboxItems,
        };
    }
    safeVerdict(verdict) {
        if (!this.config.privacySafeSummary)
            return verdict;
        const fallback = `${verdict.reasonCode} was observed from structured runtime evidence.`;
        const safe = (value, limit) => {
            const normalized = value.replace(/\s+/g, ' ').trim();
            if (!normalized || sensitiveSummaryPattern.test(normalized))
                return fallback;
            return normalized.slice(0, limit);
        };
        return {
            ...verdict,
            why: safe(verdict.why, 500),
            ...(verdict.suggestedAction ? { suggestedAction: safe(verdict.suggestedAction, 500) } : {}),
            evidence: verdict.evidence.map(item => ({ ...item, summary: safe(item.summary, 240) })),
        };
    }
    isQuietHours(timestamp) {
        if (!this.config.quietHours.enabled)
            return false;
        const time = new Date(timestamp).toTimeString().slice(0, 5);
        const start = this.config.quietHours.start;
        const end = this.config.quietHours.end;
        if (start === end)
            return true;
        return start < end ? time >= start && time < end : time >= start || time < end;
    }
    toPublic(item) {
        return {
            id: item.id,
            ...(item.sessionId ? { sessionId: item.sessionId } : {}),
            occurredAt: item.occurredAt,
            level: item.level,
            action: item.action,
            reasonCode: item.reasonCode,
            why: item.why,
            ...(item.suggestedAction ? { suggestedAction: item.suggestedAction } : {}),
            evidence: item.evidence.map(evidence => ({ type: evidence.type, authority: evidence.authority, summary: evidence.summary })),
            status: item.status,
            ...(item.snoozedUntil ? { snoozedUntil: item.snoozedUntil } : {}),
            bundleCount: item.bundleCount,
            reasonCodes: [...item.reasonCodes],
        };
    }
    isPending(item, now) {
        if (item.status === 'open')
            return true;
        if (item.status !== 'snoozed' || item.snoozedUntil === undefined)
            return false;
        const until = Date.parse(item.snoozedUntil);
        return Number.isFinite(until) && until <= now;
    }
    find(id) {
        return this.items.find(item => item.id === id);
    }
    queueSave() {
        this.saveChain = this.saveChain
            .then(() => this.store.save(this.items))
            .catch(error => this.logger.warn?.(`${PLUGIN_NAME}: metadata state could not be saved`, error));
    }
}
function asRecord(value) {
    return value !== null && typeof value === 'object' ? value : {};
}
export { PLUGIN_NAME, PLUGIN_VERSION };
//# sourceMappingURL=service.js.map