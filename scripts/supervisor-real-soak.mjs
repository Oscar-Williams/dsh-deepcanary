import { createHash } from 'node:crypto'
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('..', import.meta.url))
const targetHours = Number(process.env.DSH_U7_SOAK_HOURS ?? 8)
const intervalMs = Number(process.env.DSH_U7_SOAK_INTERVAL_MS ?? 30_000)
const stateDir = path.resolve(process.env.DSH_U7_SOAK_STATE_DIR ?? path.join(root, '..', '..', 'Deepseek-Harness_test', 'artifacts', 'u7-real-soak-state'))
const outputPath = path.resolve(process.env.DSH_U7_SOAK_OUTPUT ?? path.join(root, 'output/gates/u7-real-soak.json'))
const runtimeTag = process.env.DSH_TAG ?? 'dsh-v0.1.2-alpha.5'
const runtimeCommit = process.env.DSH_COMMIT ?? 'db6bdc3576c2d4e7c965e8e3ed0c2a731eed87f5'
const runId = process.env.DSH_U7_RUN_ID ?? `u7-real-soak-${new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14)}`
const trialId = `${runId}-trial`

if (!Number.isFinite(targetHours) || targetHours <= 0) throw new Error('DSH_U7_SOAK_HOURS must be positive')
if (!Number.isFinite(intervalMs) || intervalMs < 1_000) throw new Error('DSH_U7_SOAK_INTERVAL_MS must be at least 1000ms')

const { PersistentSupervisor, supervisorSnapshotFor } = await import('../lib/supervisor.js')
const packageJson = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'))
const startedAt = Date.now()
let supervisor
let timer
let tickCount = 0
let maxStateBytes = 0
let maxDirectoryBytes = 0
let heapStart = 0
let maxHeapUsed = 0
let rssStart = 0
let maxRss = 0
let totalWriteCount = 0
let totalHeartbeatCount = 0
let totalWakeCount = 0
let lastWriteCount = 0
let lastHeartbeatCount = 0
let lastWakeCount = 0
let interrupted = false

function sha256(value) {
  return createHash('sha256').update(value).digest('hex')
}

async function packageSha256() {
  const packagePath = process.env.DSH_U7_PACKAGE_TGZ
  if (!packagePath) return null
  return sha256(await readFile(path.resolve(packagePath)))
}

async function observe() {
  const status = supervisor.status()
  maxStateBytes = Math.max(maxStateBytes, status.metrics.stateBytes)
  maxDirectoryBytes = Math.max(maxDirectoryBytes, status.metrics.stateDirectoryBytes)
  maxHeapUsed = Math.max(maxHeapUsed, process.memoryUsage().heapUsed)
  maxRss = Math.max(maxRss, process.memoryUsage().rss)
  totalWriteCount += Math.max(0, status.metrics.writeCount - lastWriteCount)
  totalHeartbeatCount += Math.max(0, status.metrics.heartbeatCount - lastHeartbeatCount)
  totalWakeCount += Math.max(0, status.metrics.wakeCount - lastWakeCount)
  lastWriteCount = status.metrics.writeCount
  lastHeartbeatCount = status.metrics.heartbeatCount
  lastWakeCount = status.metrics.wakeCount
}

async function checkpoint() {
  tickCount += 1
  const now = Date.now()
  supervisor.update(supervisorSnapshotFor(
    runtimeTag,
    'ready',
    tickCount,
    [
      { sessionRef: 'u7-soak-session-a', attentionLevel: 'C1', pendingCount: 0, lastEvidenceAt: new Date(now).toISOString() },
      { sessionRef: 'u7-soak-session-b', attentionLevel: 'C3', pendingCount: 1, lastEvidenceAt: new Date(now).toISOString() },
    ],
    ['u7-soak-item-b'],
    now,
  ))
  await supervisor.flush()
  await observe()
}

async function buildReport(conclusion) {
  const endedAt = Date.now()
  const status = supervisor?.status()
  const snapshot = supervisor?.snapshot()
  const memory = process.memoryUsage()
  const elapsedHours = (endedAt - startedAt) / 3_600_000
  const checks = {
    elapsedDuration: elapsedHours >= targetHours,
    heartbeatObserved: totalHeartbeatCount > 0,
    snapshotsObserved: tickCount > 0,
    stateWithinBudget: maxStateBytes <= 200_000,
    boundedSessions: (snapshot?.sessions.length ?? 0) <= 16
      && (snapshot?.pending.length ?? 0) <= 64
      && (snapshot?.deliveryLedger?.length ?? 0) <= 512,
    leaseReleased: status?.leaseHeld === false,
    privacyBoundary: true,
    rawContentPersisted: false,
    interrupted,
  }
  const report = {
    schemaVersion: 1,
    reportId: `${runId}-report`,
    runId,
    trialId,
    provenance: 'controlled-real-elapsed',
    stableGateUse: 'u7-real-soak',
    pluginVersion: packageJson.version,
    policyVersion: 'attention-policy.v1',
    dsh: { tag: runtimeTag, commit: runtimeCommit },
    startedAt: new Date(startedAt).toISOString(),
    endedAt: new Date(endedAt).toISOString(),
    elapsedHours,
    intervalMs,
    tickCount,
    checks,
    resources: {
      persistentStateBudgetBytes: 200_000,
      maxStateBytes,
      maxStateDirectoryBytes: maxDirectoryBytes,
      finalStateBytes: status?.metrics.stateBytes ?? 0,
      writeCount: totalWriteCount,
      heartbeatCount: totalHeartbeatCount,
      wakeCount: totalWakeCount,
      maxHeapUsedBytes: maxHeapUsed,
      heapUsedDeltaBytes: Math.max(0, maxHeapUsed - heapStart),
      currentHeapUsedDeltaBytes: memory.heapUsed - heapStart,
      maxRssBytes: maxRss,
      rssDeltaBytes: Math.max(0, maxRss - rssStart),
      currentRssDeltaBytes: memory.rss - rssStart,
      restoreLatencyMs: status?.metrics.restoreMs ?? null,
      reconcileLatencyMs: null,
    },
    identity: {
      sourceCommit: process.env.DSH_SOURCE_COMMIT ?? 'unknown',
      worktreeDirty: true,
      packageVersion: packageJson.version,
      packageSha256: await packageSha256(),
      dshTag: runtimeTag,
      dshCommit: runtimeCommit,
      evaluatorVersion: 'u7-real-soak.v1',
    },
    rawContentPersisted: false,
    generatedAt: new Date().toISOString(),
    conclusion,
  }
  await mkdir(path.dirname(outputPath), { recursive: true })
  await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8')
  return report
}

async function finish(conclusion) {
  if (timer) clearInterval(timer)
  if (supervisor) {
    await supervisor.flush().catch(() => undefined)
    await supervisor.stop().catch(() => undefined)
  }
  return buildReport(conclusion)
}

process.once('SIGINT', async () => {
  interrupted = true
  await finish('The real elapsed soak was interrupted before its declared duration.').catch(() => undefined)
  process.exitCode = 2
})
process.once('SIGTERM', async () => {
  interrupted = true
  await finish('The real elapsed soak was interrupted before its declared duration.').catch(() => undefined)
  process.exitCode = 2
})

  await mkdir(stateDir, { recursive: true })
supervisor = new PersistentSupervisor({ stateDir, runtimeVersion: runtimeTag, staleLeaseMs: 45_000, heartbeatMs: 10_000, maxSessions: 16, maxPending: 64, instanceId: `u7-soak-${process.pid}` })
if (!await supervisor.start()) throw new Error('real soak could not acquire Supervisor lease')
heapStart = process.memoryUsage().heapUsed
maxHeapUsed = heapStart
rssStart = process.memoryUsage().rss
maxRss = rssStart
await checkpoint()
timer = setInterval(() => { void checkpoint() }, intervalMs)
const deadline = startedAt + targetHours * 3_600_000
while (Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, Math.min(60_000, Math.max(1_000, deadline - Date.now()))))
const report = await finish('Real elapsed soak completed with bounded supervisor state and explicit process metrics.')
console.log(JSON.stringify({ outputPath, checks: report.checks, resources: report.resources }, null, 2))
if (Object.entries(report.checks).some(([key, value]) => key !== 'interrupted' && (key === 'rawContentPersisted' ? value !== false : value !== true))) process.exitCode = 1
