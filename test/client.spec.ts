import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'
import { handleNotificationClick, positionSelectedAttention } from '../src/client/attention-navigation.js'

describe('DeepCanary attention navigation', () => {
  it('returns a notification click to the selected alert in order', () => {
    const order: string[] = []
    handleNotificationClick(
      { close: () => { order.push('close') } },
      'alert-2',
      id => { order.push(`open:${id}`) },
      () => { order.push('focus') },
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
    expect(source).toContain('visibilitychange')
    expect(source).not.toContain('function SettingsForm')
  })
})
