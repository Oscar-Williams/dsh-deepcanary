import { mkdtemp, readFile, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { DeepCanaryService } from '../src/service.js'
import type { CanarySignal } from '../src/types.js'

const services: DeepCanaryService[] = []

function testSignal(): CanarySignal {
  return {
    schemaVersion: 1,
    id: 'approval-1',
    occurredAt: new Date().toISOString(),
    source: 'tool',
    kind: 'HUMAN_APPROVAL_REQUIRED',
    sessionId: 'session-private-id',
    workspaceId: 'workspace-private-id',
    evidence: [{ type: 'tool-history', authority: 'runtime', ref: 'tool-call', summary: 'approval boundary observed' }],
    dedupeKey: 'approval:session-private-id',
    data: {},
  }
}

afterEach(async () => {
  for (const service of services.splice(0)) await service.dispose()
})

describe('DeepCanaryService', () => {
  it('persists only metadata and never the session content', async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), 'deepcanary-'))
    const service = new DeepCanaryService({ logger: {} } as never, { stateDir: directory, maxInboxItems: 50 })
    services.push(service)
    await service.ready
    const item = await service.ingest(testSignal())
    expect(item).toMatchObject({ level: 'C2', action: 'INTERRUPT', reasonCode: 'HUMAN_APPROVAL_REQUIRED' })
    await service.dispose()
    const persisted = await readFile(service.store.file, 'utf8')
    expect(persisted).toContain('HUMAN_APPROVAL_REQUIRED')
    expect(persisted).not.toContain('session-private-id')
    expect(persisted).not.toContain('workspace-private-id')
    await rm(directory, { recursive: true, force: true })
  })

  it('redacts prompt-shaped provider summaries when privacy-safe summaries are enabled', async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), 'deepcanary-summary-'))
    const service = new DeepCanaryService({ logger: {} } as never, { stateDir: directory, maxInboxItems: 50 })
    services.push(service)
    await service.ready
    await service.ingest({
      ...testSignal(),
      id: 'unsafe-summary',
      evidence: [{ type: 'tool-history', authority: 'runtime', ref: 'unsafe', summary: 'Prompt: use the secret API key and paste the transcript.' }],
    })
    await service.dispose()
    const persisted = await readFile(service.store.file, 'utf8')
    expect(persisted).not.toContain('secret API key')
    expect(persisted).not.toContain('paste the transcript')
    await rm(directory, { recursive: true, force: true })
  })

  it('downgrades the fourth C2 notification to a digest', async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), 'deepcanary-budget-'))
    const service = new DeepCanaryService({ logger: {} } as never, { stateDir: directory, maxInterruptsPerHour: 3, maxInboxItems: 50 })
    services.push(service)
    await service.ready
    const actions: string[] = []
    for (let index = 0; index < 4; index += 1) {
      const item = await service.ingest({ ...testSignal(), id: `approval-${index}`, dedupeKey: `approval:${index}`, occurredAt: new Date(index + 1_000).toISOString() })
      if (item) actions.push(item.action)
    }
    expect(actions).toEqual(['INTERRUPT', 'INTERRUPT', 'INTERRUPT', 'DIGEST'])
    await service.dispose()
    await rm(directory, { recursive: true, force: true })
  })

  it('mounts through the DSH lifecycle adapter and disposes cleanly', async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), 'deepcanary-adapter-'))
    const listeners = new Map<string, (...args: any[]) => void>()
    const service = new DeepCanaryService({
      logger: {},
      on: (name: string, listener: (...args: any[]) => void) => { listeners.set(name, listener) },
    } as never, { stateDir: directory, maxInboxItems: 50 })
    services.push(service)
    await service.ready
    service.start()
    const session = { id: 'lifecycle-session', header: { cwd: 'C:\\work' } }
    listeners.get('session/created')?.(session)
    listeners.get('session/event')?.(session, { type: 'turn/end', seq: 1, data: { reason: 'blocked' } })
    await new Promise(resolve => setImmediate(resolve))
    expect(service.status().sessions).toBe(1)
    expect(service.inbox(10)[0]?.reasonCode).toBe('HUMAN_QUESTION_PENDING')
    listeners.get('session/disposed')?.(session)
    expect(service.status().sessions).toBe(0)
    await service.dispose()
    expect(service.status().plugin.state).toBe('ready')
    await rm(directory, { recursive: true, force: true })
  })

  it('keeps lifecycle transitions explicit and closes a recovered root cause without a new alert', async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), 'deepcanary-lifecycle-'))
    const service = new DeepCanaryService({ logger: {} } as never, { stateDir: directory, maxInboxItems: 50 })
    services.push(service)
    await service.ready
    const item = await service.ingest({
      ...testSignal(),
      id: 'stall-1',
      kind: 'HOST_SUSPECTED_STALL',
      sessionId: 'runtime-session',
      dedupeKey: 'stall-1',
      bundleKey: 'runtime-session:stall',
      severityHint: 2,
    })
    expect(item?.status).toBe('open')
    expect(service.seen('stall-1')).toBe(true)
    expect(service.inbox(10)[0]?.status).toBe('seen')
    const recovered = await service.ingest({
      ...testSignal(),
      id: 'recovered-1',
      kind: 'HOST_STALL_RECOVERED',
      sessionId: 'runtime-session',
      dedupeKey: 'recovered-1',
      bundleKey: 'runtime-session:stall',
      severityHint: 1,
    })
    expect(recovered?.status).toBe('recovered')
    expect(service.snapshot().inbox).toHaveLength(0)
    expect(service.inbox(10)[0]).toMatchObject({ id: 'stall-1', status: 'recovered', recoveredAt: expect.any(String) })

    const receipt = await service.performAction('same-request', 'stall-1', 'feedback', { useful: true })
    const replay = await service.performAction('same-request', 'stall-1', 'feedback', { useful: true })
    expect(replay).toEqual(receipt)
    await service.dispose()
    await rm(directory, { recursive: true, force: true })
  })

  it('re-associates hashed session references after restart without persisting raw identifiers', async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), 'deepcanary-restart-'))
    const first = new DeepCanaryService({ logger: {} } as never, { stateDir: directory, maxInboxItems: 50 })
    services.push(first)
    await first.ready
    const item = await first.ingest(testSignal())
    expect(item).toBeDefined()
    await first.dispose()

    const listeners = new Map<string, (...args: any[]) => void>()
    const second = new DeepCanaryService({
      logger: {},
      on: (name: string, listener: (...args: any[]) => void) => { listeners.set(name, listener) },
    } as never, { stateDir: directory, maxInboxItems: 50 })
    services.push(second)
    await second.ready
    second.start()
    listeners.get('session/created')?.({ id: 'session-private-id', header: { cwd: 'C:\\work' } })
    expect(second.jump(item?.id ?? '')).toMatchObject({ available: true, sessionId: 'session-private-id' })
    listeners.get('session/disposed')?.({ id: 'session-private-id' })
    expect(second.inbox(10)[0]).toMatchObject({ status: 'expired' })
    await second.dispose()
    await rm(directory, { recursive: true, force: true })
  })

  it('exposes policy explanation and performs a read-only candidate dry-run', async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), 'deepcanary-policy-'))
    const service = new DeepCanaryService({ logger: {} } as never, { stateDir: directory, maxInboxItems: 50 })
    services.push(service)
    await service.ready
    const item = await service.ingest(testSignal())
    expect(item?.decisionTrace).toMatchObject({ finalLevel: 'C2', finalAction: 'INTERRUPT' })
    const explanation = service.explain(item?.id ?? '')
    expect(explanation?.decisionTrace).toMatchObject({
      matchedRules: ['reason.default-c2'],
      authoritySummary: { strongest: 'runtime' },
      finalAction: 'INTERRUPT',
    })
    const revision = service.status().revision
    const result = await service.dryRun({
      signal: { kind: 'HUMAN_APPROVAL_REQUIRED', authority: 'runtime', severityHint: 2 },
      candidate: { notificationLevel: 'C1' },
    })
    expect(result).toMatchObject({ mode: 'dry-run', readOnly: true, changed: true })
    expect(result.current.action).toBe('INTERRUPT')
    expect(result.candidate.action).toBe('INBOX')
    expect(result.differences).toContainEqual({ field: 'action', current: 'INTERRUPT', candidate: 'INBOX' })
    expect(service.status().revision).toBe(revision)
    expect(service.inbox(10)).toHaveLength(1)
    await service.dispose()
    await rm(directory, { recursive: true, force: true })
  })

  it('rejects untyped dry-run fields before policy evaluation', async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), 'deepcanary-policy-input-'))
    const service = new DeepCanaryService({ logger: {} } as never, { stateDir: directory, maxInboxItems: 50 })
    services.push(service)
    await service.ready
    await expect(service.dryRun({
      signal: { kind: 'TASK_COMPLETED', authority: 'runtime', healthy: 'true' as never },
    })).rejects.toThrow('dry-run.signal.healthy must be boolean')
    expect(service.status().revision).toBe(0)
    expect(service.inbox(10)).toHaveLength(0)
    await service.dispose()
    await rm(directory, { recursive: true, force: true })
  })

  it('keeps a high-throughput burst within the configured Inbox bound', async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), 'deepcanary-throughput-'))
    const service = new DeepCanaryService({ logger: {} } as never, {
      stateDir: directory,
      notificationLevel: 'C1',
      dedupeWindowMinutes: 0,
      bundleWindowSeconds: 0,
      maxInboxItems: 50,
    })
    services.push(service)
    await service.ready
    const jobs = Array.from({ length: 250 }, (_, index) => service.ingest({
      ...testSignal(),
      id: `throughput-${index}`,
      dedupeKey: `throughput:${index}`,
      occurredAt: new Date(1_000 + index).toISOString(),
      kind: 'TASK_COMPLETED',
    }))
    const results = await Promise.all(jobs)
    expect(results.filter(Boolean)).toHaveLength(250)
    expect(service.snapshot().inbox).toHaveLength(50)
    expect(service.snapshot().status.openInbox).toBe(50)
    await service.dispose()
    await rm(directory, { recursive: true, force: true })
  })
})
