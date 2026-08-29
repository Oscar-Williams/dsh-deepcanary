import type { Context } from '@deepseek-ai/cordis';
import { Config } from './config.js';
import type { DeepCanaryConfig } from './types.js';
import type { DeepCanaryConfigInput } from './config.js';
export declare const name = "dsh-deepcanary";
export declare const inject: string[];
export { Config };
export type { DeepCanaryConfig, DeepCanaryConfigInput };
export * from './types.js';
export * from './providers.js';
export { DedupeLedger, InterruptBudget } from './core/dedupe.js';
export { judgeSignal } from './core/judge.js';
export { getWorkspaceIdentity, probeWindowsInterop, windowsPathToWsl, wslPathToWindows } from './adapters/windows.js';
export { ContextDshAdapter } from './adapters/dsh.js';
export type { DeepCanaryEvent, DshAdapter, RuntimeHealth, SessionSnapshot } from './adapters/dsh.js';
export { DeepCanaryService } from './service.js';
export declare function apply(ctx: Context, config?: DeepCanaryConfigInput): void;
//# sourceMappingURL=index.d.ts.map