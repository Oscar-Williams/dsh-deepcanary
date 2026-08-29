/** Stable reason codes emitted by DeepCanary providers. */
export type ReasonCode =
  | 'HUMAN_APPROVAL_REQUIRED'
  | 'HUMAN_QUESTION_PENDING'
  | 'HOST_UNREACHABLE'
  | 'HOST_SUSPECTED_STALL'
  | 'TOOL_FAILURE_LOOP'
  | 'NO_MEANINGFUL_PROGRESS'
  | 'SUBAGENT_PRESSURE'
  | 'CONTEXT_PRESSURE'
  | 'COMPACTION_OCCURRED'
  | 'TASK_COMPLETED'
  | 'TASK_FAILED'
  | 'TASK_ABORTED'
  | 'COMPLETION_SUSPICIOUS'

export type AttentionLevel = 'C0' | 'C1' | 'C2' | 'C3'
export type AttentionAction = 'IGNORE' | 'INBOX' | 'DIGEST' | 'INTERRUPT' | 'ESCALATE'
export type EvidenceType =
  | 'session-event'
  | 'runtime-probe'
  | 'tool-history'
  | 'subagent-state'
  | 'http-probe'
  | 'process-probe'
  | 'user-policy'
  | 'model-judgment'
export type EvidenceAuthority = 'host' | 'runtime' | 'derived' | 'heuristic'

export interface EvidenceRef {
  type: EvidenceType
  authority: EvidenceAuthority
  ref: string
  summary: string
}

/** The normalized, lossless-free signal exchanged inside the plugin. */
export interface CanarySignal {
  schemaVersion: 1
  id: string
  occurredAt: string
  source: 'session' | 'agent' | 'subagent' | 'tool' | 'host' | 'windows' | 'usage' | 'external'
  kind: ReasonCode
  sessionId?: string
  workspaceId?: string
  severityHint?: 0 | 1 | 2 | 3
  evidence: EvidenceRef[]
  dedupeKey?: string
  data: Record<string, string | number | boolean | undefined>
}

export interface AttentionVerdict {
  eventId: string
  level: AttentionLevel
  action: AttentionAction
  confidence: number
  reasonCode: ReasonCode
  why: string
  suggestedAction?: string
  evidence: EvidenceRef[]
}

export type InboxStatus = 'open' | 'acknowledged' | 'snoozed' | 'muted'

export interface InboxItem extends AttentionVerdict {
  id: string
  sessionId?: string
  workspaceId?: string
  occurredAt: string
  status: InboxStatus
  snoozedUntil?: string
  feedback?: {
    useful: boolean
    note?: string
    at: string
  }
}

export interface QuietHours {
  enabled: boolean
  start: string
  end: string
}

export interface DeepCanaryConfig {
  stateDir: string
  notificationLevel: 'C1' | 'C2' | 'C3'
  maxInterruptsPerHour: number
  dedupeWindowMinutes: number
  bundleWindowSeconds: number
  longRunThresholdMinutes: number
  subagentPressure: 'relaxed' | 'standard' | 'strict'
  quietHours: QuietHours
  privacySafeSummary: boolean
  healthPollSeconds: number
  maxInboxItems: number
}

export interface WorkspaceIdentity {
  canonicalId: string
  hostPath?: string
  wslPath?: string
  platform: 'windows' | 'wsl' | 'other'
  nativeToast: 'available' | 'unavailable'
}

export interface RuntimeStatus {
  plugin: {
    name: string
    version: string
    state: 'ready' | 'loading' | 'degraded'
  }
  process: {
    platform: string
    node: string
  }
  workspace: WorkspaceIdentity
  sessions: number
  tools: string[]
  openInbox: number
  indicator: 'gray' | 'yellow' | 'orange' | 'red'
  capabilities: {
    browserNotification: boolean
    nativeToast: boolean
    destructiveActions: false
  }
}

export interface PublicInboxItem {
  id: string
  sessionId?: string
  occurredAt: string
  level: AttentionLevel
  action: AttentionAction
  reasonCode: ReasonCode
  why: string
  suggestedAction?: string
  evidence: Array<Pick<EvidenceRef, 'type' | 'authority' | 'summary'>>
  status: InboxStatus
  snoozedUntil?: string
}

export interface PublicSnapshot {
  status: RuntimeStatus
  inbox: PublicInboxItem[]
}
