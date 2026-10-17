import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'
import { loadRuntime } from './runtime-checkout.mjs'

// Controlled real public Session/projection objects; no model run, browser,
// answerer attachment, native notification, or release-level compatibility claim.
const runtime = await loadRuntime(process.env.DSH_RUNTIME)
const { Context } = await runtime.importPackage('@deepseek-ai/cordis')
const { SessionStore } = await runtime.importPackage('@deepseek-ai/dsh-session')
const { SessionProjectionRegistry } = await runtime.importPackage('@deepseek-ai/dsh-session-projection')
const { UserQuestionService } = await runtime.importPackage('@deepseek-ai/dsh-user-questions')
const { createToolResultMessage, createUserMessage } = await runtime.importPackage('@deepseek-ai/dsh-llm')
const { DeepCanaryService } = await import('../lib/service.js')
const { ContextDshAdapter } = await import('../lib/adapters/dsh.js')
const ctx = new Context()
const directory = await mkdtemp(path.join(os.tmpdir(), 'deepcanary-020-contract-'))
const fibers = []
const checks = {}
let service
let leave
async function check(name, predicate) {
  for (let attempt = 0; attempt < 100 && !predicate(); attempt++) await delay(10)
  assert.ok(predicate(), name)
  checks[name] = true
}
try {
  fibers.push(await ctx.plugin(SessionStore))
  fibers.push(await ctx.plugin(SessionProjectionRegistry))
  fibers.push(await ctx.plugin(UserQuestionService))
  const session = ctx.sessions.prepare('contract-timed-question')
  leave = ctx.sessions.enter(session)
  ctx.sessions.announce(session)
  session.append('turn/start', { turn: 1 })
  session.append('request/header', {
    header: { config: {}, tools: [{ name: 'ask_user_question', description: 'Controlled fixture', parameters: {
      type: 'object', properties: { questions: { type: 'array' }, timeout: { type: 'integer' } },
    } }] }, reason: 'initial',
  })
  const callId = 'controlled-question-call'
  session.append('tool/call', { turn: 1, step: 1, callId, name: 'ask_user_question', arguments: JSON.stringify({
    questions: [{ id: 'scope', question: 'Controlled fixture, not user content' }], timeout: 1,
  }) })
  service = new DeepCanaryService(ctx, { stateDir: directory })
  await service.ready
  service.start()
  const question = () => service.inbox(20).find(item => item.questionState !== undefined)
  await check('nonEmptyStartupC3', () => question()?.level === 'C3' && question()?.questionState === 'open')
  const itemId = question().id
  session.append('tool/result', { turn: 1, step: 1,
    message: createToolResultMessage({ callId, content: [{ type: 'text', text: JSON.stringify({ pending: true, callId }) }], isError: false }),
  }, { surfaceOp: 'append' })
  await check('realTimeoutDowngradesSameItem', () => question()?.id === itemId && question()?.level === 'C1' && question()?.questionState === 'continued' && question()?.status === 'open')
  session.append('turn/end', { turn: 1, reason: { kind: 'completed' } })
  await check('turnEndKeepsAnswerableQuestion', () => question()?.id === itemId && question()?.status === 'open')
  session.append('user/message', createUserMessage({ source: { kind: 'user-question-reply', callId, outcome: 'answered' },
    content: [{ type: 'text', text: JSON.stringify({ answers: [{ id: 'scope', selected: [], custom: 'Controlled reply' }] }) }],
  }), { surfaceOp: 'append' })
  await check('admittedReplyResolves', () => question()?.status === 'recovered')
  const adapter = new ContextDshAdapter(ctx)
  {
    for (const longRemains of [true, false]) {
      const turn = longRemains ? 2 : 3
      session.append('turn/start', { turn })
      const calls = [{ name: 'bash', callId: `long-${turn}` }, { name: 'read_file', callId: `short-${turn}` }]
      if (!longRemains) calls.reverse()
      for (const call of calls) session.append('tool/call', { turn, step: 1, ...call, arguments: '{}' })
      await adapter.reconcile()
      assert.equal((await adapter.getSessionSnapshot(session.id)).toolClass, 'long-running')
      session.append('tool/result', { turn, step: 1, message: createToolResultMessage({
        callId: `${longRemains ? 'short' : 'long'}-${turn}`, content: [], isError: false,
      }) }, { surfaceOp: 'append' })
      await adapter.reconcile()
      const remaining = await adapter.getSessionSnapshot(session.id)
      assert.equal(remaining.activeToolCount, 1)
      assert.equal(remaining.toolClass, longRemains ? 'long-running' : 'ordinary')
      checks[longRemains ? 'parallelLongToolKeepsGrace' : 'finishedLongToolReleasesGrace'] = true
      session.append('turn/end', { turn, reason: { kind: 'completed' } })
    }
  }
  console.log(JSON.stringify({ runtimeVersion: runtime.version, runtimeCommit: runtime.commit,
    provenance: 'controlled-public-session-v4-and-host-question-projection',
    artifact: 'current-local-build', checks, passed: true,
    notValidated: ['latest-client-settings', 'web-ui', 'OS-notification', 'long-duration-soak'],
  }, null, 2))
} finally {
  await service?.dispose()
  leave?.()
  for (const fiber of fibers.reverse()) await fiber.dispose()
  await rm(directory, { recursive: true, force: true })
}
