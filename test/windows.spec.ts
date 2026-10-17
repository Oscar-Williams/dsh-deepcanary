import { describe, expect, it } from 'vitest'
import { getWorkspaceIdentity, probeWindowsInterop, windowsPathToWsl, wslPathToWindows } from '../src/adapters/windows.js'

describe('Windows and WSL workspace identity', () => {
  it('converts drive paths in both directions', () => {
    expect(windowsPathToWsl('C:\\Users\\Example\\project')).toBe('/mnt/c/Users/Example/project')
    expect(wslPathToWindows('/mnt/c/Users/Example/project')).toBe('C:\\Users\\Example\\project')
  })

  it('keeps a stable canonical id across a WSL presentation', () => {
    const identity = getWorkspaceIdentity('/mnt/c/Users/Example/project', { platform: 'linux', env: { WSL_DISTRO_NAME: 'Ubuntu' } })
    expect(identity.platform).toBe('wsl')
    expect(identity.windowsInterop).toBe('unknown')
    expect(identity.hostPath).toBe('C:\\Users\\Example\\project')
    expect(identity.wslPath).toBe('/mnt/c/Users/Example/project')
    expect(identity.canonicalId).toBe('c:/users/example/project')
  })

  it('selects the browser fallback when Windows interop is unavailable', () => {
    expect(probeWindowsInterop({ platform: 'linux', env: {} })).toBe('unavailable')
    expect(probeWindowsInterop({ platform: 'linux', env: { WSL_INTEROP: '/run/WSL/1_interop' } })).toBe('available')
    expect(probeWindowsInterop({ platform: 'win32', env: {} })).toBe('available')
    expect(probeWindowsInterop({ platform: 'win32', env: { DSH_DEEPCANARY_WINDOWS_INTEROP: '0' } })).toBe('unavailable')
  })
})
