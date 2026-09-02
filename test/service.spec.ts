import { mkdtemp, readFile, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
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
  it('persists only metadata and a local opaque session handle, never session content', async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), 'deepcanary-'))
    const service = new DeepCanaryService({ logger: {} } as never, { stateDir: directory, maxInboxItems: 50 })
    services.push(service)
    await service.ready
    const item = await service.ingest(testSignal())
    expect(item).toMatchObject({ level: 'C2', action: 'INTERRUPT', reasonCode: 'HUMAN_APPROVAL_REQUIRED' })
    await service.dispose()
    const persisted = await readFile(service.store.file, 'utf8')
    expect(persisted).toContain('HUMAN_APPROVAL_REQUIRED')
    expect(persisted).toContain('session-private-id')
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

  it('charges one interrupt when a C1 bundle later escalates, and keeps policy caps budget-free', async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), 'deepcanary-bundle-budget-'))
    const service = new DeepCanaryService({ logger: {} } as never, { stateDir: directory, maxInterruptsPerHour: 1, maxInboxItems: 50 })
    services.push(service)
    await service.ready
    const now = Date.now()
    const first = await service.ingest({
      ...testSignal(),
      id: 'bundle-root',
      kind: 'TASK_COMPLETED',
      severityHint: 1,
      dedupeKey: 'bundle-root',
      bundleKey: 'same-root',
      occurredAt: new Date(now).toISOString(),
      evidence: [{ type: 'session-event', authority: 'runtime', ref: 'bundle-root', summary: 'normal completion' }],
    })
    expect(first).toMatchObject({ action: 'INBOX', bundleCount: 1 })
    const escalated = await service.ingest({
      ...testSignal(),
      id: 'bundle-escalation',
      kind: 'HUMAN_APPROVAL_REQUIRED',
      dedupeKey: 'bundle-escalation',
      bundleKey: 'same-root',
      occurredAt: new Date(now + 1).toISOString(),
    })
    expect(escalated).toMatchObject({ level: 'C2', action: 'INTERRUPT', bundleCount: 2 })
    expect(service.status().delivery.interruptBudget).toMatchObject({ used: 1, remaining: 0 })
    const repeated = await service.ingest({
      ...testSignal(),
      id: 'bundle-repeat',
      kind: 'HUMAN_APPROVAL_REQUIRED',
      dedupeKey: 'bundle-repeat',
      bundleKey: 'same-root',
      occurredAt: new Date(now + 2).toISOString(),
    })
    expect(repeated).toMatchObject({ level: 'C2', action: 'INTERRUPT', bundleCount: 3 })
    expect(service.status().delivery.interruptBudget).toMatchObject({ used: 1, remaining: 0 })

    const quietDirectory = await mkdtemp(path.join(os.tmpdir(), 'deepcanary-bundle-quiet-'))
    const quiet = new DeepCanaryService({ logger: {} } as never, {
      stateDir: quietDirectory,
      maxInterruptsPerHour: 1,
      quietHours: { enabled: true, start: '00:00', end: '00:00' },
      maxInboxItems: 50,
    })
    services.push(quiet)
    await quiet.ready
    await quiet.ingest({
      ...testSignal(),
      id: 'quiet-root',
      kind: 'TASK_COMPLETED',
      severityHint: 1,
      dedupeKey: 'quiet-root',
      bundleKey: 'quiet-same-root',
      occurredAt: new Date(10_000).toISOString(),
      evidence: [{ type: 'session-event', authority: 'runtime', ref: 'quiet-root', summary: 'normal completion' }],
    })
    const quietEscalation = await quiet.ingest({
      ...testSignal(),
      id: 'quiet-escalation',
      kind: 'HUMAN_APPROVAL_REQUIRED',
      dedupeKey: 'quiet-escalation',
      bundleKey: 'quiet-same-root',
      occurredAt: new Date(10_001).toISOString(),
    })
    expect(quietEscalation).toMatchObject({ level: 'C2', action: 'DIGEST', bundleCount: 2 })
    expect(quiet.status().delivery.interruptBudget).toMatchObject({ used: 0, remaining: 1 })
    await service.dispose()
    await quiet.dispose()
    await rm(directory, { recursive: true, force: true })
    await rm(quietDirectory, { recursive: true, force: true })
  })

  it('returns action outcomes, exposes delivery policy state, and persists safe type suppression', async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), 'deepcanary-suppression-'))
    const service = new DeepCanaryService({ logger: {} } as never, { stateDir: directory, maxInboxItems: 50 })
    services.push(service)
    await service.ready
    const testNow = Date.now()
    const feedbackItem = await service.ingest({
      ...testSignal(),
      id: 'feedback-visible',
      dedupeKey: 'feedback-visible',
      occurredAt: new Date(testNow).toISOString(),
    })
    const feedback = await service.performAction('feedback-visible-request', feedbackItem?.id ?? '', 'feedback', { useful: true })
    expect(feedback.body).toMatchObject({
      updated: true,
      result: { kind: 'feedback-recorded', useful: true, value: 'useful' },
      item: { id: 'feedback-visible', feedback: { useful: true, value: 'useful' } },
    })
    expect(service.status().delivery.interruptBudget).toMatchObject({ limit: 3, used: 1, remaining: 2 })

    const muted = await service.performAction('mute-visible-request', feedbackItem?.id ?? '', 'mute')
    expect(muted.body).toMatchObject({ updated: true, item: { id: 'feedback-visible', status: 'open' } })
    expect((muted.body.item as { mutedUntil?: string }).mutedUntil).toEqual(expect.any(String))
    expect(service.snapshot().inbox.some(item => item.id === 'feedback-visible')).toBe(true)
    const unmuted = await service.performAction('unmute-visible-request', feedbackItem?.id ?? '', 'unmute')
    expect(unmuted.body).toMatchObject({ updated: true, result: { kind: 'unmute-complete' }, item: { id: 'feedback-visible' } })
    expect((unmuted.body.item as { mutedUntil?: string }).mutedUntil).toBeUndefined()

    const completion = await service.ingest({
      ...testSignal(),
      id: 'completion-to-suppress',
      kind: 'TASK_COMPLETED',
      dedupeKey: 'completion-to-suppress',
      occurredAt: new Date(testNow + 1).toISOString(),
      severityHint: 1,
      evidence: [{ type: 'session-event', authority: 'runtime', ref: 'completion', summary: 'normal completion' }],
    })
    expect(completion?.level).toBe('C1')
    const suppressed = await service.performAction('suppress-request', completion?.id ?? '', 'suppress')
    expect(suppressed.body).toMatchObject({ updated: true, result: { kind: 'suppressed', reasonCode: 'TASK_COMPLETED' }, item: { status: 'acknowledged' } })
    expect(service.settings().suppressedReasonCodes).toEqual(['TASK_COMPLETED'])
    expect(await service.ingest({
      ...testSignal(),
      id: 'completion-after-suppression',
      kind: 'TASK_COMPLETED',
      dedupeKey: 'completion-after-suppression',
      occurredAt: new Date(testNow + 2).toISOString(),
      severityHint: 1,
      evidence: [{ type: 'session-event', authority: 'runtime', ref: 'completion-2', summary: 'normal completion' }],
    })).toBeUndefined()

    const critical = await service.ingest({
      ...testSignal(),
      id: 'completion-critical',
      kind: 'TASK_COMPLETED',
      dedupeKey: 'completion-critical',
      occurredAt: new Date(testNow + 3).toISOString(),
      severityHint: 3,
      evidence: [{ type: 'session-event', authority: 'runtime', ref: 'completion-critical', summary: 'completion requires review' }],
    })
    expect(critical?.level).toBe('C3')
    await service.dispose()
    expect(await readFile(service.suppressionStore.file, 'utf8')).toContain('TASK_COMPLETED')

    const restored = new DeepCanaryService({ logger: {} } as never, { stateDir: directory, maxInboxItems: 50 })
    services.push(restored)
    await restored.ready
    expect(restored.settings().suppressedReasonCodes).toEqual(['TASK_COMPLETED'])
    const restoredAction = await restored.performAction('restore-suppression', 'TASK_COMPLETED', 'unsuppress', { reasonCode: 'TASK_COMPLETED' })
    expect(restoredAction.body).toMatchObject({ updated: true, result: { kind: 'suppression-restored', reasonCode: 'TASK_COMPLETED' } })
    expect(restored.settings().suppressedReasonCodes).toEqual([])
    await restored.dispose()
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

  it('limits liveness checks to an active turn and measures from turn start', async () => {
    vi.useFakeTimers()
    const directory = await mkdtemp(path.join(os.tmpdir(), 'deepcanary-running-state-'))
    const listeners = new Map<string, (...args: any[]) => void>()
    try {
      vi.setSystemTime(new Date('2026-09-02T08:00:00.000Z'))
      const service = new DeepCanaryService({
        logger: {},
        on: (name: string, listener: (...args: any[]) => void) => { listeners.set(name, listener) },
      } as never, { stateDir: directory, longRunThresholdMinutes: 1, maxInboxItems: 50 })
      services.push(service)
      await service.ready
      service.start()
      const session = { id: 'running-state-session', header: { cwd: 'C:\\work' } }
      listeners.get('session/created')?.(session)
      listeners.get('session/event')?.(session, { type: 'turn/end', seq: 1, data: { reason: { kind: 'completed' } } })
      vi.setSystemTime(new Date('2026-09-02T08:05:00.000Z'))
      ;(service as unknown as { checkStalls: () => void }).checkStalls()
      await Promise.resolve()
      await Promise.resolve()
      expect(service.inbox(20).some(item => item.reasonCode === 'HOST_SUSPECTED_STALL')).toBe(false)

      listeners.get('session/event')?.(session, { type: 'turn/start', seq: 2, data: { turn: 2 } })
      vi.setSystemTime(new Date('2026-09-02T08:07:00.000Z'))
      ;(service as unknown as { checkStalls: () => void }).checkStalls()
      await Promise.resolve()
      await Promise.resolve()
      expect(service.inbox(20).some(item => item.reasonCode === 'HOST_SUSPECTED_STALL')).toBe(true)
      await service.dispose()
    } finally {
      vi.useRealTimers()
      await rm(directory, { recursive: true, force: true })
    }
  })

  it('does not create a competing stall alert while an authoritative question is waiting', async () => {
    vi.useFakeTimers()
    const directory = await mkdtemp(path.join(os.tmpdir(), 'deepcanary-human-wait-'))
    const listeners = new Map<string, (...args: any[]) => void>()
    try {
      vi.setSystemTime(new Date('2026-09-02T08:00:00.000Z'))
      const service = new DeepCanaryService({
        logger: {},
        on: (name: string, listener: (...args: any[]) => void) => { listeners.set(name, listener) },
      } as never, { stateDir: directory, longRunThresholdMinutes: 1, maxInboxItems: 50 })
      services.push(service)
      await service.ready
      service.start()
      const session = { id: 'human-wait-session', header: { cwd: 'C:\\work' } }
      listeners.get('session/created')?.(session)
      listeners.get('session/event')?.(session, { type: 'turn/start', seq: 1, data: {} })
      listeners.get('session/event')?.(session, { type: 'tool/call', seq: 2, data: { name: 'ask_user_question' } })
      await Promise.resolve()
      await Promise.resolve()

      vi.setSystemTime(new Date('2026-09-02T08:05:00.000Z'))
      ;(service as unknown as { checkStalls: () => void }).checkStalls()
      await Promise.resolve()
      await Promise.resolve()
      expect(service.inbox(20).some(item => item.reasonCode === 'HUMAN_QUESTION_PENDING')).toBe(true)
      expect(service.inbox(20).some(item => item.reasonCode === 'HOST_SUSPECTED_STALL')).toBe(false)

      listeners.get('session/event')?.(session, { type: 'tool/result', seq: 3, data: { name: 'ask_user_question' } })
      vi.setSystemTime(new Date('2026-09-02T08:07:00.000Z'))
      ;(service as unknown as { checkStalls: () => void }).checkStalls()
      await Promise.resolve()
      await Promise.resolve()
      expect(service.inbox(20).some(item => item.reasonCode === 'HOST_SUSPECTED_STALL')).toBe(true)
      await service.dispose()
    } finally {
      vi.useRealTimers()
      await rm(directory, { recursive: true, force: true })
    }
  })

  it('does not dedupe a host recovery against the unreachable root cause', async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), 'deepcanary-host-recovery-'))
    const service = new DeepCanaryService({ logger: {} } as never, { stateDir: directory, dedupeWindowMinutes: 10 })
    services.push(service)
    await service.ready

    const hostSignal = (id: string, kind: 'HOST_UNREACHABLE' | 'HOST_STALL_RECOVERED', severityHint: 1 | 3): CanarySignal => {
      const result = { ...testSignal(), id, kind, dedupeKey: 'host:unreachable', severityHint }
      delete result.sessionId
      return result
    }
    await service.ingest(hostSignal('host-down', 'HOST_UNREACHABLE', 3))
    const recovered = await service.ingest(hostSignal('host-up', 'HOST_STALL_RECOVERED', 1))

    expect(recovered).toBeDefined()
    expect(recovered?.status).toBe('recovered')
    expect(service.inbox(20).some(item => item.status === 'recovered')).toBe(true)
    await service.dispose()
  })

  it('exposes only safe host probe diagnostics in runtime status', async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), 'deepcanary-host-probe-status-'))
    const service = new DeepCanaryService({ logger: {} } as never, { stateDir: directory, maxInboxItems: 50 })
    services.push(service)
    await service.ready
    expect(service.status().delivery.hostProbe).toMatchObject({ healthy: true, consecutiveFailures: 0, state: 'healthy' })
    await service.dispose()
  })

  it('probes the public health route and serializes failure recovery', async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), 'deepcanary-host-probe-flow-'))
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: false, status: 503 })
      .mockResolvedValueOnce({ ok: false, status: 503 })
      .mockResolvedValueOnce({ ok: true, status: 200 })
    vi.stubGlobal('fetch', fetchMock)
    let injectWebServer: ((value: unknown) => void) | undefined
    const service = new DeepCanaryService({
      logger: {},
      inject: (_services: string[], callback: (value: unknown) => unknown) => { injectWebServer = callback },
    } as never, { stateDir: directory, maxInboxItems: 50 })
    services.push(service)
    await service.ready
    service.start()
    injectWebServer?.({ webServer: { port: 43131 } })
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))

    const probe = (service as unknown as { probeHost: () => Promise<void> }).probeHost.bind(service)
    await probe()
    expect(service.status().delivery.hostProbe).toMatchObject({ port: 43131, healthy: false, consecutiveFailures: 2 })
    expect(service.inbox(20).some(item => item.reasonCode === 'HOST_UNREACHABLE')).toBe(true)

    await probe()
    expect(fetchMock.mock.calls.map(call => call[0])).toEqual([
      'http://127.0.0.1:43131/dsh-deepcanary/health',
      'http://127.0.0.1:43131/dsh-deepcanary/health',
      'http://127.0.0.1:43131/dsh-deepcanary/health',
    ])
    expect(service.status().delivery.hostProbe).toMatchObject({ port: 43131, healthy: true, consecutiveFailures: 0 })
    expect(service.inbox(20).some(item => item.status === 'recovered')).toBe(true)

    await service.dispose()
    vi.unstubAllGlobals()
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

  it('re-associates hashed session references when a matching live session returns', async () => {
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
    expect(await readFile(second.store.file, 'utf8')).toContain('session-private-id')
    await rm(directory, { recursive: true, force: true })
  })

  it('keeps an opaque session handle so a restored alert can reopen its DSH session', async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), 'deepcanary-historical-jump-'))
    const first = new DeepCanaryService({ logger: {} } as never, { stateDir: directory, maxInboxItems: 50 })
    services.push(first)
    await first.ready
    const item = await first.ingest({
      ...testSignal(),
      id: 'historical-jump',
      sessionId: 'stable-session-id',
      dedupeKey: 'historical-jump',
    })
    expect(item).toBeDefined()
    await first.dispose()

    const second = new DeepCanaryService({ logger: {} } as never, { stateDir: directory, maxInboxItems: 50 })
    services.push(second)
    await second.ready
    expect(second.inbox(10)[0]).toMatchObject({ id: 'historical-jump', sessionId: 'stable-session-id' })
    expect(second.jump('historical-jump')).toMatchObject({ available: true, sessionId: 'stable-session-id' })
    const persisted = await readFile(second.store.file, 'utf8')
    expect(persisted).toContain('stable-session-id')
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
