import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { MetadataStore } from '../src/persistence.js'
import { claimStateDirectory, claimStateWriter, resolveStateIdentity } from '../src/state-identity.js'
import type { InboxItem } from '../src/types.js'

const directories: string[] = []
async function directory() { const dir = await mkdtemp(join(tmpdir(), 'deepcanary-migration-')); directories.push(dir); return dir }
afterEach(async () => { for (const dir of directories.splice(0)) await rm(dir, { recursive: true, force: true }) })
const item = (): InboxItem => ({ id: 'pending', eventId: 'pending', schemaVersion: 3, level: 'C3', action: 'ESCALATE',
  confidence: .98, reasonCode: 'HUMAN_APPROVAL_REQUIRED', messageKey: 'item.reason.HUMAN_APPROVAL_REQUIRED', policyVersion: 'attention-policy.v1',
  why: 'Public approval boundary', evidence: [], occurredAt: '2026-11-03T00:00:00.000Z', status: 'snoozed',
  snoozedUntil: '2026-11-03T10:00:00.000Z', notificationGeneration: 4, reminderPending: true, sessionId: 'owner', bundleCount: 1,
  reasonCodes: ['HUMAN_APPROVAL_REQUIRED'] })
describe('ledger migration and ownership', () => {
  it('migrates v1 while preserving snooze, delivery generation and policy budget', async () => {
    const dir = await directory(); const store = new MetadataStore(dir)
    await store.save([item()], [], { policyVersion: 'attention-policy.v1', dedupe: [], interruptConsumedAt: ['2026-11-03T00:00:00.000Z'], deliveryLedger: [] })
    const raw = JSON.parse(await readFile(store.file, 'utf8')); raw.schemaVersion = 1
    await writeFile(store.file, JSON.stringify(raw))
    const loaded = await store.loadState()
    expect(loaded.items[0]).toMatchObject({ status: 'snoozed', notificationGeneration: 4, reminderPending: true, snoozedUntil: item().snoozedUntil })
    expect(loaded.items[0]?.task?.executionGeneration).toMatch(/^[a-f0-9]{16}$/)
    expect(loaded.runtime?.interruptConsumedAt).toEqual(['2026-11-03T00:00:00.000Z'])
    await store.save(loaded.items, loaded.backgroundWatches, loaded.runtime)
    expect(JSON.parse(await readFile(store.file, 'utf8')).schemaVersion).toBe(2)
  })
  it.each(['{bad json', '{"schemaVersion":9,"items":[]}', '{"schemaVersion":1,"items":[{}]}'])('preserves unreadable state and refuses overwrite', async raw => {
    const store = new MetadataStore(await directory()); await writeFile(store.file, raw)
    await expect(store.loadState()).rejects.toThrow()
    await expect(store.save([])).rejects.toThrow('protected')
    expect(await readFile(store.file, 'utf8')).toBe(raw)
  })
  it('holds the writer through the lifecycle and releases it for a hot reload', async () => {
    const identity = resolveStateIdentity(undefined, 'test', await directory())
    await claimStateDirectory(identity)
    const release = await claimStateWriter(identity)
    await expect(claimStateWriter(identity)).rejects.toThrow('live Host')
    await release()
    await (await claimStateWriter(identity))()
  })
  it('allows only one concurrent recovery of a dead writer', async () => {
    const identity = resolveStateIdentity(undefined, 'test', await directory())
    await claimStateDirectory(identity)
    const dead = { schemaVersion: 1, owner: identity.owner, pid: 2_147_483_647, token: '00000000-0000-4000-8000-000000000000' }
    await mkdir(join(identity.directory, 'inbox-writer.lock'))
    await writeFile(join(identity.directory, 'inbox-writer.lock', 'owner.json'), JSON.stringify(dead))
    await writeFile(join(identity.directory, 'inbox-writer.json'), JSON.stringify(dead))
    const claims = await Promise.allSettled([claimStateWriter(identity), claimStateWriter(identity), claimStateWriter(identity)])
    const winners = claims.filter(result => result.status === 'fulfilled')
    expect(winners).toHaveLength(1)
    for (const winner of winners) if (winner.status === 'fulfilled') await winner.value()
    await (await claimStateWriter(identity))()
  })
})
