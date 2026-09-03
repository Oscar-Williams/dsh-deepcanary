import { Context } from '@deepseek-ai/cordis'
import { SessionStore } from '@deepseek-ai/dsh-session'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import { afterEach, describe, expect, it } from 'vitest'
import { ContextDshAdapter } from '../src/adapters/dsh.js'

describe('DSH alpha.5 adapter integration', () => {
  let storeFiber: { dispose: () => Promise<void> } | undefined

  afterEach(async () => {
    await storeFiber?.dispose()
    storeFiber = undefined
  })

  it('reconciles the public SessionStore list and Session snapshotEvents contract', async () => {
    const ctx = new Context()
    storeFiber = await ctx.plugin(SessionStore)
    const session = ctx.sessions.create('alpha5-adapter-session' as SessionId, { meta: { cwd: 'C:\\work' } })
    session.append('turn/start', { turn: 1 })

    const adapter = new ContextDshAdapter(ctx, { hostVersion: 'dsh-v0.1.2-alpha.5' })
    const received: Array<{ type: string; sessionId?: string; eventCount?: number }> = []
    adapter.subscribe(event => received.push({
      type: event.type,
      ...(event.snapshot === undefined ? {} : {
        sessionId: event.snapshot.sessionId,
        eventCount: event.snapshot.eventCount,
      }),
    }))

    await adapter.start()

    expect(ctx.sessions.list()).toHaveLength(1)
    expect(received).toEqual([{ type: 'session/created', sessionId: session.id, eventCount: 1 }])
    expect(adapter.getReconciliationStatus()).toMatchObject({
      phase: 'ready',
      authoritative: true,
      verified: true,
      listedSessions: 1,
      bufferedEvents: 0,
    })
    expect(await adapter.getSessionSnapshot(session.id)).toMatchObject({
      sessionId: session.id,
      active: true,
      lastEventSeq: 0,
      eventCount: 1,
      running: true,
    })
  })
})
