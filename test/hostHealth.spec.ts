import { describe, expect, it } from 'vitest'
import { HostProbeEpoch } from '../src/hostHealth.js'

describe('HostProbeEpoch', () => {
  it('opens one debounced outage, emits one recovery edge, and records continued health', () => {
    const probe = new HostProbeEpoch(2, 'test-host')
    expect(probe.status()).toMatchObject({ state: 'healthy', healthy: true, consecutiveFailures: 0 })
    expect(probe.observe(false, 1_000)).toMatchObject({ state: 'healthy', healthy: true, consecutiveFailures: 1, transition: 'none' })
    const opened = probe.observe(false, 2_000)
    expect(opened).toMatchObject({ state: 'outage-open', healthy: false, consecutiveFailures: 2, transition: 'outage-opened' })
    expect(opened.outageId).toMatch(/^[a-f0-9]{16}$/)
    const continuedFailure = probe.observe(false, 3_000)
    expect(continuedFailure).toMatchObject({ state: 'outage-open', healthy: false, consecutiveFailures: 3, outageId: opened.outageId, transition: 'none' })
    const recovered = probe.observe(true, 4_000)
    expect(recovered).toMatchObject({ state: 'recovered', healthy: true, consecutiveFailures: 0, outageId: opened.outageId, transition: 'recovered' })
    expect(probe.observe(true, 5_000)).toMatchObject({ state: 'recovery-continued', healthy: true, outageId: opened.outageId, transition: 'recovery-continued' })
  })

  it('starts a new outage identity after a post-recovery failure epoch', () => {
    const probe = new HostProbeEpoch(1, 'test-host')
    const first = probe.observe(false, 1_000)
    probe.observe(true, 2_000)
    const next = probe.observe(false, 3_000)
    expect(next).toMatchObject({ state: 'outage-open', transition: 'outage-opened' })
    expect(next.outageId).not.toBe(first.outageId)
  })
})
