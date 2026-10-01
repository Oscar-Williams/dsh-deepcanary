import assert from 'node:assert/strict'
import { mkdir, mkdtemp, readFile, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { loadRuntimeCheckout, rc020 } from './runtime-checkout.mjs'

const runtime = await loadRuntimeCheckout(process.env.DSH_020_RUNTIME, rc020)
const { boot, initProfile, readProfilePatches } = await runtime.importPackage('@deepseek-ai/dsh-app-boot')
const { default: ConfigEditor } = await runtime.importPackage('@deepseek-ai/dsh-config-editor')
const { default: Settings } = await runtime.importPackage('@deepseek-ai/dsh-settings')
const { SessionStore } = await runtime.importPackage('@deepseek-ai/dsh-session')
const { Config } = await import('../lib/config.js')
const { DeepCanaryService } = await import('../lib/service.js')
const { SettingsDraft } = await import('../lib/settings-draft.js')
const home = await mkdtemp(path.join(tmpdir(), 'deepcanary-settings-020-'))
const dir = path.join(home, 'profiles', 'web')
const checks = {}
let ctx, service
try {
  initProfile(dir, ['fixture'])
  const bundle = path.join(dir, 'node_modules', 'fixture')
  await mkdir(bundle, { recursive: true })
  await writeFile(path.join(home, 'package.json'), '{"name":"isolated-contract"}')
  await writeFile(path.join(bundle, 'package.json'), JSON.stringify({ name: 'fixture', version: '1.0.0', dsh: { bundle: { patch: 'cordis.patch.yml' } } }))
  await writeFile(path.join(bundle, 'cordis.patch.yml'), JSON.stringify([{ insert: [
    { id: 'sessions', name: 'cordis:sessions' }, { id: 'config-editor', name: 'cordis:editor' }, { id: 'settings', name: 'cordis:settings' },
    { id: 'deepcanary', name: 'cordis:deepcanary', config: { notificationLevel: 'C2' } },
  ] }]))
  await writeFile(path.join(dir, 'cordis.yml'), '[]\n')
  const profile = { name: 'web', dir, home, patchPath: path.join(dir, 'cordis.patch.yml'), installAnchor: path.join(home, 'package.json'), cwd: home, startedBundles: ['fixture'], overlays: [], telemetryDisabledEnv: undefined }
  async function start() {
    ctx = await boot('fixture', path.join(dir, 'cordis.yml'), readProfilePatches('fixture', profile), context => {
      context.provide('profileContext', profile)
      context.provide('appReady', { onReady(listener) { listener(); return () => {} } })
      Object.assign(context.loader.builtins, { sessions: SessionStore, editor: ConfigEditor, settings: Settings, deepcanary: {
        Config, inject: ['sessions', 'profileContext'], apply(owner, config) { service = new DeepCanaryService(owner, config); service.start() },
      } })
    })
    await service.ready
  }
  await start()
  const row = () => ctx.settings.describe().find(item => item.ns === 'deepcanary')
  assert.ok(row()); assert.equal(row().autoGenerate, false); checks.servedCustomPage = true
  const revision = row().revision
  await service.updateSettings({ maxInterruptsPerHour: 7, quietHours: { enabled: true, start: '21:00', end: '06:00' } })
  assert.equal(service.settings().maxInterruptsPerHour, 7)
  assert.equal(service.settings().quietHours.start, '21:00'); checks.hostHttpAndVolatileSource = true
  await assert.rejects(ctx.settings.update('deepcanary', { maxInterruptsPerHour: 8 }, revision), error => error.name === 'SettingsConflictError')
  assert.equal(service.settings().maxInterruptsPerHour, 7); checks.conflictPreservesAcceptedValue = true
  const raw = await readFile(profile.patchPath, 'utf8')
  assert.ok(raw.includes('7')); checks.persistedUserLayer = true
  await ctx.fiber.dispose(); ctx = undefined
  await start()
  assert.equal(service.settings().maxInterruptsPerHour, 7); checks.reloadPersistence = true
  const draft = new SettingsDraft(['maxInterruptsPerHour'], () => ({
    value: { maxInterruptsPerHour: service.settings().maxInterruptsPerHour },
    base: { maxInterruptsPerHour: 3 }, revision: row().revision, writable: true,
  }), async (operations, expectedRevision) => {
    try { await ctx.settings.mutate('deepcanary', operations, expectedRevision); return true }
    catch (error) { if (error.name === 'SettingsConflictError') return false; throw error }
  })
  draft.edit('maxInterruptsPerHour', 8)
  await ctx.settings.update('deepcanary', { maxInterruptsPerHour: 4 }, row().revision)
  draft.refresh()
  assert.equal(await draft.save(), false)
  assert.equal(service.settings().maxInterruptsPerHour, 4)
  assert.equal(draft.value.maxInterruptsPerHour, 8)
  assert.equal(draft.failure, 'conflict'); checks.staleDraftMirrorCannotOverwrite = true
  draft.discard(); draft.edit('maxInterruptsPerHour', 6)
  assert.equal(await draft.save(), true)
  assert.equal(service.settings().maxInterruptsPerHour, 6); checks.discardRebasesNextEdit = true
  draft.reset()
  await ctx.settings.update('deepcanary', { maxInterruptsPerHour: 4 }, row().revision)
  draft.refresh()
  assert.equal(await draft.save(), false)
  assert.equal(service.settings().maxInterruptsPerHour, 4); checks.inheritanceResetRevisionProtected = true
  await ctx.settings.mutate('deepcanary', [{ op: 'unset', path: ['maxInterruptsPerHour'] }], row().revision)
  assert.equal(service.settings().maxInterruptsPerHour, 3); checks.resetInheritanceLive = true
  await assert.rejects(ctx.settings.update('deepcanary', { maxInterruptsPerHour: -1 }, row().revision))
  assert.equal(service.settings().maxInterruptsPerHour, 3); checks.invalidTransactionRejected = true
  console.log(JSON.stringify({ passed: true, runtime: runtime.version, commit: runtime.commit, provenance: 'controlled-real-host-settings-and-loader', checks }, null, 2))
} finally {
  await service?.dispose()
  await ctx?.fiber.dispose()
  await rm(home, { recursive: true, force: true })
}
