import type { Context } from '@deepseek-ai/cordis';
import type { DeepCanaryConfigInput } from './config.js';
import { ContextDshAdapter } from './adapters/dsh.js';
import { MetadataStore, SuppressionStore } from './persistence.js';
import { OutcomeStore } from './outcome.js';
import type { CanarySignal, DeepCanaryConfig, DryRunRequest, DryRunResult, FeedbackValue, InboxItem, PublicInboxItem, PublicSettings, PublicSnapshot, OutcomeReceipt, OutcomeDeleteFilter, OutcomeReceiptInput, RuntimeStatus, SuppressibleReasonCode } from './types.js';
declare const PLUGIN_NAME = "dsh-deepcanary";
declare const PLUGIN_VERSION = "0.1.0-rc.4";
interface ActionReceipt {
    status: number;
    body: Record<string, unknown>;
    fingerprint: string;
}
export declare class DeepCanaryService {
    config: DeepCanaryConfig;
    readonly store: MetadataStore;
    readonly suppressionStore: SuppressionStore;
    readonly outcomeStore: OutcomeStore;
    readonly workspace: import("./types.js").WorkspaceIdentity;
    readonly adapter: ContextDshAdapter;
    readonly ready: Promise<void>;
    private readonly ctx;
    private readonly sessions;
    private readonly items;
    private readonly suppressedReasons;
    private readonly dedupe;
    private readonly budget;
    private readonly pressureSeen;
    private readonly logger;
    private adapterSubscription;
    private activeSubagents;
    private registeredTools;
    private interval;
    private hostProbeInterval;
    private hostProbePort;
    private hostProbeFailures;
    private hostProbeHealthy;
    private settingsScope;
    private settingsProvider;
    private settingsSource;
    private settingsSubscription;
    private saveChain;
    private hydrated;
    private disposed;
    private started;
    private revision;
    private readonly actionReceipts;
    private readonly outcomeReceipts;
    private outcomeSaveChain;
    private suppressionSaveChain;
    constructor(ctx: Context, input?: DeepCanaryConfigInput);
    start(): void;
    setRegisteredTools(names: readonly string[]): void;
    ingest(signal: CanarySignal): Promise<InboxItem | undefined>;
    snapshot(): PublicSnapshot;
    status(): RuntimeStatus;
    settings(): PublicSettings;
    updateSettings(input: Record<string, unknown>): Promise<PublicSettings>;
    inbox(limit?: number): PublicInboxItem[];
    /** Record one redacted decision outcome for a local, controlled, or replay trial. */
    recordOutcome(id: string, input: unknown): Promise<OutcomeReceipt | undefined>;
    outcomes(limit?: number, source?: OutcomeReceiptInput['source'], trialId?: string): OutcomeReceipt[];
    /** Permanently remove only records selected by an explicit trial or retention cutoff. */
    deleteOutcomes(filter: OutcomeDeleteFilter): Promise<number>;
    seen(id: string): boolean;
    acknowledge(id: string): boolean;
    snooze(id: string, minutes?: number): boolean;
    mute(id: string): boolean;
    /** End a temporary mute immediately while retaining the Inbox item. */
    unmute(id: string): boolean;
    /** Persistently silence the current low-risk event class for future signals. */
    suppress(id: string): {
        updated: boolean;
        reasonCode?: SuppressibleReasonCode;
    };
    /** Restore notifications for a previously silenced low-risk event class. */
    unsuppress(reasonCode: string): boolean;
    feedback(id: string, useful: boolean, note?: string, value?: FeedbackValue): boolean;
    explain(id: string): PublicInboxItem | undefined;
    /** Preview current and candidate policy outcomes without touching state or DSH. */
    dryRun(input: DryRunRequest): Promise<DryRunResult>;
    jump(id: string): {
        sessionId?: string;
        url?: string;
        available: boolean;
        note: string;
    };
    /** Apply one browser action exactly once for its request id. */
    performAction(requestId: string, id: string, action: string, payload?: Record<string, unknown>): Promise<ActionReceipt>;
    recordHostProbe(ok: boolean, detail?: string): void;
    private probeHost;
    dispose(): Promise<void>;
    private hydrate;
    private onSessionCreated;
    private onSessionDisposed;
    private onSessionEvent;
    private onSubagentDelta;
    private checkStalls;
    private findBundle;
    /** Apply delivery policy and reserve one C2 budget unit only for a new interrupt. */
    private applyPolicy;
    private mergeBundle;
    private recover;
    private expireSessionItems;
    private pressureThresholds;
    private applySettings;
    private resetLivenessTimer;
    private resetHostProbeTimer;
    private publicSettings;
    private safeVerdict;
    private isQuietHours;
    private toPublic;
    private isPending;
    private normalizeLifecycle;
    private find;
    private bumpRevision;
    private queueSave;
    private updateExistingOutcome;
    private queueOutcomeSave;
    private queueSuppressionSave;
}
export { PLUGIN_NAME, PLUGIN_VERSION };
//# sourceMappingURL=service.d.ts.map