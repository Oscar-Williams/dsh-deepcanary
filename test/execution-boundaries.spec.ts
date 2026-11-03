import { mkdtemp, readFile, rm } from 'node:fs/promises'
import path from 'node:path'
import os from 'node:os'
import { describe, expect, it, vi } from 'vitest'
import { DeepCanaryService } from '../src/service.js'
import { hashMetadata } from '../src/persistence.js'

describe('execution and independent human boundaries', () => {
  it('settles parallel approvals individually across restart and rejects a replay from the previous run', async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), 'deepcanary-independent-approvals-'))
    const listeners = new Map<string, (...args: unknown[]) => void>()
    const events: Array<{ seq: number; type: string; time: number; data: Record<string, unknown> }> = []
    const session = { id: 'parallel-owner', header: { createdAt: Date.now(), cwd: process.cwd() }, snapshotEvents: () => [...events] }
    const ctx = { logger: {}, sessions: { list: () => [session] },
      on: (name: string, callback: (...args: unknown[]) => void) => { listeners.set(name, callback) } }
    const append = (type: string, data: Record<string, unknown>) => {
      const event = { seq: events.length, type, time: Date.now(), data }; events.push(event)
      listeners.get('session/event')?.(session, event)
    }
    let service = new DeepCanaryService(ctx as never, { stateDir: directory })
    try {
      await service.ready; service.start()
      await vi.waitFor(() => expect(service.status().reconciliation.verified).toBe(true))
      append('turn/start', { turn: 1 })
      append('approval/asked', { id: 'approval-a', callId: 'a' })
      append('approval/asked', { id: 'approval-b', callId: 'b' })
      await vi.waitFor(() => expect(service.snapshot().inbox).toHaveLength(2))
      const firstGeneration = service.snapshot().inbox[0]!.task!.executionGeneration
      append('approval/decided', { id: 'approval-a', callId: 'a', outcome: 'approved' })
      await vi.waitFor(() => expect(service.snapshot().inbox).toHaveLength(1))
      const remaining = service.snapshot().inbox[0]!
      await service.dispose()
      service = new DeepCanaryService(ctx as never, { stateDir: directory })
      await service.ready; service.start()
      await vi.waitFor(() => expect(service.status().reconciliation.verified).toBe(true))
      expect(service.snapshot().inbox).toMatchObject([{ id: remaining.id, task: { executionGeneration: firstGeneration } }])
      listeners.get('session/event')?.(session, events[1])
      expect(service.snapshot().inbox).toHaveLength(1)
      append('turn/start', { turn: 2 })
      append('approval/asked', { id: 'approval-c', callId: 'c' })
      await vi.waitFor(() => expect(service.snapshot().inbox).toHaveLength(1))
      expect(service.snapshot().inbox[0]!.task!.executionGeneration).not.toBe(firstGeneration)
      expect(service.explain(remaining.id)?.status).toBe('recovered')
      append('turn/end', { turn: 1, reason: { kind: 'completed' } })
      expect(service.snapshot().inbox).toHaveLength(1)
      append('turn/end', { turn: 2, reason: { kind: 'completed' } })
      await vi.waitFor(() => expect(service.snapshot().inbox).toHaveLength(0))
      append('turn/start', { turn: 3 })
      append('turn/end', { turn: 3, reason: { kind: 'completed' } })
      await vi.waitFor(() => expect(service.snapshot().activity?.filter(item => item.reasonCode === 'TASK_COMPLETED')).toHaveLength(2))
    } finally { await service.dispose(); await rm(directory, { recursive: true, force: true }) }
  })

  it('keeps every protected item and a durable unread watermark when capacity is exhausted', async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), 'deepcanary-unread-watermark-'))
    let service = new DeepCanaryService({ logger: {} } as never, { stateDir: directory, maxInboxItems: 50 })
    try {
      await service.ready
      for (let index = 0; index <= 50; index++) await service.ingest({
        schemaVersion: 1, id: `approval-${index}`, occurredAt: new Date().toISOString(), source: 'session',
        sessionId: `owner-${index}`, kind: 'HUMAN_APPROVAL_REQUIRED', severityHint: 3, dedupeKey: `approval-${index}`,
        task: { taskRef: hashMetadata(`owner-${index}`), executionGeneration: hashMetadata(`run-${index}`), kind: 'session', sourceSeq: 7 },
        evidence: [{ type: 'session-event', authority: 'runtime', ref: 'approval/asked', summary: 'Current approval boundary.' }], data: {},
      })
      expect(service.snapshot().inbox).toHaveLength(50)
      expect(service.explain('approval-0')).toBeDefined()
      expect(service.explain('approval-50')).toBeUndefined()
      expect(service.snapshot().retention).toMatchObject({ limited: true, deferredSessions: 1 })
      await service.dispose()
      const saved = JSON.parse(await readFile(path.join(directory, 'inbox.json'), 'utf8'))
      expect(saved.runtime.deferredSources).toEqual([{ sessionRef: hashMetadata('owner-50'), sourceSeq: 7 }])
      service = new DeepCanaryService({ logger: {} } as never, { stateDir: directory, maxInboxItems: 50 })
      await service.ready
      expect(service.snapshot().retention?.limited).toBe(true)
    } finally { await service.dispose(); await rm(directory, { recursive: true, force: true }) }
  })
})
