import { execFile } from 'node:child_process'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'
import { Context } from '@deepseek-ai/cordis'
import { SessionStore } from '@deepseek-ai/dsh-session'
import { resolveReleaseArtifact, verifyBuiltEntries } from './release-artifact.mjs'
import { verifyEnvironment } from './verify-environment.mjs'

const root = fileURLToPath(new URL('..', import.meta.url))
const execFileAsync = promisify(execFile)
const packageJson = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'))
const runId = process.env.DSH_ADAPTER_RUN_ID ?? `alpha5-npm-adapter-${packageJson.version}-${new Date().toISOString().replaceAll(/[:.]/g, '-')}`
const outputPath = path.resolve(root, process.env.DSH_ADAPTER_OUTPUT ?? `output/gates/${runId}.json`)
const runtimeTag = 'dsh-v0.1.2-alpha.5'
await verifyEnvironment(root)
const artifact = await resolveReleaseArtifact(root, packageJson, process.env.DSH_ADAPTER_PACKAGE_TGZ)
await verifyBuiltEntries(root, artifact)

async function command(name, args) {
  try {
    return (await execFileAsync(name, args, { cwd: root, maxBuffer: 2_000_000 })).stdout.trim()
  } catch {
    return ''
  }
}

const { ContextDshAdapter } = await import('../lib/adapters/dsh.js')
const ctx = new Context()
const storeFiber = await ctx.plugin(SessionStore)
const session = ctx.sessions.create('alpha5-adapter-session')
session.append('turn/start', { turn: 1 })
const received = []
const adapter = new ContextDshAdapter(ctx, { hostVersion: runtimeTag })
adapter.subscribe(event => received.push({
  type: event.type,
  hasSnapshot: event.snapshot !== undefined,
  ...(event.snapshot === undefined ? {} : { eventCount: event.snapshot.eventCount, lastEventSeq: event.snapshot.lastEventSeq }),
}))
try {
  await adapter.start()
  const status = adapter.getReconciliationStatus()
  const snapshot = await adapter.getSessionSnapshot(session.id)
  const checks = {
    sessionsList: ctx.sessions.list().length === 1,
    snapshotEvents: snapshot?.eventCount === 1 && snapshot.lastEventSeq === 0,
    subscriberFirstReconciliation: received[0]?.type === 'session/created' && received[0]?.hasSnapshot === true,
    phase: status.phase === 'ready',
    authoritative: status.authoritative === true,
    verified: status.verified === true,
    listedSessions: status.listedSessions === 1,
    bufferedEvents: status.bufferedEvents === 0,
    sessionEventCount: snapshot?.eventCount === 1,
    lastEventSeq: snapshot?.lastEventSeq === 0,
    running: snapshot?.running === true,
  }
  const report = {
    schemaVersion: 1,
    platform: process.platform,
    nodeVersion: process.version,
    provenance: 'controlled',
    pluginName: 'dsh-deepcanary',
    pluginVersion: packageJson.version,
    sourceCommit: await command('git', ['rev-parse', 'HEAD']) || 'unknown',
    packageSha256: artifact.sha256,
    artifactSourceCommit: artifact.sourceCommit,
    dshTag: runtimeTag,
    dshCommit: null,
    execution: { adapter: 'working-tree-lib-matching-frozen-artifact', runtime: 'locked-npm-packages', runtimeVersion: '0.1.2-alpha.5', sourceCheckoutTested: false },
    policyVersion: 'attention-policy.v1',
    runId,
    trialId: process.env.DSH_ADAPTER_TRIAL_ID ?? runId,
    rawContentPersisted: false,
    checks,
  }
  await mkdir(path.dirname(outputPath), { recursive: true })
  await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8')
  const passed = Object.values(checks).every(value => value === true)
  console.log(`alpha.5 adapter smoke report written: ${path.relative(root, outputPath)}`)
  console.log(JSON.stringify({ passed, checks }, null, 2))
  if (!passed) process.exitCode = 1
} finally {
  await storeFiber.dispose()
}
