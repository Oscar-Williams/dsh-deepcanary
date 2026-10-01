import { mkdtemp, mkdir, readFile, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, expect, it } from 'vitest'
import { importLegacySettings, legacySettingsPatch } from '../src/settings-migration.js'
import { claimStateDirectory, resolveStateIdentity, importLegacyInbox } from '../src/state-identity.js'
import { MetadataStore } from '../src/persistence.js'
import { normalizeConfig } from '../src/config.js'
import { DeepCanaryService } from '../src/service.js'

const roots: string[] = []
async function fixture() { const root = await mkdtemp(join(tmpdir(), 'deepcanary-migration-')); roots.push(root); return root }
afterEach(async () => { await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true }))) })

it('keeps explicit overrides including equal-to-default and nested fields', () => {
  expect(legacySettingsPatch({ notificationLevel: 'C3', quietHours: { enabled: true, start: '21:00', ignored: true }, unknown: 'ignored' },
    { notificationLevel: 'C2', quietHours: { enabled: false } })).toEqual({ quietHours: { start: '21:00' } })
})
it('rejects all migration when even an overridden known field is invalid', () => {
  expect(() => legacySettingsPatch({ maxInterruptsPerHour: -1, notificationLevel: 'C3' }, { maxInterruptsPerHour: 3 })).toThrow()
})
it('imports renamed legacy source once through revision-fenced Host transaction, without modifying source', async () => {
  const home = await fixture(); const state = join(home, 'state'); await mkdir(state)
  const file = join(home, 'settings.yaml.imported'); const source = 'dsh-deepcanary:\n  notificationLevel: C3\n  quietHours:\n    start: "21:00"\n'
  await writeFile(file, source)
  let writes = 0; let revision = 1
  const host = { describe: () => [{ ns: 'deepcanary', user: {}, revision }], update: async (_ns: string, patch: object, fence?: number) => {
    expect(fence).toBe(revision); expect(patch).toEqual({ notificationLevel: 'C3', quietHours: { start: '21:00' } }); writes++; revision++
  } }
  expect(await importLegacySettings(home, state, host)).toBe('imported')
  expect(await importLegacySettings(home, state, host)).toBe('already-imported'); expect(writes).toBe(1)
  expect(await readFile(file, 'utf8')).toBe(source)
  expect(await readFile(join(state, 'legacy-settings-import.json'), 'utf8')).not.toContain('C3')
})
it('rereads explicit user values after one conflict and does not overwrite them', async () => {
  const home = await fixture(); const state = join(home, 'state'); await mkdir(state)
  await writeFile(join(home, 'settings.yaml'), 'dsh-deepcanary:\n  notificationLevel: C3\n')
  let attempts = 0
  const host = { describe: () => [{ ns: 'deepcanary', user: attempts ? { notificationLevel: 'C1' } : {}, revision: attempts }], update: async () => {
    attempts++; const error = new Error('conflict'); error.name = 'SettingsConflictError'; throw error
  } }
  expect(await importLegacySettings(home, state, host)).toBe('imported'); expect(attempts).toBe(1)
})
it('isolates profiles and refuses a custom directory owned by another profile', async () => {
  const home = await fixture(); const web = { name: 'web', dir: join(home, 'profiles/web'), home }; const desktop = { ...web, name: 'desktop', dir: join(home, 'profiles/desktop') }
  expect(resolveStateIdentity(web, 'deepcanary', '').directory).not.toBe(resolveStateIdentity(desktop, 'deepcanary', '').directory)
  const custom = join(home, 'shared'); await claimStateDirectory(resolveStateIdentity(web, 'deepcanary', custom))
  await expect(claimStateDirectory(resolveStateIdentity(desktop, 'deepcanary', custom))).rejects.toThrow('shared writes refused')
})
it('HTTP configuration never claims persistence without a Host settings service', async () => {
  const stateDir = await fixture(); const service = new DeepCanaryService({} as never, { stateDir })
  await expect(service.updateSettings({ notificationLevel: 'C3' })).rejects.toThrow('no configuration was persisted')
  expect(service.settings().notificationLevel).toBe('C2'); await service.dispose()
})

it('adopts legacy Inbox only on Desktop, preserving the source and disabling historical navigation', async () => {
  const home = await fixture()
  const source = new DeepCanaryService({} as never, { stateDir: join(home, 'dsh-deepcanary') })
  await source.ingest({ schemaVersion: 1, id: 'legacy-question', source: 'tool', kind: 'HUMAN_QUESTION_PENDING', sessionId: 'historical-session', occurredAt: new Date().toISOString(), evidence: [{ type: 'tool-history', authority: 'runtime', ref: 'test', summary: 'controlled fixture' }], data: {} })
  await source.dispose(); const original = await readFile(source.store.file, 'utf8')
  const web = resolveStateIdentity({ name: 'web', dir: join(home, 'profiles/web'), home }, 'deepcanary', '')
  const desktop = resolveStateIdentity({ name: 'desktop', dir: join(home, 'profiles/desktop'), home }, 'deepcanary', '')
  await claimStateDirectory(web); await claimStateDirectory(desktop)
  await importLegacyInbox(web); expect(await new MetadataStore(web.directory).load()).toEqual([])
  await importLegacyInbox(desktop)
  expect(await new MetadataStore(desktop.directory).load()).toMatchObject([{ targetAvailable: false }])
  expect(await readFile(source.store.file, 'utf8')).toBe(original)
  await new MetadataStore(desktop.directory).save([]); await importLegacyInbox(desktop)
  expect(await new MetadataStore(desktop.directory).load()).toEqual([])
})

it('resolves live Loader references before applying defaults or quiet-hour values', () => {
  let level = 'C3'
  const input = { notificationLevel: { get: () => level }, quietHours: { get: () => ({ enabled: true, start: '21:00', end: '06:00' }) } }
  expect(normalizeConfig(input as never)).toMatchObject({ notificationLevel: 'C3', quietHours: { enabled: true, start: '21:00' } })
  level = 'C1'; expect(normalizeConfig(input as never).notificationLevel).toBe('C1')
})
