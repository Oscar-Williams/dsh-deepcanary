/** Stable reason codes emitted by DeepCanary providers. */
export type ReasonCode = 'HUMAN_APPROVAL_REQUIRED' | 'HUMAN_QUESTION_PENDING' | 'HOST_UNREACHABLE' | 'HOST_SUSPECTED_STALL' | 'TOOL_FAILURE_LOOP' | 'NO_MEANINGFUL_PROGRESS' | 'SUBAGENT_PRESSURE' | 'CONTEXT_PRESSURE' | 'COMPACTION_OCCURRED' | 'TASK_COMPLETED' | 'TASK_FAILED' | 'TASK_ABORTED' | 'COMPLETION_SUSPICIOUS' | 'HOST_STALL_RECOVERED';
/** Version of the browser-facing state/action contract. */
export declare const ATTENTION_PROTOCOL_VERSION = 2;
/** Version of the deterministic attention policy used to create verdicts. */
export declare const ATTENTION_POLICY_VERSION = "attention-policy.v1";
/** Values safe to expose as interpolation parameters in localized copy. */
export type MessageParams = Record<string, string | number | boolean>;
export type AttentionLevel = 'C0' | 'C1' | 'C2' | 'C3';
export type AttentionAction = 'IGNORE' | 'INBOX' | 'DIGEST' | 'INTERRUPT' | 'ESCALATE';
export type EvidenceType = 'session-event' | 'runtime-probe' | 'tool-history' | 'subagent-state' | 'http-probe' | 'process-probe' | 'user-policy' | 'model-judgment';
export type EvidenceAuthority = 'host' | 'runtime' | 'derived' | 'heuristic';
export interface EvidenceRef {
    type: EvidenceType;
    authority: EvidenceAuthority;
    ref: string;
    summary: string;
}
/** A privacy-safe explanation of how one deterministic policy decision was reached. */
export interface PolicyDecisionTrace {
    schemaVersion: 1;
    policyVersion: string;
    verdictId: string;
    matchedRules: string[];
    appliedScopes: string[];
    suppressedBy: string[];
    bundledWith?: {
        eventCount: number;
        reasonCodes: ReasonCode[];
    };
    authoritySummary: {
        strongest: EvidenceAuthority;
        counts: Record<EvidenceAuthority, number>;
    };
    finalLevel: AttentionLevel;
    finalAction: AttentionAction;
    recoveryRule?: string;
}
/** The normalized, lossless-free signal exchanged inside the plugin. */
export interface CanarySignal {
    schemaVersion: 1;
    id: string;
    occurredAt: string;
    source: 'session' | 'agent' | 'subagent' | 'tool' | 'host' | 'windows' | 'usage' | 'external';
    kind: ReasonCode;
    sessionId?: string;
    workspaceId?: string;
    severityHint?: 0 | 1 | 2 | 3;
    evidence: EvidenceRef[];
    dedupeKey?: string;
    /** Optional root-cause key used to combine adjacent attention items. */
    bundleKey?: string;
    data: Record<string, string | number | boolean | undefined>;
}
export interface AttentionVerdict {
    schemaVersion: typeof ATTENTION_PROTOCOL_VERSION;
    eventId: string;
    level: AttentionLevel;
    action: AttentionAction;
    confidence: number;
    reasonCode: ReasonCode;
    messageKey: string;
    messageParams?: MessageParams;
    suggestionKey?: string;
    policyVersion: string;
    why: string;
    suggestedAction?: string;
    evidence: EvidenceRef[];
    decisionTrace?: PolicyDecisionTrace;
}
export type InboxStatus = 'open' | 'seen' | 'acknowledged' | 'snoozed' | 'muted' | 'recovered' | 'expired';
export interface InboxItem extends AttentionVerdict {
    id: string;
    sessionId?: string;
    workspaceId?: string;
    /** Hashes retained across restart so live sessions can be re-associated without persisting raw IDs. */
    sessionRef?: string;
    workspaceRef?: string;
    occurredAt: string;
    status: InboxStatus;
    snoozedUntil?: string;
    seenAt?: string;
    acknowledgedAt?: string;
    recoveredAt?: string;
    expiredAt?: string;
    feedback?: {
        useful: boolean;
        note?: string;
        at: string;
    };
    /** Internal privacy-safe hash used to join adjacent events. */
    bundleKey?: string;
    bundleCount: number;
    reasonCodes: ReasonCode[];
}
export interface QuietHours {
    enabled: boolean;
    start: string;
    end: string;
}
export interface DeepCanaryConfig {
    stateDir: string;
    notificationLevel: 'C1' | 'C2' | 'C3';
    openOnCritical: boolean;
    maxInterruptsPerHour: number;
    dedupeWindowMinutes: number;
    bundleWindowSeconds: number;
    longRunThresholdMinutes: number;
    subagentPressure: 'relaxed' | 'standard' | 'strict';
    quietHours: QuietHours;
    privacySafeSummary: boolean;
    healthPollSeconds: number;
    maxInboxItems: number;
}
export interface WorkspaceIdentity {
    canonicalId: string;
    hostPath?: string;
    wslPath?: string;
    platform: 'windows' | 'wsl' | 'other';
    windowsInterop: 'available' | 'unavailable' | 'unknown';
    nativeToast: 'available' | 'unavailable';
}
export interface PublicSettings {
    notificationLevel: 'C1' | 'C2' | 'C3';
    openOnCritical: boolean;
    maxInterruptsPerHour: number;
    dedupeWindowMinutes: number;
    bundleWindowSeconds: number;
    longRunThresholdMinutes: number;
    subagentPressure: 'relaxed' | 'standard' | 'strict';
    quietHours: QuietHours;
    privacySafeSummary: boolean;
    healthPollSeconds: number;
    maxInboxItems: number;
}
export interface RuntimeStatus {
    plugin: {
        name: string;
        version: string;
        state: 'ready' | 'loading' | 'degraded';
    };
    process: {
        platform: string;
        node: string;
    };
    workspace: WorkspaceIdentity;
    sessions: number;
    tools: string[];
    openInbox: number;
    revision: number;
    indicator: 'gray' | 'yellow' | 'orange' | 'red';
    capabilities: {
        browserNotification: boolean;
        nativeToast: boolean;
        windowsInterop: 'available' | 'unavailable' | 'unknown';
        destructiveActions: false;
    };
}
export interface PublicInboxItem {
    id: string;
    sessionId?: string;
    occurredAt: string;
    level: AttentionLevel;
    action: AttentionAction;
    reasonCode: ReasonCode;
    messageKey: string;
    messageParams?: MessageParams;
    suggestionKey?: string;
    policyVersion: string;
    why: string;
    suggestedAction?: string;
    evidence: Array<Pick<EvidenceRef, 'type' | 'authority' | 'summary'>>;
    decisionTrace?: PolicyDecisionTrace;
    status: InboxStatus;
    snoozedUntil?: string;
    seenAt?: string;
    acknowledgedAt?: string;
    recoveredAt?: string;
    expiredAt?: string;
    bundleCount: number;
    reasonCodes: ReasonCode[];
}
/** Structured input accepted by the read-only Policy Dry-run surface. */
export interface DryRunSignalInput {
    id?: string;
    kind: ReasonCode;
    authority: EvidenceAuthority;
    severityHint?: 0 | 1 | 2 | 3;
    healthy?: boolean;
    userViewing?: boolean;
    threshold?: number;
    failureCount?: number;
    activeSubagents?: number;
    idleMs?: number;
}
export interface DryRunPolicyInput {
    notificationLevel?: 'C1' | 'C2' | 'C3';
    quietHours?: Partial<QuietHours>;
}
export interface DryRunRequest {
    signal: DryRunSignalInput;
    candidate?: DryRunPolicyInput;
}
export interface DryRunDifference {
    field: 'level' | 'action' | 'reasonCode';
    current: string;
    candidate: string;
}
export interface DryRunResult {
    schemaVersion: 1;
    mode: 'dry-run';
    readOnly: true;
    generatedAt: string;
    input: DryRunSignalInput;
    current: AttentionVerdict;
    candidate: AttentionVerdict;
    differences: DryRunDifference[];
    changed: boolean;
}
export interface PublicSnapshot {
    schemaVersion: typeof ATTENTION_PROTOCOL_VERSION;
    revision: number;
    generatedAt: string;
    status: RuntimeStatus;
    settings: PublicSettings;
    inbox: PublicInboxItem[];
}
//# sourceMappingURL=types.d.ts.map