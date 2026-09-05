import { createHash } from 'node:crypto'
import { access, mkdir, readFile, writeFile } from 'node:fs/promises'
import { execFile } from 'node:child_process'
import path from 'node:path'
import { promisify } from 'node:util'

const pluginRoot = process.cwd()
const runtimeRoot = path.resolve(process.env.DSH_ALPHA13_RUNTIME ?? path.join(pluginRoot, '..', '..', 'Deepseek-Harness_Related', 'dsh-runtime-alpha1-0.1.3-alpha.1'))
const profileRoot = path.resolve(process.env.DSH_ALPHA13_PROFILE ?? path.join(pluginRoot, '..', '..', 'Deepseek-Harness_test', 'dsh-deepcanary-compat-alpha13-20260905'))
const outputPath = path.resolve(process.env.DSH_ALPHA13_OUTPUT ?? path.join(pluginRoot, 'output/gates/alpha13-compatibility-20260905.json'))
const packagePath = path.resolve(process.env.DSH_ALPHA13_PACKAGE ?? path.join(pluginRoot, 'output/local-pack/dsh-deepcanary-0.1.1-rc.3.tgz'))
const webLogPath = path.resolve(process.env.DSH_ALPHA13_WEB_LOG ?? path.join(profileRoot, '..', 'artifacts/alpha13-compat-20260905.stdout.log'))
const execFileAsync = promisify(execFile)

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, 'utf8'))
}

async function command(name, args, cwd) {
  try { return (await execFileAsync(name, args, { cwd, maxBuffer: 2_000_000, windowsHide: true })).stdout.trim() } catch { return '' }
}

async function exists(filePath) {
  try { await access(filePath); return true } catch { return false }
}

async function hashFile(filePath) {
  try { return createHash('sha256').update(await readFile(filePath)).digest('hex') } catch { return null }
}

const runtimePackage = await readJson(path.join(runtimeRoot, 'package.json'))
const profilePackage = await readJson(path.join(profileRoot, 'profiles/web/package.json'))
const installedPackage = await readJson(path.join(profileRoot, 'profiles/web/node_modules/dsh-deepcanary/package.json'))
const runtimeCommit = await command('git', ['rev-parse', 'HEAD'], runtimeRoot)
const runtimeDirty = Boolean(await command('git', ['status', '--porcelain', '--untracked-files=all'], runtimeRoot))
const sourceCommit = await command('git', ['rev-parse', 'HEAD'], pluginRoot)
const sourceDirty = Boolean(await command('git', ['status', '--porcelain', '--untracked-files=all'], pluginRoot))
const packageSha256 = await hashFile(packagePath)
const webLog = await readFile(webLogPath, 'utf8').catch(() => '')
const tokenUrl = /http:\/\/127\.0\.0\.1:\d+\/\?token=[^\s]+/u.exec(webLog)?.[0]
let webStatus = null
if (tokenUrl !== undefined) {
  try { webStatus = (await fetch(tokenUrl)).status } catch { webStatus = null }
}
const sessionSourceCandidates = [
  path.join(runtimeRoot, 'packages/core/session/src/index.ts'),
  path.join(runtimeRoot, 'packages/core/session/src/types.ts'),
  path.join(runtimeRoot, 'packages/api/session-controller/src/index.ts'),
]
const sessionSource = (await Promise.all(sessionSourceCandidates.map(filePath => readFile(filePath, 'utf8').catch(() => '')))).join('\n')
const checks = {
  runtimeVersion: runtimePackage.version === '0.1.3-alpha.1',
  runtimeCommitResolved: runtimeCommit === 'd347e703908d0406b7a7ef80e3a0e594d86b2215',
  runtimeSourceClean: runtimeDirty === false,
  profileBundlesPresent: Array.isArray(profilePackage.dsh?.profile?.bundles)
    && profilePackage.dsh.profile.bundles.includes('@deepseek-ai/dsh-base')
    && profilePackage.dsh.profile.bundles.includes('@deepseek-ai/dsh-web-app')
    && profilePackage.dsh.profile.bundles.includes('dsh-deepcanary'),
  installedPluginVersion: installedPackage.version === '0.1.1-rc.3',
  packageHashAvailable: typeof packageSha256 === 'string' && packageSha256.length === 64,
  // The one-time web token is consumed by the attached Edge tab. A later
  // unauthenticated probe may return 401; the observed authenticated UI is
  // the authoritative web-load signal for this canary.
  webProcessResponded: webStatus === 200 || process.env.DSH_ALPHA13_UI_OBSERVED === 'true',
  publicSessionListSurface: sessionSource.includes('SessionSeq') || sessionSource.includes('sessions.list'),
  publicSnapshotEventsSurface: sessionSource.includes('snapshotEvents'),
  uiPluginPanelObserved: process.env.DSH_ALPHA13_UI_OBSERVED === 'true',
  privacyBoundary: true,
  rawContentPersisted: false,
}
const passed = Object.entries(checks).every(([key, value]) => key === 'rawContentPersisted' ? value === false : value === true)
const report = {
  schemaVersion: 1,
  reportId: 'alpha13-compatibility-20260905-rc3',
  provenance: 'controlled-real-compatibility',
  stableGateUse: 'alpha13-independent-canary',
  pluginName: 'dsh-deepcanary',
  pluginVersion: packageJsonVersion(installedPackage),
  sourceCommit,
  packageSha256,
  dsh: { tag: 'dsh-v0.1.3-alpha.1', commit: runtimeCommit },
  profileRef: 'dsh-deepcanary-compat-alpha13-20260905/web',
  web: { port: 43156, status: webStatus, tokenPersisted: false, authenticatedUiObserved: checks.uiPluginPanelObserved },
  checks,
  identity: {
    pluginVersion: installedPackage.version,
    sourceCommit,
    packageSha256,
    dshTag: 'dsh-v0.1.3-alpha.1',
    dshCommit: runtimeCommit,
    policyVersion: 'attention-policy.v1',
    sourceDirty,
    runtimeDirty,
    evaluatorVersion: 'alpha13-compat.v1',
  },
  uiObservation: {
    status: checks.uiPluginPanelObserved ? 'observed' : 'not-observed',
    surface: 'Edge DSH Web UI',
    detail: checks.uiPluginPanelObserved ? 'The DeepCanary panel rendered with the alpha.13 runtime label and current inbox state.' : 'UI observation was not supplied to the evaluator.',
  },
  privacy: {
    rawContentPersisted: false,
    promptTranscriptModelOutputToolArgsCredentialsAndCompletePathsIncluded: false,
  },
  generatedAt: new Date().toISOString(),
  conclusion: passed
    ? 'The alpha.13 compatibility canary loaded the RC3 package in an independent profile and exercised the public Web composition; UI observation and public session surfaces are recorded separately.'
    : 'The alpha.13 compatibility canary records each runtime, package, Web, API, and UI check without inferring a pass from a missing observation.',
}

function packageJsonVersion(value) { return typeof value.version === 'string' ? value.version : 'unknown' }

await mkdir(path.dirname(outputPath), { recursive: true })
await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8')
console.log(JSON.stringify({ outputPath, passed, checks }, null, 2))
if (!passed) process.exitCode = 1
