import { describe, expect, it } from 'vitest'
import { signalFromHostProbe, signalFromStallRecovery, signalsFromSessionEvent } from '../src/providers.js'

const session = { id: 'session-1', header: { cwd: 'C:\\work' } }
const facts = { toolFailures: 3, activeSubagents: 0, lastEventAt: 1_000, startedAt: 1_000 }

describe('runtime providers', () => {
  it('converts DSH turn and tool facts into stable signals', () => {
    expect(signalsFromSessionEvent(session, { type: 'turn/end', seq: 4, time: 2_000, data: { reason: 'blocked' } }, facts)[0]).toMatchObject({ kind: 'HUMAN_QUESTION_PENDING', source: 'session' })
    expect(signalsFromSessionEvent(session, { type: 'tool/result', seq: 5, time: 2_100, data: { error: { code: 'EFAIL' } } }, facts)[0]).toMatchObject({ kind: 'TOOL_FAILURE_LOOP', source: 'tool' })
  })

  it('only emits host failure when the probe is negative', () => {
    expect(signalFromHostProbe(true, 'ok')).toBeUndefined()
    expect(signalFromHostProbe(false, 'web host unavailable')).toMatchObject({ kind: 'HOST_UNREACHABLE', severityHint: 3 })
  })

  it('keeps a suspicious completion as one completion verdict', () => {
    const signals = signalsFromSessionEvent(session, {
      type: 'turn/end',
      seq: 6,
      time: 3_000,
      data: { reason: { kind: 'completed' }, unresolvedApproval: true },
    }, facts)
    expect(signals).toHaveLength(1)
    expect(signals[0]).toMatchObject({ kind: 'COMPLETION_SUSPICIOUS' })
  })

  it('raises repeated compaction to context pressure and keeps recovery unbundled', () => {
    const event = { type: 'context/compaction', time: 4_000, data: { kind: 'compaction' } }
    expect(signalsFromSessionEvent(session, event, { ...facts, contextCompactions: 1 })[0]).toMatchObject({ kind: 'COMPACTION_OCCURRED' })
    expect(signalsFromSessionEvent(session, event, { ...facts, contextCompactions: 2 })[0]).toMatchObject({ kind: 'CONTEXT_PRESSURE' })
    expect(signalFromStallRecovery(session).bundleKey).toBeUndefined()
  })

  it('uses the same-tool failure count when it is available', () => {
    const signals = signalsFromSessionEvent(session, {
      type: 'tool/result',
      seq: 7,
      time: 5_000,
      data: { error: { code: 'EFAIL' } },
    }, { ...facts, toolFailures: 9, sameToolFailures: 2, lastToolName: 'read' })
    expect(signals).toHaveLength(0)
    expect(signalsFromSessionEvent(session, {
      type: 'tool/result',
      seq: 8,
      time: 5_001,
      data: { error: { code: 'EFAIL' } },
    }, { ...facts, toolFailures: 9, sameToolFailures: 3, lastToolName: 'read' })[0]).toMatchObject({ kind: 'TOOL_FAILURE_LOOP' })
  })
})
