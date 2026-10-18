import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'
import { loadRuntime } from './runtime-checkout.mjs'

// Controlled public Session/question facts, with an advanced clock for deadlines.
// This contract runs no model/tool task and supplies no natural-use evidence.
const runtime = await loadRuntime(process.env.DSH_RUNTIME)
const { Context } = await runtime.importPackage('@deepseek-ai/cordis')
const { SessionStore } = await runtime.importPackage('@deepseek-ai/dsh-session')
const { SessionProjectionRegistry } = await runtime.importPackage('@deepseek-ai/dsh-session-projection')
const { UserQuestionService } = await runtime.importPackage('@deepseek-ai/dsh-user-questions')
const { createUserMessage } = await runtime.importPackage('@deepseek-ai/dsh-llm')
const { DeepCanaryService } = await import('../lib/service.js')
const { hashMetadata } = await import('../lib/persistence.js')
const { notificationKey } = await import('../lib/core/reminders.js')
const directory = await mkdtemp(path.join(process.env.DEEPCANARY_TEST_TMP ?? os.tmpdir(), 'deepcanary-reminders-contract-'))
const ctx = new Context()
const fibers = []
const checks = {}
const originalNow = Date.now
let now = originalNow()
Date.now = () => now
let service, leave
async function check(name, predicate) {
  for (let attempt = 0; attempt < 100 && !predicate(); attempt++) await delay(10)
  if (!predicate()) console.log(JSON.stringify({ check: name, reconciliation: service?.status().reconciliation,
    items: service?.inbox(20).map(item => ({ reason: item.reasonCode, level: item.level, questionState: item.questionState, status: item.status })) }))
  assert.ok(predicate(), name)
  checks[name] = true
}
const claim = (generation, owner = 'controlled-renderer-a') => ({ notificationGeneration: generation,
  notificationClientInstance: owner, notificationExpiresAt: new Date(now + 30_000).toISOString() })
try {
  fibers.push(await ctx.plugin(SessionStore))
  fibers.push(await ctx.plugin(SessionProjectionRegistry))
  fibers.push(await ctx.plugin(UserQuestionService))
  const session = ctx.sessions.prepare('controlled-reminder-owner')
  leave = ctx.sessions.enter(session)
  ctx.sessions.announce(session)
  session.append('turn/start', { turn: 1 })
  session.append('request/header', { header: { config: {}, tools: [{ name: 'ask_user_question', description: 'Controlled contract',
    parameters: { type: 'object', properties: { questions: { type: 'array' }, timeout: { type: 'integer' } } } }] }, reason: 'initial' })
  const callId = 'controlled-reminder-question'
  session.append('tool/call', { turn: 1, step: 1, callId, name: 'ask_user_question', arguments: JSON.stringify({
    questions: [{ id: 'choice', question: 'Controlled reminder fixture' }], timeout: 1,
  }) })
  service = new DeepCanaryService(ctx, { stateDir: directory })
  await service.ready
  service.start()
  await check('publicQuestionCreatesAuthoritativeC3', () => service.snapshot().inbox.some(item => item.questionState === 'open' && item.level === 'C3'))
  const item = service.inbox(30).find(item => item.questionState === 'open')
  service.snooze(item.id, 5)
  assert.equal(service.snapshot().scheduled[0].id, item.id)
  checks.scheduledWorkRetainsOriginalOwner = service.snapshot().scheduled[0].sessionId === session.id
  assert.equal((await service.performAction('before-due', item.id, 'notification-claim', claim(1))).body.result.outcome, 'unavailable')
  checks.futureReminderDoesNotSend = true
  await service.dispose()
  service = new DeepCanaryService(ctx, { stateDir: directory })
  await service.ready
  service.start()
  await check('defaultModeRestoresSchedule', () => service.snapshot().scheduled[0]?.notificationGeneration === 1)
  now += 5 * 60_000 + 1
  await check('currentAuthorityRearmsOneGeneration', () => service.snapshot().inbox.some(candidate => candidate.id === item.id && candidate.notificationGeneration === 1 && candidate.notificationEligible))
  assert.equal((await service.performAction('stale-generation', item.id, 'notification-claim', claim(0))).body.result.outcome, 'unavailable')
  checks.staleGenerationRejected = true
  assert.equal((await service.performAction('current-generation', item.id, 'notification-claim', claim(1))).body.result.outcome, 'granted')
  assert.equal((await service.performAction('other-renderer', item.id, 'notification-claim', claim(1, 'controlled-renderer-b'))).body.result.outcome, 'already-claimed')
  checks.singleRendererClaim = true
  const current = service.explain(item.id)
  const key = notificationKey(current)
  const delivery = { notificationGeneration: 1, notificationStage: 'constructed', notificationAttemptId: hashMetadata('controlled-generation-one'),
    notificationRef: hashMetadata(`${key}:notification`), tagRef: hashMetadata(`${key}:tag`),
    titleKey: `notification.title.${item.reasonCode}`, bodyFingerprint: hashMetadata('controlled-enum-summary'), observedAt: new Date(now).toISOString() }
  assert.equal((await service.performAction('constructed', item.id, 'notification-delivery', delivery)).body.updated, true)
  await service.dispose()
  service = new DeepCanaryService(ctx, { stateDir: directory })
  await service.ready
  service.start()
  assert.equal((await service.performAction('after-reload', item.id, 'notification-claim', claim(1))).body.result.outcome, 'already-complete')
  checks.defaultModeDoesNotRedeliver = true
  service.snooze(item.id, 5)
  session.append('user/message', createUserMessage({ source: { kind: 'user-question-reply', callId, outcome: 'answered' },
    content: [{ type: 'text', text: JSON.stringify({ answers: [{ id: 'choice', selected: [], custom: 'Controlled answer' }] }) }],
  }), { surfaceOp: 'append' })
  await check('answerCancelsScheduledQuestion', () => service.explain(item.id)?.status === 'recovered' && service.snapshot().scheduled.length === 0)
  now += 5 * 60_000 + 1
  assert.equal(service.snapshot().inbox.some(candidate => candidate.id === item.id), false)
  checks.closedQuestionStaysClosedAfterDeadline = true
  assert.equal(JSON.stringify(service.snapshot()).includes('Controlled answer'), false)
  checks.contentRemainsWithHost = true
  console.log(JSON.stringify({ passed: true, runtimeVersion: runtime.version, provenance: 'controlled-public-session-question-and-clock', checks }, null, 2))
} finally {
  Date.now = originalNow
  await service?.dispose()
  leave?.()
  for (const fiber of fibers.reverse()) await fiber.dispose()
  await rm(directory, { recursive: true, force: true })
}
