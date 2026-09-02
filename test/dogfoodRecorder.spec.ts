import { readFile, readdir, rm, mkdtemp } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { hashMetadata } from '../src/persistence.js'
import { DeepCanaryService } from '../src/service.js'
import { DOGFOOD_ENVIRONMENT, DogfoodRuntimeRecorder, dogfoodRunFromEnvironment } from '../src/dogfoodRecorder.js'
import type { CanarySignal, ReasonCode } from '../src/types.js'

const originalEnvironment = new Map<string, string | undefined>()

function setDogfoodEnvironment(values: Record<string, string>): void {
  for (const [key, value] of Object.entries({
    [DOGFOOD_ENVIRONMENT.enabled]: '1',
    [DOGFOOD_ENVIRONMENT.runId]: 'runtime-recorder-test',
    [DOGFOOD_ENVIRONMENT.trialId]: 'runtime-recorder-trial',
    [DOGFOOD_ENVIRONMENT.taskFamily]: 'coding',
    [DOGFOOD_ENVIRONMENT.scenario]: 'normal-completion',
    ...values,
  })) {
    if (!originalEnvironment.has(key)) originalEnvironment.set(key, process.env[key])
    process.env[key] = value
  }
}

afterEach(() => {
  for (const [key, value] of originalEnvironment) {
    if (value === undefined) delete process.env[key]
    else process.env[key] = value
  }
  originalEnvironment.clear()
})

function signal(kind: ReasonCode, id: string, dedupeKey: string, options: Partial<CanarySignal> = {}): CanarySignal {
  return {
    schemaVersion: 1,
    id,
    occurredAt: new Date(Date.now()).toISOString(),
    source: kind.startsWith('HOST_') ? 'host' : 'session',
    kind,
    sessionId: 'session-runtime-test',
    evidence: [{ type: kind.startsWith('HOST_') ? 'runtime-probe' : 'session-event', authority: 'runtime', ref: id, summary: 'structured test evidence' }],
    dedupeKey,
    ...options,
    data: options.data ?? {},
  }
}

describe('runtime dogfood recorder', () => {
  it('is disabled without an explicit complete run contract', () => {
    expect(dogfoodRunFromEnvironment('0.1.0-rc.4', 'dsh-v0.1.2-alpha.4')).toBeUndefined()
    setDogfoodEnvironment({})
    expect(dogfoodRunFromEnvironment('0.1.0-rc.4', 'dsh-v0.1.2-alpha.4')).toMatchObject({
      provenance: 'real',
      taskFamily: 'coding',
      scenario: 'normal-completion',
      rawContentPersisted: false,
    })
  })

  it('records silent, suppressed, deduped, bundled, and recovery opportunities', async () => {
    setDogfoodEnvironment({})
    const directory = await mkdtemp(path.join(os.tmpdir(), 'deepcanary-runtime-recorder-'))
    const service = new DeepCanaryService({ logger: {} } as never, { stateDir: directory, maxInboxItems: 50 })
    try {
      await service.ready
      await service.ingest(signal('CONTEXT_PRESSURE', 'c0-event', 'c0-event', { data: { healthy: true } }))

      const suppressedItem = await service.ingest(signal('TASK_COMPLETED', 'suppressed-root', 'suppressed-root'))
      expect(suppressedItem).toBeDefined()
      expect(service.suppress(suppressedItem!.id).updated).toBe(true)
      await service.ingest(signal('TASK_COMPLETED', 'suppressed-follow-up', 'suppressed-follow-up'))

      await service.ingest(signal('TASK_FAILED', 'dedupe-root', 'same-failure'))
      await service.ingest(signal('TASK_FAILED', 'dedupe-repeat', 'same-failure'))

      await service.ingest(signal('TASK_FAILED', 'bundle-root', 'bundle-root', { bundleKey: 'bundle-runtime-test' }))
      await service.ingest(signal('TASK_FAILED', 'bundle-follow-up', 'bundle-follow-up', { bundleKey: 'bundle-runtime-test' }))

      await service.ingest(signal('HOST_SUSPECTED_STALL', 'stall-root', 'stall-root'))
      await service.ingest(signal('HOST_STALL_RECOVERED', 'stall-recovered', 'stall-recovered'))
    } finally {
      await service.dispose()
    }

    const files = (await readdir(directory)).filter(file => /^dogfood-[a-f0-9]{16}\.json$/.test(file))
    expect(files).toHaveLength(1)
    const bundle = JSON.parse(await readFile(path.join(directory, files[0]!), 'utf8')) as { observations: Array<{ decisionDisposition: string }> }
    expect(bundle.observations.map(observation => observation.decisionDisposition)).toEqual(expect.arrayContaining([
      'c0-silent',
      'suppressed',
      'deduped',
      'bundle-merged',
      'recovery-closed',
    ]))
    await rm(directory, { recursive: true, force: true })
  })

  it('records a distinct healthy long-run checkpoint without creating an Inbox item', async () => {
    setDogfoodEnvironment({
      [DOGFOOD_ENVIRONMENT.runId]: 'healthy-runtime-test',
      [DOGFOOD_ENVIRONMENT.trialId]: 'healthy-runtime-trial',
      [DOGFOOD_ENVIRONMENT.scenario]: 'healthy-long-run',
    })
    const directory = await mkdtemp(path.join(os.tmpdir(), 'deepcanary-healthy-recorder-'))
    const run = dogfoodRunFromEnvironment('0.1.0-rc.4', 'dsh-v0.1.2-alpha.4')!
    const recorder = new DogfoodRuntimeRecorder(directory, run)
    recorder.recordHealthyHeartbeat('session-healthy-test', '2026-09-02T12:00:00.000Z')
    await recorder.flush()
    const file = (await readdir(directory)).find(value => /^dogfood-[a-f0-9]{16}\.json$/.test(value))!
    const bundle = JSON.parse(await readFile(path.join(directory, file), 'utf8')) as { observations: Array<{ eventClass: string; eventSubtype: string; decisionDisposition: string; deliveryChannel: string }> }
    expect(bundle.observations).toEqual([{
      schemaVersion: 1,
      observationRef: expect.any(String),
      runId: 'healthy-runtime-test',
      occurredAt: '2026-09-02T12:00:00.000Z',
      eventClass: 'healthy-run',
      eventSubtype: 'healthy-heartbeat',
      eventSource: 'session',
      authority: 'runtime',
      phase: 'running',
      decisionDisposition: 'c0-silent',
      deliveryChannel: 'none',
    }])
    await rm(directory, { recursive: true, force: true })
  })

  it('closes an opted-in run when the recorder is finished', async () => {
    setDogfoodEnvironment({
      [DOGFOOD_ENVIRONMENT.runId]: 'finish-runtime-test',
      [DOGFOOD_ENVIRONMENT.trialId]: 'finish-runtime-trial',
    })
    const directory = await mkdtemp(path.join(os.tmpdir(), 'deepcanary-finish-recorder-'))
    const run = dogfoodRunFromEnvironment('0.1.0-rc.4', 'dsh-v0.1.2-alpha.4')!
    const recorder = new DogfoodRuntimeRecorder(directory, run)
    recorder.finish('2026-09-02T12:01:00.000Z')
    await recorder.flush()
    const file = (await readdir(directory)).find(value => /^dogfood-[a-f0-9]{16}\.json$/.test(value))!
    const bundle = JSON.parse(await readFile(path.join(directory, file), 'utf8')) as { run: { endedAt?: string } }
    expect(bundle.run.endedAt).toBe('2026-09-02T12:01:00.000Z')
    await rm(directory, { recursive: true, force: true })
  })

  it('links real user feedback back to the delivered observation without storing content', async () => {
    setDogfoodEnvironment({
      [DOGFOOD_ENVIRONMENT.runId]: 'feedback-runtime-test',
      [DOGFOOD_ENVIRONMENT.trialId]: 'feedback-runtime-trial',
    })
    const directory = await mkdtemp(path.join(os.tmpdir(), 'deepcanary-feedback-recorder-'))
    const service = new DeepCanaryService({ logger: {} } as never, { stateDir: directory, maxInboxItems: 50 })
    try {
      await service.ready
      const item = await service.ingest(signal('TASK_COMPLETED', 'feedback-item', 'feedback-item'))
      expect(item).toBeDefined()
      expect(service.feedback(item!.id, true, 'this note is intentionally not persisted in dogfood', 'useful')).toBe(true)
    } finally {
      await service.dispose()
    }
    const file = (await readdir(directory)).find(value => /^dogfood-[a-f0-9]{16}\.json$/.test(value))!
    const bundle = JSON.parse(await readFile(path.join(directory, file), 'utf8')) as { observations: Array<Record<string, unknown>> }
    expect(bundle.observations).toEqual(expect.arrayContaining([
      expect.objectContaining({
        attentionRef: expect.any(String),
        userFeedback: 'useful',
        usefulnessReason: 'actionable',
        reviewLabel: 'correct-useful',
        policyReview: 'correct',
      }),
    ]))
    expect(JSON.stringify(bundle)).not.toContain('this note is intentionally not persisted')
    await rm(directory, { recursive: true, force: true })
  })

  it('joins browser notification delivery stages to the matching real observation', async () => {
    setDogfoodEnvironment({
      [DOGFOOD_ENVIRONMENT.runId]: 'notification-runtime-test',
      [DOGFOOD_ENVIRONMENT.trialId]: 'notification-runtime-trial',
    })
    const directory = await mkdtemp(path.join(os.tmpdir(), 'deepcanary-notification-recorder-'))
    const service = new DeepCanaryService({ logger: {} } as never, { stateDir: directory, maxInboxItems: 50 })
    let notificationRef = ''
    let tagRef = ''
    let bodyFingerprint = ''
    try {
      await service.ready
      const item = await service.ingest(signal('HUMAN_APPROVAL_REQUIRED', 'notification-item', 'notification-item'))
      expect(item).toBeDefined()
      notificationRef = hashMetadata(`${item!.id}:notification`)
      tagRef = hashMetadata(`${item!.id}:tag`)
      bodyFingerprint = hashMetadata('privacy-safe notification body')
      const base = {
        notificationAttemptId: hashMetadata('notification-attempt'),
        notificationRef,
        tagRef,
        titleKey: 'notification.title.HUMAN_APPROVAL_REQUIRED',
        bodyFingerprint,
      }
      for (const [index, notificationStage] of (['attempted', 'constructed', 'click-handler-attached', 'clicked'] as const).entries()) {
        const receipt = await service.performAction(
          `notification-stage-${index}`,
          item!.id,
          'notification-delivery',
          { ...base, notificationStage, observedAt: `2026-09-02T12:0${index}:00.000Z` },
        )
        expect(receipt.body).toMatchObject({ updated: true, result: { kind: 'notification-delivery-recorded' } })
      }
      const rejected = await service.performAction(
        'notification-wrong-title',
        item!.id,
        'notification-delivery',
        { ...base, titleKey: 'notification.title.TASK_FAILED', notificationStage: 'constructed', observedAt: '2026-09-02T12:03:00.000Z' },
      )
      expect(rejected.body).toMatchObject({ updated: true, result: { kind: 'notification-delivery-unavailable' } })
    } finally {
      await service.dispose()
    }
    const file = (await readdir(directory)).find(value => /^dogfood-[a-f0-9]{16}\.json$/.test(value))!
    const bundle = JSON.parse(await readFile(path.join(directory, file), 'utf8')) as { observations: Array<Record<string, any>> }
    const observation = bundle.observations.find(value => value.attentionRef === hashMetadata('notification-item'))
    expect(observation).toMatchObject({
      notificationDelivery: {
        notificationRef,
        tagRef,
        titleKey: 'notification.title.HUMAN_APPROVAL_REQUIRED',
        bodyFingerprint,
        stages: ['attempted', 'constructed', 'click-handler-attached', 'clicked'],
        clickedAt: expect.any(String),
      },
    })
    expect(JSON.stringify(bundle)).not.toContain('privacy-safe notification body')
    await rm(directory, { recursive: true, force: true })
  })
})
