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
})
