import Schema from '@deepseek-ai/schemastery'
import type { DeepCanaryConfig, QuietHours } from './types.js'

export interface DeepCanaryConfigInput extends Partial<Omit<DeepCanaryConfig, 'quietHours'>> {
  quietHours?: Partial<QuietHours>
}

export const Config = Schema.object({
  stateDir: Schema.string().default('~/.dsh/dsh-deepcanary').description('Metadata-only local state directory'),
  notificationLevel: Schema.union(['C1', 'C2', 'C3'] as const).default('C2').description('Highest level allowed to notify the user'),
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
})

const defaults: DeepCanaryConfig = {
  stateDir: '~/.dsh/dsh-deepcanary',
  notificationLevel: 'C2',
  maxInterruptsPerHour: 3,
  dedupeWindowMinutes: 10,
  bundleWindowSeconds: 60,
  longRunThresholdMinutes: 5,
  subagentPressure: 'standard',
  quietHours: { enabled: false, start: '22:00', end: '08:00' },
  privacySafeSummary: true,
  healthPollSeconds: 15,
  maxInboxItems: 500,
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
