/** Small, DOM-agnostic helpers for returning from an attention sink to an item. */

export interface SelectedAttentionElement {
  dataset: { deepcanaryItem?: string }
  scrollIntoView: (options?: { block?: 'nearest'; inline?: 'nearest' }) => void
}

/**
 * Bring the selected Inbox item into the panel's visible scroll range.
 *
 * @returns whether a matching item was found and positioned.
 */
export function positionSelectedAttention(
  elements: Iterable<SelectedAttentionElement>,
  id: string,
): boolean {
  const selected = [...elements].find(element => element.dataset.deepcanaryItem === id)
  if (selected === undefined) return false
  selected.scrollIntoView({ block: 'nearest', inline: 'nearest' })
  return true
}

/** Complete the browser-notification return path in a deterministic order. */
export function handleNotificationClick(
  notification: { close: () => void },
  id: string,
  focus: () => void,
  open: (id: string) => void,
  openSession?: (sessionId: string) => boolean,
  navigate?: (url: string) => void,
  url?: string,
  sessionId?: string,
): void {
  focus()
  const hasNativeSessionTarget = sessionId !== undefined && openSession !== undefined
  const openedSession = sessionId !== undefined && openSession !== undefined
    ? openSession(sessionId)
    : false
  open(id)
  // A DSH session service may reject a stale or unknown id. In that case the
  // caller keeps the Inbox open so the user can see the unavailable state;
  // a guessed URL must not select a different session. URL fallback remains
  // available only for hosts that do not provide the native session service.
  if (!hasNativeSessionTarget && !openedSession && navigate !== undefined && url !== undefined) navigate(url)
  notification.close()
}
