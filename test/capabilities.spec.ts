import { describe, expect, it, vi } from 'vitest'
import { rendererCapabilities } from '../src/client/capabilities.js'

describe('renderer endpoint boundary', () => {
  it('rejects absolute, protocol-relative and normalized traversal requests before fetch', async () => {
    const fetchMock = vi.fn(async () => new Response('{}'))
    vi.stubGlobal('fetch', fetchMock)
    try {
      for (const path of ['https://untrusted.example/api/dsh-deepcanary/state', '//untrusted.example/api/dsh-deepcanary/state',
        '/api/dsh-deepcanary/../credentials', '/api/dsh-deepcanary/%2e%2e/state', '/api/dsh-deepcanary/state/extra']) {
        await expect(rendererCapabilities.request(path)).rejects.toThrow('Invalid plugin endpoint')
      }
      expect(fetchMock).not.toHaveBeenCalled()
      await rendererCapabilities.request('/api/dsh-deepcanary/state?revision=1')
      expect(fetchMock).toHaveBeenCalledOnce()
    } finally { vi.unstubAllGlobals() }
  })
})
