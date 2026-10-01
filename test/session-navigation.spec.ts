import { describe, expect, it } from 'vitest'
import { hasCatalogSession, openAttentionSession } from '../src/client/session-navigation.js'

describe('version-aware session navigation', () => {
  it('returns to retained history by exact catalog identity without treating disposal as deletion', () => {
    const calls: string[] = []
    const ctx = {
      uiWorkspace: { openSession: (id: string) => { calls.push(id) } },
      sessions: { list: { getSnapshot: () => ({ phase: 'ready', ids: ['retained'] }) } },
    }
    expect(hasCatalogSession(ctx, 'retained')).toBe(true)
    expect(openAttentionSession(ctx, 'retained')).toBe(true)
    expect(openAttentionSession(ctx, 'deleted')).toBe(false)
    expect(calls).toEqual(['retained'])
  })

  it('does not guess a target from pending, failed, or retained-only catalog entries', () => {
    const openSession = () => { throw new Error('must not navigate') }
    for (const getSnapshot of [
      () => ({ phase: 'pending', ids: ['target'] }),
      () => ({ phase: 'ready', ids: [], byId: { target: {} } }),
      () => { throw new Error('disconnected') },
    ]) {
      const ctx = { uiWorkspace: { openSession }, sessions: { list: { getSnapshot } } }
      expect(hasCatalogSession(ctx, 'target')).toBe(false)
      expect(openAttentionSession(ctx, 'target')).toBe(false)
    }
  })
  it('prefers the new workspace owner and preserves its receiver', () => {
    const calls: string[] = []
    const workspace = { openSession(id: string) { expect(this).toBe(workspace); calls.push(id) } }
    expect(openAttentionSession({ get: () => workspace, sessions: { open: () => { throw new Error('wrong owner') } } }, 'historical')).toBe(true)
    expect(calls).toEqual(['historical'])
  })

  it('resolves a service that activates after the client', () => {
    let workspace: { openSession: (id: string) => void } | undefined
    const calls: string[] = []
    const ctx = { get: () => workspace, sessions: {} }
    expect(openAttentionSession(ctx, 'target')).toBe(false)
    workspace = { openSession: id => { calls.push(id) } }
    expect(openAttentionSession(ctx, 'target')).toBe(true)
    expect(calls).toEqual(['target'])
  })

  it('retains the alpha5 owner when the workspace capability is absent', () => {
    const sessions = { open(id: string) { expect(this).toBe(sessions); expect(id).toBe('old') } }
    expect(openAttentionSession({ sessions }, 'old')).toBe(true)
  })

  it('does not fall back after a new owner rejects navigation', () => {
    let legacyCalled = false
    expect(openAttentionSession({
      uiWorkspace: { openSession: () => { throw new Error('unavailable') } },
      sessions: { open: () => { legacyCalled = true } },
    }, 'unknown')).toBe(false)
    expect(legacyCalled).toBe(false)
  })

  it('fails closed for missing, throwing, and malformed capabilities', () => {
    expect(openAttentionSession({ sessions: {} }, 'target')).toBe(false)
    expect(openAttentionSession({ get: () => { throw new Error('disposed') }, sessions: {} }, 'target')).toBe(false)
    expect(openAttentionSession({ get: () => ({ openSession: true }), sessions: {} }, 'target')).toBe(false)
    expect(openAttentionSession({ sessions: { open: () => { throw new Error('stale') } } }, 'target')).toBe(false)
  })

  it('does not navigate an empty target', () => {
    expect(openAttentionSession({ get: () => { throw new Error('must not resolve') }, sessions: {} }, ' ')).toBe(false)
  })
})
