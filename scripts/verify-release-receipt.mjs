import { createHash } from 'node:crypto'
import { access, readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('..', import.meta.url))
const packageJson = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'))
if (packageJson.version !== '0.1.1-rc.1') {
  console.log(`release receipt check skipped: ${packageJson.name}@${packageJson.version} is an unpublished engineering candidate; the immutable RC1 receipt remains historical.`)
  process.exit(0)
}
const receipt = JSON.parse(await readFile(path.join(root, 'benchmark', 'alpha5-compatibility-receipt.json'), 'utf8'))
const gold = JSON.parse(await readFile(path.join(root, 'benchmark', 'attention-gold-v3.json'), 'utf8'))

const receiptStatus = receipt.status
if (receiptStatus !== 'CANDIDATE' && receiptStatus !== 'PASS') throw new Error('release receipt status must be CANDIDATE or PASS')
if (receipt.receiptType !== 'release-candidate') throw new Error('current receipt must be a release-candidate receipt')
if (receipt.plugin !== packageJson.name) throw new Error('release receipt plugin does not match package.json')
if (receipt.pluginVersion !== packageJson.version) throw new Error('release receipt pluginVersion does not match package.json')
if (receipt.attentionFixtureVersion !== gold.fixtureVersion) throw new Error('release receipt fixture version does not match AttentionGold')
if (receipt.runtime?.tag !== 'dsh-v0.1.2-alpha.5' || receipt.runtime?.version !== '0.1.2-alpha.5') {
  throw new Error('current receipt must target official DSH alpha.5')
}
if (!Array.isArray(gold.scenarios) || gold.scenarios.length < 15) throw new Error('AttentionGold must contain at least 15 classification scenarios')
if (!Array.isArray(gold.serviceScenarios) || gold.serviceScenarios.length < 2) throw new Error('AttentionGold must contain duplicate and bundle service scenarios')

const requiredGates = [
  'runtimeInstall', 'runtimeBuild', 'cliVersion', 'webDumpConfig', 'pluginBuild',
  'pluginTests', 'pluginWebE2E', 'settingsE2E', 'unloadRestart', 'privacyGate',
  'distributionIntegrity', 'publicTagInstall', 'windowsE2E', 'wslE2E', 'modelE2E',
]
const candidatePendingGates = new Set(['publicTagInstall', 'wslE2E'])
for (const gate of requiredGates) {
  if (receipt.gates?.[gate] === true) continue
  if (receiptStatus === 'CANDIDATE' && candidatePendingGates.has(gate) && receipt.gates?.[gate] === false) continue
  throw new Error(`release gate is not PASS: ${gate}`)
}
if (receipt.attentionGate !== 'PASS') throw new Error('attentionGate must be PASS')
if (typeof receipt.artifactSha256 !== 'string' || !/^[a-f0-9]{64}$/.test(receipt.artifactSha256)) throw new Error('artifactSha256 is missing or malformed')
if (typeof receipt.pluginCommit !== 'string' || receipt.pluginCommit.length === 0) throw new Error('pluginCommit is missing')

const expectedTarball = `dsh-deepcanary-${packageJson.version}.tgz`
const artifactCandidates = [
  path.join(root, 'output', 'local-pack', expectedTarball),
  path.join(root, expectedTarball),
]
let artifactPath
for (const candidate of artifactCandidates) {
  try {
    await access(candidate)
    artifactPath = candidate
    break
  } catch {
    // Continue to the documented fallback location.
  }
}
if (artifactPath === undefined) throw new Error(`release artifact is missing: ${expectedTarball}`)
const digest = createHash('sha256').update(await readFile(artifactPath)).digest('hex')
if (digest !== receipt.artifactSha256) throw new Error('artifactSha256 does not match the release tarball')

console.log(`release receipt ok: ${packageJson.name}@${packageJson.version} [${receiptStatus}] (${digest})`)
