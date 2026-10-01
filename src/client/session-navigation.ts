/** Navigation belongs to uiWorkspace on newer DSH, not the Session Controller. */
export interface SessionNavigationContext {
  get?: (name: string) => unknown
  uiWorkspace?: { openSession: (sessionId: string) => void }
  sessions: {
    open?: (sessionId: string) => void
    list?: { getSnapshot?: () => { phase: string; ids: readonly string[] } }
  }
}

/** Catalog membership proves a retained history target without resuming a task. */
export function hasCatalogSession(ctx: SessionNavigationContext, sessionId: string): boolean {
  try {
    const snapshot = ctx.sessions.list?.getSnapshot?.()
    return snapshot?.phase === 'ready' && snapshot.ids.includes(sessionId)
  } catch {
    return false
  }
}

/** True means the host accepted navigation, not that loading has completed. */
export function openAttentionSession(ctx: SessionNavigationContext, sessionId: string): boolean {
  if (!sessionId.trim()) return false
  if (ctx.sessions.list?.getSnapshot !== undefined && !hasCatalogSession(ctx, sessionId)) return false
  try {
    // Resolve at click time: optional services can activate after our client.
    const workspace = ctx.get?.('uiWorkspace') ?? ctx.uiWorkspace
    if (workspace !== null && typeof workspace === 'object'
      && 'openSession' in workspace && typeof workspace.openSession === 'function') {
      workspace.openSession(sessionId)
      return true
    }
    if (typeof ctx.sessions.open !== 'function') return false
    ctx.sessions.open(sessionId)
    return true
  } catch {
    // Never retry a rejected native target with a different owner or guessed URL.
    return false
  }
}
