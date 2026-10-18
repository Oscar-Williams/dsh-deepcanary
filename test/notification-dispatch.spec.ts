import { describe, expect, it } from 'vitest'
import { claimNotificationBatch } from '../src/client/notification-dispatch.js'

const item = (id: string, generation = 0) => ({ id, notificationGeneration: generation, level: 'C2' as const,
  action: 'INTERRUPT', status: 'open', occurredAt: '2026-10-18T00:00:00.000Z' })
describe('notification dispatch', () => {
  it('continues beyond completed claims to reach pending work', async () => {
    const attempted = new Set<string>()
    const sent = []
    for await (const entry of claimNotificationBatch(['a', 'b', 'c', 'd'].map(id => item(id)), attempted,
      async entry => entry.id === 'd' ? 'granted' : 'already-complete')) sent.push(entry.id)
    expect(sent).toEqual(['d'])
    expect([...attempted]).toEqual(['a', 'b', 'c'])
  })
  it('allows the new generation and skips ineligible, snoozed and muted work', async () => {
    const sent = []
    const rows = [item('rescheduled', 1), { ...item('blocked'), notificationEligible: false },
      { ...item('future'), status: 'snoozed' }, { ...item('muted'), mutedUntil: '2099-01-01T00:00:00Z' }]
    for await (const entry of claimNotificationBatch(rows, new Set(['rescheduled']), async () => 'granted')) sent.push(entry.id)
    expect(sent).toEqual(['rescheduled'])
  })
  it('moves past an exhausted prefix on the following bounded pass', async () => {
    const attempted = new Set<string>()
    const rows = Array.from({ length: 13 }, (_, index) => item(`item-${index}`))
    const sent = []
    const claim = async (entry: { id: string }) => entry.id === 'item-12' ? 'granted' as const : 'exhausted' as const
    for await (const entry of claimNotificationBatch(rows, attempted, claim)) sent.push(entry.id)
    expect(sent).toEqual([])
    for await (const entry of claimNotificationBatch(rows, attempted, claim)) sent.push(entry.id)
    expect(sent).toEqual(['item-12'])
  })
  it('bounds claim traffic and gives authoritative urgency priority', async () => {
    const rows = Array.from({ length: 30 }, (_, index) => item(`normal-${index}`))
    const critical = { ...item('critical'), level: 'C3' as const, action: 'ESCALATE' }
    const sent = []
    for await (const entry of claimNotificationBatch([...rows, critical], new Set(), async () => 'granted')) sent.push(entry.id)
    expect(sent).toEqual(['critical', 'normal-0', 'normal-1'])
    let calls = 0
    for await (const _entry of claimNotificationBatch(rows, new Set(), async () => { calls++; return 'already-claimed' })) { /* no claims */ }
    expect(calls).toBe(12)
  })
})
