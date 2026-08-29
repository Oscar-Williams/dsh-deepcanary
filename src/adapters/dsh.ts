import type { Context } from '@deepseek-ai/cordis'
import type { SessionEventLike, SessionLike } from '../providers.js'

export interface Disposable {
  dispose(): void
}

export interface DeepCanaryEvent {
  type: 'session/created' | 'session/event' | 'session/disposed'
  session: unknown
  event?: unknown
}

export interface SessionSnapshot {
  sessionId: string
  active: boolean
  cwd?: string
  lastEventAt: number
}

export interface RuntimeHealth {
  status: 'healthy' | 'degraded' | 'unreachable' | 'unknown'
  authoritative: boolean
  checkedAt: string
  detail?: string
}

/** Stable boundary between DSH runtime facts and DeepCanary interpretation. */
export interface DshAdapter {
  hostVersion: string
  start(): Promise<void>
  subscribe(listener: (event: DeepCanaryEvent) => void): Disposable
  getSessionSnapshot(sessionId: string): Promise<SessionSnapshot | null>
  getRuntimeHealth(): Promise<RuntimeHealth>
}

interface ContextLike {
  on?: (event: string, listener: (...args: any[]) => any) => unknown
}

interface DshAdapterOptions {
  hostVersion?: string
  runtimeHealth?: () => Promise<RuntimeHealth>
}

/** Context-backed adapter used by the plugin host; all DSH event wiring lives here. */
export class ContextDshAdapter implements DshAdapter {
  readonly hostVersion: string
  private readonly ctx: ContextLike
  private readonly listeners = new Set<(event: DeepCanaryEvent) => void>()
  private readonly snapshots = new Map<string, SessionSnapshot>()
  private readonly runtimeHealth: () => Promise<RuntimeHealth>
  private started = false

  constructor(ctx: Context, options: DshAdapterOptions = {}) {
    this.ctx = ctx as unknown as ContextLike
    this.hostVersion = options.hostVersion ?? process.env.DSH_VERSION ?? 'unknown'
    this.runtimeHealth = options.runtimeHealth ?? (async () => ({
      status: 'unknown',
      authoritative: false,
      checkedAt: new Date().toISOString(),
      detail: 'The composed DSH runtime does not expose a health provider to DeepCanary.',
    }))
  }

  async start(): Promise<void> {
    if (this.started) return
    this.started = true
    const on = this.ctx.on
    if (typeof on !== 'function') return
    on.call(this.ctx, 'session/created', (session: unknown) => this.publish({ type: 'session/created', session }))
    on.call(this.ctx, 'session/event', (session: unknown, event: unknown) => this.publish({ type: 'session/event', session, event }))
    on.call(this.ctx, 'session/disposed', (session: unknown) => this.publish({ type: 'session/disposed', session }))
  }

  subscribe(listener: (event: DeepCanaryEvent) => void): Disposable {
    this.listeners.add(listener)
    return { dispose: () => this.listeners.delete(listener) }
  }

  async getSessionSnapshot(sessionId: string): Promise<SessionSnapshot | null> {
    return this.snapshots.get(sessionId) ?? null
  }

  getRuntimeHealth(): Promise<RuntimeHealth> {
    return this.runtimeHealth()
  }

  private publish(event: DeepCanaryEvent): void {
    const id = idOf(event.session)
    if (id !== undefined) {
      const previous = this.snapshots.get(id)
      const session = event.session as SessionLike
      const cwd = session.header?.cwd
      this.snapshots.set(id, {
        sessionId: id,
        active: event.type !== 'session/disposed',
        ...(cwd ? { cwd } : previous?.cwd ? { cwd: previous.cwd } : {}),
        lastEventAt: event.type === 'session/event' ? Date.now() : previous?.lastEventAt ?? Date.now(),
      })
    }
    for (const listener of this.listeners) listener(event)
  }
}

function idOf(value: unknown): string | undefined {
  if (typeof value === 'string' && value.length > 0) return value
  if (typeof value === 'number' && Number.isSafeInteger(value)) return String(value)
  if (value !== null && typeof value === 'object' && 'id' in value) return idOf((value as { id?: unknown }).id)
  return undefined
}

export type { SessionEventLike, SessionLike }
