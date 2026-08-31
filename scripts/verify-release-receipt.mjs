import { createHash } from 'node:crypto'
import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('..', import.meta.url))
const packageJson = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'))
const receipt = JSON.parse(await readFile(path.join(root, 'benchmark', 'release-receipt.json'), 'utf8'))
const gold = JSON.parse(await readFile(path.join(root, 'benchmark', 'attention-gold.json'), 'utf8'))

const receiptStatus = receipt.status
if (receiptStatus !== 'CANDIDATE' && receiptStatus !== 'PASS') throw new Error('release receipt status must be CANDIDATE or PASS')
if (receipt.pluginVersion !== packageJson.version) throw new Error('release receipt pluginVersion does not match package.json')
if (receipt.attentionFixtureVersion !== gold.fixtureVersion) throw new Error('release receipt fixture version does not match AttentionGold')
if (!Array.isArray(gold.scenarios) || gold.scenarios.length < 15) throw new Error('AttentionGold must contain at least 15 classification scenarios')
if (!Array.isArray(gold.serviceScenarios) || gold.serviceScenarios.length < 2) throw new Error('AttentionGold must contain duplicate and bundle service scenarios')

const requiredGates = [
  'runtimeInstall', 'runtimeBuild', 'cliVersion', 'webDumpConfig', 'pluginBuild',
  'pluginTests', 'pluginWebE2E', 'settingsE2E', 'unloadRestart', 'privacyGate',
  'distributionIntegrity', 'publicTagInstall', 'windowsE2E', 'wslE2E', 'modelE2E',
]
const candidatePendingGates = new Set(['publicTagInstall'])
for (const gate of requiredGates) {
  if (receipt.gates?.[gate] === true) continue
  if (receiptStatus === 'CANDIDATE' && candidatePendingGates.has(gate) && receipt.gates?.[gate] === false) continue
  throw new Error(`release gate is not PASS: ${gate}`)
}
if (receiptStatus === 'CANDIDATE' && receipt.gates?.publicTagInstall !== false) {
  throw new Error('CANDIDATE receipt must keep publicTagInstall pending')
}
if (receipt.attentionGate !== 'PASS') throw new Error('attentionGate must be PASS')
if (typeof receipt.artifactSha256 !== 'string' || !/^[a-f0-9]{64}$/.test(receipt.artifactSha256)) throw new Error('artifactSha256 is missing or malformed')

const expectedTarball = `dsh-deepcanary-${packageJson.version}.tgz`
const candidates = (await readdir(root)).filter(name => name === expectedTarball)
if (candidates.length !== 1) throw new Error(`expected exactly one release artifact: ${expectedTarball}`)
const digest = createHash('sha256').update(await readFile(path.join(root, expectedTarball))).digest('hex')
if (digest !== receipt.artifactSha256) throw new Error('artifactSha256 does not match the release tarball')

console.log(`release receipt ok: ${packageJson.name}@${packageJson.version} [${receiptStatus}] (${digest})`)
