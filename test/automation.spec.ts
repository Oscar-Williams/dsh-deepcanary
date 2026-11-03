import { describe, expect, it } from 'vitest'
import { AutomationTracker, selectAutomationDelivery } from '../src/adapters/automation.js'

const receipt = { scheduledAt: '2026-11-03T00:00:00.000Z', deliveredAt: '2026-11-03T00:00:01.000Z', messageId: 'message-next' }
const event = (seq: number, type: string, data: object) => ({ seq, type, data })
describe('public automation receipts and execution', () => {
  it.each([
    { id: 'schedule-1', sessionId: 'reused', lastDelivery: receipt },
    { id: 'schedule-1', target: { kind: 'new' }, lastDelivery: { ...receipt, targetSessionId: 'reused' } },
  ])('keeps delivery separate from an old turn and joins the exact admitted message', task => {
    const tracker = new AutomationTracker()
    tracker.observeCatalog([task])
    tracker.observeSession('reused', [event(0, 'turn/start', { turn: 1 }), event(1, 'turn/end', { turn: 1, reason: { kind: 'completed' } })])
    expect(tracker.snapshot()[0]?.phase).toBe('delivered')
    const history = [event(2, 'turn/start', { turn: 2 }), event(3, 'user/message', { id: 'message-next', content: 'private prompt' }),
      event(4, 'turn/end', { turn: 1, reason: { kind: 'completed' } })]
    tracker.observeSession('reused', history)
    expect(tracker.snapshot()[0]).toMatchObject({ phase: 'running', triggerSeq: 3, turn: 2 })
    tracker.observeSession('reused', [...history, event(5, 'turn/end', { turn: 2, reason: { kind: 'completed' } })])
    expect(tracker.snapshot()[0]?.phase).toBe('completed')
    expect(JSON.stringify(tracker.snapshot())).not.toContain('private prompt')
  })
  it('keeps consecutive occurrences distinct when the session is reused', () => {
    const tracker = new AutomationTracker()
    tracker.observeCatalog([{ id: 'schedule', sessionId: 'same', lastDelivery: receipt }])
    tracker.observeCatalog([{ id: 'schedule', sessionId: 'same', lastDelivery: { ...receipt, messageId: 'message-later' } }])
    tracker.observeSession('same', [event(0, 'turn/start', { turn: 1 }), event(1, 'user/message', { id: 'message-next' }),
      event(2, 'turn/end', { turn: 1, reason: { kind: 'completed' } })])
    expect(tracker.snapshot().map(run => run.phase)).toEqual(['completed', 'delivered'])
    expect(new Set(tracker.snapshot().map(run => run.executionGeneration)).size).toBe(2)
    const restored = new AutomationTracker(); restored.restore(tracker.snapshot())
    expect(restored.snapshot()).toEqual(tracker.snapshot())
  })
  it('does not attribute a later turn to an interrupted observation', () => {
    const tracker = new AutomationTracker()
    tracker.observeCatalog([{ id: 'schedule', sessionId: 'same', lastDelivery: receipt }])
    tracker.observeSession('same', [event(0, 'turn/start', { turn: 1 }), event(1, 'user/message', { id: 'message-next' }),
      event(2, 'turn/start', { turn: 2 }), event(3, 'turn/end', { turn: 2, reason: { kind: 'completed' } })])
    expect(tracker.snapshot()[0]?.phase).toBe('unknown')
    expect(tracker.taskForEvent('same', 3)).toBeUndefined()
  })
  it('selects metadata without retaining raw catalog content', () => {
    const selected = selectAutomationDelivery({ id: 's', sessionId: 'same', title: 'private title', prompt: 'private secret',
      lastDelivery: { ...receipt, prompt: 'private secret', error: 'C:/private/API_KEY' } })
    expect(selected).toBeDefined()
    expect(JSON.stringify(selected)).not.toMatch(/private|API_KEY/)
  })
})
