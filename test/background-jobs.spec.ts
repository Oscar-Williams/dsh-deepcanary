import { mkdtemp, readFile, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { BackgroundJobTracker, MAX_BACKGROUND_WATCHES, selectBackgroundEvent, signalFromBackgroundSettlement } from '../src/adapters/background-jobs.js'
import { judgeSignal } from '../src/core/judge.js'
import { DeepCanaryService } from '../src/service.js'
import { MetadataStore } from '../src/persistence.js'

const job = (status = 'running', id = 'workflow-1') => ({ id, owner: 'owner-1', kind: 'workflow', startedAt: 1_000,
  status, ...(status === 'running' ? {} : { finishedAt: 2_000 }),
  get label(): never { throw new Error('Private label') },
  get progress(): never { throw new Error('Private progress') },
  get detail(): never { throw new Error('Private error') },
  get output(): never { throw new Error('Private output') },
})

describe('background task observation', () => {
  it('closes a stalled reminder on renewed background activity and releases grace on settlement', async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), 'deepcanary-background-progress-'))
    let now = 1_000_000
    const clock = vi.spyOn(Date, 'now').mockImplementation(() => now)
    let notify: ((event: unknown) => void) | undefined
    const activeJob = job()
    activeJob.startedAt = now
    let rows = [activeJob]
    const listeners = new Map<string, (...args: any[]) => void>()
    const session = { id: 'owner-1' }
    const ctx = { logger: {}, on: (name: string, listener: (...args: any[]) => void) => { listeners.set(name, listener) },
      sessions: { list: () => [session] }, inject: (names: string[], callback: (value: unknown) => void) => {
        if (names[0] === 'jobs') callback({ jobs: { list: () => rows, events: { subscribe: (_filter: unknown, listener: (event: unknown) => void) => {
          notify = listener
          return () => { notify = undefined }
        } } }, sessions: { list: () => [session] } })
      } }
    const service = new DeepCanaryService(ctx as never, { stateDir: directory, longRunThresholdMinutes: 1 })
    try {
      await service.ready
      service.start()
      await vi.waitFor(() => { expect(service.status().background?.running).toBe(1) })
      listeners.get('session/created')?.(session)
      listeners.get('session/event')?.(session, { type: 'turn/start', data: {} })
      now += 121_000
      ;(service as unknown as { checkStalls(): void }).checkStalls()
      await vi.waitFor(() => { expect(service.inbox(20).find(item => item.reasonCode === 'HOST_SUSPECTED_STALL')?.status).toBe('open') })
      now += 1
      notify?.({ type: 'output', id: 'workflow-1', owner: session.id, total: 128 })
      await vi.waitFor(() => { expect(service.inbox(20).find(item => item.reasonCode === 'HOST_SUSPECTED_STALL')?.status).toBe('recovered') })
      rows = []
      notify?.({ type: 'settled', job: { id: 'workflow-1', owner: session.id, kind: 'workflow', status: 'completed',
        startedAt: 1_000_000, finishedAt: now }, cause: 'producer', awaited: true })
      await vi.waitFor(() => { expect(service.status().background?.running).toBe(0) })
      now += 59_000
      ;(service as unknown as { checkStalls(): void }).checkStalls()
      expect(service.inbox(20).filter(item => item.reasonCode === 'HOST_SUSPECTED_STALL' && item.status === 'open')).toHaveLength(0)
    } finally { clock.mockRestore(); await service.dispose(); await rm(directory, { recursive: true, force: true }) }
  })

  it('removes private fields before retaining an asynchronous event', () => {
    const selected = selectBackgroundEvent({ type: 'settled', job: job('failed'), cause: 'producer', awaited: false })
    expect(selected).toMatchObject({ type: 'settled', job: { owner: 'owner-1', kind: 'workflow', status: 'failed' } })
    expect(Object.keys(selected!.job as object)).toEqual(['id', 'owner', 'kind', 'status', 'startedAt', 'finishedAt'])
  })

  it('recognizes increasing public byte counts without reading output or accepting stale pulses', () => {
    let now = 1_000
    const clock = vi.spyOn(Date, 'now').mockImplementation(() => now)
    try {
      const tracker = new BackgroundJobTracker()
      tracker.observe({ type: 'registered', job: job() })
      now = 2_000
      tracker.observe({ type: 'output', id: 'workflow-1', owner: 'owner-1', total: 120 })
      expect(tracker.lastActivityFor('owner-1')).toBe(2_000)
      now = 3_000
      for (const total of [120, 90, -1, Number.POSITIVE_INFINITY]) tracker.observe({ type: 'output', id: 'workflow-1', owner: 'owner-1', total })
      tracker.observe({ type: 'output', id: 'workflow-1', owner: 'foreign-owner', total: 500 })
      expect(tracker.lastActivityFor('owner-1')).toBe(2_000)
      tracker.observe({ type: 'settled', job: job('completed'), cause: 'producer', awaited: false })
      expect(tracker.lastActivityFor('owner-1')).toBeUndefined()
    } finally { clock.mockRestore() }
  })

  it('tracks healthy work quietly and maps an unawaited failure to C2 using metadata only', () => {
    const tracker = new BackgroundJobTracker()
    expect(tracker.observe({ type: 'registered', job: job() })).toBeUndefined()
    expect(tracker.summary()).toMatchObject({ running: 1, unknown: 0 })
    const settled = tracker.observe({ type: 'settled', job: job('failed'), cause: 'producer', awaited: false })!
    const signal = signalFromBackgroundSettlement(settled)
    expect(judgeSignal(signal)).toMatchObject({ level: 'C2', messageKey: 'item.reason.BACKGROUND_TASK_FAILED' })
    expect(signal.sessionId).toBe('owner-1')
    expect(tracker.summary().running).toBe(0)
    expect(JSON.stringify(signal)).not.toContain('Private')
  })

  it.each([
    { status: 'completed', cause: 'producer', awaited: true },
    { status: 'killed', cause: 'kill', awaited: false },
    { status: 'failed', cause: 'teardown', awaited: false },
  ])('keeps collected outcomes and intentional shutdown quiet: $status/$cause', row => {
    const tracker = new BackgroundJobTracker()
    tracker.observe({ type: 'registered', job: job() })
    expect(tracker.observe({ type: 'settled', job: job(row.status), cause: row.cause, awaited: row.awaited })).toBeUndefined()
    expect(tracker.summary()).toMatchObject({ running: 0, unknown: 0 })
  })

  it('keeps a normal background completion in Inbox at C1', () => {
    const settled = new BackgroundJobTracker().observe({ type: 'settled', job: job('completed'), cause: 'producer', awaited: false })!
    expect(judgeSignal(signalFromBackgroundSettlement(settled))).toMatchObject({ level: 'C1', action: 'INBOX', messageKey: 'item.reason.BACKGROUND_TASK_COMPLETED' })
  })

  it('collects a watched outcome after reload once and ignores unrelated historical outcomes', () => {
    const tracker = new BackgroundJobTracker()
    tracker.observe({ type: 'registered', job: job() })
    const replacement = new BackgroundJobTracker()
    replacement.restore(tracker.snapshot())
    const sessions = [{ id: 'owner-1', snapshotEvents: () => [{ type: 'job/settled', data: {
      jobId: 'workflow-1', owner: 'owner-1', kind: 'workflow', startedAt: 1_000, finishedAt: 2_000, status: 'failed', cause: 'producer',
    } }] }]
    const registry = { list: () => [job('failed'), job('completed', 'unrelated-old-job')] }
    expect(replacement.reconcile(registry, sessions, 3_000)).toMatchObject([{ status: 'failed', catchup: true }])
    expect(replacement.reconcile(registry, sessions, 3_000)).toEqual([])
    expect(replacement.observe({ type: 'settled', job: job('failed'), cause: 'producer', awaited: false })).toBeUndefined()
  })

  it('preserves uncertainty and rejects copied foreign-owner history', () => {
    const tracker = new BackgroundJobTracker()
    tracker.observe({ type: 'registered', job: job() })
    const replacement = new BackgroundJobTracker()
    replacement.restore(tracker.snapshot())
    const sessions = [{ id: 'owner-1', snapshotEvents: () => [{ type: 'job/settled', data: {
      jobId: 'workflow-1', owner: 'foreign-owner', kind: 'workflow', startedAt: 1_000, finishedAt: 2_000, status: 'completed', cause: 'producer',
    } }] }]
    expect(replacement.reconcile({ list: () => [] }, sessions, 3_000)).toEqual([])
    expect(replacement.summary()).toMatchObject({ running: 0, unknown: 1 })
  })

  it('bounds retained watches and reports partial tracking explicitly', () => {
    const tracker = new BackgroundJobTracker()
    for (let index = 0; index < MAX_BACKGROUND_WATCHES + 20; index += 1) tracker.observe({ type: 'registered', job: job('running', `job-${index}`) })
    expect(tracker.snapshot()).toHaveLength(MAX_BACKGROUND_WATCHES)
    expect(tracker.summary().limited).toBe(true)
  })

  it('clears the capacity notice after the authoritative roster fits again', () => {
    const tracker = new BackgroundJobTracker()
    const rows = Array.from({ length: MAX_BACKGROUND_WATCHES + 1 }, (_, index) => job('running', `job-${index}`))
    const sessions = [{ id: 'owner-1' }]
    tracker.reconcile({ list: () => rows }, sessions, 2_000)
    expect(tracker.summary().limited).toBe(true)
    tracker.reconcile({ list: () => rows.slice(0, MAX_BACKGROUND_WATCHES) }, sessions, 3_000)
    expect(tracker.summary()).toMatchObject({ running: MAX_BACKGROUND_WATCHES, limited: false })
  })

  it('stores only allowlisted watch fields in the existing atomic Inbox state', async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), 'deepcanary-background-store-'))
    try {
      const tracker = new BackgroundJobTracker()
      tracker.observe({ type: 'registered', job: job() })
      const store = new MetadataStore(directory)
      await store.save([], [{ ...tracker.snapshot()[0]!, extra: 'PRIVATE-PAYLOAD' } as never])
      expect(await readFile(store.file, 'utf8')).not.toContain('PRIVATE-PAYLOAD')
      expect((await store.loadState()).backgroundWatches).toHaveLength(1)
    } finally { await rm(directory, { recursive: true, force: true }) }
  })

  it('persists active supervision, catches up after replacement and keeps one exact session target', async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), 'deepcanary-background-service-'))
    let listener: ((event: unknown) => void) | undefined
    let rows = [job()]
    let events: unknown[] = []
    const session = { id: 'owner-1', snapshotEvents: () => events }
    const registry = { list: () => rows, events: { subscribe: (_filter: unknown, callback: (event: unknown) => void) => {
      listener = callback
      return () => { listener = undefined }
    } } }
    const ctx = { logger: {}, sessions: { list: () => [session] }, inject: (names: string[], callback: (value: unknown) => void) => {
      if (names[0] === 'jobs') callback({ jobs: registry, sessions: { list: () => [session] } })
    } }
    const services: DeepCanaryService[] = []
    try {
      const first = new DeepCanaryService(ctx as never, { stateDir: directory })
      services.push(first)
      await first.ready
      first.start()
      await vi.waitFor(() => { expect(first.status().background?.running).toBe(1) })
      expect(first.inbox(20)).toEqual([])
      listener?.({ type: 'output', id: 'workflow-1', owner: 'owner-1', total: 120 })
      await first.dispose()
      expect(listener).toBeUndefined()
      rows = [job('failed')]
      events = [{ type: 'job/settled', seq: 0, time: 2_000, data: { jobId: 'workflow-1', owner: 'owner-1', kind: 'workflow',
        startedAt: 1_000, finishedAt: 2_000, status: 'failed', cause: 'producer' } }]
      for (let restart = 0; restart < 2; restart += 1) {
        const next = new DeepCanaryService(ctx as never, { stateDir: directory })
        services.push(next)
        await next.ready
        next.start()
        await vi.waitFor(() => { expect(next.inbox(20)).toHaveLength(1) })
        expect(next.inbox(20)[0]).toMatchObject({ level: 'C2', sessionId: 'owner-1', messageKey: 'item.reason.BACKGROUND_TASK_FAILED_CATCHUP' })
        await next.dispose()
      }
      expect(await readFile(path.join(directory, 'inbox.json'), 'utf8')).not.toContain('Private')
    } finally {
      for (const service of services) await service.dispose()
      await rm(directory, { recursive: true, force: true })
    }
  })
})
