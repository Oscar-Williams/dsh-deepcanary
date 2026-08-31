import type { Context } from '@deepseek-ai/cordis'
import { DedupeLedger, InterruptBudget } from './core/dedupe.js'
import { judgeSignal } from './core/judge.js'
import { Config, normalizeConfig, sanitizeConfigPatch } from './config.js'
import type { DeepCanaryConfigInput } from './config.js'
import { ContextDshAdapter } from './adapters/dsh.js'
import type { Disposable } from './adapters/dsh.js'
import { getWorkspaceIdentity } from './adapters/windows.js'
import { hashMetadata, MetadataStore } from './persistence.js'
import {
  signalFromAgentError,
  signalFromHostRecovery,
  signalFromHostProbe,
  signalFromStall,
  signalFromStallRecovery,
  signalFromSubagentPressure,
  signalsFromSessionEvent,
} from './providers.js'
import type {
  AttentionAction,
  AttentionVerdict,
  AttentionLevel,
  CanarySignal,
  DeepCanaryConfig,
  InboxItem,
  PublicInboxItem,
  PublicSettings,
  PublicSnapshot,
  RuntimeStatus,
} from './types.js'
import { ATTENTION_PROTOCOL_VERSION as PROTOCOL_VERSION } from './types.js'

const PLUGIN_NAME = 'dsh-deepcanary'
const PLUGIN_VERSION = '0.1.0-rc.2'
const SETTINGS_NAMESPACE = 'dsh-deepcanary'

interface LiveSession {
  id: string
  cwd?: string
  startedAt: number
  lastEventAt: number
  active: boolean
  toolFailures: number
  activeSubagents: number
  stalled: boolean
  contextCompactions: number
  lastToolName?: string
  sameToolFailures: number
}

interface LoggerLike {
  info?: (...args: unknown[]) => void
  warn?: (...args: unknown[]) => void
  error?: (...args: unknown[]) => void
}

interface ContextLike {
  on?: (event: string, listener: (...args: any[]) => any) => unknown
  inject?: (services: string[], callback: (ctx: any) => any) => unknown
  logger?: LoggerLike
}

interface SettingsScopeLike {
  get: () => unknown
  watch?: (callback: (next: unknown) => void) => unknown
  update?: (patch: object) => Promise<void>
}

interface SettingsProviderLike {
  installSection?: (owner: Context, namespace: string, schema: unknown, entry: DeepCanaryConfig, hooks: {
    setSource: (current: () => DeepCanaryConfig) => void
    onChange: () => void
    validate?: (value: DeepCanaryConfig) => void
  }) => void
  register?: (namespace: string, schema: unknown, options: { base: DeepCanaryConfig; applies: 'live' }) => SettingsScopeLike
  get?: (namespace: string) => unknown
  update?: (namespace: string, patch: object) => Promise<void>
}

interface ActionReceipt {
  status: number
  body: Record<string, unknown>
  fingerprint: string
}

const levelValue: Record<AttentionLevel, number> = { C0: 0, C1: 1, C2: 2, C3: 3 }
const sensitiveSummaryPattern = /prompt|transcript|assistant\/(?:message|output)|user\/(?:message|prompt)|tool\s*(?:argument|input|payload)|api[-_ ]?key|access[-_ ]?token|bearer|password|secret|credential|authorization|private\s+key|```/i

function idOf(value: unknown): string | undefined {
  if (typeof value === 'string' && value.length > 0) return value
  if (typeof value === 'number' && Number.isSafeInteger(value)) return String(value)
  if (value !== null && typeof value === 'object' && 'id' in value) return idOf((value as { id?: unknown }).id)
  return undefined
}

function nowIso(): string {
  return new Date().toISOString()
}

export class DeepCanaryService {
  config: DeepCanaryConfig
  readonly store: MetadataStore
  readonly workspace = getWorkspaceIdentity()
  readonly adapter: ContextDshAdapter
  readonly ready: Promise<void>

  private readonly ctx: ContextLike
  private readonly sessions = new Map<string, LiveSession>()
  private readonly items: InboxItem[] = []
  private readonly dedupe: DedupeLedger
  private readonly budget: InterruptBudget
  private readonly pressureSeen = new Set<number>()
  private readonly logger: LoggerLike
  private adapterSubscription: Disposable | undefined
  private activeSubagents = 0
  private registeredTools: string[] = []
  private interval: ReturnType<typeof setInterval> | undefined
  private hostProbeInterval: ReturnType<typeof setInterval> | undefined
  private hostProbePort: number | undefined
  private hostProbeFailures = 0
  private hostProbeHealthy = true
  private settingsScope: SettingsScopeLike | undefined
  private settingsProvider: SettingsProviderLike | undefined
  private settingsSource: (() => DeepCanaryConfig) | undefined
  private settingsSubscription: (() => void) | undefined
  private saveChain = Promise.resolve()
  private hydrated = false
  private disposed = false
  private started = false
  private revision = 0
  private readonly actionReceipts = new Map<string, ActionReceipt>()

  constructor(ctx: Context, input?: DeepCanaryConfigInput) {
    this.ctx = ctx as unknown as ContextLike
    this.adapter = new ContextDshAdapter(ctx)
    this.config = normalizeConfig(input)
    this.store = new MetadataStore(this.config.stateDir)
    this.dedupe = new DedupeLedger(this.config.dedupeWindowMinutes * 60 * 1000)
    this.budget = new InterruptBudget(this.config.maxInterruptsPerHour)
    this.logger = this.ctx.logger ?? {}
    this.ready = this.hydrate()
  }

  start(): void {
    if (this.started || this.disposed) return
    this.started = true
    this.adapterSubscription = this.adapter.subscribe(event => {
      if (event.type === 'session/created') this.onSessionCreated(event.session)
      else if (event.type === 'session/event') this.onSessionEvent(event.session, event.event)
      else this.onSessionDisposed(event.session)
    })
    void this.adapter.start()
    this.ctx.on?.call(this.ctx, 'dispose', () => { void this.dispose() })

    this.ctx.inject?.(['agents'], (agentCtx: any) => {
      agentCtx.on?.('agent/error', (payload: unknown) => {
        void this.ingest(signalFromAgentError(asRecord(payload)))
      })
    })
    this.ctx.inject?.(['subagents'], (subagentCtx: any) => {
      subagentCtx.on?.('subagent/start', () => this.onSubagentDelta(1))
      subagentCtx.on?.('subagent/end', () => this.onSubagentDelta(-1))
    })
    this.ctx.inject?.(['settings'], (settingsCtx: any) => {
      const settings = settingsCtx.settings as SettingsProviderLike | undefined
      if (!settings) return
      this.settingsProvider = settings
      try {
        const applyCurrent = (): void => {
          const current = this.settingsSource?.() ?? settings.get?.(SETTINGS_NAMESPACE) ?? this.settingsScope?.get()
          if (current !== undefined) this.applySettings(current)
        }
        if (settings.installSection) {
          settings.installSection(this.ctx as unknown as Context, SETTINGS_NAMESPACE, Config, this.config, {
            setSource: current => { this.settingsSource = current },
            onChange: applyCurrent,
          })
        } else if (settings.register) {
          const scope = settings.register(SETTINGS_NAMESPACE, Config, { base: this.config, applies: 'live' })
          this.settingsScope = scope
          this.applySettings(scope.get())
          const disposeWatch = scope.watch?.(next => this.applySettings(next))
          if (typeof disposeWatch === 'function') this.settingsSubscription = () => { disposeWatch() }
        } else {
          applyCurrent()
        }
      } catch (error: unknown) {
        this.logger.warn?.(`${PLUGIN_NAME}: live settings are unavailable; using composed config`, error)
      }
    })

    this.ctx.inject?.(['webServer'], (webCtx: any) => {
      const port = webCtx.webServer?.port
      if (typeof port !== 'number' || port <= 0) return
      this.hostProbePort = port
      this.resetHostProbeTimer()
      void this.probeHost()
    })

    this.resetLivenessTimer()
    this.logger.info?.(`${PLUGIN_NAME} mounted; evidence-first local attention supervision enabled`)
  }

  setRegisteredTools(names: readonly string[]): void {
    this.registeredTools = [...names]
  }

  async ingest(signal: CanarySignal): Promise<InboxItem | undefined> {
    await this.ready
    if (this.disposed || signal.schemaVersion !== 1) return undefined
    const now = Number.isFinite(Date.parse(signal.occurredAt)) ? Date.parse(signal.occurredAt) : Date.now()
    this.normalizeLifecycle(now)
    const verdict = this.safeVerdict(judgeSignal(signal))
    if (verdict.level === 'C0') return undefined
    const dedupeKey = signal.dedupeKey ?? `${signal.kind}:${signal.sessionId ?? 'host'}`
    if (!this.dedupe.accept(dedupeKey, now)) return undefined

    if (signal.kind === 'HOST_STALL_RECOVERED') {
      const recovered = this.recover(signal, verdict, now)
      if (recovered === undefined) return undefined
      this.queueSave()
      return recovered
    }

    const bundleKey = signal.bundleKey ? hashMetadata(signal.bundleKey) : undefined
    const existing = bundleKey ? this.findBundle(bundleKey, now) : undefined
    if (existing) {
      this.mergeBundle(existing, verdict, signal, now)
      this.bumpRevision()
      this.queueSave()
      return existing
    }

    let action = verdict.action
    if (this.isQuietHours(now) && action === 'INTERRUPT') action = 'DIGEST'
    if (levelValue[verdict.level] > levelValue[this.config.notificationLevel] && action !== 'INBOX') action = 'INBOX'
    if (action === 'INTERRUPT' && !this.budget.consume(now)) action = 'DIGEST'

    const item: InboxItem = {
      ...verdict,
      id: verdict.eventId,
      ...(signal.sessionId ? { sessionId: signal.sessionId } : {}),
      ...(signal.workspaceId ? { workspaceId: signal.workspaceId } : {}),
      ...(signal.sessionId ? { sessionRef: hashMetadata(signal.sessionId) } : {}),
      ...(signal.workspaceId ? { workspaceRef: hashMetadata(signal.workspaceId) } : {}),
      occurredAt: signal.occurredAt,
      action,
      status: 'open',
      ...(bundleKey ? { bundleKey } : {}),
      bundleCount: 1,
      reasonCodes: [signal.kind],
    }
    this.items.unshift(item)
    if (this.items.length > this.config.maxInboxItems) this.items.length = this.config.maxInboxItems
    this.bumpRevision()
    this.queueSave()
    return item
  }

  snapshot(): PublicSnapshot {
    const now = Date.now()
    this.normalizeLifecycle(now)
    const status = this.status()
    return {
      schemaVersion: PROTOCOL_VERSION,
      revision: this.revision,
      generatedAt: new Date(now).toISOString(),
      status,
      settings: this.publicSettings(),
      inbox: this.items
        .filter(item => this.isPending(item, now))
        .map(item => this.toPublic(item)),
    }
  }

  status(): RuntimeStatus {
    const now = Date.now()
    this.normalizeLifecycle(now)
    const open = this.items.filter(item => this.isPending(item, now)).map(item => item.level)
    const highest = open.reduce<AttentionLevel>((current, level) => levelValue[level] > levelValue[current] ? level : current, 'C0')
    return {
      plugin: { name: PLUGIN_NAME, version: PLUGIN_VERSION, state: this.hydrated ? 'ready' : 'loading' },
      process: { platform: process.platform, node: process.version },
      workspace: this.workspace,
      sessions: [...this.sessions.values()].filter(session => session.active).length,
      tools: [...this.registeredTools],
      openInbox: open.length,
      revision: this.revision,
      indicator: highest === 'C0' ? 'gray' : highest === 'C1' ? 'yellow' : highest === 'C2' ? 'orange' : 'red',
      capabilities: {
        browserNotification: true,
        nativeToast: this.workspace.nativeToast === 'available',
        windowsInterop: this.workspace.windowsInterop,
        destructiveActions: false,
      },
    }
  }

  settings(): PublicSettings {
    return this.publicSettings()
  }

  async updateSettings(input: Record<string, unknown>): Promise<PublicSettings> {
    const patch = sanitizeConfigPatch(input)
    if (this.settingsProvider?.update) {
      await this.settingsProvider.update(SETTINGS_NAMESPACE, patch)
      const current = this.settingsProvider.get?.(SETTINGS_NAMESPACE)
      this.applySettings(current ?? { ...this.config, ...patch })
    } else if (this.settingsScope?.update) {
      await this.settingsScope.update(patch)
      this.applySettings({ ...this.config, ...patch })
    } else {
      this.applySettings({ ...this.config, ...patch })
    }
    return this.publicSettings()
  }

  inbox(limit = 20): PublicInboxItem[] {
    this.normalizeLifecycle(Date.now())
    const safeLimit = Number.isFinite(limit) ? Math.max(1, Math.min(100, Math.trunc(limit))) : 20
    return this.items.slice(0, safeLimit).map(item => this.toPublic(item))
  }

  seen(id: string): boolean {
    const item = this.find(id)
    if (!item || item.status === 'acknowledged' || item.status === 'muted' || item.status === 'recovered' || item.status === 'expired') return false
    if (item.status === 'seen') return false
    item.status = 'seen'
    item.seenAt = nowIso()
    delete item.snoozedUntil
    this.bumpRevision()
    this.queueSave()
    return true
  }

  acknowledge(id: string): boolean {
    const item = this.find(id)
    if (!item || item.status === 'acknowledged' || item.status === 'muted' || item.status === 'recovered' || item.status === 'expired') return false
    item.status = 'acknowledged'
    item.acknowledgedAt = nowIso()
    delete item.snoozedUntil
    this.bumpRevision()
    this.queueSave()
    return true
  }

  snooze(id: string, minutes = 30): boolean {
    const item = this.find(id)
    if (!item || item.status === 'acknowledged' || item.status === 'muted' || item.status === 'recovered' || item.status === 'expired') return false
    const bounded = Number.isFinite(minutes) ? Math.max(1, Math.min(24 * 60, Math.trunc(minutes))) : 30
    item.status = 'snoozed'
    item.snoozedUntil = new Date(Date.now() + bounded * 60 * 1000).toISOString()
    this.bumpRevision()
    this.queueSave()
    return true
  }

  mute(id: string): boolean {
    const item = this.find(id)
    if (!item || item.status === 'muted' || item.status === 'recovered' || item.status === 'expired') return false
    item.status = 'muted'
    delete item.snoozedUntil
    this.bumpRevision()
    this.queueSave()
    return true
  }

  feedback(id: string, useful: boolean, note?: string): boolean {
    const item = this.find(id)
    if (!item) return false
    item.feedback = {
      useful: Boolean(useful),
      ...(note ? { note: note.slice(0, 200) } : {}),
      at: nowIso(),
    }
    this.bumpRevision()
    this.queueSave()
    return true
  }

  explain(id: string): PublicInboxItem | undefined {
    const item = this.find(id)
    return item ? this.toPublic(item) : undefined
  }

  jump(id: string): { sessionId?: string; url?: string; available: boolean; note: string } {
    const item = this.find(id)
    if (!item?.sessionId) return { available: false, note: 'This item has no associated live session.' }
    return {
      sessionId: item.sessionId,
      url: `/?session=${encodeURIComponent(item.sessionId)}`,
      available: true,
      note: 'The URL is a local DSH navigation hint; the host decides whether the session route is available.',
    }
  }

  /** Apply one browser action exactly once for its request id. */
  async performAction(requestId: string, id: string, action: string, payload: Record<string, unknown> = {}): Promise<ActionReceipt> {
    if (typeof requestId !== 'string' || requestId.length === 0 || requestId.length > 128 || /[\u0000-\u001f]/.test(requestId)) {
      return { status: 400, body: { error: 'requestId must be a printable string of 1-128 characters' }, fingerprint: '' }
    }
    const knownActions = new Set(['seen', 'acknowledge', 'snooze', 'mute', 'feedback', 'jump', 'retry'])
    if (!knownActions.has(action)) {
      return { status: 400, body: { error: 'unsupported action', schemaVersion: PROTOCOL_VERSION }, fingerprint: '' }
    }
    if (action !== 'retry' && (typeof id !== 'string' || id.length === 0 || id.length > 256)) {
      return { status: 400, body: { error: 'id is required', schemaVersion: PROTOCOL_VERSION }, fingerprint: '' }
    }
    if (action === 'feedback' && typeof payload.useful !== 'boolean') {
      return { status: 400, body: { error: 'feedback.useful must be boolean', schemaVersion: PROTOCOL_VERSION }, fingerprint: '' }
    }
    if (action === 'snooze' && payload.minutes !== undefined && (typeof payload.minutes !== 'number' || !Number.isFinite(payload.minutes))) {
      return { status: 400, body: { error: 'snooze.minutes must be a finite number', schemaVersion: PROTOCOL_VERSION }, fingerprint: '' }
    }

    const fingerprint = JSON.stringify({
      id,
      action,
      minutes: payload.minutes,
      useful: payload.useful,
      note: payload.note,
    })
    const previous = this.actionReceipts.get(requestId)
    if (previous !== undefined) {
      if (previous.fingerprint !== fingerprint) {
        return {
          status: 409,
          body: { error: 'requestId was already used for a different action', schemaVersion: PROTOCOL_VERSION, requestId, revision: this.revision },
          fingerprint,
        }
      }
      return previous
    }

    let status = 200
    let body: Record<string, unknown>
    if (action === 'retry') {
      await this.probeHost()
      body = { schemaVersion: PROTOCOL_VERSION, requestId, revision: this.revision, updated: this.hostProbePort !== undefined }
    } else if (this.find(id) === undefined) {
      status = 404
      body = { error: 'inbox item not found', schemaVersion: PROTOCOL_VERSION, requestId, revision: this.revision, updated: false }
    } else if (action === 'jump') {
      body = { schemaVersion: PROTOCOL_VERSION, requestId, revision: this.revision, result: this.jump(id) }
    } else {
      const updated = action === 'seen'
        ? this.seen(id)
        : action === 'acknowledge'
          ? this.acknowledge(id)
          : action === 'snooze'
            ? this.snooze(id, typeof payload.minutes === 'number' ? payload.minutes : 30)
            : action === 'mute'
              ? this.mute(id)
              : this.feedback(id, payload.useful === true, typeof payload.note === 'string' ? payload.note : undefined)
      body = { schemaVersion: PROTOCOL_VERSION, requestId, revision: this.revision, updated }
    }

    const receipt: ActionReceipt = { status, body, fingerprint }
    this.actionReceipts.set(requestId, receipt)
    while (this.actionReceipts.size > 512) {
      const oldest = this.actionReceipts.keys().next().value
      if (oldest === undefined) break
      this.actionReceipts.delete(oldest)
    }
    return receipt
  }

  recordHostProbe(ok: boolean, detail = 'The local DSH host probe did not succeed.'): void {
    const signal = signalFromHostProbe(ok, detail)
    if (signal) void this.ingest(signal)
  }

  private async probeHost(): Promise<void> {
    const port = this.hostProbePort
    if (port === undefined || this.disposed) return
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 2_500)
    try {
      await fetch(`http://127.0.0.1:${port}/`, { signal: controller.signal })
      const recovered = !this.hostProbeHealthy
      this.hostProbeFailures = 0
      this.hostProbeHealthy = true
      if (recovered) void this.ingest(signalFromHostRecovery())
    } catch {
      this.hostProbeFailures += 1
      if (this.hostProbeFailures >= 2 && this.hostProbeHealthy) {
        this.hostProbeHealthy = false
        this.recordHostProbe(false, `The local DSH WebServer did not answer on port ${port}.`)
      }
    } finally {
      clearTimeout(timeout)
    }
  }

  async dispose(): Promise<void> {
    if (this.disposed) return
    this.disposed = true
    this.adapterSubscription?.dispose()
    this.settingsSubscription?.()
    if (this.interval !== undefined) clearInterval(this.interval)
    if (this.hostProbeInterval !== undefined) clearInterval(this.hostProbeInterval)
    await this.ready.catch(() => undefined)
    await this.saveChain
  }

  private async hydrate(): Promise<void> {
    try {
      const restored = await this.store.load()
      this.items.splice(0, this.items.length, ...restored.slice(0, this.config.maxInboxItems))
    } catch (error: unknown) {
      this.logger.warn?.(`${PLUGIN_NAME}: metadata state could not be loaded; starting with an empty inbox`, error)
    } finally {
      this.hydrated = true
    }
  }

  private onSessionCreated(value: unknown): void {
    const session = asRecord(value)
    const id = idOf(session)
    if (!id) return
    const header = asRecord(session.header)
    const cwd = typeof header.cwd === 'string' ? header.cwd : undefined
    const now = Date.now()
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
    })
    const sessionRef = hashMetadata(id)
    for (const item of this.items) {
      if (item.sessionId === undefined && item.sessionRef === sessionRef) {
        item.sessionId = id
      }
    }
    this.bumpRevision()
  }

  private onSessionDisposed(value: unknown): void {
    const id = idOf(value)
    if (!id) return
    const session = this.sessions.get(id)
    if (session) {
      session.active = false
      this.expireSessionItems(id)
      this.bumpRevision()
    }
  }

  private onSessionEvent(sessionValue: unknown, eventValue: unknown): void {
    const sessionRecord = asRecord(sessionValue)
    const event = asRecord(eventValue)
    const id = idOf(sessionRecord)
    if (!id || typeof event.type !== 'string') return
    if (event.ignorable === true) return
    let session = this.sessions.get(id)
    if (!session) {
      this.onSessionCreated(sessionValue)
      session = this.sessions.get(id)
    }
    if (!session) return
    const previousEventAt = session.lastEventAt
    const now = Date.now()
    const wasStalled = session.stalled
    if (wasStalled) session.stalled = false
    session.lastEventAt = now
    const eventData = asRecord(event.data)
    const observedToolName = typeof eventData.name === 'string'
      ? eventData.name
      : typeof eventData.toolName === 'string'
        ? eventData.toolName
        : session.lastToolName
    if (event.type === 'tool/call' && observedToolName !== undefined) session.lastToolName = observedToolName
    if (event.type === 'tool/result') {
      if (eventData.error !== undefined) {
        session.toolFailures += 1
        if (observedToolName !== undefined && observedToolName === session.lastToolName) session.sameToolFailures += 1
        else session.sameToolFailures = 1
        if (observedToolName !== undefined) session.lastToolName = observedToolName
      } else {
        session.toolFailures = 0
        session.sameToolFailures = 0
      }
    }
    if (event.type === 'compaction/start') session.contextCompactions += 1
    const facts = {
      toolFailures: session.toolFailures,
      activeSubagents: session.activeSubagents,
      lastEventAt: session.lastEventAt,
      startedAt: session.startedAt,
      contextCompactions: session.contextCompactions,
      ...(session.lastToolName ? { lastToolName: session.lastToolName } : {}),
      sameToolFailures: session.sameToolFailures,
    }
    const signals = wasStalled
      ? [signalFromStallRecovery({ id, ...(session.cwd ? { header: { cwd: session.cwd } } : {}) }, now)]
      : []
    if (now - previousEventAt < this.config.longRunThresholdMinutes * 60 * 1000) signals.length = 0
    signals.push(...signalsFromSessionEvent(
      { id, ...(session.cwd ? { header: { cwd: session.cwd } } : {}) },
      { type: event.type, ...(typeof event.seq === 'number' ? { seq: event.seq } : {}), ...(typeof event.time === 'number' ? { time: event.time } : {}), ...(event.ignorable === true ? { ignorable: true } : {}), data: asRecord(event.data) },
      facts,
    ))
    for (const signal of signals) void this.ingest(signal)
  }

  private onSubagentDelta(delta: 1 | -1): void {
    this.activeSubagents = Math.max(0, this.activeSubagents + delta)
    const active = this.activeSubagents
    for (const session of this.sessions.values()) session.activeSubagents = active
    const thresholds = this.pressureThresholds()
    for (const threshold of thresholds) {
      if (active >= threshold && !this.pressureSeen.has(threshold)) {
        this.pressureSeen.add(threshold)
        void this.ingest(signalFromSubagentPressure(active, threshold))
      } else if (active < threshold) {
        this.pressureSeen.delete(threshold)
      }
    }
  }

  private checkStalls(): void {
    const thresholdMs = this.config.longRunThresholdMinutes * 60 * 1000
    for (const session of this.sessions.values()) {
      if (!session.active) continue
      const signal = signalFromStall({ id: session.id, ...(session.cwd ? { header: { cwd: session.cwd } } : {}) }, {
        toolFailures: session.toolFailures,
        activeSubagents: session.activeSubagents,
        lastEventAt: session.lastEventAt,
        startedAt: session.startedAt,
      }, thresholdMs)
      if (signal) {
        session.stalled = true
        void this.ingest(signal)
      }
    }
  }

  private findBundle(bundleKey: string, now: number): InboxItem | undefined {
    const windowMs = this.config.bundleWindowSeconds * 1000
    if (windowMs <= 0) return undefined
    return this.items.find(item => {
      if (item.bundleKey !== bundleKey || (item.status !== 'open' && item.status !== 'seen' && item.status !== 'snoozed')) return false
      const occurredAt = Date.parse(item.occurredAt)
      return Number.isFinite(occurredAt) && Math.abs(now - occurredAt) <= windowMs
    })
  }

  private mergeBundle(item: InboxItem, verdict: AttentionVerdict, signal: CanarySignal, now: number): void {
    const previousLevel = item.level
    item.bundleCount += 1
    item.reasonCodes = [...new Set([...item.reasonCodes, verdict.reasonCode])]
    item.messageKey = verdict.messageKey
    if (verdict.messageParams !== undefined) item.messageParams = { ...verdict.messageParams }
    if (verdict.suggestionKey !== undefined) item.suggestionKey = verdict.suggestionKey
    item.policyVersion = verdict.policyVersion
    item.evidence = [...item.evidence, ...verdict.evidence]
      .filter((candidate, index, all) => all.findIndex(value => value.type === candidate.type && value.authority === candidate.authority && value.ref === candidate.ref) === index)
      .slice(-8)
    if (verdict.why !== item.why) item.why = `${item.why} Related signal: ${verdict.why}`.slice(0, 500)
    if (verdict.suggestedAction !== undefined) item.suggestedAction = verdict.suggestedAction
    if (levelValue[verdict.level] > levelValue[item.level]) {
      item.level = verdict.level
      item.reasonCode = verdict.reasonCode
      if (verdict.level === 'C3') item.action = 'ESCALATE'
      else if (verdict.level === 'C2' && item.action !== 'DIGEST') item.action = this.budget.consume(now) ? 'INTERRUPT' : 'DIGEST'
    } else if (previousLevel === 'C1' && verdict.level === 'C1' && item.action === 'INBOX') {
      item.action = 'INBOX'
    }
    if (this.isQuietHours(now) && item.action === 'INTERRUPT') item.action = 'DIGEST'
    item.confidence = Math.max(item.confidence, verdict.confidence)
    item.occurredAt = signal.occurredAt
  }

  private recover(signal: CanarySignal, verdict: AttentionVerdict, now: number): InboxItem | undefined {
    const bundleKey = signal.bundleKey ? hashMetadata(signal.bundleKey) : undefined
    const item = this.items.find(candidate => {
      if (candidate.status !== 'open' && candidate.status !== 'seen' && candidate.status !== 'snoozed') return false
      if (bundleKey !== undefined && candidate.bundleKey === bundleKey) return true
      return signal.sessionId !== undefined
        && candidate.sessionId === signal.sessionId
        && (candidate.reasonCode === 'HOST_SUSPECTED_STALL' || candidate.reasonCode === 'HOST_UNREACHABLE')
    })
    if (item === undefined) return undefined
    item.status = 'recovered'
    item.recoveredAt = new Date(now).toISOString()
    delete item.snoozedUntil
    item.reasonCodes = [...new Set([...item.reasonCodes, verdict.reasonCode])]
    item.evidence = [...item.evidence, ...verdict.evidence]
      .filter((candidate, index, all) => all.findIndex(value => value.type === candidate.type && value.authority === candidate.authority && value.ref === candidate.ref) === index)
      .slice(-8)
    item.confidence = Math.max(item.confidence, verdict.confidence)
    this.bumpRevision()
    return item
  }

  private expireSessionItems(sessionId: string): void {
    let changed = false
    for (const item of this.items) {
      if (item.sessionId !== sessionId || (item.status !== 'open' && item.status !== 'seen' && item.status !== 'snoozed')) continue
      item.status = 'expired'
      item.expiredAt = nowIso()
      delete item.snoozedUntil
      changed = true
    }
    if (changed) {
      this.bumpRevision()
      this.queueSave()
    }
  }

  private pressureThresholds(): number[] {
    switch (this.config.subagentPressure) {
      case 'relaxed': return [12, 24, 48]
      case 'strict': return [3, 6, 12]
      default: return [6, 12, 24]
    }
  }

  private applySettings(value: unknown): void {
    if (value === null || typeof value !== 'object') return
    const next = normalizeConfig(value as Partial<DeepCanaryConfig>)
    if (next.stateDir !== this.config.stateDir) {
      this.logger.warn?.(`${PLUGIN_NAME}: stateDir changes take effect after restart`)
      next.stateDir = this.config.stateDir
    }
    const changed = JSON.stringify(next) !== JSON.stringify(this.config)
    this.config = next
    this.dedupe.setWindowMs(next.dedupeWindowMinutes * 60 * 1000)
    this.budget.setMaxPerHour(next.maxInterruptsPerHour)
    if (this.items.length > next.maxInboxItems) {
      this.items.length = next.maxInboxItems
      this.bumpRevision()
      this.queueSave()
    }
    if (changed) this.bumpRevision()
    if (this.started) {
      this.resetLivenessTimer()
      this.resetHostProbeTimer()
    }
  }

  private resetLivenessTimer(): void {
    if (this.interval !== undefined) clearInterval(this.interval)
    this.interval = setInterval(() => this.checkStalls(), this.config.healthPollSeconds * 1000)
    this.interval.unref?.()
  }

  private resetHostProbeTimer(): void {
    if (this.hostProbeInterval !== undefined) clearInterval(this.hostProbeInterval)
    if (this.hostProbePort === undefined) return
    this.hostProbeInterval = setInterval(() => { void this.probeHost() }, this.config.healthPollSeconds * 1000)
    this.hostProbeInterval.unref?.()
  }

  private publicSettings(): PublicSettings {
    return {
      notificationLevel: this.config.notificationLevel,
      openOnCritical: this.config.openOnCritical,
      maxInterruptsPerHour: this.config.maxInterruptsPerHour,
      dedupeWindowMinutes: this.config.dedupeWindowMinutes,
      bundleWindowSeconds: this.config.bundleWindowSeconds,
      longRunThresholdMinutes: this.config.longRunThresholdMinutes,
      subagentPressure: this.config.subagentPressure,
      quietHours: { ...this.config.quietHours },
      privacySafeSummary: this.config.privacySafeSummary,
      healthPollSeconds: this.config.healthPollSeconds,
      maxInboxItems: this.config.maxInboxItems,
    }
  }

  private safeVerdict(verdict: AttentionVerdict): AttentionVerdict {
    if (!this.config.privacySafeSummary) return verdict
    const fallback = `${verdict.reasonCode} was observed from structured runtime evidence.`
    const safe = (value: string, limit: number): string => {
      const normalized = value.replace(/\s+/g, ' ').trim()
      if (!normalized || sensitiveSummaryPattern.test(normalized)) return fallback
      return normalized.slice(0, limit)
    }
    return {
      ...verdict,
      why: safe(verdict.why, 500),
      ...(verdict.suggestedAction ? { suggestedAction: safe(verdict.suggestedAction, 500) } : {}),
      evidence: verdict.evidence.map(item => ({ ...item, summary: safe(item.summary, 240) })),
    }
  }

  private isQuietHours(timestamp: number): boolean {
    if (!this.config.quietHours.enabled) return false
    const time = new Date(timestamp).toTimeString().slice(0, 5)
    const start = this.config.quietHours.start
    const end = this.config.quietHours.end
    if (start === end) return true
    return start < end ? time >= start && time < end : time >= start || time < end
  }

  private toPublic(item: InboxItem): PublicInboxItem {
    return {
      id: item.id,
      ...(item.sessionId ? { sessionId: item.sessionId } : {}),
      occurredAt: item.occurredAt,
      level: item.level,
      action: item.action,
      reasonCode: item.reasonCode,
      messageKey: item.messageKey,
      ...(item.messageParams === undefined ? {} : { messageParams: { ...item.messageParams } }),
      ...(item.suggestionKey === undefined ? {} : { suggestionKey: item.suggestionKey }),
      policyVersion: item.policyVersion,
      why: item.why,
      ...(item.suggestedAction ? { suggestedAction: item.suggestedAction } : {}),
      evidence: item.evidence.map(evidence => ({ type: evidence.type, authority: evidence.authority, summary: evidence.summary })),
      status: item.status,
      ...(item.snoozedUntil ? { snoozedUntil: item.snoozedUntil } : {}),
      ...(item.seenAt ? { seenAt: item.seenAt } : {}),
      ...(item.acknowledgedAt ? { acknowledgedAt: item.acknowledgedAt } : {}),
      ...(item.recoveredAt ? { recoveredAt: item.recoveredAt } : {}),
      ...(item.expiredAt ? { expiredAt: item.expiredAt } : {}),
      bundleCount: item.bundleCount,
      reasonCodes: [...item.reasonCodes],
    }
  }

  private isPending(item: InboxItem, now: number): boolean {
    if (item.status === 'open' || item.status === 'seen') return true
    if (item.status !== 'snoozed' || item.snoozedUntil === undefined) return false
    const until = Date.parse(item.snoozedUntil)
    return Number.isFinite(until) && until <= now
  }

  private normalizeLifecycle(now: number): void {
    let changed = false
    for (const item of this.items) {
      if (item.status !== 'snoozed' || item.snoozedUntil === undefined) continue
      const until = Date.parse(item.snoozedUntil)
      if (!Number.isFinite(until) || until > now) continue
      item.status = 'open'
      delete item.snoozedUntil
      changed = true
    }
    if (changed) {
      this.bumpRevision()
      this.queueSave()
    }
  }

  private find(id: string): InboxItem | undefined {
    return this.items.find(item => item.id === id)
  }

  private bumpRevision(): void {
    this.revision = this.revision >= Number.MAX_SAFE_INTEGER ? 1 : this.revision + 1
  }

  private queueSave(): void {
    this.saveChain = this.saveChain
      .then(() => this.store.save(this.items))
      .catch(error => this.logger.warn?.(`${PLUGIN_NAME}: metadata state could not be saved`, error))
  }
}

function asRecord(value: unknown): Record<string, any> {
  return value !== null && typeof value === 'object' ? value as Record<string, any> : {}
}

export { PLUGIN_NAME, PLUGIN_VERSION }
