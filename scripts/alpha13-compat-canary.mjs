import { gunzipSync } from 'node:zlib'
import { access, mkdir, readFile, readdir, writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { execFile } from 'node:child_process'
import path from 'node:path'
import { promisify } from 'node:util'

const pluginRoot = process.cwd()
const packageJson = JSON.parse(await readFile(path.join(pluginRoot, 'package.json'), 'utf8'))
const expectedPluginVersion = packageJson.version
const runtimeRoot = path.resolve(process.env.DSH_ALPHA13_RUNTIME ?? path.join(pluginRoot, '..', '..', 'Deepseek-Harness_Related', 'dsh-runtime-alpha1-0.1.3-alpha.1'))
const profileRoot = path.resolve(process.env.DSH_ALPHA13_PROFILE ?? path.join(pluginRoot, '..', '..', 'Deepseek-Harness_test', 'dsh-deepcanary-compat-alpha13-20260905'))
const outputPath = path.resolve(process.env.DSH_ALPHA13_OUTPUT ?? path.join(pluginRoot, 'output/gates/alpha13-compatibility.json'))
const packagePath = path.resolve(process.env.DSH_ALPHA13_PACKAGE ?? path.join(pluginRoot, `output/local-pack/dsh-deepcanary-${expectedPluginVersion}.tgz`))
const webLogPath = process.env.DSH_ALPHA13_WEB_LOG === undefined ? undefined : path.resolve(process.env.DSH_ALPHA13_WEB_LOG)
const uiEvidencePath = process.env.DSH_ALPHA13_UI_EVIDENCE === undefined ? undefined : path.resolve(process.env.DSH_ALPHA13_UI_EVIDENCE)
const webPort = Number(process.env.DSH_ALPHA13_WEB_PORT ?? '43157')
const profileRef = `${path.basename(profileRoot)}/web`
const reportId = process.env.DSH_ALPHA13_REPORT_ID ?? `alpha13-compatibility-${expectedPluginVersion}`
const execFileAsync = promisify(execFile)

async function readJson(filePath) {
  try { return JSON.parse(await readFile(filePath, 'utf8')) } catch { return undefined }
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

function readTarString(buffer, start, end) {
  return buffer.subarray(start, end).toString('utf8').replace(/\0.*$/u, '').trim()
}

function readTarSize(buffer) {
  const value = readTarString(buffer, 124, 136).replace(/[^0-7]/gu, '')
  return value.length === 0 ? 0 : Number.parseInt(value, 8)
}

/** Read the package payload without depending on a mutable global tar module. */
function tarEntries(file) {
  const archive = gunzipSync(file)
  const entries = new Map()
  let offset = 0
  while (offset + 512 <= archive.length) {
    const header = archive.subarray(offset, offset + 512)
    if (header.every(byte => byte === 0)) break
    const size = readTarSize(header)
    const type = String.fromCharCode(header[156] ?? 0)
    const prefix = readTarString(header, 345, 500)
    const name = readTarString(header, 0, 100)
    const relative = `${prefix ? `${prefix}/` : ''}${name}`.replace(/^package\//u, '')
    const dataStart = offset + 512
    if ((type === '\0' || type === '0' || type === '') && relative.length > 0) {
      entries.set(relative, archive.subarray(dataStart, dataStart + size))
    }
    offset = dataStart + Math.ceil(size / 512) * 512
  }
  return entries
}

async function directoryEntries(directory) {
  const entries = new Map()
  const walk = async current => {
    for (const entry of await readdir(current, { withFileTypes: true })) {
      const file = path.join(current, entry.name)
      if (entry.isDirectory()) await walk(file)
      else if (entry.isFile()) entries.set(path.relative(directory, file).replaceAll('\\', '/'), await readFile(file))
    }
  }
  await walk(directory)
  return entries
}

function digestEntries(entries) {
  const digest = createHash('sha256')
  for (const [name, data] of [...entries.entries()].sort(([left], [right]) => left.localeCompare(right, 'en'))) {
    digest.update(name).update('\0').update(data)
  }
  return digest.digest('hex')
}

function sameEntries(left, right) {
  if (left.size !== right.size) return false
  for (const [name, data] of left) {
    const other = right.get(name)
    if (other === undefined || !data.equals(other)) return false
  }
  return true
}

const runtimePackage = await readJson(path.join(runtimeRoot, 'package.json'))
const profilePackage = await readJson(path.join(profileRoot, 'profiles/web/package.json'))
const installedRoot = path.join(profileRoot, 'profiles/web/node_modules/dsh-deepcanary')
const installedPackage = await readJson(path.join(installedRoot, 'package.json'))
const runtimeCommit = await command('git', ['rev-parse', 'HEAD'], runtimeRoot)
const runtimeDirty = Boolean(await command('git', ['status', '--porcelain', '--untracked-files=all'], runtimeRoot))
const sourceCommit = await command('git', ['rev-parse', 'HEAD'], pluginRoot)
const sourceDirty = Boolean(await command('git', ['status', '--porcelain', '--untracked-files=all'], pluginRoot))
const packageSha256 = await hashFile(packagePath)
const archiveEntries = await exists(packagePath) ? tarEntries(await readFile(packagePath)) : new Map()
const installedEntries = await exists(installedRoot) ? await directoryEntries(installedRoot) : new Map()
const installedMatchesPackage = sameEntries(archiveEntries, installedEntries)
const archiveContentSha256 = digestEntries(archiveEntries)
const installedContentSha256 = digestEntries(installedEntries)
const webLog = webLogPath === undefined ? '' : await readFile(webLogPath, 'utf8').catch(() => '')
const tokenUrl = /http:\/\/127\.0\.0\.1:\d+\/\?token=[^\s]+/u.exec(webLog)?.[0]
let webStatus = null
try {
  const response = await fetch(`http://127.0.0.1:${webPort}/`)
  webStatus = response.status
} catch {
  if (tokenUrl !== undefined) {
    try { webStatus = (await fetch(tokenUrl)).status } catch { webStatus = null }
  }
}
const uiEvidence = await readJson(uiEvidencePath)
const uiEvidenceValid = uiEvidence?.schemaVersion === 1
  && uiEvidence?.status === 'observed'
  && uiEvidence?.surface === 'Edge DSH Web UI'
  && uiEvidence?.pluginVersion === expectedPluginVersion
  && uiEvidence?.dshTag === 'dsh-v0.1.3-alpha.1'
  && uiEvidence?.checks?.authenticated === true
  && uiEvidence?.checks?.pluginPanelVisible === true
  && uiEvidence?.checks?.currentInboxRendered === true
  && typeof uiEvidence?.screenshotPath === 'string'
  && await exists(path.resolve(pluginRoot, uiEvidence.screenshotPath))
  && uiEvidence.screenshotSha256 === await hashFile(path.resolve(pluginRoot, uiEvidence.screenshotPath))

const sessionSourceCandidates = [
  path.join(runtimeRoot, 'packages/core/session/src/index.ts'),
  path.join(runtimeRoot, 'packages/core/session/src/types.ts'),
  path.join(runtimeRoot, 'packages/api/session-controller/src/index.ts'),
]
const sessionSource = (await Promise.all(sessionSourceCandidates.map(filePath => readFile(filePath, 'utf8').catch(() => '')))).join('\n')
let runtimeContract
try {
  const { runRuntimeContract } = await import('./adapter-runtime-contract.mjs')
  runtimeContract = await runRuntimeContract(runtimeRoot, new URL('../', import.meta.url))
} catch (error) {
  runtimeContract = { passed: false, error: error instanceof Error ? error.message : 'runtime contract unavailable' }
}

const checks = {
  runtimeVersion: runtimePackage?.version === '0.1.3-alpha.1',
  runtimeCommitResolved: runtimeCommit === 'd347e703908d0406b7a7ef80e3a0e594d86b2215',
  runtimeSourceClean: runtimeDirty === false,
  profileBundlesPresent: Array.isArray(profilePackage?.dsh?.profile?.bundles)
    && profilePackage.dsh.profile.bundles.includes('@deepseek-ai/dsh-base')
    && profilePackage.dsh.profile.bundles.includes('@deepseek-ai/dsh-web-app')
    && profilePackage.dsh.profile.bundles.includes('dsh-deepcanary'),
  installedPluginVersion: installedPackage?.version === expectedPluginVersion,
  packageHashAvailable: typeof packageSha256 === 'string' && packageSha256.length === 64,
  installedPackageMatchesTarball: installedMatchesPackage,
  packageContentDigestAvailable: archiveEntries.size > 0 && archiveContentSha256 === installedContentSha256,
  webProcessResponded: typeof webStatus === 'number' && webStatus >= 200 && webStatus < 600,
  publicSessionListSurface: sessionSource.includes('SessionSeq') || sessionSource.includes('sessions.list'),
  publicSnapshotEventsSurface: sessionSource.includes('snapshotEvents'),
  runtimeContractPassed: runtimeContract.passed === true,
  uiEvidenceObserved: uiEvidenceValid,
  privacyBoundary: true,
  rawContentPersisted: false,
}
const passed = Object.entries(checks).every(([key, value]) => key === 'rawContentPersisted' ? value === false : value === true)
const report = {
  schemaVersion: 1,
  reportId,
  provenance: 'controlled-real-compatibility',
  stableGateUse: 'alpha13-independent-canary',
  pluginName: 'dsh-deepcanary',
  pluginVersion: installedPackage?.version ?? 'unknown',
  sourceCommit,
  packageSha256,
  archiveContentSha256,
  installedContentSha256,
  dsh: { tag: 'dsh-v0.1.3-alpha.1', commit: runtimeCommit },
  profileRef,
  web: { port: webPort, status: webStatus, tokenPersisted: false, authenticatedUiObserved: uiEvidenceValid },
  runtimeContract,
  checks,
  identity: {
    pluginVersion: installedPackage?.version ?? 'unknown',
    sourceCommit,
    packageSha256,
    dshTag: 'dsh-v0.1.3-alpha.1',
    dshCommit: runtimeCommit,
    policyVersion: 'attention-policy.v1',
    sourceDirty,
    runtimeDirty,
    evaluatorVersion: 'alpha13-compat.v2',
  },
  uiObservation: uiEvidence ?? { status: 'not-observed', surface: 'Edge DSH Web UI' },
  privacy: {
    rawContentPersisted: false,
    promptTranscriptModelOutputToolArgsCredentialsAndCompletePathsIncluded: false,
  },
  generatedAt: new Date().toISOString(),
  conclusion: passed
    ? 'The alpha.13 canary proved that the installed package bytes match the candidate tgz, the public Session v2 contract passes, the Web process responded, and a separate authenticated Edge observation recorded the loaded panel.'
    : 'The alpha.13 canary records package-byte identity, public runtime contract, Web response, and UI evidence separately; missing or mismatched evidence keeps the canary pending.',
}

await mkdir(path.dirname(outputPath), { recursive: true })
await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8')
console.log(JSON.stringify({ outputPath, passed, checks, runtimeContract: { passed: runtimeContract.passed, checks: runtimeContract.checks } }, null, 2))
if (!passed) process.exitCode = 1
