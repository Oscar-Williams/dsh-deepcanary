import type { Context } from '@deepseek-ai/cordis'
import { DedupeLedger, InterruptBudget } from './core/dedupe.js'
import { judgeSignal } from './core/judge.js'
import { Config, normalizeConfig } from './config.js'
import type { DeepCanaryConfigInput } from './config.js'
import { getWorkspaceIdentity } from './adapters/windows.js'
import { MetadataStore } from './persistence.js'
import {
  signalFromAgentError,
  signalFromHostProbe,
  signalFromStall,
  signalFromSubagentPressure,
  signalsFromSessionEvent,
} from './providers.js'
import type {
  AttentionAction,
  AttentionLevel,
  CanarySignal,
  DeepCanaryConfig,
  InboxItem,
  PublicInboxItem,
  PublicSnapshot,
  RuntimeStatus,
} from './types.js'

const PLUGIN_NAME = 'dsh-deepcanary'
const PLUGIN_VERSION = '0.1.0-rc.1'

interface LiveSession {
  id: string
  cwd?: string
  startedAt: number
  lastEventAt: number
  active: boolean
  toolFailures: number
  activeSubagents: number
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

const levelValue: Record<AttentionLevel, number> = { C0: 0, C1: 1, C2: 2, C3: 3 }

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
  readonly ready: Promise<void>

  private readonly ctx: ContextLike
  private readonly sessions = new Map<string, LiveSession>()
  private readonly items: InboxItem[] = []
  private readonly dedupe: DedupeLedger
  private readonly budget: InterruptBudget
  private readonly pressureSeen = new Set<number>()
  private readonly logger: LoggerLike
  private activeSubagents = 0
  private registeredTools: string[] = []
  private interval: ReturnType<typeof setInterval> | undefined
  private saveChain = Promise.resolve()
  private hydrated = false
  private disposed = false

  constructor(ctx: Context, input?: DeepCanaryConfigInput) {
    this.ctx = ctx as unknown as ContextLike
    this.config = normalizeConfig(input)
    this.store = new MetadataStore(this.config.stateDir)
    this.dedupe = new DedupeLedger(this.config.dedupeWindowMinutes * 60 * 1000)
    this.budget = new InterruptBudget(this.config.maxInterruptsPerHour)
    this.logger = this.ctx.logger ?? {}
    this.ready = this.hydrate()
  }

  start(): void {
    const on = this.ctx.on
    if (typeof on === 'function') {
      on.call(this.ctx, 'session/created', (session: unknown) => this.onSessionCreated(session))
      on.call(this.ctx, 'session/event', (session: unknown, event: unknown) => this.onSessionEvent(session, event))
      on.call(this.ctx, 'session/disposed', (session: unknown) => this.onSessionDisposed(session))
      on.call(this.ctx, 'dispose', () => { void this.dispose() })
    }

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
      const settings = settingsCtx.settings as {
        register?: (namespace: string, schema: unknown, options: { base: DeepCanaryConfig; applies: 'live' }) => {
          get: () => unknown
          watch?: (callback: (next: unknown) => void) => unknown
        }
      } | undefined
      if (!settings?.register) return
      try {
        const scope = settings.register('dsh-deepcanary', Config, { base: this.config, applies: 'live' })
        this.applySettings(scope.get())
        scope.watch?.(next => this.applySettings(next))
      } catch (error: unknown) {
        this.logger.warn?.(`${PLUGIN_NAME}: live settings are unavailable; using composed config`, error)
      }
    })

    this.interval = setInterval(() => this.checkStalls(), this.config.healthPollSeconds * 1000)
    this.interval.unref?.()
    this.logger.info?.(`${PLUGIN_NAME} mounted; evidence-first local attention supervision enabled`)
  }

  setRegisteredTools(names: readonly string[]): void {
    this.registeredTools = [...names]
  }

  async ingest(signal: CanarySignal): Promise<InboxItem | undefined> {
    await this.ready
    if (this.disposed || signal.schemaVersion !== 1) return undefined
    const verdict = judgeSignal(signal)
    if (verdict.level === 'C0') return undefined
    const dedupeKey = signal.dedupeKey ?? `${signal.kind}:${signal.sessionId ?? 'host'}`
    const eventTime = Date.parse(signal.occurredAt)
    const now = Number.isFinite(eventTime) ? eventTime : Date.now()
    if (!this.dedupe.accept(dedupeKey, now)) return undefined

    let action = verdict.action
    if (this.isQuietHours(now) && (action === 'INTERRUPT' || action === 'ESCALATE')) action = 'DIGEST'
    if (levelValue[verdict.level] > levelValue[this.config.notificationLevel] && action !== 'INBOX') action = 'INBOX'
    if (action === 'INTERRUPT' && !this.budget.consume(now)) action = 'DIGEST'

    const item: InboxItem = {
      ...verdict,
      id: verdict.eventId,
      ...(signal.sessionId ? { sessionId: signal.sessionId } : {}),
      ...(signal.workspaceId ? { workspaceId: signal.workspaceId } : {}),
      occurredAt: signal.occurredAt,
      action,
      status: 'open',
    }
    this.items.unshift(item)
    if (this.items.length > this.config.maxInboxItems) this.items.length = this.config.maxInboxItems
    this.queueSave()
    return item
  }

  snapshot(): PublicSnapshot {
    const status = this.status()
    const now = Date.now()
    return {
      status,
      inbox: this.items
        .filter(item => item.status === 'open' || (item.status === 'snoozed' && item.snoozedUntil !== undefined && Date.parse(item.snoozedUntil) <= now))
        .map(item => this.toPublic(item)),
    }
  }

  status(): RuntimeStatus {
    const open = this.items.filter(item => item.status === 'open' || item.status === 'snoozed').map(item => item.level)
    const highest = open.reduce<AttentionLevel>((current, level) => levelValue[level] > levelValue[current] ? level : current, 'C0')
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
        destructiveActions: false,
      },
    }
  }

  inbox(limit = 20): PublicInboxItem[] {
    const safeLimit = Math.max(1, Math.min(100, Math.trunc(limit)))
    return this.items.slice(0, safeLimit).map(item => this.toPublic(item))
  }

  acknowledge(id: string): boolean {
    const item = this.find(id)
    if (!item) return false
    item.status = 'acknowledged'
    this.queueSave()
    return true
  }

  snooze(id: string, minutes = 30): boolean {
    const item = this.find(id)
    if (!item) return false
    const bounded = Math.max(1, Math.min(24 * 60, Math.trunc(minutes)))
    item.status = 'snoozed'
    item.snoozedUntil = new Date(Date.now() + bounded * 60 * 1000).toISOString()
    this.queueSave()
    return true
  }

  mute(id: string): boolean {
    const item = this.find(id)
    if (!item) return false
    item.status = 'muted'
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

  recordHostProbe(ok: boolean, detail = 'The local DSH host probe did not succeed.'): void {
    const signal = signalFromHostProbe(ok, detail)
    if (signal) void this.ingest(signal)
  }

  async dispose(): Promise<void> {
    if (this.disposed) return
    this.disposed = true
    if (this.interval !== undefined) clearInterval(this.interval)
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
    })
  }

  private onSessionDisposed(value: unknown): void {
    const id = idOf(value)
    if (!id) return
    const session = this.sessions.get(id)
    if (session) session.active = false
  }

  private onSessionEvent(sessionValue: unknown, eventValue: unknown): void {
    const sessionRecord = asRecord(sessionValue)
    const event = asRecord(eventValue)
    const id = idOf(sessionRecord)
    if (!id || typeof event.type !== 'string') return
    let session = this.sessions.get(id)
    if (!session) {
      this.onSessionCreated(sessionValue)
      session = this.sessions.get(id)
    }
    if (!session) return
    session.lastEventAt = Date.now()
    if (event.type === 'tool/result' && asRecord(event.data).error !== undefined) session.toolFailures += 1
    const facts = {
      toolFailures: session.toolFailures,
      activeSubagents: session.activeSubagents,
      lastEventAt: session.lastEventAt,
      startedAt: session.startedAt,
    }
    const signals = signalsFromSessionEvent(
      { id, ...(session.cwd ? { header: { cwd: session.cwd } } : {}) },
      { type: event.type, ...(typeof event.seq === 'number' ? { seq: event.seq } : {}), ...(typeof event.time === 'number' ? { time: event.time } : {}), data: asRecord(event.data) },
      facts,
    )
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
      if (signal) void this.ingest(signal)
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
    this.config = next
    this.dedupe.setWindowMs(next.dedupeWindowMinutes * 60 * 1000)
    this.budget.setMaxPerHour(next.maxInterruptsPerHour)
    if (this.items.length > next.maxInboxItems) this.items.length = next.maxInboxItems
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
      why: item.why,
      ...(item.suggestedAction ? { suggestedAction: item.suggestedAction } : {}),
      evidence: item.evidence.map(evidence => ({ type: evidence.type, authority: evidence.authority, summary: evidence.summary })),
      status: item.status,
      ...(item.snoozedUntil ? { snoozedUntil: item.snoozedUntil } : {}),
    }
  }

  private find(id: string): InboxItem | undefined {
    return this.items.find(item => item.id === id)
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
