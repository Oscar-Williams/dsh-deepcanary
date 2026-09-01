import type { Context } from '@deepseek-ai/cordis';
import type { DeepCanaryConfigInput } from './config.js';
import { ContextDshAdapter } from './adapters/dsh.js';
import { MetadataStore } from './persistence.js';
import { OutcomeStore } from './outcome.js';
import type { CanarySignal, DeepCanaryConfig, DryRunRequest, DryRunResult, InboxItem, PublicInboxItem, PublicSettings, PublicSnapshot, OutcomeReceipt, OutcomeDeleteFilter, OutcomeReceiptInput, RuntimeStatus } from './types.js';
declare const PLUGIN_NAME = "dsh-deepcanary";
declare const PLUGIN_VERSION = "0.1.0-rc.3";
interface ActionReceipt {
    status: number;
    body: Record<string, unknown>;
    fingerprint: string;
}
export declare class DeepCanaryService {
    config: DeepCanaryConfig;
    readonly store: MetadataStore;
    readonly outcomeStore: OutcomeStore;
    readonly workspace: import("./types.js").WorkspaceIdentity;
    readonly adapter: ContextDshAdapter;
    readonly ready: Promise<void>;
    private readonly ctx;
    private readonly sessions;
    private readonly items;
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
    feedback(id: string, useful: boolean, note?: string): boolean;
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
}
export { PLUGIN_NAME, PLUGIN_VERSION };
//# sourceMappingURL=service.d.ts.map