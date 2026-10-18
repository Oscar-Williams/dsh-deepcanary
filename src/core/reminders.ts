import type { AttentionVerdict, InboxItem } from '../types.js'

export const MAX_NOTIFICATION_GENERATION = 2_147_483_647

export function notificationGeneration(item: { notificationGeneration?: number }): number {
  return item.notificationGeneration ?? 0
}

/** Keep the original delivery identity readable while fencing each explicit reschedule. */
export function notificationKey(item: { id: string; notificationGeneration?: number }): string {
  const generation = notificationGeneration(item)
  return generation === 0 ? item.id : `${item.id}:reminder:${generation}`
}

export function notificationCondition(item: InboxItem): string {
  const base = item.bundleKey ?? item.id
  const generation = notificationGeneration(item)
  return generation === 0 ? base : `${base}:reminder:${generation}`
}

/** Reapply delivery preferences to the existing classification and evidence. */
export function reminderVerdict(item: InboxItem): AttentionVerdict {
  const action = item.level === 'C3' ? 'ESCALATE' : item.level === 'C2' ? 'INTERRUPT' : item.level === 'C1' ? 'INBOX' : 'IGNORE'
  const transient = new Set(['quiet-hours', 'notification-level', 'interrupt-budget'])
  return { ...item, action, ...(item.decisionTrace === undefined ? {} : { decisionTrace: {
    ...item.decisionTrace,
    appliedScopes: [...new Set([...item.decisionTrace.appliedScopes.filter(scope => !transient.has(scope)), 'scheduled-reminder'])],
    suppressedBy: item.decisionTrace.suppressedBy.filter(scope => !transient.has(scope)),
    finalAction: action,
  } }) }
}
