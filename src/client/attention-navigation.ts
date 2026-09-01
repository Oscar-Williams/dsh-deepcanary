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
  open: (id: string) => void,
  focus: () => void,
): void {
  focus()
  open(id)
  notification.close()
}
