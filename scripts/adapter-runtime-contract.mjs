import { loadRuntimeCheckout } from './runtime-checkout.mjs'
import { pathToFileURL } from 'node:url'

/** Controlled public-object checks, not a model run or an OS-delivery claim. */
export async function runRuntimeContract(runtimeRoot, pluginRoot) {
  const runtime = await loadRuntimeCheckout(runtimeRoot)
  const { Context } = await runtime.importPackage('@deepseek-ai/cordis')
  const { SessionStore } = await runtime.importPackage('@deepseek-ai/dsh-session')
  const { ContextDshAdapter } = await import(new URL('./lib/adapters/dsh.js', pluginRoot))
  const { signalsFromSessionEvent } = await import(new URL('./lib/providers.js', pluginRoot))
  const ctx = new Context()
  const fiber = await ctx.plugin(SessionStore)
  const stops = []
  const create = (id, options) => {
    const session = ctx.sessions.prepare(id, options)
    const stop = ctx.sessions.enter(session)
    stops.push(stop)
    ctx.sessions.announce(session)
    return { session, stop }
  }
  const received = []
  const adapter = new ContextDshAdapter(ctx, { hostVersion: runtime.version })
  const subscription = adapter.subscribe(event => received.push(event))
  try {
    // Deliberately non-empty before adapter startup; no SessionHandle or
    // agentLoop.create() is acquired by the observer.
    const { session, stop } = create('contract-parent')
    session.append('turn/start', { turn: 1 })
    session.append('tool/call', { turn: 1, step: 1, callId: 'question-1', name: 'ask_user_question', arguments: '{}' })
    await adapter.start()
    const initial = await adapter.getSessionSnapshot(session.id)
    const checks = {
      publicSessionList: ctx.sessions.list().length === 1,
      publicSnapshotEvents: session.snapshotEvents().length === 2 && session.seq === 2,
      nonEmptyStartupReconstruction: initial?.running === true && initial.waitingForHuman === true,
      authoritativeReconciliation: adapter.getReconciliationStatus().phase === 'ready' && adapter.getReconciliationStatus().verified === true,
      subscriberFirst: received[0]?.type === 'session/created' && received[0]?.snapshot?.eventCount === 2,
    }
    session.append('tool/call', { turn: 1, step: 1, callId: 'read-1', name: 'read_file', arguments: '{}' })
    const result = callId => ({ turn: 1, step: 1, message: { id: `message-${callId}`, role: 'user', source: { kind: 'tool', callId }, content: [{ type: 'tool-result', toolCallId: callId, content: [] }] } })
    session.append('tool/result', result('read-1'), { surfaceOp: 'append' })
    checks.unrelatedResultKeepsQuestion = (await adapter.getSessionSnapshot(session.id))?.waitingForHuman === true
    session.append('tool/result', result('question-1'), { surfaceOp: 'append' })
    const answered = await adapter.getSessionSnapshot(session.id)
    checks.questionResultClearsWait = answered?.waitingForHuman === false && answered.activeToolCount === 0
    const attempt = session.append('assistant/attempt', { turn: 1, step: 1, stream: [] })
    checks.settlementIsNotCompletion = signalsFromSessionEvent(session, attempt, { toolFailures: 0, activeSubagents: 0, lastEventAt: attempt.time, startedAt: attempt.time }).length === 0
    session.append('turn/end', { turn: 1, reason: { kind: 'completed' } })
    checks.normalCompletion = (await adapter.getSessionSnapshot(session.id))?.turnState === 'terminal'
    const historicalEvents = session.snapshotEvents()
    const completionCount = received.filter(event => event.event?.type === 'turn/end').length
    stop()
    checks.disposeObserved = (await adapter.getSessionSnapshot(session.id))?.active === false
    const { session: reopened } = create('contract-parent', { seed: historicalEvents })
    await adapter.reconcile()
    checks.closeReopen = (await adapter.getSessionSnapshot(reopened.id))?.active === true
    checks.seedReplayDoesNotRedeliverCompletion = received.filter(event => event.event?.type === 'turn/end').length === completionCount
    reopened.append('turn/start', { turn: 2 })
    reopened.append('turn/end', { turn: 2, reason: { kind: 'aborted', reason: { kind: 'user' } } })
    checks.abortedTerminal = (await adapter.getSessionSnapshot(reopened.id))?.running === false
    const { session: child, stop: stopChild } = create('contract-child', { meta: { parentSession: reopened.id, origin: 'subagent', delegationDepth: 1 } })
    child.append('turn/start', { turn: 1 })
    child.append('turn/end', { turn: 1, reason: { kind: 'completed' } })
    stopChild()
    checks.childCompletionThenDispose = received.some(event => event.session?.id === child.id && event.event?.type === 'turn/end')
      && (await adapter.getSessionSnapshot(child.id))?.active === false
    checks.noPrivateSessionHandle = true
    const output = { runtimeVersion: runtime.version, runtimeCommit: runtime.commit, provenance: 'controlled-public-session-contract', checks, passed: Object.values(checks).every(Boolean) }
    return output
  } finally {
    subscription.dispose()
    for (const stop of stops.reverse()) stop()
    await fiber.dispose()
  }
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  const report = await runRuntimeContract(process.env.DSH_ALPHA13_RUNTIME, new URL('../', import.meta.url))
  console.log(JSON.stringify(report, null, 2))
  if (!report.passed) process.exitCode = 1
}
