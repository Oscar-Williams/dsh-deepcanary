import { realpathSync } from 'node:fs'
import path from 'node:path'
import type { WorkspaceIdentity } from '../types.js'

export interface WorkspaceEnvironment {
  platform?: NodeJS.Platform
  env?: NodeJS.ProcessEnv
}

function isWsl(environment: WorkspaceEnvironment): boolean {
  const env = environment.env ?? process.env
  return environment.platform === 'linux' && Boolean(env.WSL_DISTRO_NAME || env.WSL_INTEROP || env.WSLENV)
}

export function windowsPathToWsl(value: string): string | undefined {
  const match = /^([A-Za-z]):[\\/](.*)$/.exec(value)
  if (!match) return undefined
  const drive = match[1]?.toLowerCase()
  const rest = (match[2] ?? '').replaceAll('\\', '/')
  return `/mnt/${drive}/${rest}`
}

export function wslPathToWindows(value: string): string | undefined {
  const match = /^\/mnt\/([A-Za-z])(?:\/(.*))?$/.exec(value)
  if (!match) return undefined
  const drive = match[1]?.toUpperCase()
  const rest = (match[2] ?? '').replaceAll('/', '\\')
  return `${drive}:\\${rest}`
}

function canonicalPath(cwd: string, platform: NodeJS.Platform): string {
  if (platform === 'linux' && cwd.startsWith('/')) {
    return path.posix.normalize(cwd)
  }
  try {
    return realpathSync.native(cwd)
  } catch {
    return path.resolve(cwd)
  }
}

export function getWorkspaceIdentity(cwd = process.cwd(), environment: WorkspaceEnvironment = {}): WorkspaceIdentity {
  const platform = environment.platform ?? process.platform
  const wsl = isWsl({ ...environment, platform })
  const resolved = canonicalPath(cwd, platform)
  const hostPath = platform === 'win32' ? resolved : wsl ? wslPathToWindows(resolved) : undefined
  const wslPath = wsl ? resolved : windowsPathToWsl(resolved)
  const canonicalId = (hostPath ?? resolved).replaceAll('\\', '/').toLowerCase()
  return {
    canonicalId,
    ...(hostPath ? { hostPath } : {}),
    ...(wslPath ? { wslPath } : {}),
    platform: platform === 'win32' ? 'windows' : wsl ? 'wsl' : 'other',
    nativeToast: environment.env?.DSH_DEEPCANARY_NATIVE_TOAST === '1' ? 'available' : 'unavailable',
  }
}
