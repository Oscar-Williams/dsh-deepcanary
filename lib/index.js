import { Config } from './config.js';
import { DeepCanaryService } from './service.js';
import { registerTools } from './tools.js';
import { installWebRoutes } from './web.js';
export const name = 'dsh-deepcanary';
export const inject = ['tools', 'sessions'];
export { Config };
export * from './types.js';
export * from './providers.js';
export { DedupeLedger, InterruptBudget } from './core/dedupe.js';
export { judgeSignal } from './core/judge.js';
export { applyDeliveryPolicy, mergeBundleTrace, withBundleTrace, withRecoveryTrace } from './core/policy.js';
export { getWorkspaceIdentity, probeWindowsInterop, windowsPathToWsl, wslPathToWindows } from './adapters/windows.js';
export { ContextDshAdapter } from './adapters/dsh.js';
export { OutcomeStore, buildOutcomeReceipt, eventClassForReason, isOutcomeReceipt, normalizeOutcomeDeleteFilter, normalizeOutcomeInput, strongestEvidenceAuthority } from './outcome.js';
export { DeepCanaryService } from './service.js';
export function apply(ctx, config) {
    const service = new DeepCanaryService(ctx, config);
    service.start();
    service.setRegisteredTools(registerTools(ctx, service));
    installWebRoutes(ctx, service);
}
//# sourceMappingURL=index.js.map