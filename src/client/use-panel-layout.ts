import { useEffect, useRef, useState } from 'react'
import type { KeyboardEvent, PointerEvent } from 'react'
import { clampRect, defaultLayout, modeRect, readLayout, resizeRect, snapRect } from './panel-layout.js'
import type { PanelLayout, PanelMode, PanelRect, PanelViewport, ResizeEdge } from './panel-layout.js'

const KEY = 'dsh-deepcanary-layout.v2'
export function panelViewport(): PanelViewport {
  const view = window.visualViewport
  return { x: view?.offsetLeft ?? 0, y: view?.offsetTop ?? 0, width: view?.width ?? window.innerWidth, height: view?.height ?? window.innerHeight }
}
function initialLayout(): PanelLayout {
  try { return readLayout(JSON.parse(window.localStorage.getItem(KEY) ?? 'null'), panelViewport()) }
  catch { return defaultLayout(panelViewport()) }
}

export function usePanelLayout(open: boolean) {
  const [layout, setLayout] = useState(initialLayout)
  const [editing, setEditing] = useState<'move' | 'resize' | undefined>()
  const current = useRef(layout); current.current = layout
  const keyboardOrigin = useRef<PanelLayout | undefined>(undefined)
  const pointer = useRef<{ id: number; target: HTMLElement; x: number; y: number; initial: PanelLayout; edge?: ResizeEdge; split?: boolean } | undefined>(undefined)
  const frame = useRef<number | undefined>(undefined)
  const pending = useRef<PanelLayout | undefined>(undefined)
  const commit = (value: PanelLayout): void => { current.current = value; setLayout(value) }
  const flush = (): void => {
    if (frame.current !== undefined) cancelAnimationFrame(frame.current)
    frame.current = undefined
    if (pending.current) { commit(pending.current); pending.current = undefined }
  }
  const finish = (cancel: boolean): void => {
    const start = pointer.current
    if (!start) return
    flush()
    pointer.current = undefined
    if (start.target.hasPointerCapture(start.id)) start.target.releasePointerCapture(start.id)
    commit(cancel ? start.initial : start.edge || start.split ? current.current
      : { ...current.current, rect: snapRect(current.current.rect, panelViewport()) })
  }
  const onMove = (event: globalThis.PointerEvent): void => {
    const start = pointer.current
    if (!start || event.pointerId !== start.id) return
    const dx = event.clientX - start.x; const dy = event.clientY - start.y
    let rect: PanelRect = start.initial.rect
    if (start.split) pending.current = { ...current.current, split: Math.max(280, Math.min(340, start.initial.split + dx)) }
    else {
      rect = start.edge ? resizeRect(rect, start.edge, dx, dy, panelViewport())
        : clampRect({ ...rect, x: rect.x + dx, y: rect.y + dy }, panelViewport())
      pending.current = { ...current.current, mode: 'floating', rect,
        restore: start.edge ? rect : { ...start.initial.restore, x: rect.x, y: rect.y } }
    }
    if (frame.current === undefined) frame.current = requestAnimationFrame(() => { frame.current = undefined; flush() })
  }
  useEffect(() => {
    if (!open) {
      finish(true)
      if (keyboardOrigin.current) commit({ ...keyboardOrigin.current, rect: clampRect(keyboardOrigin.current.rect, panelViewport()) })
      keyboardOrigin.current = undefined; setEditing(undefined)
      return
    }
    const onUp = (event: globalThis.PointerEvent): void => { if (pointer.current?.id === event.pointerId) finish(false) }
    const onCancel = (event: globalThis.PointerEvent): void => { if (pointer.current?.id === event.pointerId) finish(true) }
    const onBlur = (): void => {
      finish(true)
      if (keyboardOrigin.current) { commit({ ...keyboardOrigin.current, rect: clampRect(keyboardOrigin.current.rect, panelViewport()) }); keyboardOrigin.current = undefined; setEditing(undefined) }
    }
    const onViewport = (): void => {
      finish(true)
      keyboardOrigin.current = undefined; setEditing(undefined)
      const value = current.current
      commit({ ...value, rect: modeRect(value.mode, value.restore, panelViewport()) })
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onCancel)
    window.addEventListener('lostpointercapture', onCancel)
    window.addEventListener('blur', onBlur)
    window.addEventListener('resize', onViewport)
    window.visualViewport?.addEventListener('resize', onViewport)
    window.visualViewport?.addEventListener('scroll', onViewport)
    return () => {
      finish(true)
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onCancel)
      window.removeEventListener('lostpointercapture', onCancel)
      window.removeEventListener('blur', onBlur)
      window.removeEventListener('resize', onViewport)
      window.visualViewport?.removeEventListener('resize', onViewport)
      window.visualViewport?.removeEventListener('scroll', onViewport)
    }
  }, [open])
  useEffect(() => {
    const timer = window.setTimeout(() => {
      try { window.localStorage.setItem(KEY, JSON.stringify(layout)) } catch { /* Geometry remains usable without storage. */ }
    }, 150)
    return () => { window.clearTimeout(timer) }
  }, [layout])
  const startPointer = (event: PointerEvent<HTMLElement>, edge?: ResizeEdge, split = false): void => {
    if (event.button !== 0 || !event.isPrimary || pointer.current !== undefined) return
    if (!edge && !split && event.target instanceof Element && event.target.closest('button,input,select,textarea,a,summary,[contenteditable]')) return
    if (!edge && !split && current.current.mode !== 'floating') return
    event.preventDefault()
    event.currentTarget.setPointerCapture(event.pointerId)
    pointer.current = { id: event.pointerId, target: event.currentTarget, x: event.clientX, y: event.clientY, initial: current.current,
      ...(edge ? { edge } : {}), ...(split ? { split: true } : {}) }
  }
  const mode = (next: PanelMode): void => {
    const value = current.current
    const restore = value.restore
    commit({ ...value, mode: next, restore, rect: modeRect(next, next === 'floating' ? restore : value.rect, panelViewport()) })
  }
  const beginKeyboard = (next: 'move' | 'resize'): void => {
    keyboardOrigin.current = current.current
    if (current.current.mode !== 'floating') mode('floating')
    setEditing(next)
  }
  const onKeyDown = (event: KeyboardEvent<HTMLElement>): boolean => {
    if (!editing) return false
    if (event.key === 'Escape' || event.key === 'Enter') {
      if (event.key === 'Escape' && keyboardOrigin.current) commit(keyboardOrigin.current)
      setEditing(undefined); keyboardOrigin.current = undefined
    } else if (event.key.startsWith('Arrow')) {
      const amount = event.shiftKey ? 32 : 8
      const dx = event.key === 'ArrowLeft' ? -amount : event.key === 'ArrowRight' ? amount : 0
      const dy = event.key === 'ArrowUp' ? -amount : event.key === 'ArrowDown' ? amount : 0
      const value = current.current
      const rect = editing === 'resize' ? resizeRect(value.rect, 'se', dx, dy, panelViewport())
        : clampRect({ ...value.rect, x: value.rect.x + dx, y: value.rect.y + dy }, panelViewport())
      commit({ ...value, rect, restore: editing === 'resize' ? rect : { ...value.restore, x: rect.x, y: rect.y } })
    } else return false
    event.preventDefault(); event.stopPropagation(); return true
  }
  return { layout, editing, startPointer, beginKeyboard, onKeyDown, mode,
    reset: () => { commit(defaultLayout(panelViewport())) },
    setSplit: (split: number) => { commit({ ...current.current, split: Math.max(280, Math.min(340, split)) }) } }
}
