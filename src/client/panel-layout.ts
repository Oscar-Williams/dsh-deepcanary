export interface PanelRect { x: number; y: number; width: number; height: number }
export interface PanelViewport { x: number; y: number; width: number; height: number }
export type ResizeEdge = 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w' | 'nw'
export type PanelMode = 'floating' | 'left' | 'right' | 'maximized'
export interface PanelLayout { rect: PanelRect; mode: PanelMode; restore: PanelRect; split: number }

export function clampRect(rect: PanelRect, viewport: PanelViewport): PanelRect {
  const width = Math.max(1, Math.min(viewport.width - 24, Math.max(Math.min(360, viewport.width - 24), rect.width)))
  const height = Math.max(1, Math.min(viewport.height - 24, Math.max(Math.min(320, viewport.height - 24), rect.height)))
  return { width, height,
    x: Math.max(viewport.x + 12, Math.min(viewport.x + viewport.width - width - 12, rect.x)),
    y: Math.max(viewport.y + 12, Math.min(viewport.y + viewport.height - height - 12, rect.y)) }
}

export function defaultLayout(viewport: PanelViewport): PanelLayout {
  const rect = clampRect({ x: viewport.x + viewport.width - 904, y: viewport.y + viewport.height - 664, width: 880, height: 640 }, viewport)
  return { rect, restore: { ...rect }, mode: 'floating', split: 308 }
}

export function modeRect(mode: PanelMode, rect: PanelRect, viewport: PanelViewport): PanelRect {
  if (mode === 'floating') return clampRect(rect, viewport)
  return clampRect({ x: mode === 'right' ? viewport.x + viewport.width / 2 : viewport.x + 12,
    y: viewport.y + 12, width: mode === 'maximized' ? viewport.width - 24 : (viewport.width - 36) / 2,
    height: viewport.height - 24 }, viewport)
}

/** Keep the opposite edge fixed; minimum size never pushes the panel out of view. */
export function resizeRect(start: PanelRect, edge: ResizeEdge, dx: number, dy: number, viewport: PanelViewport): PanelRect {
  const minW = Math.min(360, viewport.width - 24)
  const minH = Math.min(320, viewport.height - 24)
  let left = start.x; let top = start.y; let right = left + start.width; let bottom = top + start.height
  if (edge.includes('w')) left = Math.max(viewport.x + 12, Math.min(right - minW, left + dx))
  if (edge.includes('e')) right = Math.min(viewport.x + viewport.width - 12, Math.max(left + minW, right + dx))
  if (edge.includes('n')) top = Math.max(viewport.y + 12, Math.min(bottom - minH, top + dy))
  if (edge.includes('s')) bottom = Math.min(viewport.y + viewport.height - 12, Math.max(top + minH, bottom + dy))
  return clampRect({ x: left, y: top, width: right - left, height: bottom - top }, viewport)
}

export function snapRect(rect: PanelRect, viewport: PanelViewport): PanelRect {
  const value = clampRect(rect, viewport)
  const left = viewport.x + 12; const top = viewport.y + 12
  const right = viewport.x + viewport.width - 12 - value.width
  const bottom = viewport.y + viewport.height - 12 - value.height
  return { ...value, x: Math.abs(value.x - left) <= 12 ? left : Math.abs(value.x - right) <= 12 ? right : value.x,
    y: Math.abs(value.y - top) <= 12 ? top : Math.abs(value.y - bottom) <= 12 ? bottom : value.y }
}

export function readLayout(value: unknown, viewport: PanelViewport): PanelLayout {
  const fallback = defaultLayout(viewport)
  if (!value || typeof value !== 'object') return fallback
  const raw = value as Partial<PanelLayout>
  const validRect = (rect: unknown): rect is PanelRect => !!rect && typeof rect === 'object'
    && ['x', 'y', 'width', 'height'].every(key => Number.isFinite((rect as Record<string, unknown>)[key]))
  if (!validRect(raw.rect) || !validRect(raw.restore) || !['floating', 'left', 'right', 'maximized'].includes(raw.mode!)) return fallback
  return { rect: modeRect(raw.mode!, raw.restore, viewport), restore: raw.restore, mode: raw.mode!,
    split: typeof raw.split === 'number' && Number.isFinite(raw.split) ? Math.max(280, Math.min(340, raw.split)) : fallback.split }
}
