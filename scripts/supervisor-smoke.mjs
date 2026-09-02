import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('..', import.meta.url))
const outputPath = path.resolve(root, 'output/gates/supervisor-smoke-report.json')
const { PersistentSupervisor, supervisorSnapshotFor } = await import('../lib/supervisor.js')

const checks = {}
const directory = await mkdtemp(path.join(os.tmpdir(), 'deepcanary-supervisor-smoke-'))
let now = 1_756_800_000_000
const options = (stateDir, instanceId, pid) => ({
  stateDir,
  runtimeVersion: '0.1.2-alpha.4',
  now: () => now,
  pid,
  instanceId,
  heartbeatMs: 60_000,
  staleLeaseMs: 100,
})
const makeSnapshot = (revision, timestamp = now) => supervisorSnapshotFor(
  '0.1.2-alpha.4',
  'ready',
  revision,
  [{ sessionRef: 'session-hash', attentionLevel: 'C2', pendingCount: 1, lastEvidenceAt: new Date(timestamp).toISOString() }],
  ['item-hash'],
  timestamp,
)

try {
  const first = new PersistentSupervisor(options(directory, 'smoke-first', 501))
  checks.firstLeaseAcquired = await first.start()
  first.update(makeSnapshot(7))
  await first.stop()
  checks.shutdownLeaseReleased = (await first.store.loadLease()) === undefined

  const restored = new PersistentSupervisor(options(directory, 'smoke-restored', 502))
  checks.restoreWorked = await restored.start()
  checks.restoreRevision = restored.status().revision === 7

  const contender = new PersistentSupervisor(options(directory, 'smoke-contender', 503))
  checks.freshLeaseStandby = (await contender.start()) === false && contender.status().state === 'standby'

  now += 101
  const takeover = new PersistentSupervisor(options(directory, 'smoke-takeover', 504))
  checks.staleLeaseTakenOver = await takeover.start()
  restored.update(makeSnapshot(99, now))
  await restored.flush()
  const persisted = JSON.parse(await readFile(takeover.store.snapshotFile, 'utf8'))
  checks.previousOwnerFenced = restored.status().state === 'standby' && persisted.snapshot.revision !== 99
  checks.takeoverLeaseHeld = takeover.status().leaseHeld
  await restored.stop()
  await contender.stop()
  await takeover.stop()

  const corruptDirectory = await mkdtemp(path.join(os.tmpdir(), 'deepcanary-supervisor-corrupt-smoke-'))
  try {
    const corrupt = new PersistentSupervisor(options(corruptDirectory, 'smoke-corrupt', 505))
    await writeFile(corrupt.store.snapshotFile, '{not-json', 'utf8')
    checks.corruptSnapshotQuarantined = await corrupt.start()
    const names = await readdir(corruptDirectory)
    checks.corruptSnapshotQuarantined = checks.corruptSnapshotQuarantined && names.some(name => name.startsWith('supervisor.json.corrupt-'))
    await corrupt.stop()
  } finally {
      await rm(corruptDirectory, { recursive: true, force: true })
  }

  const corruptLeaseDirectory = await mkdtemp(path.join(os.tmpdir(), 'deepcanary-supervisor-corrupt-lease-smoke-'))
  try {
    const corruptLease = new PersistentSupervisor(options(corruptLeaseDirectory, 'smoke-corrupt-lease', 506))
    await writeFile(corruptLease.store.leaseFile, '{not-json', 'utf8')
    const started = await corruptLease.start()
    const names = await readdir(corruptLeaseDirectory)
    const currentLease = await corruptLease.store.loadLease()
    checks.corruptLeaseRecovered = started
      && corruptLease.status().state === 'running'
      && currentLease?.instanceId === 'smoke-corrupt-lease'
      && names.some(name => name.startsWith('supervisor.lease.corrupt-'))
    await corruptLease.stop()
  } finally {
    await rm(corruptLeaseDirectory, { recursive: true, force: true })
  }
} finally {
  await rm(directory, { recursive: true, force: true })
}

const requiredCheckNames = [
  'firstLeaseAcquired',
  'shutdownLeaseReleased',
  'restoreWorked',
  'restoreRevision',
  'freshLeaseStandby',
  'staleLeaseTakenOver',
  'previousOwnerFenced',
  'takeoverLeaseHeld',
  'corruptSnapshotQuarantined',
  'corruptLeaseRecovered',
]
const report = {
  reportSchemaVersion: 1,
  runtimeBaseline: 'dsh-v0.1.2-alpha.4',
  checks,
  passed: requiredCheckNames.length === Object.keys(checks).length
    && requiredCheckNames.every(name => checks[name] === true),
  generatedAt: new Date().toISOString(),
  conclusion: requiredCheckNames.length === Object.keys(checks).length
    && requiredCheckNames.every(name => checks[name] === true)
    ? 'Lease acquisition, restore, standby takeover waiting, stale takeover, previous-owner fencing, shutdown release, and corrupt-snapshot quarantine passed in an isolated local smoke run.'
    : 'One or more isolated Supervisor smoke checks require investigation before operational promotion.',
}
await (await import('node:fs/promises')).mkdir(path.dirname(outputPath), { recursive: true })
await (await import('node:fs/promises')).writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8')
console.log(`supervisor smoke report written: ${path.relative(root, outputPath)}`)
console.log(JSON.stringify({ passed: report.passed, checks: report.checks }, null, 2))
if (!report.passed) process.exitCode = 1
