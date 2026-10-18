import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'
import { loadRuntime } from './runtime-checkout.mjs'

const runtime = await loadRuntime(process.env.DSH_RUNTIME)
const { Context } = await runtime.importPackage('@deepseek-ai/cordis')
const { SessionStore } = await runtime.importPackage('@deepseek-ai/dsh-session')
const { AgentRegistry } = await runtime.importPackage('@deepseek-ai/dsh-agent')
const { LocalJobRegistry } = await runtime.importPackage('@deepseek-ai/dsh-jobs-local')
const { DeepCanaryService } = await import('../lib/service.js')
const ctx = new Context()
const directory = await mkdtemp(path.join(os.tmpdir(), 'deepcanary-background-contract-'))
const fibers = []
const leaves = []
const resolvers = []
const checks = {}
let service
async function check(name, predicate) {
  for (let attempt = 0; attempt < 100 && !predicate(); attempt++) await delay(10)
  if (!predicate()) console.log(JSON.stringify({ check: name, background: service?.status().background,
    inbox: service?.inbox(30).map(item => ({ reason: item.reasonCode, message: item.messageKey })), jobs: ctx.jobs.list().length,
    ownerJobs: ctx.jobs.list('contract-background-owner').length }))
  assert.ok(predicate(), name)
  checks[name] = true
}
try {
  fibers.push(await ctx.plugin(SessionStore))
  fibers.push(await ctx.plugin(AgentRegistry))
  fibers.push(await ctx.plugin(LocalJobRegistry))
  const session = ctx.sessions.prepare('contract-background-owner')
  leaves.push(ctx.sessions.enter(session))
  ctx.sessions.announce(session)
  // A controlled carrier supplies ownership; the released registries own
  // registration, Session logging, waiter semantics and lifecycle events.
  leaves.push(ctx.agents.enter({ id: session.id, session, ctx }))
  leaves.push(ctx.jobs.attachController('controlled-contract-owner'))
  const start = () => {
    let resolve
    const done = new Promise(value => { resolve = value })
    resolvers.push(resolve)
    const id = ctx.jobs.start({ kind: 'bash', owner: session.id, label: 'Controlled public job contract',
      run: () => ({ done, cancel: () => resolve({ status: 'killed' }) }) })
    return { id, resolve }
  }
  service = new DeepCanaryService(ctx, { stateDir: directory })
  await service.ready
  service.start()
  const first = start()
  await check('healthyBackgroundIsQuiet', () => service.status().background?.running === 1 && service.inbox(30).length === 0)
  session.append('turn/start', { turn: 1 })
  session.append('turn/end', { turn: 1, reason: { kind: 'completed' } })
  await check('replyEndRetainsBackgroundMeaning', () => service.inbox(30).some(item => item.messageKey === 'item.reason.TURN_COMPLETED_BACKGROUND'))
  first.resolve({ status: 'failed', detail: 'PRIVATE-DETAIL-MUST-STAY-WITH-HOST' })
  await check('unawaitedFailureC2ReturnsToOwner', () => service.inbox(30).some(item => item.messageKey === 'item.reason.BACKGROUND_TASK_FAILED' && item.level === 'C2' && item.sessionId === session.id))
  session.append('turn/start', { turn: 2 })
  session.append('turn/end', { turn: 2, reason: { kind: 'error' } })
  await delay(30)
  assert.equal(service.inbox(30).filter(item => item.reasonCode === 'TASK_FAILED').length, 1)
  checks.relatedForegroundFailureSharesInterrupt = true
  const awaited = start()
  const waiting = ctx.jobs.wait(awaited.id, 1_000, session.id)
  awaited.resolve({ status: 'completed' })
  await waiting
  await delay(30)
  assert.equal(service.inbox(30).some(item => item.messageKey === 'item.reason.BACKGROUND_TASK_COMPLETED'), false)
  checks.collectedCompletionStaysQuiet = true
  const pending = start()
  await check('nextBackgroundTracked', () => service.status().background?.running === 1)
  await service.dispose()
  pending.resolve({ status: 'completed' })
  await delay(30)
  service = new DeepCanaryService(ctx, { stateDir: directory })
  await service.ready
  service.start()
  await check('reloadCollectsMissedCompletionOnce', () => service.inbox(30).filter(item => item.messageKey === 'item.reason.BACKGROUND_TASK_COMPLETED_CATCHUP').length === 1)
  const count = service.inbox(30).length
  await service.dispose()
  service = new DeepCanaryService(ctx, { stateDir: directory })
  await service.ready
  service.start()
  await delay(30)
  assert.equal(service.inbox(30).length, count)
  checks.secondReloadDoesNotRepeat = true
  assert.equal(JSON.stringify(service.snapshot()).includes('PRIVATE-DETAIL'), false)
  checks.metadataPrivacy = true
  console.log(JSON.stringify({ passed: true, runtimeVersion: runtime.version,
    provenance: 'controlled-released-session-agent-and-local-job-registries', checks }, null, 2))
} finally {
  for (const resolve of resolvers) resolve({ status: 'killed' })
  await service?.dispose()
  for (const leave of leaves.reverse()) leave()
  for (const fiber of fibers.reverse()) await fiber.dispose()
  await rm(directory, { recursive: true, force: true })
}
