import { describe, expect, it } from 'vitest'
import { signalFromHostProbe, signalsFromSessionEvent } from '../src/providers.js'

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
})
