import { describe, expect, it } from 'vitest'
import { ContextDshAdapter } from '../src/adapters/dsh.js'

describe('DSH adapter boundary', () => {
  it('normalizes lifecycle events and exposes session snapshots', async () => {
    const listeners = new Map<string, (...args: any[]) => void>()
    const adapter = new ContextDshAdapter({
      on: (name: string, listener: (...args: any[]) => void) => { listeners.set(name, listener) },
    } as never, { hostVersion: '0.1.2-alpha.1' })
    const received: string[] = []
    adapter.subscribe(event => received.push(event.type))
    await adapter.start()
    const session = { id: 'adapter-session', header: { cwd: 'C:\\work' } }
    listeners.get('session/created')?.(session)
    listeners.get('session/event')?.(session, { type: 'tool/result' })
    listeners.get('session/disposed')?.(session)
    expect(adapter.hostVersion).toBe('0.1.2-alpha.1')
    expect(received).toEqual(['session/created', 'session/event', 'session/disposed'])
    expect(await adapter.getSessionSnapshot('adapter-session')).toMatchObject({ sessionId: 'adapter-session', active: false, cwd: 'C:\\work' })
    expect((await adapter.getRuntimeHealth()).status).toBe('unknown')
  })
})
