import { realpathSync } from 'node:fs';
import path from 'node:path';
function isWsl(environment) {
    const env = environment.env ?? process.env;
    return environment.platform === 'linux' && Boolean(env.WSL_DISTRO_NAME || env.WSL_INTEROP || env.WSLENV);
}
export function probeWindowsInterop(environment = {}) {
    const platform = environment.platform ?? process.platform;
    const env = environment.env ?? process.env;
    if (env.DSH_DEEPCANARY_WINDOWS_INTEROP === '0')
        return 'unavailable';
    if (platform === 'win32')
        return 'available';
    if (platform !== 'linux')
        return 'unavailable';
    if (env.WSL_INTEROP)
        return 'available';
    if (env.WSL_DISTRO_NAME || env.WSLENV)
        return 'unknown';
    return 'unavailable';
}
export function windowsPathToWsl(value) {
    const match = /^([A-Za-z]):[\\/](.*)$/.exec(value);
    if (!match)
        return undefined;
    const drive = match[1]?.toLowerCase();
    const rest = (match[2] ?? '').replaceAll('\\', '/');
    return `/mnt/${drive}/${rest}`;
}
export function wslPathToWindows(value) {
    const match = /^\/mnt\/([A-Za-z])(?:\/(.*))?$/.exec(value);
    if (!match)
        return undefined;
    const drive = match[1]?.toUpperCase();
    const rest = (match[2] ?? '').replaceAll('/', '\\');
    return `${drive}:\\${rest}`;
}
function canonicalPath(cwd, platform) {
    if (platform === 'linux' && cwd.startsWith('/')) {
        return path.posix.normalize(cwd);
    }
    try {
        return realpathSync.native(cwd);
    }
    catch {
        return path.resolve(cwd);
    }
}
export function getWorkspaceIdentity(cwd = process.cwd(), environment = {}) {
    const platform = environment.platform ?? process.platform;
    const wsl = isWsl({ ...environment, platform });
    const resolved = canonicalPath(cwd, platform);
    const hostPath = platform === 'win32' ? resolved : wsl ? wslPathToWindows(resolved) : undefined;
    const wslPath = wsl ? resolved : windowsPathToWsl(resolved);
    const canonicalId = (hostPath ?? resolved).replaceAll('\\', '/').toLowerCase();
    return {
        canonicalId,
        ...(hostPath ? { hostPath } : {}),
        ...(wslPath ? { wslPath } : {}),
        platform: platform === 'win32' ? 'windows' : wsl ? 'wsl' : 'other',
        windowsInterop: probeWindowsInterop({ ...environment, platform }),
        nativeToast: environment.env?.DSH_DEEPCANARY_NATIVE_TOAST === '1' ? 'available' : 'unavailable',
    };
}
//# sourceMappingURL=windows.js.map