import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'
import { handleNotificationClick, positionSelectedAttention } from '../src/client/attention-navigation.js'

describe('DeepCanary attention navigation', () => {
  it('returns a notification click to the selected alert in order', () => {
    const order: string[] = []
    handleNotificationClick(
      { close: () => { order.push('close') } },
      'alert-2',
      () => { order.push('focus') },
      id => { order.push(`open:${id}`) },
    )
    expect(order).toEqual(['focus', 'open:alert-2', 'close'])
  })

  it('positions only the matching alert with nearest alignment', () => {
    const calls: Array<{ id: string; options: unknown }> = []
    const elements = ['alert-1', 'alert-2'].map(id => ({
      dataset: { deepcanaryItem: id },
      scrollIntoView: (options?: unknown) => { calls.push({ id, options }) },
    }))
    expect(positionSelectedAttention(elements, 'alert-2')).toBe(true)
    expect(positionSelectedAttention(elements, 'missing')).toBe(false)
    expect(calls).toEqual([{ id: 'alert-2', options: { block: 'nearest', inline: 'nearest' } }])
  })

  it('keeps the Inbox visible when alpha5 rejects an older session id', () => {
    const order: string[] = []
    handleNotificationClick(
      { close: () => { order.push('close') } },
      'historical-alert',
      () => { order.push('focus') },
      id => { order.push(`open:${id}`) },
      () => false,
      url => { order.push(`navigate:${url}`) },
      '/?session=historical-session',
      'historical-session',
    )
    expect(order).toEqual(['focus', 'open:historical-alert', 'close'])
  })

  it('retains URL fallback for a host without the native Session API', () => {
    const order: string[] = []
    handleNotificationClick(
      { close: () => { order.push('close') } },
      'legacy-alert',
      () => { order.push('focus') },
      id => { order.push(`open:${id}`) },
      undefined,
      url => { order.push(`navigate:${url}`) },
      '/?session=legacy-session',
    )
    expect(order).toEqual(['focus', 'open:legacy-alert', 'navigate:/?session=legacy-session', 'close'])
  })

  it('prefers the public DSH Session API for an existing historical target', () => {
    const order: string[] = []
    handleNotificationClick(
      { close: () => { order.push('close') } },
      'historical-alert',
      () => { order.push('focus') },
      id => { order.push(`open:${id}`) },
      sessionId => { order.push(`session:${sessionId}`); return true },
      url => { order.push(`navigate:${url}`) },
      '/?session=historical-session',
      'historical-session',
    )
    expect(order).toEqual(['focus', 'session:historical-session', 'open:historical-alert', 'close'])
  })
})

describe('DeepCanary DSH client surface', () => {
  it('declares the DSH client module and all four interaction gates', async () => {
    const manifest = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8')) as {
      exports?: Record<string, unknown>
      dsh?: { client?: { platform?: string; inject?: string[] } }
    }
    const source = await readFile(new URL('../src/client/index.ts', import.meta.url), 'utf8')

    expect(manifest.exports?.['./client']).toBe('./lib/client.js')
    expect(manifest.dsh?.client?.platform).toBe('web')
    expect(manifest.dsh?.client?.inject).toEqual([
      '@deepseek-ai/dsh-client-locale',
      '@deepseek-ai/dsh-client-ui-layout',
      '@deepseek-ai/dsh-api-session-controller',
      '@deepseek-ai/dsh-client-ui-session',
      '@deepseek-ai/dsh-client-ui-sidebar',
      '@deepseek-ai/dsh-client-ui-renderer',
      '@deepseek-ai/dsh-client-ui-settings',
      '@deepseek-ai/dsh-client-ui-settings-plugins',
    ])
    expect(source).toContain('open: false')
    expect(source).toContain('data-deepcanary-close')
    expect(source).toContain('sidebar.footer.action')
    expect(source).toContain('shell.overlay')
    expect(source).toContain('role: \'separator\'')
    expect(source).toContain('onPointerCancel')
    expect(source).toContain('touch-action:none')
    expect(source).toContain('aria-live\': \'polite\'')
    expect(source).toContain('AUTO_OPEN_REASONS')
    expect(source).toContain('panel.bodyLabel')
    expect(source).toContain('satisfies Record<keyof typeof zh, string>')
    expect(source).toContain('ctx.locale.register(NS, { zh, en })')
    expect(source).toContain('settings.plugin.item')
    expect(source).toContain('ctx.settingsScope?.bind')
    expect(source).toContain('namespace: SETTINGS_NS')
    expect(source).toContain('key: SETTINGS_NS')
    expect(source).toContain('requestId: makeRequestId()')
    expect(source).toContain('positionSelectedAttention')
    expect(source).toContain('handleNotificationClick')
    expect(source).toContain('notificationTitle')
    expect(source).toContain("value.action === 'INTERRUPT' || value.action === 'ESCALATE'")
    expect(source).toContain('ctx.sessions')
    expect(source).toContain('item.moreActions')
    expect(source).toContain('item.suppressType')
    expect(source).toContain('item.feedbackMenu')
    expect(source).toContain('item.noSessionLink')
    expect(source).toContain('pointermove')
    expect(source).toContain('visibilitychange')
    expect(source).not.toContain('function SettingsForm')
  })
})
