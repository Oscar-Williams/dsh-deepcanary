import Schema from '@deepseek-ai/schemastery'
import type { DeepCanaryConfig, QuietHours } from './types.js'

export interface DeepCanaryConfigInput extends Partial<Omit<DeepCanaryConfig, 'quietHours'>> {
  quietHours?: Partial<QuietHours>
}

export const Config = Schema.object({
  stateDir: Schema.string().default('~/.dsh/dsh-deepcanary').description('Metadata-only local state directory'),
  notificationLevel: Schema.union(['C1', 'C2', 'C3'] as const).default('C2').description('Highest level allowed to notify the user'),
  openOnCritical: Schema.boolean().default(false).description('Open the DeepCanary panel for allowlisted C3 events'),
  maxInterruptsPerHour: Schema.natural().min(0).max(10).default(3).description('C2 interrupt budget per rolling hour'),
  dedupeWindowMinutes: Schema.natural().min(0).max(120).default(10).description('Dedupe window for equivalent signals'),
  bundleWindowSeconds: Schema.natural().min(0).max(900).default(60).description('Window for bundling adjacent attention items'),
  longRunThresholdMinutes: Schema.natural().min(1).max(120).default(5).description('Idle threshold before a running session is checked for a stall'),
  subagentPressure: Schema.union(['relaxed', 'standard', 'strict'] as const).default('standard').description('Subagent pressure thresholds'),
  quietHours: Schema.object({
    enabled: Schema.boolean().default(false),
    start: Schema.string().default('22:00'),
    end: Schema.string().default('08:00'),
  }).default({ enabled: false, start: '22:00', end: '08:00' }),
  privacySafeSummary: Schema.boolean().default(true).description('Keep content and prompts out of plugin state and notifications'),
  healthPollSeconds: Schema.natural().min(5).max(300).default(15).description('Local liveness check interval'),
  maxInboxItems: Schema.natural().min(50).max(5000).default(500).description('Maximum retained metadata inbox items'),
  supervisorMode: Schema.union(['off', 'experimental'] as const).default('off').description('Persistent Supervisor lifecycle; experimental is an explicit engineering opt-in'),
})

const defaults: DeepCanaryConfig = {
  stateDir: '~/.dsh/dsh-deepcanary',
  notificationLevel: 'C2',
  openOnCritical: false,
  maxInterruptsPerHour: 3,
  dedupeWindowMinutes: 10,
  bundleWindowSeconds: 60,
  longRunThresholdMinutes: 5,
  subagentPressure: 'standard',
  quietHours: { enabled: false, start: '22:00', end: '08:00' },
  privacySafeSummary: true,
  healthPollSeconds: 15,
  maxInboxItems: 500,
  supervisorMode: 'off',
}

export function normalizeConfig(input: DeepCanaryConfigInput | undefined): DeepCanaryConfig {
  const quietHours = input?.quietHours
  return {
    ...defaults,
    ...input,
    quietHours: {
      ...defaults.quietHours,
      ...quietHours,
    },
  }
}

function integerPatch(value: unknown, name: string, min: number, max: number): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value)) throw new TypeError(`${name} must be an integer`)
  if (value < min || value > max) throw new RangeError(`${name} must be between ${min} and ${max}`)
  return value
}

function clockPatch(value: unknown, name: string): string {
  if (typeof value !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(value)) throw new TypeError(`${name} must use HH:MM format`)
  return value
}

/** Validate the browser settings surface without exposing stateDir or unknown keys. */
export function sanitizeConfigPatch(input: Record<string, unknown>): DeepCanaryConfigInput {
  const patch: DeepCanaryConfigInput = {}
  for (const key of Object.keys(input)) {
    if (!['notificationLevel', 'openOnCritical', 'maxInterruptsPerHour', 'dedupeWindowMinutes', 'bundleWindowSeconds', 'longRunThresholdMinutes', 'subagentPressure', 'quietHours', 'privacySafeSummary', 'healthPollSeconds', 'maxInboxItems', 'supervisorMode'].includes(key)) {
      throw new TypeError(`unsupported setting: ${key}`)
    }
  }
  if (input.notificationLevel !== undefined) {
    if (input.notificationLevel !== 'C1' && input.notificationLevel !== 'C2' && input.notificationLevel !== 'C3') throw new TypeError('notificationLevel must be C1, C2, or C3')
    patch.notificationLevel = input.notificationLevel
  }
  if (input.openOnCritical !== undefined) {
    if (typeof input.openOnCritical !== 'boolean') throw new TypeError('openOnCritical must be boolean')
    patch.openOnCritical = input.openOnCritical
  }
  if (input.maxInterruptsPerHour !== undefined) patch.maxInterruptsPerHour = integerPatch(input.maxInterruptsPerHour, 'maxInterruptsPerHour', 0, 10)
  if (input.dedupeWindowMinutes !== undefined) patch.dedupeWindowMinutes = integerPatch(input.dedupeWindowMinutes, 'dedupeWindowMinutes', 0, 120)
  if (input.bundleWindowSeconds !== undefined) patch.bundleWindowSeconds = integerPatch(input.bundleWindowSeconds, 'bundleWindowSeconds', 0, 900)
  if (input.longRunThresholdMinutes !== undefined) patch.longRunThresholdMinutes = integerPatch(input.longRunThresholdMinutes, 'longRunThresholdMinutes', 1, 120)
  if (input.subagentPressure !== undefined) {
    if (input.subagentPressure !== 'relaxed' && input.subagentPressure !== 'standard' && input.subagentPressure !== 'strict') throw new TypeError('subagentPressure must be relaxed, standard, or strict')
    patch.subagentPressure = input.subagentPressure
  }
  if (input.quietHours !== undefined) {
    if (input.quietHours === null || typeof input.quietHours !== 'object') throw new TypeError('quietHours must be an object')
    const quietHours = input.quietHours as Record<string, unknown>
    for (const key of Object.keys(quietHours)) if (!['enabled', 'start', 'end'].includes(key)) throw new TypeError(`unsupported quiet-hours setting: ${key}`)
    if (quietHours.enabled !== undefined && typeof quietHours.enabled !== 'boolean') throw new TypeError('quietHours.enabled must be boolean')
    patch.quietHours = {
      ...(quietHours.enabled === undefined ? {} : { enabled: quietHours.enabled }),
      ...(quietHours.start === undefined ? {} : { start: clockPatch(quietHours.start, 'quietHours.start') }),
      ...(quietHours.end === undefined ? {} : { end: clockPatch(quietHours.end, 'quietHours.end') }),
    }
  }
  if (input.privacySafeSummary !== undefined) {
    if (typeof input.privacySafeSummary !== 'boolean') throw new TypeError('privacySafeSummary must be boolean')
    patch.privacySafeSummary = input.privacySafeSummary
  }
  if (input.healthPollSeconds !== undefined) patch.healthPollSeconds = integerPatch(input.healthPollSeconds, 'healthPollSeconds', 5, 300)
  if (input.maxInboxItems !== undefined) patch.maxInboxItems = integerPatch(input.maxInboxItems, 'maxInboxItems', 50, 5000)
  if (input.supervisorMode !== undefined) {
    if (input.supervisorMode !== 'off' && input.supervisorMode !== 'experimental') throw new TypeError('supervisorMode must be off or experimental')
    patch.supervisorMode = input.supervisorMode
  }
  return patch
}
