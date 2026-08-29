type ClientItem = {
    id: string;
    sessionId?: string;
    occurredAt: string;
    level: 'C0' | 'C1' | 'C2' | 'C3';
    action: string;
    reasonCode: string;
    reasonCodes: string[];
    why: string;
    suggestedAction?: string;
    evidence: Array<{
        type: string;
        authority: string;
        summary: string;
    }>;
    status: string;
    snoozedUntil?: string;
    bundleCount: number;
};
type ClientSettings = {
    notificationLevel: 'C1' | 'C2' | 'C3';
    maxInterruptsPerHour: number;
    dedupeWindowMinutes: number;
    bundleWindowSeconds: number;
    longRunThresholdMinutes: number;
    subagentPressure: 'relaxed' | 'standard' | 'strict';
    quietHours: {
        enabled: boolean;
        start: string;
        end: string;
    };
    privacySafeSummary: boolean;
    healthPollSeconds: number;
    maxInboxItems: number;
};
type ClientSnapshot = {
    status: {
        indicator: 'gray' | 'yellow' | 'orange' | 'red';
        openInbox: number;
        sessions: number;
        plugin: {
            state: string;
            version: string;
        };
        capabilities: {
            browserNotification: boolean;
            nativeToast: boolean;
            windowsInterop: string;
        };
    };
    settings: ClientSettings;
    inbox: ClientItem[];
};
type JumpResult = {
    available: boolean;
    url?: string;
    note: string;
};
declare const rootId = "dsh-deepcanary-root";
declare const seenKey = "dsh-deepcanary-notified";
declare function el<K extends keyof HTMLElementTagNameMap>(tag: K, text?: string): HTMLElementTagNameMap[K];
declare function button(label: string, onClick: () => void): HTMLButtonElement;
declare function notify(items: ClientItem[]): void;
declare function post(path: string, payload: Record<string, unknown>): Promise<Response | undefined>;
declare function action(id: string, value: Record<string, unknown>): Promise<void>;
declare function field(label: string, control: HTMLElement): HTMLElement;
declare function selectControl<T extends string>(name: string, values: readonly T[], current: T): HTMLSelectElement;
declare function numberControl(name: string, current: number, min: number, max: number): HTMLInputElement;
declare function renderSettings(parent: HTMLElement, settings: ClientSettings): void;
declare function saveSettings(form: HTMLFormElement): Promise<void>;
declare function render(snapshot: ClientSnapshot): void;
declare function refresh(): Promise<void>;
//# sourceMappingURL=client.d.ts.map