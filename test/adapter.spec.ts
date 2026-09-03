import { describe, expect, it } from 'vitest'
import { ContextDshAdapter } from '../src/adapters/dsh.js'

describe('DSH adapter boundary', () => {
  it('normalizes lifecycle events and exposes session snapshots', async () => {
    const listeners = new Map<string, (...args: any[]) => void>()
    const adapter = new ContextDshAdapter({
      on: (name: string, listener: (...args: any[]) => void) => { listeners.set(name, listener) },
    } as never, { hostVersion: '0.1.2-alpha.2' })
    const received: string[] = []
    adapter.subscribe(event => received.push(event.type))
    await adapter.start()
    const session = { id: 'adapter-session', header: { cwd: 'C:\\work' } }
    listeners.get('session/created')?.(session)
    listeners.get('session/event')?.(session, { type: 'tool/result' })
    listeners.get('session/disposed')?.(session)
    expect(adapter.hostVersion).toBe('0.1.2-alpha.2')
    expect(received).toEqual(['session/created', 'session/event', 'session/disposed'])
    expect(await adapter.getSessionSnapshot('adapter-session')).toMatchObject({ sessionId: 'adapter-session', active: false, cwd: 'C:\\work' })
    expect((await adapter.getRuntimeHealth()).status).toBe('unknown')
  })

  it('seeds from the authoritative session list and skips an event already in the snapshot', async () => {
    const listeners = new Map<string, (...args: any[]) => void>()
    const events = [
      { type: 'turn/start', seq: 0, time: 1_000, data: {} },
      { type: 'approval/asked', seq: 1, time: 2_000, data: {} },
    ]
    const session = {
      id: 'authoritative-session',
      header: { cwd: 'C:\\work', createdAt: 500 },
      seq: events.length,
      snapshotEvents: () => events,
    }
    let listCalls = 0
    const adapter = new ContextDshAdapter({
      on: (name: string, listener: (...args: any[]) => void) => { listeners.set(name, listener) },
      sessions: {
        list: () => {
          listCalls += 1
          if (listCalls === 1) listeners.get('session/event')?.(session, events[1])
          return [session]
        },
      },
    } as never, { hostVersion: '0.1.2-alpha.5' })
    const received: Array<{ type: string; snapshot: Record<string, unknown> | undefined }> = []
    adapter.subscribe(event => received.push({ type: event.type, snapshot: event.snapshot as Record<string, unknown> | undefined }))

    await adapter.start()

    expect(received.map(event => event.type)).toEqual(['session/created'])
    expect(received[0]?.snapshot).toMatchObject({
      sessionId: 'authoritative-session',
      active: true,
      startedAt: 1_000,
      lastEventAt: 2_000,
      lastEventSeq: 1,
      eventCount: 2,
      running: true,
      waitingForHuman: true,
      humanNeededReason: 'approval',
      humanNeededSeq: 1,
    })
    expect(adapter.getReconciliationStatus()).toMatchObject({
      phase: 'ready',
      authoritative: true,
      verified: true,
      listedSessions: 1,
      skippedBufferedEvents: 1,
    })
    expect(await adapter.getSessionSnapshot('authoritative-session')).toMatchObject({ waitingForHuman: true })

    const completed = { type: 'turn/end', seq: 2, time: 3_000, data: { reason: { kind: 'completed' } } }
    events.push(completed)
    session.seq = events.length
    listeners.get('session/event')?.(session, completed)
    expect(received.map(event => event.type)).toEqual(['session/created', 'session/event'])
    expect(await adapter.getSessionSnapshot('authoritative-session')).toMatchObject({
      lastEventSeq: 2,
      eventCount: 3,
      running: false,
      waitingForHuman: false,
    })
  })

  it('releases buffered events and exposes degraded status when authoritative listing fails', async () => {
    const listeners = new Map<string, (...args: any[]) => void>()
    const session = { id: 'degraded-session', header: { cwd: 'C:\\work' } }
    const event = { type: 'turn/start', seq: 0, time: 4_000, data: {} }
    const adapter = new ContextDshAdapter({
      on: (name: string, listener: (...args: any[]) => void) => { listeners.set(name, listener) },
      sessions: {
        list: () => {
          listeners.get('session/event')?.(session, event)
          throw new Error('session list temporarily unavailable')
        },
      },
    } as never)
    const received: string[] = []
    adapter.subscribe(eventValue => received.push(eventValue.type))

    await adapter.start()

    expect(received).toEqual(['session/event'])
    expect(adapter.getReconciliationStatus()).toMatchObject({
      phase: 'unavailable',
      authoritative: false,
      verified: false,
      detail: 'session list temporarily unavailable',
    })
    expect(await adapter.getSessionSnapshot('degraded-session')).toMatchObject({ active: true, lastEventSeq: 0 })
  })

  it('deduplicates the same post-snapshot event during the reconciliation boundary', async () => {
    const listeners = new Map<string, (...args: any[]) => void>()
    const events = [{ type: 'turn/start', seq: 0, time: 5_000, data: {} }]
    let snapshotCalls = 0
    const postSnapshotEvent = { type: 'approval/asked', seq: 1, time: 6_000, data: {} }
    const session = {
      id: 'post-snapshot-session',
      header: { cwd: 'C:\\work', createdAt: 4_000 },
      snapshotEvents: () => {
        const copy = [...events]
        snapshotCalls += 1
        if (snapshotCalls === 1) {
          events.push(postSnapshotEvent)
          listeners.get('session/event')?.(session, postSnapshotEvent)
          listeners.get('session/event')?.(session, postSnapshotEvent)
        }
        return copy
      },
    }
    const adapter = new ContextDshAdapter({
      on: (name: string, listener: (...args: any[]) => void) => { listeners.set(name, listener) },
      sessions: { list: () => [session] },
    } as never)
    const received: string[] = []
    adapter.subscribe(event => received.push(event.type))

    await adapter.start()

    expect(received).toEqual(['session/created', 'session/event'])
    expect(adapter.getReconciliationStatus()).toMatchObject({
      phase: 'ready',
      authoritative: true,
      verified: true,
      skippedBufferedEvents: 1,
    })
    expect(await adapter.getSessionSnapshot('post-snapshot-session')).toMatchObject({
      lastEventSeq: 1,
      eventCount: 2,
      waitingForHuman: true,
    })
  })

  it('publishes an authoritative disposal when a previously live session leaves the store', async () => {
    const listeners = new Map<string, (...args: any[]) => void>()
    const session = {
      id: 'disappearing-session',
      header: { cwd: 'C:\\work', createdAt: 7_000 },
      snapshotEvents: () => [{ type: 'turn/start', seq: 0, time: 8_000, data: {} }],
    }
    let liveSessions: readonly unknown[] = [session]
    const adapter = new ContextDshAdapter({
      on: (name: string, listener: (...args: any[]) => void) => { listeners.set(name, listener) },
      sessions: { list: () => liveSessions },
    } as never)
    const received: string[] = []
    adapter.subscribe(event => received.push(event.type))

    await adapter.start()
    liveSessions = []
    await adapter.reconcile()

    expect(received).toEqual(['session/created', 'session/disposed'])
    expect(await adapter.getSessionSnapshot('disappearing-session')).toMatchObject({ active: false })
    expect(adapter.getReconciliationStatus()).toMatchObject({
      phase: 'ready',
      authoritative: true,
      verified: true,
      listedSessions: 0,
    })
  })
})
