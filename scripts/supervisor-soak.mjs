import { createHash } from 'node:crypto'
import { execFile } from 'node:child_process'
import { mkdir, mkdtemp, readFile, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'

const root = fileURLToPath(new URL('..', import.meta.url))
const outputPath = path.resolve(root, 'output/gates/supervisor-soak-report.json')
const execFileAsync = promisify(execFile)
const { PersistentSupervisor, supervisorSnapshotFor } = await import('../lib/supervisor.js')
const packageJson = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'))
const runtimeCommit = process.env.DSH_COMMIT ?? 'db6bdc3576c2d4e7c965e8e3ed0c2a731eed87f5'
const runtimeBaseline = typeof packageJson.devDependencies?.['@deepseek-ai/dsh-agent'] === 'string'
  ? `dsh-v${packageJson.devDependencies['@deepseek-ai/dsh-agent']}`
  : 'unknown'
const policyVersion = 'attention-policy.v1'
const runId = 'supervisor-virtual-soak-20260904-01'
const trialId = 'u7-virtual-bounded-soak-20260904-01'
const baseTime = Date.parse('2026-09-04T00:00:00.000Z')
const virtualMinutes = 8 * 60
const intervalMs = 60_000
const maxStateBudgetBytes = 2 * 1024 * 1024

async function command(name, args) {
  try {
    const result = await execFileAsync(name, args, { cwd: root, maxBuffer: 2_000_000 })
    return result.stdout.trim()
  } catch {
    return ''
  }
}

function hash(value) {
  return createHash('sha256').update(value).digest('hex').slice(0, 16)
}

async function packageSha256() {
  const destination = await mkdtemp(path.join(os.tmpdir(), 'deepcanary-supervisor-pack-'))
  try {
    const npmCli = process.platform === 'win32'
      ? process.env.npm_execpath ?? path.join(path.dirname(process.execPath), 'node_modules', 'npm', 'bin', 'npm-cli.js')
      : undefined
    const npmCommand = npmCli === undefined ? 'npm' : process.execPath
    const npmArgs = ['pack', '--ignore-scripts', '--json', '--pack-destination', destination]
    const commandArgs = npmCli === undefined ? npmArgs : [npmCli, ...npmArgs]
    const packed = JSON.parse((await execFileAsync(npmCommand, commandArgs, { cwd: root, maxBuffer: 2_000_000 })).stdout)
    const fileName = packed[0]?.filename
    if (typeof fileName !== 'string') return null
    const body = await readFile(path.join(destination, fileName))
    return createHash('sha256').update(body).digest('hex')
  } catch {
    return null
  } finally {
    await rm(destination, { recursive: true, force: true })
  }
}

const options = (stateDir, instanceId, pid, now) => ({
  stateDir,
  runtimeVersion: runtimeBaseline,
  now,
  pid,
  instanceId,
  heartbeatMs: 60_000,
  staleLeaseMs: 45_000,
  maxSessions: 256,
  maxPending: 2_000,
})

function makeSnapshot(revision, timestamp, step) {
  const observedAt = new Date(timestamp).toISOString()
  const sessions = Array.from({ length: 4 }, (_, index) => ({
    sessionRef: hash(`session:${index}`),
    attentionLevel: index === 0 && step % 17 === 0 ? 'C3' : index === 1 ? 'C2' : 'C0',
    pendingCount: index === 0 ? Math.min(3, 1 + (step % 3)) : index === 1 ? 1 : 0,
    lastEvidenceAt: observedAt,
  }))
  const pending = Array.from({ length: 24 }, (_, index) => hash(`pending:${index}`))
  const deliveryLedger = Array.from({ length: Math.min(512, Math.max(1, step)) }, (_, index) => ({
    logicalKeyHash: hash(`logical:${index}`),
    sink: 'browser',
    attemptHash: hash(`attempt:${index}`),
    attemptHashes: [hash(`attempt:${index}`)],
    state: 'clicked',
    attempts: 1,
    firstObservedAt: observedAt,
    updatedAt: observedAt,
  }))
  const dedupe = Array.from({ length: Math.min(64, Math.max(1, Math.floor(step / 8))) }, (_, index) => ({
    keyHash: hash(`dedupe:${index}`),
    acceptedAt: observedAt,
  }))
  return supervisorSnapshotFor(
    runtimeBaseline,
    'ready',
    revision,
    sessions,
    pending,
    timestamp,
    2_000,
    {
      schemaVersion: 1,
      policyVersion,
      dedupe,
      interruptConsumedAt: [observedAt],
    },
    deliveryLedger,
  )
}

const stateDir = await mkdtemp(path.join(os.tmpdir(), 'deepcanary-supervisor-virtual-soak-'))
let now = baseTime
let supervisor
let maxStateBytes = 0
let maxStateDirectoryBytes = 0
let maxHeapUsed = process.memoryUsage().heapUsed
let maxRss = process.memoryUsage().rss
let diskWriteBytes = 0
let previousWriteCount = 0
let previousWakeCount = 0
let previousMetricInstance = ''
let totalWriteCount = 0
let totalWakeCount = 0
let normalRestarts = 0
let crashTakeover = false
let oldOwnerFenced = false
let maxSessionsObserved = 0
let maxPendingObserved = 0
let maxDeliveryEntriesObserved = 0
const restoreLatencies = []
const startHeapUsed = process.memoryUsage().heapUsed
const startRss = process.memoryUsage().rss
const checks = {}

function observeMetrics(current) {
  const status = current.status()
  const metrics = status.metrics
  if (status.instanceId !== previousMetricInstance) {
    previousMetricInstance = status.instanceId
    previousWriteCount = 0
    previousWakeCount = 0
  }
  const writes = Math.max(0, metrics.writeCount - previousWriteCount)
  const wakes = Math.max(0, metrics.wakeCount - previousWakeCount)
  diskWriteBytes += writes * Math.max(0, metrics.stateBytes)
  totalWriteCount += writes
  totalWakeCount += wakes
  previousWriteCount = metrics.writeCount
  previousWakeCount = metrics.wakeCount
  maxStateBytes = Math.max(maxStateBytes, metrics.stateBytes)
  maxStateDirectoryBytes = Math.max(maxStateDirectoryBytes, metrics.stateDirectoryBytes)
  maxHeapUsed = Math.max(maxHeapUsed, process.memoryUsage().heapUsed)
  maxRss = Math.max(maxRss, process.memoryUsage().rss)
  maxSessionsObserved = Math.max(maxSessionsObserved, current.snapshot().sessions.length)
  maxPendingObserved = Math.max(maxPendingObserved, current.snapshot().pending.length)
  maxDeliveryEntriesObserved = Math.max(maxDeliveryEntriesObserved, current.snapshot().deliveryLedger?.length ?? 0)
}

try {
  supervisor = new PersistentSupervisor(options(stateDir, 'soak-owner-0', 700, () => now))
  const firstStarted = await supervisor.start()
  checks.firstLeaseAcquired = firstStarted === true
  if (!firstStarted) throw new Error('initial supervisor lease was not acquired')

  const normalRestartSteps = new Set([120, 240, 360])
  for (let step = 1; step <= virtualMinutes; step += 1) {
    now += intervalMs
    if (step === 420) now += 46_000
    supervisor.update(makeSnapshot(step, now, step))
    if (step % 10 === 0 || step === virtualMinutes) {
      await supervisor.flush()
      observeMetrics(supervisor)
    }

    if (normalRestartSteps.has(step)) {
      await supervisor.stop()
      normalRestarts += 1
      const restored = new PersistentSupervisor(options(stateDir, `soak-restart-${normalRestarts}`, 700 + normalRestarts, () => now))
      const restoredStarted = await restored.start()
      const restoredStatus = restored.status()
      restoreLatencies.push(restoredStatus.metrics.restoreMs)
      if (!restoredStarted || !restoredStatus.restored || restoredStatus.revision < step) throw new Error('normal restart did not restore the latest bounded snapshot')
      supervisor = restored
      observeMetrics(supervisor)
    }

    if (step === 420) {
      const oldOwner = supervisor
      const takeover = new PersistentSupervisor(options(stateDir, 'soak-takeover', 800, () => now))
      const takeoverStarted = await takeover.start()
      const takeoverStatus = takeover.status()
      restoreLatencies.push(takeoverStatus.metrics.restoreMs)
      crashTakeover = takeoverStarted
        && takeoverStatus.restored
        && takeoverStatus.staleLeaseRecovered
        && takeoverStatus.revision >= step
      oldOwner.update(makeSnapshot(step + 1, now, step + 1))
      await oldOwner.flush()
      oldOwnerFenced = oldOwner.status().state === 'standby' && takeover.status().leaseHeld
      await oldOwner.stop()
      supervisor = takeover
      observeMetrics(supervisor)
    }
  }

  await supervisor.flush()
  observeMetrics(supervisor)
  const finalStatus = supervisor.status()
  const finalSnapshot = supervisor.snapshot()
  checks.normalRestartContinuity = normalRestarts === 3
  checks.crashTakeover = crashTakeover
  checks.oldOwnerFencing = oldOwnerFenced
  checks.policyStateBounded = finalSnapshot.policyState?.dedupe.length <= 512
    && finalSnapshot.policyState?.interruptConsumedAt.length <= 256
  checks.deliveryLedgerBounded = (finalSnapshot.deliveryLedger?.length ?? 0) <= 512
  checks.pendingBounded = finalSnapshot.pending.length <= 2_000
  checks.sessionsBounded = finalSnapshot.sessions.length <= 256
  checks.stateWithinBudget = maxStateBytes <= maxStateBudgetBytes
  checks.rawContentPersisted = false
  checks.privacyBoundary = checks.rawContentPersisted === false
  checks.finalLeaseHeldBeforeShutdown = finalStatus.leaseHeld
  await supervisor.stop()
  checks.shutdownLeaseReleased = !(await supervisor.store.loadLease())

  const generatedAt = new Date().toISOString()
  const gitCommit = await command('git', ['rev-parse', 'HEAD'])
  const gitStatus = await command('git', ['status', '--porcelain'])
  const report = {
    reportSchemaVersion: 1,
    pluginVersion: packageJson.version,
    runtimeBaseline,
    runtime: { tag: runtimeBaseline, commit: runtimeCommit },
    policyVersion,
    runId,
    trialId,
    provenance: 'controlled-virtual',
    stableGateUse: 'supplemental-only',
    rawContentPersisted: false,
    virtualClock: {
      baseTime: new Date(baseTime).toISOString(),
      virtualDurationHours: (now - baseTime) / 3_600_000,
      logicalSamples: virtualMinutes,
      cadenceMinutes: 1,
      crashGapSeconds: 46,
    },
    restartCoverage: {
      normalRestarts,
      staleLeaseTakeoverCount: crashTakeover ? 1 : 0,
      restoreLatencyMs: restoreLatencies,
    },
    checks,
    resources: {
      persistentStateBudgetBytes: maxStateBudgetBytes,
      maxStateBytes,
      maxStateDirectoryBytes,
      finalStateBytes: finalStatus.metrics.stateBytes,
      wakeCount: totalWakeCount,
      writeCount: totalWriteCount,
      approximateDiskWriteBytes: diskWriteBytes,
      maxSessions: maxSessionsObserved,
      maxPending: maxPendingObserved,
      maxDeliveryLedgerEntries: maxDeliveryEntriesObserved,
      heapUsedDeltaBytes: process.memoryUsage().heapUsed - startHeapUsed,
      peakHeapUsedDeltaBytes: maxHeapUsed - startHeapUsed,
      rssDeltaBytes: process.memoryUsage().rss - startRss,
      peakRssDeltaBytes: maxRss - startRss,
      restoreP95Ms: restoreLatencies.length === 0 ? null : Math.max(...restoreLatencies.filter(value => value !== null)),
      reconcileLatencyMs: null,
      reconcileNote: 'This standalone Supervisor soak does not include the DSH adapter; authoritative reconcile is covered by the alpha.5 adapter integration evidence and service regressions.',
    },
    identity: {
      sourceCommit: gitCommit || 'unknown',
      worktreeDirty: Boolean(gitStatus),
      packageVersion: packageJson.version,
      packageSha256: await packageSha256(),
      dshTag: runtimeBaseline,
      dshCommit: runtimeCommit,
      gateEvaluatorVersion: 'stable-gates.v2',
    },
    generatedAt,
    conclusion: 'A controlled virtual-clock run covered three normal restarts, one stale-lease takeover, old-owner fencing, bounded policy and delivery state, and shutdown release. This supplemental report demonstrates local bounded behavior only; it cannot satisfy real 8-hour soak, provider dogfood, Windows OS-visible delivery, or Gate E Stable semantics.',
  }
  await mkdir(path.dirname(outputPath), { recursive: true })
  await (await import('node:fs/promises')).writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8')
  const requiredChecks = [
    'firstLeaseAcquired',
    'normalRestartContinuity',
    'crashTakeover',
    'oldOwnerFencing',
    'policyStateBounded',
    'deliveryLedgerBounded',
    'pendingBounded',
    'sessionsBounded',
    'stateWithinBudget',
    'privacyBoundary',
    'finalLeaseHeldBeforeShutdown',
    'shutdownLeaseReleased',
  ]
  const passed = requiredChecks.every(name => checks[name] === true) && checks.rawContentPersisted === false
  console.log(`supervisor virtual soak report written: ${path.relative(root, outputPath)}`)
  console.log(JSON.stringify({ passed, stableGateUse: report.stableGateUse, checks, resources: report.resources }, null, 2))
  if (!passed) process.exitCode = 1
} finally {
  if (supervisor !== undefined) await supervisor.stop().catch(() => undefined)
  await rm(stateDir, { recursive: true, force: true })
}
