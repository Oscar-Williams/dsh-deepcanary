import type { InboxItem } from '../types.js'

function retentionPriority(item: InboxItem): number {
  if (item.status !== 'open' && item.status !== 'seen' && item.status !== 'snoozed') return 0
  if (item.level === 'C3') return 100
  if (item.status === 'snoozed' || item.reminderPending) return 80
  return item.level === 'C2' ? 60 : 40
}

/** Keep human waits and deliberately scheduled work during routine update bursts. */
export function retainInboxItems<T extends InboxItem>(items: readonly T[], limit: number): T[] {
  if (items.length <= limit) return [...items]
  const retained = new Set([...items].sort((left, right) => retentionPriority(right) - retentionPriority(left)
    || Date.parse(right.lastReminderAt ?? right.occurredAt) - Date.parse(left.lastReminderAt ?? left.occurredAt)).slice(0, limit))
  return items.filter(item => retained.has(item))
}
