/* global Notification */

type ClientItem = {
  id: string
  sessionId?: string
  occurredAt: string
  level: 'C0' | 'C1' | 'C2' | 'C3'
  action: string
  reasonCode: string
  why: string
  suggestedAction?: string
  evidence: Array<{ type: string; authority: string; summary: string }>
  status: string
}

type ClientSnapshot = {
  status: {
    indicator: 'gray' | 'yellow' | 'orange' | 'red'
    openInbox: number
    sessions: number
    plugin: { state: string; version: string }
    capabilities: { browserNotification: boolean; nativeToast: boolean }
  }
  inbox: ClientItem[]
}

const rootId = 'dsh-deepcanary-root'
const seenKey = 'dsh-deepcanary-notified'

function el<K extends keyof HTMLElementTagNameMap>(tag: K, text?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag)
  if (text !== undefined) node.textContent = text
  return node
}

function notify(items: ClientItem[]): void {
  if (!('Notification' in globalThis) || Notification.permission !== 'granted') return
  const seen = new Set(JSON.parse(localStorage.getItem(seenKey) ?? '[]') as string[])
  for (const item of items.filter(item => (item.level === 'C2' || item.level === 'C3') && !seen.has(item.id)).slice(0, 3)) {
    new Notification(`DeepCanary ${item.level}: ${item.reasonCode}`, { body: item.why, tag: item.id })
    seen.add(item.id)
  }
  localStorage.setItem(seenKey, JSON.stringify([...seen].slice(-100)))
}

async function action(id: string, value: Record<string, unknown>): Promise<void> {
  await fetch('/dsh-deepcanary/action', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id, ...value }) })
  await refresh()
}

function render(snapshot: ClientSnapshot): void {
  let root = document.getElementById(rootId)
  if (!root) {
    root = el('aside')
    root.id = rootId
    root.style.cssText = 'position:fixed;right:16px;bottom:16px;z-index:99999;width:min(380px,calc(100vw - 32px));font:13px/1.4 system-ui,sans-serif;color:#202124;background:#fff;border:1px solid #d9dce1;border-radius:12px;box-shadow:0 10px 32px #0002;overflow:hidden'
    document.body.append(root)
  }
  root.replaceChildren()

  const header = el('div')
  header.style.cssText = 'display:flex;align-items:center;justify-content:space-between;padding:10px 12px;border-bottom:1px solid #eceef1'
  const title = el('strong', 'DeepCanary')
  const indicator = el('span', `${snapshot.status.indicator} · ${snapshot.status.openInbox}`)
  indicator.style.cssText = `color:${snapshot.status.indicator === 'gray' ? '#777' : snapshot.status.indicator === 'yellow' ? '#9a7100' : snapshot.status.indicator === 'orange' ? '#b54b00' : '#b00020'};font-weight:600`
  header.append(title, indicator)
  root.append(header)

  const controls = el('div')
  controls.style.cssText = 'display:flex;gap:6px;padding:8px 12px'
  const requestButton = el('button', '启用浏览器通知')
  requestButton.onclick = () => { void Notification.requestPermission() }
  controls.append(requestButton)
  root.append(controls)

  const list = el('div')
  list.style.cssText = 'max-height:360px;overflow:auto;padding:0 12px 10px'
  if (snapshot.inbox.length === 0) list.append(el('div', '暂无待处理提醒'))
  for (const item of snapshot.inbox.slice(0, 8)) {
    const card = el('section')
    card.style.cssText = 'padding:9px 0;border-top:1px solid #f0f1f3'
    card.append(el('div', `${item.level} · ${item.reasonCode}`), el('div', item.why))
    const evidence = el('small', item.evidence.map(value => value.summary).join(' · '))
    evidence.style.color = '#666'
    card.append(evidence)
    const buttons = el('div')
    buttons.style.cssText = 'display:flex;gap:6px;margin-top:6px'
    const acknowledge = el('button', '已处理')
    acknowledge.onclick = () => { void action(item.id, { action: 'acknowledge' }) }
    const snooze = el('button', '稍后提醒')
    snooze.onclick = () => { void action(item.id, { action: 'snooze', minutes: 30 }) }
    buttons.append(acknowledge, snooze)
    card.append(buttons)
    list.append(card)
  }
  root.append(list)
}

async function refresh(): Promise<void> {
  try {
    const response = await fetch('/dsh-deepcanary/state', { cache: 'no-store' })
    if (!response.ok) return
    const snapshot = await response.json() as ClientSnapshot
    render(snapshot)
    notify(snapshot.inbox)
  } catch {
    // The host may be restarting; the next poll will reconcile the panel.
  }
}

void refresh()
window.setInterval(() => { void refresh() }, 5000)
