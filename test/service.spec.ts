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
})
