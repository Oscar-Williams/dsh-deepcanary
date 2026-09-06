import { describe, expect, it } from 'vitest'
import { DeliveryLedger } from '../src/core/delivery.js'

describe('cross-sink delivery ledger', () => {
  it('keeps one logical delivery idempotent across duplicate and delayed callbacks', () => {
    const ledger = new DeliveryLedger()
    const base = Date.parse('2026-09-04T00:00:00.000Z')
    const at = (offset: number) => new Date(base + offset).toISOString()

    ledger.record({ verdictId: 'verdict-1', conditionGeneration: 'condition-1', sink: 'browser', attemptId: 'attempt-a', stage: 'attempted', observedAt: at(0) })
    ledger.record({ verdictId: 'verdict-1', conditionGeneration: 'condition-1', sink: 'browser', attemptId: 'attempt-a', stage: 'constructed', observedAt: at(1) })
    ledger.record({ verdictId: 'verdict-1', conditionGeneration: 'condition-1', sink: 'browser', attemptId: 'attempt-a', stage: 'constructed', observedAt: at(2) })
    ledger.record({ verdictId: 'verdict-1', conditionGeneration: 'condition-1', sink: 'browser', attemptId: 'attempt-a', stage: 'error', observedAt: at(3) })
    expect(ledger.snapshot()[0]?.state).toBe('failed')
    ledger.record({ verdictId: 'verdict-1', conditionGeneration: 'condition-1', sink: 'browser', attemptId: 'attempt-a', stage: 'clicked', observedAt: at(4) })

    // A later retry is tracked, while a successful logical delivery remains
    // terminal. A delayed callback from the old attempt cannot downgrade it
    // or create a third attempt.
    ledger.record({ verdictId: 'verdict-1', conditionGeneration: 'condition-1', sink: 'browser', attemptId: 'attempt-b', stage: 'attempted', observedAt: at(5) })
    ledger.record({ verdictId: 'verdict-1', conditionGeneration: 'condition-1', sink: 'browser', attemptId: 'attempt-a', stage: 'error', observedAt: at(6) })

    const [entry] = ledger.snapshot()
    expect(entry).toMatchObject({
      sink: 'browser',
      state: 'clicked',
      attempts: 2,
      firstObservedAt: at(0),
    })
    expect(entry?.logicalKeyHash).toMatch(/^[a-f0-9]{16}$/)
    expect(entry?.attemptHash).toMatch(/^[a-f0-9]{16}$/)
    expect(entry?.attemptHashes).toHaveLength(2)
    expect(JSON.stringify(entry)).not.toContain('verdict-1')
    expect(JSON.stringify(entry)).not.toContain('condition-1')
  })

  it('restores bounded delivery state without changing its identity', () => {
    const source = new DeliveryLedger()
    source.record({ verdictId: 'verdict-2', conditionGeneration: 'condition-2', sink: 'browser', attemptId: 'attempt-c', stage: 'constructed', observedAt: '2026-09-04T00:00:00.000Z' })

    const restored = new DeliveryLedger()
    restored.restore(source.snapshot())

    expect(restored.snapshot()).toEqual(source.snapshot())
    expect(restored.size()).toBe(1)
  })

  it('arbitrates a logical delivery with an expiring server-side claim', () => {
    const ledger = new DeliveryLedger()
    const base = Date.parse('2026-09-04T00:00:00.000Z')
    const at = (offset: number) => new Date(base + offset).toISOString()
    const logical = { verdictId: 'verdict-claim', conditionGeneration: 'condition-1', sink: 'browser' as const }

    expect(ledger.claim({ ...logical, clientInstance: 'tab-a', claimedAt: at(0), expiresAt: at(30_000) }).outcome).toBe('granted')
    expect(ledger.claim({ ...logical, clientInstance: 'tab-b', claimedAt: at(1_000), expiresAt: at(31_000) }).outcome).toBe('already-claimed')
    expect(ledger.snapshot()[0]).toMatchObject({ state: 'planned', attempts: 0, attemptHashes: [] })

    ledger.record({ ...logical, attemptId: 'attempt-a', stage: 'constructed', observedAt: at(2_000) })
    expect(ledger.claim({ ...logical, clientInstance: 'tab-b', claimedAt: at(3_000), expiresAt: at(33_000) }).outcome).toBe('already-complete')
    expect(ledger.claim({ ...logical, clientInstance: 'tab-a', claimedAt: at(4_000), expiresAt: at(34_000) }).outcome).toBe('already-complete')
  })

  it('allows a bounded retry after an expired claim and clears failed claims', () => {
    const ledger = new DeliveryLedger()
    const base = Date.parse('2026-09-04T00:00:00.000Z')
    const at = (offset: number) => new Date(base + offset).toISOString()
    const logical = { verdictId: 'verdict-retry', conditionGeneration: 'condition-1', sink: 'browser' as const }

    expect(ledger.claim({ ...logical, clientInstance: 'tab-a', claimedAt: at(0), expiresAt: at(30_000) }).outcome).toBe('granted')
    expect(ledger.claim({ ...logical, clientInstance: 'tab-b', claimedAt: at(31_000), expiresAt: at(61_000) }).outcome).toBe('granted')
    ledger.record({ ...logical, attemptId: 'attempt-b', stage: 'error', observedAt: at(32_000) })
    const [failed] = ledger.snapshot()
    expect(failed).toMatchObject({ state: 'failed', attempts: 1 })
    expect(failed).not.toHaveProperty('claimOwnerHash')
    expect(failed).not.toHaveProperty('claimExpiresAt')
  })

  it('stops claiming after three server-side opportunities when callbacks never arrive', () => {
    const ledger = new DeliveryLedger()
    const base = Date.parse('2026-09-04T00:00:00.000Z')
    const at = (offset: number) => new Date(base + offset).toISOString()
    const logical = { verdictId: 'verdict-no-callback', conditionGeneration: 'condition-1', sink: 'browser' as const }

    expect(ledger.claim({ ...logical, clientInstance: 'tab-a', claimedAt: at(0), expiresAt: at(30_000) }).outcome).toBe('granted')
    expect(ledger.claim({ ...logical, clientInstance: 'tab-b', claimedAt: at(30_001), expiresAt: at(60_001) }).outcome).toBe('granted')
    expect(ledger.claim({ ...logical, clientInstance: 'tab-c', claimedAt: at(60_002), expiresAt: at(90_002) }).outcome).toBe('granted')
    expect(ledger.claim({ ...logical, clientInstance: 'tab-d', claimedAt: at(90_003), expiresAt: at(120_003) }).outcome).toBe('unavailable')
    expect(ledger.snapshot()[0]).toMatchObject({ state: 'planned', claimAttempts: 3 })
  })

  it('does not let a delayed failure from an old attempt steal a newer claim', () => {
    const ledger = new DeliveryLedger()
    const base = Date.parse('2026-09-04T00:00:00.000Z')
    const at = (offset: number) => new Date(base + offset).toISOString()
    const logical = { verdictId: 'verdict-delayed-failure', conditionGeneration: 'condition-1', sink: 'browser' as const }

    expect(ledger.claim({ ...logical, clientInstance: 'tab-a', claimedAt: at(0), expiresAt: at(30_000) }).outcome).toBe('granted')
    expect(ledger.claim({ ...logical, clientInstance: 'tab-b', claimedAt: at(31_000), expiresAt: at(61_000) }).outcome).toBe('granted')
    ledger.record({ ...logical, attemptId: 'attempt-a', stage: 'error', observedAt: at(10_000) })
    expect(ledger.snapshot()[0]).toMatchObject({ state: 'planned', claimAttempts: 2, claimExpiresAt: at(61_000) })
    expect(ledger.claim({ ...logical, clientInstance: 'tab-c', claimedAt: at(32_000), expiresAt: at(62_000) }).outcome).toBe('already-claimed')
  })
})
