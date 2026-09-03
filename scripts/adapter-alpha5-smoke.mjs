import { createHash } from 'node:crypto'
import { execFile } from 'node:child_process'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'
import { Context } from '@deepseek-ai/cordis'
import { SessionStore } from '@deepseek-ai/dsh-session'

const root = fileURLToPath(new URL('..', import.meta.url))
const outputPath = path.resolve(root, 'output/gates/rc2-alpha5-adapter-smoke-20260904-v2.json')
const execFileAsync = promisify(execFile)
const packageJson = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'))
const runtimeTag = 'dsh-v0.1.2-alpha.5'
const runtimeCommit = process.env.DSH_COMMIT ?? 'db6bdc3576c2d4e7c965e8e3ed0c2a731eed87f5'

async function command(name, args) {
  try {
    return (await execFileAsync(name, args, { cwd: root, maxBuffer: 2_000_000 })).stdout.trim()
  } catch {
    return ''
  }
}

async function packageSha256() {
  const destination = await mkdtemp(path.join(os.tmpdir(), 'deepcanary-adapter-pack-'))
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
    return createHash('sha256').update(await readFile(path.join(destination, fileName))).digest('hex')
  } catch {
    return null
  } finally {
    await rm(destination, { recursive: true, force: true })
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
    provenance: 'controlled',
    pluginName: 'dsh-deepcanary',
    pluginVersion: packageJson.version,
    sourceCommit: await command('git', ['rev-parse', 'HEAD']) || 'unknown',
    packageSha256: await packageSha256(),
    dshTag: runtimeTag,
    dshCommit: runtimeCommit,
    policyVersion: 'attention-policy.v1',
    runId: 'laneB-rc2-alpha5-adapter-smoke-20260904-v2',
    trialId: 'laneB-rc2-alpha5-adapter-smoke-20260904-v2',
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
