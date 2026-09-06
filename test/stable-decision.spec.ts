import { describe, expect, it } from 'vitest'
import { decideStableDecision } from '../src/stableDecision.js'

const ready = {
  gateDReady: true,
  gateEReady: true,
  implementationPresent: true,
  replayPass: true,
  replayObserved: true,
  supervisorSmokePass: true,
  supervisorSmokeObserved: true,
  realDogfoodStatus: 'pass',
  optionalExceptions: [],
}

describe('stable decision boundary', () => {
  it('returns Stable when every declared gate is complete', () => {
    expect(decideStableDecision(ready)).toEqual({ decision: 'STABLE_READY', reasons: [] })
  })

  it('keeps optional evidence gaps explicit as exceptions', () => {
    expect(decideStableDecision({ ...ready, optionalExceptions: ['wsl-evidence-pending'] })).toEqual({
      decision: 'STABLE_WITH_EXCEPTIONS',
      reasons: ['wsl-evidence-pending'],
    })
  })

  it('continues the RC when evidence is incomplete', () => {
    expect(decideStableDecision({ ...ready, gateDReady: false, replayObserved: false })).toEqual({
      decision: 'CONTINUE_RC',
      reasons: ['gate-d-not-ready'],
    })
  })

  it('holds on an observed core failure', () => {
    expect(decideStableDecision({ ...ready, replayPass: false })).toEqual({
      decision: 'HOLD',
      reasons: ['policy-replay-failed'],
    })
  })
})
