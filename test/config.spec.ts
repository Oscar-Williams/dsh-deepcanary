import { describe, expect, it } from 'vitest'
import { Config, normalizeConfig, sanitizeConfigPatch } from '../src/config.js'

describe('DeepCanary settings boundary', () => {
  it('accepts the public settings surface and never accepts stateDir', () => {
    expect(sanitizeConfigPatch({
      notificationLevel: 'C1',
      openOnCritical: true,
      maxInterruptsPerHour: 0,
      supervisorMode: 'experimental',
      quietHours: { enabled: true, start: '23:00', end: '07:00' },
    })).toEqual({
      notificationLevel: 'C1',
      openOnCritical: true,
      maxInterruptsPerHour: 0,
      supervisorMode: 'experimental',
      quietHours: { enabled: true, start: '23:00', end: '07:00' },
    })
    expect(() => sanitizeConfigPatch({ stateDir: 'C:\\secrets' })).toThrow(/unsupported setting/)
  })

  it('rejects invalid ranges and preserves defaults for partial config', () => {
    expect(() => sanitizeConfigPatch({ maxInterruptsPerHour: 11 })).toThrow(/between 0 and 10/)
    expect(() => sanitizeConfigPatch({ quietHours: { start: '25:00' } })).toThrow(/HH:MM/)
    expect(normalizeConfig({ quietHours: { enabled: true } }).quietHours).toEqual({ enabled: true, start: '22:00', end: '08:00' })
    expect(normalizeConfig({}).supervisorMode).toBe('off')
    expect(() => sanitizeConfigPatch({ supervisorMode: 'stable' })).toThrow(/supervisorMode/)
    expect(() => Config({ quietHours: { enabled: true, start: '22:00', end: '08:00', timeZone: 'Missing/Zone' } })).toThrow()
    expect(() => Config({ quietHours: { enabled: true, start: '25:00', end: '08:00', timeZone: 'Asia/Shanghai' } })).toThrow()
    expect(sanitizeConfigPatch({ quietHours: { timeZone: 'Asia/Shanghai' } })).toEqual({ quietHours: { timeZone: 'Asia/Shanghai' } })
    expect(normalizeConfig({ maxInboxItems: 5_000 }).maxInboxItems).toBe(500)
  })
})
