export interface PendingQuestionFact {
  callId: string
  state: 'open' | 'continued'
}

export interface UserQuestionFacts {
  active: PendingQuestionFact[]
  settledCallIds: string[]
}

const record = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value)

/** Consume only identities/state from the host projection; never inspect question/answer content. */
export function readUserQuestionFacts(registry: unknown, session: unknown, lastSeq: number | undefined): UserQuestionFacts | undefined {
  if (!record(registry) || typeof registry.snapshot !== 'function' || lastSeq === undefined) return undefined
  try {
    const snapshot: unknown = registry.snapshot(session)
    if (!record(snapshot) || snapshot.asOfSeq !== lastSeq || !record(snapshot.values)) return undefined
    const view = snapshot.values.userQuestions
    if (!record(view) || !Array.isArray(view.active) || !Array.isArray(view.settled)) return undefined
    const active: PendingQuestionFact[] = []
    const settledCallIds: string[] = []
    const seen = new Set<string>()
    for (const entry of view.active) {
      if (!record(entry) || typeof entry.callId !== 'string' || !entry.callId
        || (entry.state !== 'open' && entry.state !== 'continued') || seen.has(entry.callId)) return undefined
      seen.add(entry.callId)
      active.push({ callId: entry.callId, state: entry.state })
    }
    for (const entry of view.settled) {
      if (!record(entry) || typeof entry.callId !== 'string' || !entry.callId || seen.has(entry.callId)) return undefined
      seen.add(entry.callId)
      settledCallIds.push(entry.callId)
    }
    return { active, settledCallIds }
  } catch {
    // An unavailable or stale projection is not proof that a pending question ended.
    return undefined
  }
}
