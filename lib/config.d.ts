import Schema from '@deepseek-ai/schemastery';
import type { DeepCanaryConfig, QuietHours } from './types.js';
export interface DeepCanaryConfigInput extends Partial<Omit<DeepCanaryConfig, 'quietHours'>> {
    quietHours?: Partial<QuietHours>;
}
export declare const Config: Schema<Schemastery.ObjectS<{
    stateDir: Schema<string, string>;
    notificationLevel: Schema<"C1" | "C2" | "C3", "C1" | "C2" | "C3">;
    openOnCritical: Schema<boolean, boolean>;
    maxInterruptsPerHour: Schema<number, number>;
    dedupeWindowMinutes: Schema<number, number>;
    bundleWindowSeconds: Schema<number, number>;
    longRunThresholdMinutes: Schema<number, number>;
    subagentPressure: Schema<"relaxed" | "standard" | "strict", "relaxed" | "standard" | "strict">;
    quietHours: Schema<Schemastery.ObjectS<{
        enabled: Schema<boolean, boolean>;
        start: Schema<string, string>;
        end: Schema<string, string>;
    }>, Schemastery.ObjectT<{
        enabled: Schema<boolean, boolean>;
        start: Schema<string, string>;
        end: Schema<string, string>;
    }>>;
    privacySafeSummary: Schema<boolean, boolean>;
    healthPollSeconds: Schema<number, number>;
    maxInboxItems: Schema<number, number>;
    supervisorMode: Schema<"off" | "experimental", "off" | "experimental">;
}>, Schemastery.ObjectT<{
    stateDir: Schema<string, string>;
    notificationLevel: Schema<"C1" | "C2" | "C3", "C1" | "C2" | "C3">;
    openOnCritical: Schema<boolean, boolean>;
    maxInterruptsPerHour: Schema<number, number>;
    dedupeWindowMinutes: Schema<number, number>;
    bundleWindowSeconds: Schema<number, number>;
    longRunThresholdMinutes: Schema<number, number>;
    subagentPressure: Schema<"relaxed" | "standard" | "strict", "relaxed" | "standard" | "strict">;
    quietHours: Schema<Schemastery.ObjectS<{
        enabled: Schema<boolean, boolean>;
        start: Schema<string, string>;
        end: Schema<string, string>;
    }>, Schemastery.ObjectT<{
        enabled: Schema<boolean, boolean>;
        start: Schema<string, string>;
        end: Schema<string, string>;
    }>>;
    privacySafeSummary: Schema<boolean, boolean>;
    healthPollSeconds: Schema<number, number>;
    maxInboxItems: Schema<number, number>;
    supervisorMode: Schema<"off" | "experimental", "off" | "experimental">;
}>>;
export declare function normalizeConfig(input: DeepCanaryConfigInput | undefined): DeepCanaryConfig;
/** Validate the browser settings surface without exposing stateDir or unknown keys. */
export declare function sanitizeConfigPatch(input: Record<string, unknown>): DeepCanaryConfigInput;
//# sourceMappingURL=config.d.ts.map