import { Context } from '@deepseek-ai/cordis'
import { mkdtemp, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'
import { expect, it, vi } from 'vitest'
import { MetadataStore } from '../src/persistence.js'
import { DeepCanaryService } from '../src/service.js'

it('finishes pending reminder writes before plugin unload and replacement', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'deepcanary-unload-'))
  const ctx = new Context()
  ctx.provide('sessions', { list: () => [] } as never)
  ctx.provide('profileContext', { name: 'web', dir: directory, home: directory } as never)
  let release!: () => void
  let entered!: () => void
  const gate = new Promise<void>(resolve => { release = resolve })
  const writing = new Promise<void>(resolve => { entered = resolve })
  const save = MetadataStore.prototype.save
  const spy = vi.spyOn(MetadataStore.prototype, 'save').mockImplementation(async function (this: MetadataStore, items) {
    entered()
    await gate
    return save.call(this, items)
  })
  const holder: { service?: DeepCanaryService } = {}
  let replacement: DeepCanaryService | undefined
  const fiber = await ctx.plugin({
    inject: ['sessions', 'profileContext'],
    apply(owner) {
      holder.service = new DeepCanaryService(owner, { stateDir: directory })
      holder.service.start()
    },
  })
  try {
    const service = holder.service!
    await service.ready
    const item = await service.ingest({
      schemaVersion: 1, id: 'unload-completion', occurredAt: new Date().toISOString(), source: 'session',
      kind: 'TASK_COMPLETED', sessionId: 'retained-session', dedupeKey: 'unload-completion', data: {},
      evidence: [{ type: 'session-event', authority: 'runtime', ref: 'completion', summary: 'Controlled completion' }],
    })
    await writing
    const closing = fiber.dispose()
    const settled = await Promise.race([closing.then(() => 'unloaded'), delay(30).then(() => 'pending')])
    expect(settled).toBe('pending')
    release()
    await closing
    spy.mockRestore()
    replacement = new DeepCanaryService(ctx, { stateDir: directory })
    await replacement.ready
    expect(replacement.inbox(10).find(row => row.id === item?.id)?.reasonCode).toBe('TASK_COMPLETED')
  } finally {
    release()
    await holder.service?.dispose()
    await fiber.dispose()
    await replacement?.dispose()
    spy.mockRestore()
    await rm(directory, { recursive: true, force: true })
  }
})
