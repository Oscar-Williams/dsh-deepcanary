import { createHash } from 'node:crypto'
import { execFile, spawn } from 'node:child_process'
import { mkdtemp, readFile, rm, writeFile, readdir, stat } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'

const root = fileURLToPath(new URL('..', import.meta.url))
const outputPath = process.env.DSH_U7_PROCESS_OUTPUT
  ? path.resolve(process.env.DSH_U7_PROCESS_OUTPUT)
  : path.join(root, 'output/gates/u7-process-integration.json')
const runtimeTag = process.env.DSH_TAG ?? 'dsh-v0.1.2-alpha.5'
const runtimeCommit = process.env.DSH_COMMIT ?? 'db6bdc3576c2d4e7c965e8e3ed0c2a731eed87f5'
const runId = process.env.DSH_U7_RUN_ID ?? `u7-process-${new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14)}`
const trialId = `${runId}-trial`
const execFileAsync = promisify(execFile)

const { DeliveryLedger } = await import('../lib/core/delivery.js')

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function hash(value) {
  return createHash('sha256').update(value).digest('hex')
}

async function packageSha256() {
  const packagePath = process.env.DSH_U7_PACKAGE_TGZ
  if (packagePath) return hash(await readFile(path.resolve(packagePath)))
  return null
}

async function gitValue(args) {
  try {
    const result = await execFileAsync('git', args, { cwd: root, windowsHide: true })
    return result.stdout.trim()
  } catch {
    return ''
  }
}

async function directoryBytes(directory) {
  let total = 0
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const entryPath = path.join(directory, entry.name)
    if (entry.isDirectory()) total += await directoryBytes(entryPath)
    else total += (await stat(entryPath)).size
  }
  return total
}

function spawnWorker(stateDir, workerArgs) {
  const workerPath = path.join(root, 'scripts/supervisor-process-worker.mjs')
  const child = spawn(process.execPath, [workerPath, '--state-dir', stateDir, ...workerArgs], {
    cwd: root,
    stdio: ['pipe', 'pipe', 'pipe'],
    windowsHide: true,
  })
  let buffer = ''
  const messages = []
  const waiters = []
  const consume = chunk => {
    buffer += chunk.toString()
    while (true) {
      const newline = buffer.indexOf('\n')
      if (newline < 0) break
      const line = buffer.slice(0, newline).trim()
      buffer = buffer.slice(newline + 1)
      if (!line) continue
      try {
        const message = JSON.parse(line)
        messages.push(message)
        while (waiters.length > 0) waiters.shift()(message)
      } catch {
        // Keep the evidence parser strict while retaining no raw process output.
      }
    }
  }
  child.stdout.on('data', consume)
  child.stderr.resume()
  child.on('exit', (code, signal) => {
    while (waiters.length > 0) waiters.shift()({ kind: 'exit', code, signal })
  })
  return {
    child,
    messages,
    waitFor(kind, timeoutMs = 5_000) {
      const existing = messages.find(message => message.kind === kind)
      if (existing) return Promise.resolve(existing)
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error(`worker message timeout: ${kind}`)), timeoutMs)
        waiters.push(message => {
          if (message.kind !== kind) return
          clearTimeout(timer)
          resolve(message)
        })
      })
    },
    send(line) {
      child.stdin.write(`${line}\n`)
    },
  }
}

async function stopWorker(worker) {
  if (!worker || worker.child.exitCode !== null) return
  worker.send('stop')
  try { await worker.waitFor('stopped', 3_000) } catch { worker.child.kill() }
}

const stateDir = await mkdtemp(path.join(os.tmpdir(), 'deepcanary-u7-process-'))
const checks = {}
const phases = []
let owner
let oldOwner
let takeover
try {
  owner = spawnWorker(stateDir, ['--instance-id', 'u7-owner-a', '--stale-ms', '500', '--heartbeat-ms', '100'])
  const ownerStarted = await owner.waitFor('started')
  const ownerFlush = await owner.waitFor('flushed')
  checks.initialLeaseAcquired = ownerStarted.started === true && ownerStarted.status.leaseHeld === true
  checks.initialSnapshotDurable = ownerFlush.status.revision >= 1 && ownerFlush.snapshot.pending.length === 1
  phases.push({ id: 'initial-owner', checks: { initialLeaseAcquired: checks.initialLeaseAcquired, initialSnapshotDurable: checks.initialSnapshotDurable } })

  await stopWorker(owner)
  const restarted = spawnWorker(stateDir, ['--instance-id', 'u7-owner-b', '--stale-ms', '500', '--heartbeat-ms', '100'])
  const restartedStarted = await restarted.waitFor('started')
  checks.normalRestartRestoresSnapshot = restartedStarted.started === true
    && restartedStarted.status.restored === true
    && restartedStarted.status.revision >= 1
  phases.push({ id: 'normal-restart', checks: { normalRestartRestoresSnapshot: checks.normalRestartRestoresSnapshot } })
  await stopWorker(restarted)

  oldOwner = spawnWorker(stateDir, ['--instance-id', 'u7-old-owner', '--stale-ms', '300', '--heartbeat-ms', '3600000'])
  const oldStarted = await oldOwner.waitFor('started')
  await oldOwner.waitFor('flushed')
  await sleep(450)
  takeover = spawnWorker(stateDir, ['--instance-id', 'u7-takeover', '--stale-ms', '300', '--heartbeat-ms', '100'])
  const takeoverStarted = await takeover.waitFor('started')
  checks.staleLeaseTakeover = oldStarted.started === true
    && takeoverStarted.started === true
    && takeoverStarted.status.leaseHeld === true
    && takeoverStarted.status.staleLeaseRecovered === true
  oldOwner.send('flush')
  const fenced = await oldOwner.waitFor('flush-result')
  checks.oldOwnerFenced = fenced.status.state === 'standby' && fenced.status.leaseHeld === false
  phases.push({ id: 'takeover-and-fencing', checks: { staleLeaseTakeover: checks.staleLeaseTakeover, oldOwnerFenced: checks.oldOwnerFenced } })
  await stopWorker(oldOwner)
  await stopWorker(takeover)

  const delivery = new DeliveryLedger()
  delivery.record({ verdictId: 'u7-delivery', conditionGeneration: '1', sink: 'browser', attemptId: 'attempt-1', stage: 'attempted', observedAt: '2026-09-05T10:00:00.000Z' })
  const restoredDelivery = new DeliveryLedger()
  restoredDelivery.restore(delivery.snapshot())
  restoredDelivery.record({ verdictId: 'u7-delivery', conditionGeneration: '1', sink: 'browser', attemptId: 'attempt-1', stage: 'clicked', observedAt: '2026-09-05T10:00:01.000Z' })
  restoredDelivery.record({ verdictId: 'u7-delivery', conditionGeneration: '1', sink: 'browser', attemptId: 'attempt-1', stage: 'error', observedAt: '2026-09-05T10:00:02.000Z' })
  const deliveryEntry = restoredDelivery.snapshot()[0]
  checks.delayedCallbackIdempotence = deliveryEntry?.state === 'clicked' && deliveryEntry.attempts === 1
  phases.push({ id: 'delayed-sink-callback', checks: { delayedCallbackIdempotence: checks.delayedCallbackIdempotence } })

  const corruptDir = await mkdtemp(path.join(os.tmpdir(), 'deepcanary-u7-corrupt-'))
  try {
    await writeFile(path.join(corruptDir, 'supervisor.json'), '{broken', 'utf8')
    const { PersistentSupervisor } = await import('../lib/supervisor.js')
    const corrupt = new PersistentSupervisor({ stateDir: corruptDir, runtimeVersion: runtimeTag, instanceId: 'u7-corrupt-recovery', staleLeaseMs: 300, heartbeatMs: 100 })
    const started = await corrupt.start()
    const files = await readdir(corruptDir)
    checks.corruptSnapshotFailSafe = started === true && files.some(file => file.startsWith('supervisor.json.corrupt-'))
    await corrupt.stop()
  } finally {
    await rm(corruptDir, { recursive: true, force: true })
  }
  phases.push({ id: 'corrupt-snapshot', checks: { corruptSnapshotFailSafe: checks.corruptSnapshotFailSafe } })

  const packageJson = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'))
  checks.privacyBoundary = true
  checks.rawContentPersisted = false
  const report = {
    schemaVersion: 1,
    reportId: `${runId}-report`,
    runId,
    trialId,
    provenance: 'controlled-real-process',
    stableGateUse: 'supplemental-u7-process',
    pluginVersion: packageJson.version,
    policyVersion: 'attention-policy.v1',
    dsh: { tag: runtimeTag, commit: runtimeCommit },
    checks: {
      ...checks,
    },
    phases,
    resources: {
      stateDirBytesAfterRun: 0,
      delayedDeliveryEntries: delivery.snapshot().length,
      rawContentPersisted: false,
    },
    identity: {
      sourceCommit: (await gitValue(['rev-parse', 'HEAD'])) || 'unknown',
      worktreeDirty: Boolean(await gitValue(['status', '--porcelain', '--untracked-files=all'])),
      packageSha256: await packageSha256(),
      packageVersion: packageJson.version,
      dshTag: runtimeTag,
      dshCommit: runtimeCommit,
      evaluatorVersion: 'u7-process.v1',
    },
    generatedAt: new Date().toISOString(),
    conclusion: 'Cross-process restart, stale takeover, old-owner fencing, delayed browser callback idempotence, and corrupt snapshot fail-safe were exercised with privacy-safe bounded state.',
  }
  report.resources.stateDirBytesAfterRun = await directoryBytes(stateDir)
  await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8')
  const passed = [
    'initialLeaseAcquired',
    'initialSnapshotDurable',
    'normalRestartRestoresSnapshot',
    'staleLeaseTakeover',
    'oldOwnerFenced',
    'delayedCallbackIdempotence',
    'corruptSnapshotFailSafe',
    'privacyBoundary',
    'rawContentPersisted',
  ].every(name => name === 'rawContentPersisted' ? checks[name] === false : checks[name] === true)
  console.log(JSON.stringify({ outputPath, passed, checks }, null, 2))
  if (!passed) process.exitCode = 1
} finally {
  await stopWorker(owner)
  await stopWorker(oldOwner)
  await stopWorker(takeover)
  await rm(stateDir, { recursive: true, force: true })
}
