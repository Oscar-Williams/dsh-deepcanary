import { describe, expect, it } from 'vitest'
import { clampRect, defaultLayout, modeRect, readLayout, resizeRect, snapRect } from '../src/client/panel-layout.js'
import type { ResizeEdge } from '../src/client/panel-layout.js'

const view = { x: 0, y: 0, width: 1440, height: 900 }
describe('floating Inbox geometry', () => {
  it('opens at the intended working size and restores into a smaller viewport', () => {
    const original = defaultLayout(view)
    expect(original.rect).toMatchObject({ width: 880, height: 640 })
    const restored = readLayout(original, { x: 0, y: 0, width: 360, height: 500 })
    expect(restored.rect).toEqual({ x: 12, y: 12, width: 336, height: 476 })
    expect(readLayout(restored, view).rect).toEqual(original.rect)
  })
  it.each(['n', 'ne', 'e', 'se', 's', 'sw', 'w', 'nw'] as ResizeEdge[])('keeps %s resizing inside the visible area', edge => {
    const rect = resizeRect({ x: 200, y: 150, width: 880, height: 640 }, edge, 4000, -4000, view)
    expect(rect.x).toBeGreaterThanOrEqual(12)
    expect(rect.y).toBeGreaterThanOrEqual(12)
    expect(rect.width).toBeGreaterThanOrEqual(360)
    expect(rect.height).toBeGreaterThanOrEqual(320)
    expect(rect.x + rect.width).toBeLessThanOrEqual(1428)
    expect(rect.y + rect.height).toBeLessThanOrEqual(888)
  })
  it('keeps the opposite corner fixed while resizing northwest', () => {
    expect(resizeRect({ x: 200, y: 150, width: 800, height: 600 }, 'nw', 40, 30, view))
      .toEqual({ x: 240, y: 180, width: 760, height: 570 })
  })
  it('snaps within twelve pixels and respects visual viewport offsets', () => {
    const viewport = { x: 20, y: 30, width: 1024, height: 600 }
    expect(snapRect({ x: 40, y: 50, width: 500, height: 350 }, viewport)).toEqual({ x: 32, y: 42, width: 500, height: 350 })
    expect(clampRect({ x: 9999, y: 9999, width: 500, height: 350 }, viewport)).toEqual({ x: 532, y: 268, width: 500, height: 350 })
  })
  it('docks and maximizes without changing the saved floating rectangle', () => {
    const value = defaultLayout(view)
    expect(modeRect('maximized', value.rect, view)).toEqual({ x: 12, y: 12, width: 1416, height: 876 })
    expect(modeRect('left', value.rect, view).x).toBe(12)
    expect(value.restore).toEqual(value.rect)
    expect(readLayout({ rect: { x: NaN }, restore: {}, mode: 'floating' }, view)).toEqual(value)
  })
})
