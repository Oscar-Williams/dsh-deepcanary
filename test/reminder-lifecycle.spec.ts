import { mkdtemp, readFile, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { DeepCanaryService } from '../src/service.js'
import { hashMetadata } from '../src/persistence.js'
import type { CanarySignal } from '../src/types.js'

const signal = (now: number, kind: CanarySignal['kind'] = 'HUMAN_QUESTION_PENDING'): CanarySignal => ({
  schemaVersion: 1, id: `reminder-${kind}`, occurredAt: new Date(now).toISOString(), source: 'session', kind,
  ...(kind === 'HUMAN_QUESTION_PENDING' ? { severityHint: 3 } : {}),
  evidence: [{ type: 'runtime-probe', authority: 'runtime', ref: 'owned-question', summary: 'Structured runtime fact.' }],
  data: {},
})
const claim = (now: number, generation = 0, owner = 'tab-a') => ({ notificationClientInstance: owner,
  notificationExpiresAt: new Date(now + 30_000).toISOString(), notificationGeneration: generation })
const delivered = (id: string, now: number) => ({ notificationStage: 'constructed', notificationAttemptId: hashMetadata('attempt-one'),
  notificationRef: hashMetadata(`${id}:notification`), tagRef: hashMetadata(`${id}:tag`),
  titleKey: 'notification.title.HUMAN_QUESTION_PENDING', bodyFingerprint: hashMetadata('safe-summary'), observedAt: new Date(now).toISOString(), notificationGeneration: 0 })

describe('scheduled reminder lifecycle', () => {
  it('gives a newly authoritative C3 its own opportunity after a delivered C2 bundle', async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), 'deepcanary-reminder-escalation-'))
    const service = new DeepCanaryService({ logger: {} } as never, { stateDir: directory, maxInterruptsPerHour: 1 })
    try {
      await service.ready
      const now = Date.now()
      const first = (await service.ingest({ ...signal(now, 'TASK_FAILED'), bundleKey: 'owned-outage', dedupeKey: 'suspected-outage' }))!
      await service.performAction('before-escalation', first.id, 'notification-claim', claim(Date.now()))
      await service.performAction('delivered-c2', first.id, 'notification-delivery', {
        ...delivered(first.id, Date.now()), titleKey: 'notification.title.TASK_FAILED',
      })
      service.config.quietHours = { enabled: true, start: '00:00', end: '00:00' }
      const escalated = await service.ingest({ ...signal(Date.now(), 'HOST_UNREACHABLE'), id: 'authoritative-outage',
        severityHint: 3, bundleKey: 'owned-outage', dedupeKey: 'confirmed-outage' })
      expect(escalated?.id).toBe(first.id)
      expect(service.snapshot().inbox[0]).toMatchObject({ level: 'C3', notificationGeneration: 1, notificationEligible: true })
      expect((await service.performAction('new-escalation', first.id, 'notification-claim', claim(Date.now(), 1))).body.result).toMatchObject({ outcome: 'granted' })
    } finally { await service.dispose(); await rm(directory, { recursive: true, force: true }) }
  })
  it('rearms a delivered reminder at its deadline and fences stale tabs', async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), 'deepcanary-reminder-'))
    let now = Date.now()
    const clock = vi.spyOn(Date, 'now').mockImplementation(() => now)
    const service = new DeepCanaryService({ logger: {} } as never, { stateDir: directory })
    try {
      await service.ready
      const item = (await service.ingest(signal(now)))!
      await service.performAction('claim-first', item.id, 'notification-claim', claim(now))
      await service.performAction('delivered-first', item.id, 'notification-delivery', delivered(item.id, now))
      service.snooze(item.id, 1)
      expect(service.snapshot().scheduled?.[0]).toMatchObject({ id: item.id, notificationGeneration: 1 })
      expect((await service.performAction('stale-during-snooze', item.id, 'notification-claim', claim(now))).body.result).toMatchObject({ outcome: 'unavailable' })
      expect((await service.performAction('current-during-snooze', item.id, 'notification-claim', claim(now, 1))).body.result).toMatchObject({ outcome: 'unavailable' })
      now += 60_001
      expect(service.snapshot().inbox[0]).toMatchObject({ id: item.id, notificationGeneration: 1, notificationEligible: true })
      expect((await service.performAction('stale-after-snooze', item.id, 'notification-claim', claim(now))).body.result).toMatchObject({ outcome: 'unavailable' })
      expect((await service.performAction('new-generation', item.id, 'notification-claim', claim(now, 1))).body.result).toMatchObject({ outcome: 'granted' })
      expect((await service.performAction('competing-tab', item.id, 'notification-claim', claim(now, 1, 'tab-b'))).body.result).toMatchObject({ outcome: 'already-claimed' })
      expect((await service.performAction('old-callback', item.id, 'notification-delivery', delivered(item.id, now))).body.updated).toBe(false)
    } finally { await service.dispose(); clock.mockRestore(); await rm(directory, { recursive: true, force: true }) }
  })

  it('retains due C2 work through quiet hours and consumes its new budget once', async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), 'deepcanary-reminder-policy-'))
    let now = Date.now()
    const clock = vi.spyOn(Date, 'now').mockImplementation(() => now)
    const service = new DeepCanaryService({ logger: {} } as never, { stateDir: directory, maxInterruptsPerHour: 2 })
    try {
      await service.ready
      const item = (await service.ingest(signal(now, 'TASK_FAILED')))!
      service.snooze(item.id, 1)
      service.config.quietHours = { enabled: true, start: '00:00', end: '00:00' }
      now += 60_001
      expect(service.snapshot().inbox[0]).toMatchObject({ action: 'DIGEST', reminderPending: true, notificationEligible: false })
      expect(service.status().delivery.interruptBudget.used).toBe(1)
      service.config.quietHours.enabled = false
      expect(service.snapshot().inbox[0]).toMatchObject({ action: 'INTERRUPT', notificationEligible: true })
      service.snapshot()
      expect(service.status().delivery.interruptBudget.used).toBe(2)
    } finally { await service.dispose(); clock.mockRestore(); await rm(directory, { recursive: true, force: true }) }
  })

  it('keeps ordinary reminder continuity durable with Supervisor disabled', async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), 'deepcanary-reminder-restart-'))
    const first = new DeepCanaryService({ logger: {} } as never, { stateDir: directory })
    const now = Date.now()
    let next: DeepCanaryService | undefined
    try {
      await first.ready
      const item = (await first.ingest(signal(now)))!
      await first.performAction('claim', item.id, 'notification-claim', claim(now))
      await first.performAction('delivered', item.id, 'notification-delivery', delivered(item.id, Date.now()))
      await first.dispose()
      next = new DeepCanaryService({ logger: {} } as never, { stateDir: directory })
      await next.ready
      expect(next.explain(item.id)).toMatchObject({ notificationEligible: false })
      expect((await next.performAction('claim-after-restart', item.id, 'notification-claim', claim(now))).body.result).toMatchObject({ outcome: 'already-complete' })
      const state = await readFile(path.join(directory, 'inbox.json'), 'utf8')
      expect(state).not.toContain('tab-a')
      expect(JSON.parse(state).runtime?.deliveryLedger).toHaveLength(1)
    } finally { await first.dispose(); await next?.dispose(); await rm(directory, { recursive: true, force: true }) }
  })

  it('lets a scheduled item be inspected, rescheduled and resumed without changing its level', async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), 'deepcanary-reminder-resume-'))
    const service = new DeepCanaryService({ logger: {} } as never, { stateDir: directory })
    try {
      await service.ready
      const item = (await service.ingest(signal(Date.now(), 'TASK_COMPLETED')))!
      service.snooze(item.id, 30)
      service.seen(item.id)
      expect(service.snapshot().scheduled?.[0]).toMatchObject({ id: item.id, status: 'snoozed', level: 'C1' })
      service.snooze(item.id, 15)
      expect(service.snapshot().scheduled?.[0]?.notificationGeneration).toBe(2)
      const resumed = await service.performAction('resume', item.id, 'unsnooze')
      expect(resumed.body.updated).toBe(true)
      expect(service.snapshot().scheduled).toEqual([])
      expect(service.snapshot().inbox[0]).toMatchObject({ id: item.id, level: 'C1', action: 'INBOX', notificationEligible: false })
      service.snooze(item.id, 1)
      service.acknowledge(item.id)
      expect(service.snapshot().scheduled).toEqual([])
      expect(service.snapshot().inbox).toEqual([])
    } finally { await service.dispose(); await rm(directory, { recursive: true, force: true }) }
  })

  it('keeps an explicit reminder waiting until the rolling budget becomes available', async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), 'deepcanary-reminder-budget-'))
    let now = Date.now()
    const clock = vi.spyOn(Date, 'now').mockImplementation(() => now)
    const service = new DeepCanaryService({ logger: {} } as never, { stateDir: directory, maxInterruptsPerHour: 1 })
    try {
      await service.ready
      const item = (await service.ingest(signal(now, 'TASK_FAILED')))!
      service.snooze(item.id, 1)
      now += 60_001
      expect(service.snapshot().inbox[0]).toMatchObject({ action: 'DIGEST', reminderPending: true })
      now += 60 * 60_000
      expect(service.snapshot().inbox[0]).toMatchObject({ action: 'INTERRUPT', notificationEligible: true })
      expect(service.status().delivery.interruptBudget.used).toBe(1)
      service.acknowledge(item.id)
      expect((await service.performAction('acknowledged', item.id, 'notification-claim', claim(now, 1))).body.result).toMatchObject({ outcome: 'unavailable' })
    } finally { await service.dispose(); clock.mockRestore(); await rm(directory, { recursive: true, force: true }) }
  })

  it('preserves budget and dedupe across ordinary default-mode restarts', async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), 'deepcanary-default-policy-'))
    let service = new DeepCanaryService({ logger: {} } as never, { stateDir: directory, maxInterruptsPerHour: 1 })
    try {
      await service.ready
      const event = signal(Date.now(), 'TASK_FAILED')
      expect((await service.ingest({ ...event, dedupeKey: 'first-failure' }))?.action).toBe('INTERRUPT')
      await service.dispose()
      service = new DeepCanaryService({ logger: {} } as never, { stateDir: directory, maxInterruptsPerHour: 1 })
      await service.ready
      expect(await service.ingest({ ...event, id: 'same-failure', dedupeKey: 'first-failure' })).toBeUndefined()
      expect((await service.ingest({ ...event, id: 'another-failure', dedupeKey: 'another-failure' }))?.action).toBe('DIGEST')
      expect(service.status().delivery.interruptBudget.used).toBe(1)
    } finally { await service.dispose(); await rm(directory, { recursive: true, force: true }) }
  })

  it('requires current authority before rearming a restored C3', async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), 'deepcanary-restored-authority-'))
    let now = Date.now()
    const clock = vi.spyOn(Date, 'now').mockImplementation(() => now)
    let service = new DeepCanaryService({ logger: {} } as never, { stateDir: directory })
    try {
      await service.ready
      const item = (await service.ingest({ ...signal(now), sessionId: 'authority-not-yet-readable' }))!
      service.snooze(item.id, 1)
      await service.dispose()
      now += 60_001
      service = new DeepCanaryService({ logger: {} } as never, { stateDir: directory })
      await service.ready
      expect(service.snapshot().inbox[0]).toMatchObject({ level: 'C3', reminderPending: true, notificationEligible: false })
      expect((await service.performAction('unverified', item.id, 'notification-claim', claim(now, 1))).body.result).toMatchObject({ outcome: 'unavailable' })
    } finally { await service.dispose(); clock.mockRestore(); await rm(directory, { recursive: true, force: true }) }
  })

  it('refuses a delivery claim when its state cannot be persisted', async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), 'deepcanary-delivery-write-failure-'))
    const service = new DeepCanaryService({ logger: {} } as never, { stateDir: directory })
    try {
      await service.ready
      const item = (await service.ingest(signal(Date.now())))!
      const write = vi.spyOn(service.store, 'save').mockRejectedValue(new Error('Controlled write failure'))
      expect((await service.performAction('failed-store', item.id, 'notification-claim', claim(Date.now()))).body.result).toMatchObject({ outcome: 'unavailable' })
      write.mockRestore()
    } finally { await service.dispose(); await rm(directory, { recursive: true, force: true }) }
  })

  it('retains scheduled work and human waits through a burst beyond Inbox capacity', async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), 'deepcanary-scheduled-retention-'))
    const service = new DeepCanaryService({ logger: {} } as never, { stateDir: directory, maxInboxItems: 50 })
    try {
      await service.ready
      const now = Date.now()
      const critical = (await service.ingest(signal(now)))!
      const later = (await service.ingest({ ...signal(now, 'TASK_COMPLETED'), dedupeKey: 'later' }))!
      service.snooze(later.id, 60)
      for (let index = 0; index < 80; index++) await service.ingest({ ...signal(now + index + 1, 'TASK_COMPLETED'),
        id: `routine-${index}`, dedupeKey: `routine-${index}` })
      expect(service.snapshot().inbox[0]?.id).toBe(critical.id)
      expect(service.snapshot().scheduled?.[0]?.id).toBe(later.id)
      expect(service.inbox(100)).toHaveLength(50)
    } finally { await service.dispose(); await rm(directory, { recursive: true, force: true }) }
  })
})
