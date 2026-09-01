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

  it('distinguishes an authoritative human wait from a heuristic approval hint', () => {
    expect(signalsFromSessionEvent(session, {
      type: 'approval/asked',
      seq: 10,
      time: 3_100,
      data: { toolName: 'bash' },
    }, facts)[0]).toMatchObject({
      kind: 'HUMAN_APPROVAL_REQUIRED',
      severityHint: 3,
      evidence: [{ type: 'session-event', authority: 'runtime' }],
    })
    expect(signalsFromSessionEvent(session, {
      type: 'approval/decided',
      seq: 11,
      time: 3_200,
      data: { toolName: 'bash', outcome: 'allowed-once' },
    }, facts)).toEqual([])
    expect(signalsFromSessionEvent(session, {
      type: 'tool/call',
      seq: 12,
      time: 3_300,
      data: { name: 'permission-check' },
    }, facts)[0]).toMatchObject({ kind: 'HUMAN_APPROVAL_REQUIRED', severityHint: 2, evidence: [{ authority: 'heuristic' }] })
    expect(signalsFromSessionEvent(session, {
      type: 'tool/call',
      seq: 13,
      time: 3_400,
      data: { name: 'ask_user_question' },
    }, facts)[0]).toMatchObject({ kind: 'HUMAN_QUESTION_PENDING', severityHint: 3 })
  })

  it('raises repeated compaction to context pressure and keeps recovery unbundled', () => {
    const event = { type: 'context/compaction', time: 4_000, data: { kind: 'compaction' } }
    expect(signalsFromSessionEvent(session, event, { ...facts, contextCompactions: 1 })[0]).toMatchObject({ kind: 'COMPACTION_OCCURRED' })
    expect(signalsFromSessionEvent(session, event, { ...facts, contextCompactions: 2 })[0]).toMatchObject({ kind: 'CONTEXT_PRESSURE' })
    expect(signalFromStallRecovery(session).bundleKey).toBe('session-1:stall')
  })

  it('does not turn DSH ignorable events into attention signals', () => {
    expect(signalsFromSessionEvent(session, { type: 'turn/end', seq: 9, ignorable: true, data: { reason: 'blocked' } }, facts)).toEqual([])
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
