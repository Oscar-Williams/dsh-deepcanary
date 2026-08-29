import { describe, expect, it } from 'vitest'
import { getWorkspaceIdentity, windowsPathToWsl, wslPathToWindows } from '../src/adapters/windows.js'

describe('Windows and WSL workspace identity', () => {
  it('converts drive paths in both directions', () => {
    expect(windowsPathToWsl('C:\\Users\\Oscar\\project')).toBe('/mnt/c/Users/Oscar/project')
    expect(wslPathToWindows('/mnt/c/Users/Oscar/project')).toBe('C:\\Users\\Oscar\\project')
  })

  it('keeps a stable canonical id across a WSL presentation', () => {
    const identity = getWorkspaceIdentity('/mnt/c/Users/Oscar/project', { platform: 'linux', env: { WSL_DISTRO_NAME: 'Ubuntu' } })
    expect(identity.platform).toBe('wsl')
    expect(identity.hostPath).toBe('C:\\Users\\Oscar\\project')
    expect(identity.wslPath).toBe('/mnt/c/Users/Oscar/project')
    expect(identity.canonicalId).toBe('c:/users/oscar/project')
  })
})
