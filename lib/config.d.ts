import Schema from '@deepseek-ai/schemastery';
import type { Volatile } from '@deepseek-ai/cordis';
import type { DeepCanaryConfig, QuietHours } from './types.js';
export interface DeepCanaryConfigInput extends Partial<Omit<DeepCanaryConfig, 'quietHours'>> {
    quietHours?: Partial<QuietHours>;
}
/** Loader-resolved live fields; standalone callers may still supply plain inputs. */
export type DeepCanaryRuntimeConfig = {
    [K in keyof DeepCanaryConfig]: K extends 'stateDir' ? string : Volatile<DeepCanaryConfig[K]>;
};
export declare const Config: Schema<Schemastery.ObjectS<NoInfer<{
    stateDir: Schema<string, string, "defined">;
    notificationLevel: Schema<"C1" | "C2" | "C3", "C1" | "C2" | "C3", "volatile-defined">;
    openOnCritical: Schema<boolean, boolean, "volatile-defined">;
    maxInterruptsPerHour: Schema<number, number, "volatile-defined">;
    dedupeWindowMinutes: Schema<number, number, "volatile-defined">;
    bundleWindowSeconds: Schema<number, number, "volatile-defined">;
    longRunThresholdMinutes: Schema<number, number, "volatile-defined">;
    subagentPressure: Schema<"relaxed" | "standard" | "strict", "relaxed" | "standard" | "strict", "volatile-defined">;
    quietHours: Schema<NoInfer<Schemastery.ObjectS<NoInfer<{
        enabled: Schema<boolean, boolean, "defined">;
        start: Schema<string, string, "defined">;
        end: Schema<string, string, "defined">;
    }>>>, NoInfer<Schemastery.ObjectT<NoInfer<{
        enabled: Schema<boolean, boolean, "defined">;
        start: Schema<string, string, "defined">;
        end: Schema<string, string, "defined">;
    }>>>, "volatile-defined">;
    privacySafeSummary: Schema<boolean, boolean, "volatile-defined">;
    healthPollSeconds: Schema<number, number, "volatile-defined">;
    maxInboxItems: Schema<number, number, "volatile-defined">;
    supervisorMode: Schema<"off" | "experimental", "off" | "experimental", "volatile-defined">;
}>>, Schemastery.ObjectT<NoInfer<{
    stateDir: Schema<string, string, "defined">;
    notificationLevel: Schema<"C1" | "C2" | "C3", "C1" | "C2" | "C3", "volatile-defined">;
    openOnCritical: Schema<boolean, boolean, "volatile-defined">;
    maxInterruptsPerHour: Schema<number, number, "volatile-defined">;
    dedupeWindowMinutes: Schema<number, number, "volatile-defined">;
    bundleWindowSeconds: Schema<number, number, "volatile-defined">;
    longRunThresholdMinutes: Schema<number, number, "volatile-defined">;
    subagentPressure: Schema<"relaxed" | "standard" | "strict", "relaxed" | "standard" | "strict", "volatile-defined">;
    quietHours: Schema<NoInfer<Schemastery.ObjectS<NoInfer<{
        enabled: Schema<boolean, boolean, "defined">;
        start: Schema<string, string, "defined">;
        end: Schema<string, string, "defined">;
    }>>>, NoInfer<Schemastery.ObjectT<NoInfer<{
        enabled: Schema<boolean, boolean, "defined">;
        start: Schema<string, string, "defined">;
        end: Schema<string, string, "defined">;
    }>>>, "volatile-defined">;
    privacySafeSummary: Schema<boolean, boolean, "volatile-defined">;
    healthPollSeconds: Schema<number, number, "volatile-defined">;
    maxInboxItems: Schema<number, number, "volatile-defined">;
    supervisorMode: Schema<"off" | "experimental", "off" | "experimental", "volatile-defined">;
}>>, "plain">;
export declare function normalizeConfig(input: DeepCanaryConfigInput | DeepCanaryRuntimeConfig | undefined): DeepCanaryConfig;
/** Validate the browser settings surface without exposing stateDir or unknown keys. */
export declare function sanitizeConfigPatch(input: Record<string, unknown>): DeepCanaryConfigInput;
//# sourceMappingURL=config.d.ts.map