import { notificationKey } from '../core/reminders.js'

interface NotificationCandidate {
  id: string
  level: 'C0' | 'C1' | 'C2' | 'C3'
  action: string
  occurredAt: string
  lastReminderAt?: string
  status: string
  mutedUntil?: string
  notificationGeneration?: number
  notificationEligible?: boolean
}
export type NotificationClaim = 'granted' | 'already-claimed' | 'already-complete' | 'exhausted' | 'unavailable'

/** Bound work per pass and leave every reschedule independent from older attempts. */
export async function* claimNotificationBatch<T extends NotificationCandidate>(
  items: readonly T[], attempted: Set<string>, claim: (item: T) => Promise<NotificationClaim>, now = Date.now(),
): AsyncGenerator<T> {
  const candidates = items.filter(item => (item.action === 'INTERRUPT' || item.action === 'ESCALATE')
    && (item.status === 'open' || item.status === 'seen') && item.notificationEligible !== false
    && (item.mutedUntil === undefined || !Number.isFinite(Date.parse(item.mutedUntil)) || Date.parse(item.mutedUntil) <= now)
    && !attempted.has(notificationKey(item)))
    .sort((left, right) => Number(right.level.slice(1)) - Number(left.level.slice(1))
      || Date.parse(right.lastReminderAt ?? right.occurredAt) - Date.parse(left.lastReminderAt ?? left.occurredAt))
  let granted = 0
  for (const item of candidates.slice(0, 12)) {
    const outcome = await claim(item)
    if (outcome === 'already-complete' || outcome === 'exhausted') attempted.add(notificationKey(item))
    if (outcome !== 'granted') continue
    yield item
    if (++granted >= 3) break
  }
}
