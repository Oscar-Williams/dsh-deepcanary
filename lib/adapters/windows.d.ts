import type { WorkspaceIdentity } from '../types.js';
export interface WorkspaceEnvironment {
    platform?: NodeJS.Platform;
    env?: NodeJS.ProcessEnv;
}
export type WindowsInteropState = 'available' | 'unavailable' | 'unknown';
export declare function probeWindowsInterop(environment?: WorkspaceEnvironment): WindowsInteropState;
export declare function windowsPathToWsl(value: string): string | undefined;
export declare function wslPathToWindows(value: string): string | undefined;
export declare function getWorkspaceIdentity(cwd?: string, environment?: WorkspaceEnvironment): WorkspaceIdentity;
//# sourceMappingURL=windows.d.ts.map