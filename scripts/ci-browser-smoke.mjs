import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

export async function browserSmoke(page, expectedVersion, options = {}) {
  if (options.freshProfile !== false) {
    const welcome = page.getByRole('dialog', { name: /Preview Notice|预览版说明/i })
    await welcome.waitFor({ state: 'visible', timeout: 15000 })
    await welcome.getByRole('button', { name: /^(继续|continue)$/i }).click()
    await welcome.waitFor({ state: 'hidden', timeout: 15000 })
    const credential = page.getByRole('dialog', { name: /Get started|开始使用/i })
    await credential.waitFor({ state: 'visible', timeout: 15000 })
    await credential.getByRole('button', { name: /^(Close|关闭)$/i }).click()
    await credential.waitFor({ state: 'hidden', timeout: 15000 })
    const apiKey = page.getByRole('dialog', { name: /Add an API key to get started|添加一个 API key 开始使用/i })
    if (await apiKey.isVisible()) {
      await apiKey.getByRole('button', { name: /Configure later|稍后配置/i }).click()
      await apiKey.waitFor({ state: 'hidden', timeout: 15000 })
    }
  }
  const health = await page.request.get(new URL('/api/dsh-deepcanary/health', page.url()).href)
  if (health.status() !== 200 || (await health.json()).plugin.version !== expectedVersion) throw new Error('authenticated runtime identity mismatch')
  const outcomes = await page.request.get(new URL('/api/dsh-deepcanary/outcomes', page.url()).href)
  if (outcomes.status() !== 200 || (await outcomes.json()).outcomeSchemaVersion !== 1) throw new Error('authenticated outcome route failed')
  const legacy = await page.request.get(new URL('/dsh-deepcanary/health', page.url()).href)
  if (legacy.status() === 200 && legacy.headers()['content-type']?.includes('application/json')) throw new Error('legacy API exposed')

  const trigger = page.locator('[data-deepcanary-trigger]')
  const panel = page.locator('[data-deepcanary-panel]')
  await trigger.waitFor({ state: 'visible', timeout: 30000 })
  if (await panel.count()) await panel.getByRole('button', { name: /Close panel|关闭面板/i }).click()
  await trigger.click()
  await panel.waitFor({ state: 'visible' })
  if (await panel.getAttribute('role') !== 'dialog') throw new Error('panel dialog role missing')
  if (await panel.getByRole('heading', { name: 'DeepCanary', exact: true }).count() !== 1) throw new Error('panel title missing')
  if (await panel.locator('[data-edge]').count() !== 8) throw new Error('eight resize directions missing')
  const west = panel.getByRole('separator', { name: /^(Resize window|调整窗口大小) \(W\)$/i })
  const pointerBefore = await panel.boundingBox()
  const westBox = await west.boundingBox()
  if (!pointerBefore || !westBox) throw new Error('resize geometry missing')
  await page.mouse.move(westBox.x + westBox.width / 2, westBox.y + westBox.height / 2)
  await page.mouse.down()
  await page.mouse.move(westBox.x + westBox.width / 2 - 48, westBox.y + westBox.height / 2, { steps: 3 })
  await page.mouse.up()
  const pointerAfter = await panel.boundingBox()
  if (!pointerAfter || pointerAfter.width <= pointerBefore.width + 24) throw new Error('west resize did not grow the panel')
  await west.focus()
  await page.keyboard.press('Enter')
  await page.keyboard.press('ArrowLeft')
  const keyboardReduced = await panel.boundingBox()
  if (!keyboardReduced || keyboardReduced.width >= pointerAfter.width) throw new Error('keyboard resize did not reduce width')
  await page.keyboard.press('Escape')
  const keyboardCancelled = await panel.boundingBox()
  if (!keyboardCancelled || Math.abs(keyboardCancelled.width - pointerAfter.width) > 1) throw new Error('keyboard cancellation did not restore geometry')

  await panel.getByRole('button', { name: /Close panel|关闭面板/i }).click()
  await panel.waitFor({ state: 'hidden' })
  if (await trigger.getAttribute('aria-expanded') !== 'false') throw new Error('trigger state did not close')
  await trigger.click()
  await page.keyboard.press('Escape')
  await panel.waitFor({ state: 'hidden' })
  await page.waitForFunction(() => document.activeElement === document.querySelector('[data-deepcanary-trigger]'))
  await trigger.click()
  await page.mouse.click(24, 120)
  if (!await panel.isVisible()) throw new Error('floating panel disappeared while working outside it')

  const originalViewport = page.viewportSize() ?? await page.evaluate(() => ({ width: innerWidth, height: innerHeight }))
  try {
    await page.setViewportSize({ width: 360, height: 640 })
    await page.waitForFunction(() => {
      const rect = document.querySelector('[data-deepcanary-panel]')?.getBoundingClientRect()
      return rect && rect.left >= 0 && rect.right <= innerWidth + 1 && rect.top >= 0 && rect.bottom <= innerHeight + 1
    })
    const narrow = await panel.boundingBox()
    if (!narrow || await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)) throw new Error('narrow viewport overflow')
    await page.emulateMedia({ forcedColors: 'active' })
    if (!await page.evaluate(() => matchMedia('(forced-colors: active)').matches)) throw new Error('forced colors was not enabled')
    if (await panel.getByRole('status').count() !== 1) throw new Error('status live region missing')
    const triggerLabel = await trigger.getAttribute('aria-label')
    if (!triggerLabel || !triggerLabel.includes('DeepCanary')) throw new Error('trigger label missing')
    await page.screenshot({ path: options.screenshotPath ?? 'output/playwright/ci-host-forced-colors.png', animations: 'disabled' })
    return { plugin: expectedVersion, directions: 8, pointerResize: true, keyboardResizeAndCancel: true, focusReturn: true, narrow, forcedColors: true }
  } finally {
    await page.emulateMedia({ forcedColors: null })
    await page.setViewportSize(originalViewport)
    if (await panel.count()) await panel.getByRole('button', { name: /Close panel|关闭面板/i }).click()
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const manifest = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'))
  const options = { freshProfile: !process.argv.includes('--existing-profile') }
  const screenshot = process.argv.find(value => value.startsWith('--screenshot='))
  if (screenshot) options.screenshotPath = screenshot.slice('--screenshot='.length)
  process.stdout.write(`async page => (${browserSmoke.toString()})(page, ${JSON.stringify(manifest.version)}, ${JSON.stringify(options)})\n`)
}
