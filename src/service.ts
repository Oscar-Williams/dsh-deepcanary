import type { Context } from '@deepseek-ai/cordis'
import { DedupeLedger, InterruptBudget } from './core/dedupe.js'
import { judgeSignal } from './core/judge.js'
import { applyDeliveryPolicy, mergeBundleTrace, withRecoveryTrace } from './core/policy.js'
import { Config, normalizeConfig, sanitizeConfigPatch } from './config.js'
import type { DeepCanaryConfigInput } from './config.js'
import { ContextDshAdapter } from './adapters/dsh.js'
import type { Disposable } from './adapters/dsh.js'
import { getWorkspaceIdentity } from './adapters/windows.js'
import { hashMetadata, MetadataStore, SuppressionStore } from './persistence.js'
import { buildOutcomeReceipt, MAX_OUTCOME_RECEIPTS, normalizeOutcomeDeleteFilter, normalizeOutcomeInput, OutcomeStore } from './outcome.js'
import { DogfoodRuntimeRecorder, dogfoodRunFromEnvironment } from './dogfoodRecorder.js'
import type { DogfoodDecisionDisposition, DogfoodDeliveryChannel, DogfoodNotificationDelivery, DogfoodNotificationStage } from './dogfood.js'
import { PersistentSupervisor, supervisorSnapshotFor } from './supervisor.js'
import type { SupervisorHostStatus } from './supervisor.js'
import { HostProbeEpoch } from './hostHealth.js'
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
  DryRunRequest,
  DryRunResult,
  DryRunSignalInput,
  EvidenceAuthority,
  FeedbackValue,
  InboxItem,
  PolicyDecisionTrace,
  PublicInboxItem,
  PublicSettings,
  PublicSnapshot,
  ReasonCode,
  OutcomeReceipt,
  OutcomeDeleteFilter,
  OutcomeReceiptInput,
  RuntimeStatus,
  SuppressibleReasonCode,
} from './types.js'
import { ATTENTION_POLICY_VERSION, ATTENTION_PROTOCOL_VERSION as PROTOCOL_VERSION, SUPPRESSIBLE_REASON_CODES } from './types.js'

const PLUGIN_NAME = 'dsh-deepcanary'
const PLUGIN_VERSION = '0.1.0-rc.4'
const SETTINGS_NAMESPACE = 'dsh-deepcanary'
const DEFAULT_MUTE_MINUTES = 60

interface LiveSession {
  id: string
  cwd?: string
  startedAt: number
  lastEventAt: number
  active: boolean
  running: boolean
  toolFailures: number
  activeSubagents: number
  stalled: boolean
  waitingForHuman: boolean
  contextCompactions: number
  lastToolName?: string
  sameToolFailures: number
  lastHealthyObservationAt?: number
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
const opaqueRefPattern = /^[a-f0-9]{16}$/
const notificationTitlePattern = /^notification\.title\.([A-Z0-9_]+)$/

function outcomeStorageKey(receipt: Pick<OutcomeReceipt, 'attentionRef' | 'source' | 'trialId'>): string {
  return `${receipt.source}:${receipt.trialId}:${receipt.attentionRef}`
}

function idOf(value: unknown): string | undefined {
  if (typeof value === 'string' && value.length > 0) return value
  if (typeof value === 'number' && Number.isSafeInteger(value)) return String(value)
  if (value !== null && typeof value === 'object' && 'id' in value) return idOf((value as { id?: unknown }).id)
  return undefined
}

function nowIso(): string {
  return new Date().toISOString()
}

function safeFeedbackNote(note: string | undefined): string | undefined {
  if (!note) return undefined
  const normalized = note.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 200)
  if (!normalized || sensitiveSummaryPattern.test(normalized)) return undefined
  return normalized
}

function cloneOutcome(receipt: OutcomeReceipt): OutcomeReceipt {
  return { ...receipt, reviewFlags: [...receipt.reviewFlags] }
}

function dispositionForAction(action: AttentionAction): DogfoodDecisionDisposition {
  switch (action) {
    case 'IGNORE': return 'c0-silent'
    case 'INBOX': return 'inbox'
    case 'DIGEST': return 'digest'
    case 'INTERRUPT': return 'interrupt'
    case 'ESCALATE': return 'escalate'
  }
}

function deliveryChannelForAction(action: AttentionAction): DogfoodDeliveryChannel {
  return action === 'INTERRUPT' || action === 'ESCALATE'
    ? 'browser-notification'
    : action === 'INBOX' || action === 'DIGEST'
      ? 'inbox'
      : 'none'
}

export class DeepCanaryService {
  config: DeepCanaryConfig
  readonly store: MetadataStore
  readonly suppressionStore: SuppressionStore
  readonly outcomeStore: OutcomeStore
  readonly workspace = getWorkspaceIdentity()
  readonly adapter: ContextDshAdapter
  readonly ready: Promise<void>

  private readonly ctx: ContextLike
  private readonly sessions = new Map<string, LiveSession>()
  private readonly items: InboxItem[] = []
  private readonly suppressedReasons = new Set<SuppressibleReasonCode>()
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
  private hostProbeInFlight = false
  private readonly hostProbe = new HostProbeEpoch(2, 'dsh-webserver')
  private supervisorHostStatus: SupervisorHostStatus = 'degraded'
  private settingsScope: SettingsScopeLike | undefined
  private settingsProvider: SettingsProviderLike | undefined
  private settingsSource: (() => DeepCanaryConfig) | undefined
  private settingsSubscription: (() => void) | undefined
  private saveChain = Promise.resolve()
  private hydrated = false
  private disposed = false
  private started = false
  private revision = 0
  private policyRestored = false
  private readonly actionReceipts = new Map<string, ActionReceipt>()
  private readonly outcomeReceipts = new Map<string, OutcomeReceipt>()
  private readonly dogfoodRecorder: DogfoodRuntimeRecorder | undefined
  private outcomeSaveChain = Promise.resolve()
  private suppressionSaveChain = Promise.resolve()
  private supervisorStart = Promise.resolve()
  readonly supervisor: PersistentSupervisor

  constructor(ctx: Context, input?: DeepCanaryConfigInput) {
    this.ctx = ctx as unknown as ContextLike
    this.adapter = new ContextDshAdapter(ctx)
    this.config = normalizeConfig(input)
    this.store = new MetadataStore(this.config.stateDir)
    this.suppressionStore = new SuppressionStore(this.config.stateDir)
    this.outcomeStore = new OutcomeStore(this.config.stateDir)
    this.supervisor = new PersistentSupervisor({ stateDir: this.config.stateDir, runtimeVersion: this.adapter.hostVersion, maxPending: this.config.maxInboxItems })
    const dogfoodRun = dogfoodRunFromEnvironment(PLUGIN_VERSION, this.adapter.hostVersion)
    this.dogfoodRecorder = dogfoodRun === undefined ? undefined : new DogfoodRuntimeRecorder(this.config.stateDir, dogfoodRun)
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
    this.supervisorStart = this.startSupervisor()
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
    let verdict = this.safeVerdict(judgeSignal(signal))
    if (verdict.level === 'C0') {
      this.recordDogfood(signal, verdict, 'c0-silent', 'none')
      return undefined
    }
    // Persistent type suppression applies only to low-risk informational classes.
    // Human-needed, host, and failure signals can never be hidden by this preference.
    if (verdict.level === 'C1' && this.suppressedReasons.has(verdict.reasonCode as SuppressibleReasonCode)) {
      this.recordDogfood(signal, verdict, 'suppressed', 'none')
      return undefined
    }
    const dedupeKey = signal.dedupeKey ?? `${signal.kind}:${signal.sessionId ?? 'host'}`
    // Recovery closes an already observed root cause. It must remain visible
    // even when the recovery signal intentionally shares the root cause key;
    // applying the normal dedupe window here would erase the recovery edge.
    if (signal.kind !== 'HOST_STALL_RECOVERED' && !this.dedupe.accept(dedupeKey, now)) {
      this.recordDogfood(signal, verdict, 'deduped', 'none')
      return undefined
    }

    if (signal.kind === 'HOST_STALL_RECOVERED') {
      const recovered = this.recover(signal, verdict, now)
      if (recovered === undefined) {
        this.recordDogfood(signal, verdict, 'dropped-event', 'none')
        return undefined
      }
      this.recordDogfood(signal, verdict, 'recovery-closed', 'none', {
        recoveredBeforeOpen: recovered.seenAt === undefined && recovered.acknowledgedAt === undefined,
        ...(signal.bundleKey === undefined ? {} : { bundleKey: signal.bundleKey }),
      })
      this.queueSave()
      this.syncSupervisor()
      return recovered
    }

    const bundleKey = signal.bundleKey ? hashMetadata(signal.bundleKey) : undefined
    const existing = bundleKey ? this.findBundle(bundleKey, now) : undefined
    if (existing) {
      // A bundle represents one user-facing attention item. Repeated signals
      // at the same or lower level enrich that item without spending another
      // interrupt. Policy is re-applied only when the bundle genuinely rises
      // to a higher attention level.
      const escalates = levelValue[verdict.level] > levelValue[existing.level]
      const bundledVerdict = escalates
        ? this.applyPolicy(verdict, now, existing.action === 'INTERRUPT')
        : verdict
      this.mergeBundle(existing, bundledVerdict, signal)
      this.recordDogfood(signal, bundledVerdict, 'bundle-merged', 'none', {
        ...(signal.bundleKey === undefined ? {} : { bundleKey: signal.bundleKey }),
      })
      this.bumpRevision()
      this.queueSave()
      this.syncSupervisor()
      return existing
    }

    verdict = this.applyPolicy(verdict, now)

    const item: InboxItem = {
      ...verdict,
      id: verdict.eventId,
      ...(signal.sessionId ? { sessionId: signal.sessionId } : {}),
      ...(signal.workspaceId ? { workspaceId: signal.workspaceId } : {}),
      ...(signal.sessionId ? { sessionRef: hashMetadata(signal.sessionId) } : {}),
      ...(signal.workspaceId ? { workspaceRef: hashMetadata(signal.workspaceId) } : {}),
      occurredAt: signal.occurredAt,
      action: verdict.action,
      status: 'open',
      ...(bundleKey ? { bundleKey } : {}),
      bundleCount: 1,
      reasonCodes: [signal.kind],
    }
    this.items.unshift(item)
    if (this.items.length > this.config.maxInboxItems) this.items.length = this.config.maxInboxItems
    this.bumpRevision()
    const disposition = dispositionForAction(item.action)
    this.recordDogfood(signal, verdict, disposition, deliveryChannelForAction(item.action), {
      ...(disposition === 'inbox' || disposition === 'digest' || disposition === 'interrupt' || disposition === 'escalate' ? { deliveryUnit: item.id } : {}),
      ...(signal.bundleKey === undefined ? {} : { bundleKey: signal.bundleKey }),
    })
    this.queueSave()
    this.syncSupervisor()
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
      delivery: {
        interruptBudget: {
          limit: this.budget.limit(),
          used: this.budget.used(now),
          remaining: this.budget.remaining(now),
        },
        quietHours: {
          ...this.config.quietHours,
          active: this.isQuietHours(now),
        },
        dedupeWindowMinutes: this.config.dedupeWindowMinutes,
        bundleWindowSeconds: this.config.bundleWindowSeconds,
        hostProbe: {
          ...(this.hostProbePort === undefined ? {} : { port: this.hostProbePort }),
          ...this.hostProbeStatus(),
        },
      },
      supervisor: this.supervisor.status(),
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

  /** Record one redacted decision outcome for a local, controlled, or replay trial. */
  async recordOutcome(id: string, input: unknown): Promise<OutcomeReceipt | undefined> {
    await this.ready
    if (typeof id !== 'string' || id.length === 0 || id.length > 256 || /[\u0000-\u001f\u007f]/.test(id)) {
      throw new TypeError('outcome.id must be a printable string of 1-256 characters')
    }
    const normalized = normalizeOutcomeInput(input)
    const item = this.find(id)
    if (item === undefined) return undefined
    const attentionRef = hashMetadata(item.id)
    const previous = this.outcomeReceipts.get(outcomeStorageKey({ attentionRef, source: normalized.source, trialId: normalized.trialId }))
    const receipt = buildOutcomeReceipt(item, normalized, previous)
    this.outcomeReceipts.set(outcomeStorageKey(receipt), receipt)
    this.syncDogfoodReceipts()
    this.bumpRevision()
    this.queueOutcomeSave()
    return cloneOutcome(receipt)
  }

  outcomes(limit = 100, source?: OutcomeReceiptInput['source'], trialId?: string): OutcomeReceipt[] {
    const safeLimit = Number.isFinite(limit) ? Math.max(1, Math.min(MAX_OUTCOME_RECEIPTS, Math.trunc(limit))) : 100
    return [...this.outcomeReceipts.values()]
      .filter(receipt => source === undefined || receipt.source === source)
      .filter(receipt => trialId === undefined || receipt.trialId === trialId)
      .sort((left, right) => right.recordedAt.localeCompare(left.recordedAt))
      .slice(0, safeLimit)
      .map(cloneOutcome)
  }

  /** Permanently remove only records selected by an explicit trial or retention cutoff. */
  async deleteOutcomes(filter: OutcomeDeleteFilter): Promise<number> {
    await this.ready
    const normalized = normalizeOutcomeDeleteFilter(filter)
    const before = normalized.before === undefined ? undefined : Date.parse(normalized.before)
    let removed = 0
    for (const [storageKey, receipt] of this.outcomeReceipts) {
      const matches = (normalized.source === undefined || receipt.source === normalized.source)
        && (normalized.trialId === undefined || receipt.trialId === normalized.trialId)
        && (before === undefined || Date.parse(receipt.recordedAt) < before)
      if (!matches) continue
      this.outcomeReceipts.delete(storageKey)
      removed += 1
    }
    if (removed > 0) {
      this.bumpRevision()
      await this.queueOutcomeSave()
    }
    return removed
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
    this.syncSupervisor()
    this.updateExistingOutcome(item, { opened: true })
    return true
  }

  acknowledge(id: string): boolean {
    const item = this.find(id)
    if (!item || item.status === 'acknowledged' || item.status === 'muted' || item.status === 'recovered' || item.status === 'expired') return false
    item.status = 'acknowledged'
    item.acknowledgedAt = nowIso()
    delete item.snoozedUntil
    delete item.mutedUntil
    this.bumpRevision()
    this.queueSave()
    this.syncSupervisor()
    this.updateExistingOutcome(item, { opened: true, acknowledged: true })
    return true
  }

  snooze(id: string, minutes = 30): boolean {
    const item = this.find(id)
    if (!item || item.status === 'acknowledged' || item.status === 'muted' || item.status === 'recovered' || item.status === 'expired') return false
    const bounded = Number.isFinite(minutes) ? Math.max(1, Math.min(24 * 60, Math.trunc(minutes))) : 30
    item.status = 'snoozed'
    item.snoozedUntil = new Date(Date.now() + bounded * 60 * 1000).toISOString()
    delete item.mutedUntil
    this.bumpRevision()
    this.queueSave()
    this.syncSupervisor()
    this.updateExistingOutcome(item, { opened: true, snoozed: true })
    return true
  }

  mute(id: string): boolean {
    const item = this.find(id)
    if (!item || item.status === 'muted' || item.status === 'recovered' || item.status === 'expired') return false
    const now = Date.now()
    const currentMute = item.mutedUntil === undefined ? Number.NaN : Date.parse(item.mutedUntil)
    if (Number.isFinite(currentMute) && currentMute > now) return false
    if (item.status === 'snoozed') item.status = 'open'
    delete item.snoozedUntil
    item.mutedUntil = new Date(now + DEFAULT_MUTE_MINUTES * 60 * 1000).toISOString()
    this.bumpRevision()
    this.queueSave()
    this.syncSupervisor()
    this.updateExistingOutcome(item, { opened: true, muted: true })
    return true
  }

  /** End a temporary mute immediately while retaining the Inbox item. */
  unmute(id: string): boolean {
    const item = this.find(id)
    if (!item || item.status === 'recovered' || item.status === 'expired') return false
    const until = item.mutedUntil === undefined ? Number.NaN : Date.parse(item.mutedUntil)
    if (item.status !== 'muted' && (!Number.isFinite(until) || until <= Date.now())) return false
    if (item.status === 'muted') item.status = 'open'
    delete item.mutedUntil
    this.bumpRevision()
    this.queueSave()
    this.syncSupervisor()
    this.updateExistingOutcome(item, { opened: true, muted: false })
    return true
  }

  /** Persistently silence the current low-risk event class for future signals. */
  suppress(id: string): { updated: boolean; reasonCode?: SuppressibleReasonCode } {
    const item = this.find(id)
    if (!item || item.level !== 'C1' || !isSuppressibleReasonCode(item.reasonCode)) return { updated: false }
    this.suppressedReasons.add(item.reasonCode)
    // The current item is handled immediately; future C1 items of this class
    // are filtered at ingestion. Higher-level events remain eligible.
    item.status = 'acknowledged'
    item.acknowledgedAt = nowIso()
    delete item.snoozedUntil
    delete item.mutedUntil
    this.bumpRevision()
    this.queueSave()
    this.syncSupervisor()
    this.queueSuppressionSave()
    this.updateExistingOutcome(item, { opened: true, muted: true })
    return { updated: true, reasonCode: item.reasonCode }
  }

  /** Restore notifications for a previously silenced low-risk event class. */
  unsuppress(reasonCode: string): boolean {
    if (!isSuppressibleReasonCode(reasonCode) || !this.suppressedReasons.delete(reasonCode)) return false
    this.bumpRevision()
    this.queueSuppressionSave()
    this.syncSupervisor()
    return true
  }

  feedback(id: string, useful: boolean, note?: string, value?: FeedbackValue): boolean {
    const item = this.find(id)
    if (!item) return false
    const safeNote = safeFeedbackNote(note)
    item.feedback = {
      useful: Boolean(useful),
      value: value ?? (useful ? 'useful' : 'not-relevant'),
      ...(safeNote === undefined ? {} : { note: safeNote }),
      at: nowIso(),
    }
    this.bumpRevision()
    this.queueSave()
    this.syncSupervisor()
    this.dogfoodRecorder?.recordUserFeedback(item.id, useful, value)
    this.updateExistingOutcome(item, { opened: true, feedback: useful ? 'useful' : 'not-useful' })
    return true
  }

  explain(id: string): PublicInboxItem | undefined {
    const item = this.find(id)
    return item ? this.toPublic(item) : undefined
  }

  /** Preview current and candidate policy outcomes without touching state or DSH. */
  async dryRun(input: DryRunRequest): Promise<DryRunResult> {
    await this.ready
    const request = normalizeDryRunRequest(input)
    const now = Date.now()
    const signal = dryRunSignal(request.signal, now)
    const baseVerdict = this.safeVerdict(judgeSignal(signal))
    const budgetAvailable = this.budget.canInterrupt(now)
    const current = applyDeliveryPolicy(baseVerdict, this.config, now, { budgetAvailable })
    const candidateConfig = normalizeConfig({
      ...this.config,
      ...(request.candidate?.notificationLevel === undefined ? {} : { notificationLevel: request.candidate.notificationLevel }),
      quietHours: { ...this.config.quietHours, ...(request.candidate?.quietHours ?? {}) },
    })
    const candidate = applyDeliveryPolicy(baseVerdict, candidateConfig, now, { budgetAvailable, candidate: true })
    const differences = (['level', 'action', 'reasonCode'] as const)
      .filter(field => current[field] !== candidate[field])
      .map(field => ({ field, current: current[field], candidate: candidate[field] }))
    return {
      schemaVersion: 1,
      mode: 'dry-run',
      readOnly: true,
      generatedAt: new Date(now).toISOString(),
      input: request.signal,
      current,
      candidate,
      differences,
      changed: differences.length > 0,
    }
  }

  jump(id: string): { sessionId?: string; url?: string; available: boolean; note: string } {
    const item = this.find(id)
    if (!item?.sessionId) return { available: false, note: 'This item has no associated live session.' }
    return {
      sessionId: item.sessionId,
      url: `/?session=${encodeURIComponent(item.sessionId)}`,
      available: true,
      note: 'The URL is a local DSH navigation hint; the host decides whether the live or historical session route is available.',
    }
  }

  /** Apply one browser action exactly once for its request id. */
  async performAction(requestId: string, id: string, action: string, payload: Record<string, unknown> = {}): Promise<ActionReceipt> {
    await this.ready
    if (typeof requestId !== 'string' || requestId.length === 0 || requestId.length > 128 || /[\u0000-\u001f]/.test(requestId)) {
      return { status: 400, body: { error: 'requestId must be a printable string of 1-128 characters' }, fingerprint: '' }
    }
    const knownActions = new Set(['seen', 'acknowledge', 'snooze', 'mute', 'unmute', 'suppress', 'unsuppress', 'feedback', 'jump', 'retry', 'notification-delivery'])
    if (!knownActions.has(action)) {
      return { status: 400, body: { error: 'unsupported action', schemaVersion: PROTOCOL_VERSION }, fingerprint: '' }
    }
    if (action !== 'retry' && action !== 'unsuppress' && (typeof id !== 'string' || id.length === 0 || id.length > 256)) {
      return { status: 400, body: { error: 'id is required', schemaVersion: PROTOCOL_VERSION }, fingerprint: '' }
    }
    if (action === 'unsuppress' && typeof payload.reasonCode !== 'string' && (typeof id !== 'string' || id.length === 0)) {
      return { status: 400, body: { error: 'reasonCode is required', schemaVersion: PROTOCOL_VERSION }, fingerprint: '' }
    }
    if (action === 'feedback' && typeof payload.useful !== 'boolean') {
      return { status: 400, body: { error: 'feedback.useful must be boolean', schemaVersion: PROTOCOL_VERSION }, fingerprint: '' }
    }
    if (action === 'feedback' && payload.value !== undefined && !isFeedbackValue(payload.value)) {
      return { status: 400, body: { error: 'feedback.value is unsupported', schemaVersion: PROTOCOL_VERSION }, fingerprint: '' }
    }
    if (action === 'snooze' && payload.minutes !== undefined && (typeof payload.minutes !== 'number' || !Number.isFinite(payload.minutes))) {
      return { status: 400, body: { error: 'snooze.minutes must be a finite number', schemaVersion: PROTOCOL_VERSION }, fingerprint: '' }
    }
    if (action === 'notification-delivery' && !this.isNotificationDeliveryPayload(payload)) {
      return { status: 400, body: { error: 'notification delivery payload is invalid', schemaVersion: PROTOCOL_VERSION }, fingerprint: '' }
    }

    const fingerprint = JSON.stringify({
      id,
      action,
      minutes: payload.minutes,
      useful: payload.useful,
      value: payload.value,
      note: payload.note,
      reasonCode: payload.reasonCode,
      notificationStage: payload.notificationStage,
      notificationAttemptId: payload.notificationAttemptId,
      notificationRef: payload.notificationRef,
      tagRef: payload.tagRef,
      titleKey: payload.titleKey,
      bodyFingerprint: payload.bodyFingerprint,
      observedAt: payload.observedAt,
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
    let result: Record<string, unknown> | undefined
    if (action === 'retry') {
      await this.probeHost()
      const updated = this.hostProbePort !== undefined
      result = { kind: updated ? 'host-probe-complete' : 'host-probe-unavailable' }
      body = { schemaVersion: PROTOCOL_VERSION, requestId, revision: this.revision, updated, result }
    } else if (action === 'notification-delivery') {
      const updated = this.recordNotificationDelivery(id, payload)
      result = { kind: updated ? 'notification-delivery-recorded' : 'notification-delivery-unavailable' }
      body = { schemaVersion: PROTOCOL_VERSION, requestId, revision: this.revision, updated: true, result }
    } else if (action === 'unsuppress') {
      const reasonCode = typeof payload.reasonCode === 'string' ? payload.reasonCode : id
      const updated = this.unsuppress(reasonCode)
      result = { kind: updated ? 'suppression-restored' : 'suppression-not-found', ...(isSuppressibleReasonCode(reasonCode) ? { reasonCode } : {}) }
      body = { schemaVersion: PROTOCOL_VERSION, requestId, revision: this.revision, updated, result }
    } else if (this.find(id) === undefined) {
      status = 404
      body = { error: 'inbox item not found', schemaVersion: PROTOCOL_VERSION, requestId, revision: this.revision, updated: false }
    } else if (action === 'jump') {
      body = { schemaVersion: PROTOCOL_VERSION, requestId, revision: this.revision, result: this.jump(id) }
    } else {
      let updated: boolean
      let updatedItem: PublicInboxItem | undefined
      if (action === 'seen') updated = this.seen(id)
      else if (action === 'acknowledge') updated = this.acknowledge(id)
      else if (action === 'snooze') updated = this.snooze(id, typeof payload.minutes === 'number' ? payload.minutes : 30)
      else if (action === 'mute') updated = this.mute(id)
      else if (action === 'unmute') updated = this.unmute(id)
      else if (action === 'suppress') {
        const suppression = this.suppress(id)
        updated = suppression.updated
        result = { kind: updated ? 'suppressed' : 'suppression-rejected', ...(suppression.reasonCode === undefined ? {} : { reasonCode: suppression.reasonCode }) }
      } else {
        updated = this.feedback(
          id,
          payload.useful === true,
          typeof payload.note === 'string' ? payload.note : undefined,
          isFeedbackValue(payload.value) ? payload.value : undefined,
        )
        result = {
          kind: updated ? 'feedback-recorded' : 'feedback-rejected',
          useful: payload.useful === true,
          value: isFeedbackValue(payload.value) ? payload.value : payload.useful === true ? 'useful' : 'not-relevant',
        }
      }
      if (result === undefined) {
        result = { kind: updated ? `${action}-complete` : `${action}-not-applied` }
      }
      if (updated) updatedItem = this.find(id) ? this.toPublic(this.find(id) as InboxItem) : undefined
      body = {
        schemaVersion: PROTOCOL_VERSION,
        requestId,
        revision: this.revision,
        updated,
        result,
        ...(updatedItem === undefined ? {} : { item: updatedItem }),
      }
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

  /** Accept only redacted browser-sink facts for a known attention item. */
  private recordNotificationDelivery(id: string, payload: Record<string, unknown>): boolean {
    const item = this.find(id)
    if (item === undefined || this.dogfoodRecorder === undefined) return false
    const stage = payload.notificationStage as DogfoodNotificationStage
    const notificationAttemptId = payload.notificationAttemptId as string
    const notificationRef = payload.notificationRef as string
    const tagRef = payload.tagRef as string
    const titleKey = payload.titleKey as string
    if (notificationRef !== hashMetadata(`${item.id}:notification`)
      || tagRef !== hashMetadata(`${item.id}:tag`)
      || titleKey !== `notification.title.${item.reasonCode}`) return false
    const delivery: DogfoodNotificationDelivery = {
      notificationAttemptId,
      notificationRef,
      tagRef,
      titleKey,
      bodyFingerprint: payload.bodyFingerprint as string,
      stages: [stage],
      firstObservedAt: payload.observedAt as string,
      ...(stage === 'clicked' ? { clickedAt: payload.observedAt as string } : {}),
    }
    this.dogfoodRecorder.recordNotificationDelivery(item.id, delivery)
    return true
  }

  private isNotificationDeliveryPayload(payload: Record<string, unknown>): boolean {
    const stage = payload.notificationStage
    const notificationAttemptId = payload.notificationAttemptId
    const notificationRef = payload.notificationRef
    const tagRef = payload.tagRef
    const titleKey = payload.titleKey
    const bodyFingerprint = payload.bodyFingerprint
    const observedAt = payload.observedAt
    if (stage !== 'attempted' && stage !== 'constructed' && stage !== 'click-handler-attached' && stage !== 'clicked' && stage !== 'error') return false
    if (typeof notificationAttemptId !== 'string' || !opaqueRefPattern.test(notificationAttemptId)) return false
    if (typeof notificationRef !== 'string' || !opaqueRefPattern.test(notificationRef)) return false
    if (typeof tagRef !== 'string' || !opaqueRefPattern.test(tagRef)) return false
    if (typeof titleKey !== 'string' || !notificationTitlePattern.test(titleKey)) return false
    if (typeof bodyFingerprint !== 'string' || !opaqueRefPattern.test(bodyFingerprint)) return false
    if (typeof observedAt !== 'string' || !Number.isFinite(Date.parse(observedAt))) return false
    return true
  }

  async recordHostProbe(ok: boolean, detail = 'The local DSH host probe did not succeed.'): Promise<void> {
    const observation = this.hostProbe.observe(ok)
    if (observation.transition === 'outage-opened') {
      const signal = signalFromHostProbe(false, detail, Date.parse(observation.lastCheckedAt), observation.outageId)
      if (signal) await this.ingest(signal)
    } else if (observation.transition === 'recovered') {
      await this.ingest(signalFromHostRecovery(observation.outageId, Date.parse(observation.lastCheckedAt)))
    }
  }

  private async startSupervisor(): Promise<void> {
    await this.ready
    if (this.disposed) return
    const started = await this.supervisor.start()
    if (!started) this.logger.warn?.(`${PLUGIN_NAME}: persistent supervisor is waiting for its lease; standby retry is scheduled`)
    await this.refreshSupervisorHealth()
    this.restoreSupervisorPolicy()
    this.revision = Math.max(this.revision, this.supervisor.snapshot().revision)
    this.syncSupervisor()
  }

  private syncSupervisor(): void {
    const now = Date.now()
    const restoredRevision = this.supervisor.snapshot().revision
    if (restoredRevision > this.revision) this.revision = restoredRevision
    const pending = this.items.filter(item => this.isPending(item, now))
    const sessions = [...this.sessions.values()]
      .filter(session => session.active)
      .map(session => {
        const sessionItems = pending.filter(item => item.sessionId === session.id)
        const attentionLevel = sessionItems.reduce<AttentionLevel>(
          (current, item) => levelValue[item.level] > levelValue[current] ? item.level : current,
          'C0',
        )
        return {
          sessionRef: hashMetadata(session.id),
          attentionLevel,
          pendingCount: sessionItems.length,
          lastEvidenceAt: new Date(session.lastEventAt).toISOString(),
        }
      })
    this.supervisor.update(supervisorSnapshotFor(
      this.adapter.hostVersion,
      this.supervisorHostStatus,
      this.revision,
      sessions,
      pending.map(item => hashMetadata(item.id)),
      now,
      this.config.maxInboxItems,
      this.supervisorPolicyState(now),
    ))
  }

  private restoreSupervisorPolicy(): void {
    if (this.policyRestored) return
    const policyState = this.supervisor.snapshot().policyState
    if (policyState?.policyVersion === ATTENTION_POLICY_VERSION) {
      this.dedupe.restore(policyState.dedupe)
      this.budget.restore(policyState.interruptConsumedAt)
    }
    this.policyRestored = true
  }

  private supervisorPolicyState(now = Date.now()) {
    return {
      schemaVersion: 1 as const,
      policyVersion: ATTENTION_POLICY_VERSION,
      dedupe: this.dedupe.snapshot(now),
      interruptConsumedAt: this.budget.snapshot(now),
    }
  }

  private async probeHost(): Promise<void> {
    const port = this.hostProbePort
    if (port === undefined || this.disposed || this.hostProbeInFlight) return
    this.hostProbeInFlight = true
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 2_500)
    try {
      // The DSH root page may require an authenticated browser session and
      // legitimately return 401 to a local server-side fetch. Probe the
      // plugin's public health route instead so host liveness is independent
      // of WebUI authentication and conversation content.
      const response = await fetch(`http://127.0.0.1:${port}/dsh-deepcanary/health`, { signal: controller.signal })
      if (!response.ok) throw new Error(`host probe returned HTTP ${response.status}`)
      const observation = this.hostProbe.observe(true)
      if (observation.transition === 'recovered') {
        await this.ingest(signalFromHostRecovery(observation.outageId, Date.parse(observation.lastCheckedAt)))
      }
    } catch {
      const observation = this.hostProbe.observe(false)
      if (observation.transition === 'outage-opened') {
        const signal = signalFromHostProbe(false, `The local DSH WebServer did not answer on port ${port}.`, Date.parse(observation.lastCheckedAt), observation.outageId)
        if (signal) await this.ingest(signal)
      }
    } finally {
      clearTimeout(timeout)
      this.hostProbeInFlight = false
      await this.refreshSupervisorHealth()
      this.syncSupervisor()
    }
  }

  private hostProbeStatus(): Omit<ReturnType<HostProbeEpoch['status']>, 'transition'> {
    const { transition: _transition, ...status } = this.hostProbe.status()
    return status
  }

  private async refreshSupervisorHealth(): Promise<void> {
    try {
      const health = await this.adapter.getRuntimeHealth()
      this.supervisorHostStatus = health.authoritative
        ? health.status === 'healthy' ? 'ready' : health.status === 'unreachable' ? 'unreachable' : 'degraded'
        : 'degraded'
    } catch {
      this.supervisorHostStatus = 'unreachable'
    }
  }

  async dispose(): Promise<void> {
    if (this.disposed) return
    this.disposed = true
    this.adapterSubscription?.dispose()
    this.settingsSubscription?.()
    if (this.interval !== undefined) clearInterval(this.interval)
    if (this.hostProbeInterval !== undefined) clearInterval(this.hostProbeInterval)
    await this.supervisorStart.catch(() => undefined)
    await this.supervisor.stop()
    await this.ready.catch(() => undefined)
    await this.saveChain
    await this.outcomeSaveChain
    await this.suppressionSaveChain
    this.dogfoodRecorder?.finish()
    await this.dogfoodRecorder?.flush()
  }

  private async hydrate(): Promise<void> {
    try {
      await this.dogfoodRecorder?.load()
    } catch (error: unknown) {
      this.logger.warn?.(`${PLUGIN_NAME}: dogfood observation state could not be loaded; starting with an empty trial ledger`, error)
    }
    try {
      const restored = await this.store.load()
      this.items.splice(0, this.items.length, ...restored.slice(0, this.config.maxInboxItems))
    } catch (error: unknown) {
      this.logger.warn?.(`${PLUGIN_NAME}: metadata state could not be loaded; starting with an empty inbox`, error)
    }
    try {
      const restoredOutcomes = await this.outcomeStore.load()
      this.outcomeReceipts.clear()
      for (const receipt of restoredOutcomes.slice(-MAX_OUTCOME_RECEIPTS)) this.outcomeReceipts.set(outcomeStorageKey(receipt), receipt)
    } catch (error: unknown) {
      this.logger.warn?.(`${PLUGIN_NAME}: outcome records could not be loaded; starting with an empty outcome set`, error)
    }
    try {
      const restoredSuppressions = await this.suppressionStore.load()
      this.suppressedReasons.clear()
      for (const reasonCode of restoredSuppressions) this.suppressedReasons.add(reasonCode)
    } catch (error: unknown) {
      this.logger.warn?.(`${PLUGIN_NAME}: notification suppression preferences could not be loaded; starting with no suppressed types`, error)
    }
    this.hydrated = true
    this.syncSupervisor()
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
      running: false,
      toolFailures: 0,
      activeSubagents: 0,
      stalled: false,
      waitingForHuman: false,
      contextCompactions: 0,
      sameToolFailures: 0,
    })
    const sessionRef = hashMetadata(id)
    let linkedHistoricalItem = false
    for (const item of this.items) {
      if (item.sessionId === undefined && item.sessionRef === sessionRef) {
        item.sessionId = id
        linkedHistoricalItem = true
      }
    }
    if (linkedHistoricalItem) this.queueSave()
    this.bumpRevision()
    this.syncSupervisor()
  }

  private onSessionDisposed(value: unknown): void {
    const id = idOf(value)
    if (!id) return
    const session = this.sessions.get(id)
    if (session) {
      session.active = false
      session.running = false
      this.expireSessionItems(id)
      this.bumpRevision()
      this.syncSupervisor()
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
    if (event.type === 'turn/start') {
      session.running = true
      session.waitingForHuman = false
      session.startedAt = now
      delete session.lastHealthyObservationAt
      session.stalled = false
      session.toolFailures = 0
      session.sameToolFailures = 0
      session.contextCompactions = 0
    }
    const wasStalled = session.stalled
    if (wasStalled) {
      session.stalled = false
      delete session.lastHealthyObservationAt
    }
    session.lastEventAt = now
    const eventData = asRecord(event.data)
    const observedToolName = typeof eventData.name === 'string'
      ? eventData.name
      : typeof eventData.toolName === 'string'
        ? eventData.toolName
        : session.lastToolName
    const humanWaitResolved = event.type === 'approval/decided'
      || event.type === 'user-questions/response'
      || event.type === 'user-questions/answered'
      || (event.type === 'tool/result' && typeof observedToolName === 'string' && /^ask[_-]user[_-]question$/i.test(observedToolName))
      || eventData.humanNeeded === false
      || eventData.requiresApproval === false
    if (humanWaitResolved) session.waitingForHuman = false
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
    if (signals.some(signal => (signal.kind === 'HUMAN_APPROVAL_REQUIRED' || signal.kind === 'HUMAN_QUESTION_PENDING')
      && signal.evidence.some(evidence => evidence.authority === 'runtime'))) {
      session.waitingForHuman = true
    }
    for (const signal of signals) void this.ingest(signal)
    if (event.type === 'turn/end') {
      session.running = false
      session.stalled = false
      session.waitingForHuman = false
      delete session.lastHealthyObservationAt
    }
    this.syncSupervisor()
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
    this.syncSupervisor()
  }

  private checkStalls(): void {
    const now = Date.now()
    const thresholdMs = this.config.longRunThresholdMinutes * 60 * 1000
    for (const session of this.sessions.values()) {
      if (!session.active || !session.running) continue
      // An authoritative human boundary already explains the absence of
      // runtime events. Waiting for the answer must not create a competing
      // stall alert or consume the user's notification budget.
      if (session.waitingForHuman) continue
      const signal = signalFromStall({ id: session.id, ...(session.cwd ? { header: { cwd: session.cwd } } : {}) }, {
        toolFailures: session.toolFailures,
        activeSubagents: session.activeSubagents,
        lastEventAt: session.lastEventAt,
        startedAt: session.startedAt,
      }, thresholdMs)
      if (signal) {
        session.stalled = true
        void this.ingest(signal)
      } else if (this.dogfoodRecorder !== undefined
        && now - session.startedAt >= thresholdMs
        && (session.lastHealthyObservationAt === undefined || now - session.lastHealthyObservationAt >= thresholdMs)) {
        session.lastHealthyObservationAt = now
        this.dogfoodRecorder.recordHealthyHeartbeat(session.id, new Date(now).toISOString())
      }
    }
    this.syncSupervisor()
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

  /** Apply delivery policy and reserve one C2 budget unit only for a new interrupt. */
  private applyPolicy(verdict: AttentionVerdict, now: number, budgetConsumed = false): AttentionVerdict {
    const first = applyDeliveryPolicy(verdict, this.config, now, {
      budgetAvailable: budgetConsumed || this.budget.canInterrupt(now),
      ...(budgetConsumed ? { budgetConsumed: true } : {}),
    })
    if (budgetConsumed || first.action !== 'INTERRUPT') return first
    if (!this.budget.consume(now)) {
      return applyDeliveryPolicy(verdict, this.config, now, { budgetAvailable: false })
    }
    return applyDeliveryPolicy(verdict, this.config, now, { budgetAvailable: true, budgetConsumed: true })
  }

  private mergeBundle(item: InboxItem, verdict: AttentionVerdict, signal: CanarySignal): void {
    const incomingIsHigher = levelValue[verdict.level] > levelValue[item.level]
    const sameReason = verdict.reasonCode === item.reasonCode
    item.bundleCount += 1
    item.reasonCodes = [...new Set([...item.reasonCodes, verdict.reasonCode])]
    // Keep the root cause copy stable while retaining the secondary reason
    // codes and evidence in the bundle. A repeated root-cause signal may
    // refresh its parameters; a lower-priority signal cannot replace it.
    if (incomingIsHigher || sameReason) {
      item.messageKey = verdict.messageKey
      if (verdict.messageParams !== undefined) item.messageParams = { ...verdict.messageParams }
      if (verdict.suggestionKey !== undefined) item.suggestionKey = verdict.suggestionKey
      if (verdict.suggestedAction !== undefined) item.suggestedAction = verdict.suggestedAction
    }
    item.policyVersion = verdict.policyVersion
    item.evidence = [...item.evidence, ...verdict.evidence]
      .filter((candidate, index, all) => all.findIndex(value => value.type === candidate.type && value.authority === candidate.authority && value.ref === candidate.ref) === index)
      .slice(-8)
    if (verdict.why !== item.why && !item.why.includes(verdict.why)) item.why = `${item.why} Related signal: ${verdict.why}`.slice(0, 500)
    if (incomingIsHigher) {
      item.level = verdict.level
      item.reasonCode = verdict.reasonCode
      item.action = verdict.action
      // A level escalation reopens delivery. This preserves the safety floor
      // when an item was temporarily muted before the higher-level evidence.
      delete item.mutedUntil
    }
    item.confidence = Math.max(item.confidence, verdict.confidence)
    item.occurredAt = signal.occurredAt
    const bundleTrace = mergeBundleTrace(item.decisionTrace, verdict.decisionTrace, item.bundleCount, item.reasonCodes, item.level, item.action)
    if (bundleTrace === undefined) delete item.decisionTrace
    else item.decisionTrace = bundleTrace
  }

  private recover(signal: CanarySignal, verdict: AttentionVerdict, now: number): InboxItem | undefined {
    const bundleKey = signal.bundleKey ? hashMetadata(signal.bundleKey) : undefined
    const item = this.items.find(candidate => {
      if (candidate.status !== 'open' && candidate.status !== 'seen' && candidate.status !== 'snoozed') return false
      if (bundleKey !== undefined && candidate.bundleKey === bundleKey) return true
      if (signal.sessionId === undefined && bundleKey === undefined && candidate.reasonCode === 'HOST_UNREACHABLE') return true
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
    const recoveryTrace = withRecoveryTrace(item.decisionTrace ?? verdict.decisionTrace, 'recovery.host-stall-closes-root-cause')
    if (recoveryTrace === undefined) delete item.decisionTrace
    else {
      item.decisionTrace = { ...recoveryTrace, finalLevel: item.level, finalAction: item.action }
    }
    const previousOutcome = [...this.outcomeReceipts.values()].find(receipt => receipt.attentionRef === hashMetadata(item.id))
    if (previousOutcome !== undefined) {
      this.updateExistingOutcome(item, { laterOutcome: 'recovered', recoveredBeforeOpen: !previousOutcome.opened })
    }
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
      this.syncSupervisor()
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
    this.syncSupervisor()
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
      suppressedReasonCodes: [...this.suppressedReasons],
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
      ...(item.decisionTrace === undefined ? {} : { decisionTrace: publicDecisionTrace(item.decisionTrace) }),
      status: item.status,
      ...(item.snoozedUntil ? { snoozedUntil: item.snoozedUntil } : {}),
      ...(item.seenAt ? { seenAt: item.seenAt } : {}),
      ...(item.acknowledgedAt ? { acknowledgedAt: item.acknowledgedAt } : {}),
      ...(item.recoveredAt ? { recoveredAt: item.recoveredAt } : {}),
      ...(item.expiredAt ? { expiredAt: item.expiredAt } : {}),
      ...(item.mutedUntil ? { mutedUntil: item.mutedUntil } : {}),
      ...(item.feedback ? { feedback: { useful: item.feedback.useful, ...(item.feedback.value === undefined ? {} : { value: item.feedback.value }), at: item.feedback.at } } : {}),
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
      if (item.status === 'snoozed' && item.snoozedUntil !== undefined) {
        const until = Date.parse(item.snoozedUntil)
        if (Number.isFinite(until) && until <= now) {
          item.status = 'open'
          delete item.snoozedUntil
          changed = true
        }
      }
      if (item.mutedUntil !== undefined) {
        const until = Date.parse(item.mutedUntil)
        if (!Number.isFinite(until) || until <= now) {
          delete item.mutedUntil
          changed = true
        }
      }
    }
    if (changed) {
      this.bumpRevision()
      this.queueSave()
      this.syncSupervisor()
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

  private updateExistingOutcome(item: InboxItem, patch: Omit<Partial<OutcomeReceiptInput>, 'source' | 'trialId'>): void {
    const attentionRef = hashMetadata(item.id)
    const previousReceipts = [...this.outcomeReceipts.values()].filter(receipt => receipt.attentionRef === attentionRef)
    if (previousReceipts.length === 0) return
    for (const previous of previousReceipts) {
      try {
        const receipt = buildOutcomeReceipt(item, { source: previous.source, trialId: previous.trialId, ...patch }, previous)
        this.outcomeReceipts.set(outcomeStorageKey(receipt), receipt)
      } catch (error: unknown) {
        this.logger.warn?.(`${PLUGIN_NAME}: outcome record could not be updated`, error)
      }
    }
    this.syncDogfoodReceipts()
    this.queueOutcomeSave()
  }

  private recordDogfood(
    signal: CanarySignal,
    verdict: AttentionVerdict,
    disposition: DogfoodDecisionDisposition,
    deliveryChannel: DogfoodDeliveryChannel,
    options: { deliveryUnit?: string; bundleKey?: string; recoveredBeforeOpen?: boolean } = {},
  ): void {
    this.dogfoodRecorder?.record({ signal, verdict, disposition, deliveryChannel, ...options })
  }

  private syncDogfoodReceipts(): void {
    if (this.dogfoodRecorder === undefined) return
    this.dogfoodRecorder.setReceipts([...this.outcomeReceipts.values()])
  }

  private queueOutcomeSave(): Promise<void> {
    const snapshot = [...this.outcomeReceipts.values()].map(cloneOutcome)
    this.outcomeSaveChain = this.outcomeSaveChain
      .then(() => this.outcomeStore.save(snapshot))
      .catch(error => this.logger.warn?.(`${PLUGIN_NAME}: outcome records could not be saved`, error))
    return this.outcomeSaveChain
  }

  private queueSuppressionSave(): Promise<void> {
    const snapshot = [...this.suppressedReasons]
    this.suppressionSaveChain = this.suppressionSaveChain
      .then(() => this.suppressionStore.save(snapshot))
      .catch(error => this.logger.warn?.(`${PLUGIN_NAME}: notification suppression preferences could not be saved`, error))
    return this.suppressionSaveChain
  }
}

const dryRunReasons = new Set<ReasonCode>([
  'HUMAN_APPROVAL_REQUIRED',
  'HUMAN_QUESTION_PENDING',
  'HOST_UNREACHABLE',
  'HOST_SUSPECTED_STALL',
  'TOOL_FAILURE_LOOP',
  'NO_MEANINGFUL_PROGRESS',
  'SUBAGENT_PRESSURE',
  'CONTEXT_PRESSURE',
  'COMPACTION_OCCURRED',
  'TASK_COMPLETED',
  'TASK_FAILED',
  'TASK_ABORTED',
  'COMPLETION_SUSPICIOUS',
  'HOST_STALL_RECOVERED',
])

const dryRunAuthorities = new Set<EvidenceAuthority>(['host', 'runtime', 'derived', 'heuristic'])

function normalizeDryRunRequest(input: DryRunRequest): DryRunRequest {
  if (input === null || typeof input !== 'object' || input.signal === null || typeof input.signal !== 'object') {
    throw new TypeError('dry-run.signal is required')
  }
  const candidate = input.candidate
  if (candidate !== undefined && (candidate === null || typeof candidate !== 'object')) throw new TypeError('dry-run.candidate must be an object')
  const raw = input.signal as DryRunSignalInput
  if (!dryRunReasons.has(raw.kind)) throw new TypeError('dry-run.signal.kind is unsupported')
  if (!dryRunAuthorities.has(raw.authority)) throw new TypeError('dry-run.signal.authority is unsupported')
  if (raw.severityHint !== undefined && (!Number.isSafeInteger(raw.severityHint) || raw.severityHint < 0 || raw.severityHint > 3)) throw new TypeError('dry-run.signal.severityHint must be 0-3')
  if (raw.id !== undefined && (typeof raw.id !== 'string' || raw.id.length === 0 || raw.id.length > 128 || /[\u0000-\u001f]/.test(raw.id))) throw new TypeError('dry-run.signal.id must be a printable string of 1-128 characters')
  for (const key of ['healthy', 'userViewing'] as const) {
    const value = raw[key]
    if (value !== undefined && typeof value !== 'boolean') throw new TypeError(`dry-run.signal.${key} must be boolean`)
  }
  const scalarKeys = ['threshold', 'failureCount', 'activeSubagents', 'idleMs'] as const
  for (const key of scalarKeys) {
    const value = raw[key]
    if (value !== undefined && (typeof value !== 'number' || !Number.isFinite(value) || value < 0)) throw new TypeError(`dry-run.signal.${key} must be a finite non-negative number`)
  }
  let normalizedCandidate: DryRunRequest['candidate']
  if (candidate !== undefined) {
    const candidateRecord = candidate as Record<string, unknown>
    for (const key of Object.keys(candidateRecord)) if (key !== 'notificationLevel' && key !== 'quietHours') throw new TypeError(`unsupported dry-run candidate setting: ${key}`)
    if (candidateRecord.notificationLevel !== undefined && candidateRecord.notificationLevel !== 'C1' && candidateRecord.notificationLevel !== 'C2' && candidateRecord.notificationLevel !== 'C3') throw new TypeError('dry-run candidate notificationLevel must be C1, C2, or C3')
    if (candidateRecord.quietHours !== undefined) {
      const quietHours = candidateRecord.quietHours
      if (quietHours === null || typeof quietHours !== 'object') throw new TypeError('dry-run candidate quietHours must be an object')
      const quietRecord = quietHours as Record<string, unknown>
      for (const key of Object.keys(quietRecord)) if (key !== 'enabled' && key !== 'start' && key !== 'end') throw new TypeError(`unsupported dry-run quiet-hours setting: ${key}`)
      if (quietRecord.enabled !== undefined && typeof quietRecord.enabled !== 'boolean') throw new TypeError('dry-run candidate quietHours.enabled must be boolean')
      for (const key of ['start', 'end'] as const) {
        const value = quietRecord[key]
        if (value !== undefined && (typeof value !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(value))) throw new TypeError(`dry-run candidate quietHours.${key} must use HH:MM format`)
      }
      normalizedCandidate = {
        ...(candidateRecord.notificationLevel === undefined ? {} : { notificationLevel: candidateRecord.notificationLevel as 'C1' | 'C2' | 'C3' }),
        quietHours: {
          ...(quietRecord.enabled === undefined ? {} : { enabled: quietRecord.enabled }),
          ...(quietRecord.start === undefined ? {} : { start: quietRecord.start as string }),
          ...(quietRecord.end === undefined ? {} : { end: quietRecord.end as string }),
        },
      }
    } else if (candidateRecord.notificationLevel !== undefined) {
      normalizedCandidate = { notificationLevel: candidateRecord.notificationLevel as 'C1' | 'C2' | 'C3' }
    } else {
      normalizedCandidate = {}
    }
  }
  return {
    signal: {
      ...(raw.id === undefined ? {} : { id: raw.id }),
      kind: raw.kind,
      authority: raw.authority,
      ...(raw.severityHint === undefined ? {} : { severityHint: raw.severityHint }),
      ...(raw.healthy === undefined ? {} : { healthy: raw.healthy }),
      ...(raw.userViewing === undefined ? {} : { userViewing: raw.userViewing }),
      ...(raw.threshold === undefined ? {} : { threshold: raw.threshold }),
      ...(raw.failureCount === undefined ? {} : { failureCount: raw.failureCount }),
      ...(raw.activeSubagents === undefined ? {} : { activeSubagents: raw.activeSubagents }),
      ...(raw.idleMs === undefined ? {} : { idleMs: raw.idleMs }),
    },
    ...(normalizedCandidate === undefined ? {} : { candidate: normalizedCandidate }),
  }
}

function dryRunSignal(input: DryRunSignalInput, now: number): CanarySignal {
  const data: CanarySignal['data'] = {}
  for (const key of ['healthy', 'userViewing', 'threshold', 'failureCount', 'activeSubagents', 'idleMs'] as const) {
    const value = input[key]
    if (value !== undefined) data[key] = value
  }
  const source: CanarySignal['source'] = input.kind === 'SUBAGENT_PRESSURE'
    ? 'subagent'
    : input.kind.startsWith('HOST_')
      ? 'host'
      : input.kind === 'TOOL_FAILURE_LOOP'
        ? 'tool'
        : 'session'
  return {
    schemaVersion: 1,
    id: input.id ?? 'dry-run-event',
    occurredAt: new Date(now).toISOString(),
    source,
    kind: input.kind,
    ...(input.severityHint === undefined ? {} : { severityHint: input.severityHint }),
    evidence: [{
      type: input.authority === 'host' ? 'http-probe' : input.authority === 'runtime' ? 'runtime-probe' : 'model-judgment',
      authority: input.authority,
      ref: 'dry-run',
      summary: `Structured ${input.kind} signal with ${input.authority} evidence.`,
    }],
    data,
  }
}

function publicDecisionTrace(trace: PolicyDecisionTrace): PolicyDecisionTrace {
  return {
    ...trace,
    matchedRules: [...trace.matchedRules],
    appliedScopes: [...trace.appliedScopes],
    suppressedBy: [...trace.suppressedBy],
    ...(trace.bundledWith === undefined ? {} : { bundledWith: { eventCount: trace.bundledWith.eventCount, reasonCodes: [...trace.bundledWith.reasonCodes] } }),
    authoritySummary: { strongest: trace.authoritySummary.strongest, counts: { ...trace.authoritySummary.counts } },
  }
}

function isSuppressibleReasonCode(value: string): value is SuppressibleReasonCode {
  return SUPPRESSIBLE_REASON_CODES.includes(value as SuppressibleReasonCode)
}

function isFeedbackValue(value: unknown): value is FeedbackValue {
  return value === 'useful'
    || value === 'not-relevant'
    || value === 'wrong-level'
    || value === 'already-resolved'
}

function asRecord(value: unknown): Record<string, any> {
  return value !== null && typeof value === 'object' ? value as Record<string, any> : {}
}

export { PLUGIN_NAME, PLUGIN_VERSION }
