import assert from 'node:assert/strict'
import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileTreeDigest, installedFileManifest, sha256 } from './candidate-inputs.mjs'
import { loadRuntime } from './runtime-checkout.mjs'

const [candidateReceipt, home, profile, output] = process.argv.slice(2)
if (!candidateReceipt || !home || !['web', 'desktop'].includes(profile)) throw new Error('Usage: node verify-installed-candidate.mjs <local-candidate.json> <home> <web|desktop> [receipt]')
const frozen = JSON.parse(await readFile(candidateReceipt, 'utf8'))
assert.equal(frozen.schemaVersion, 2, 'Use a candidate with its single-pass file manifest')
assert.equal(frozen.status, 'frozen-local-unpublished-candidate')
const bytes = await readFile(frozen.artifact)
assert.equal(sha256(bytes), frozen.sha256)
assert.equal(bytes.length, frozen.bytes)
const install = path.join(home, 'profiles', profile, 'node_modules/dsh-deepcanary')
const installed = await installedFileManifest(install)
assert.equal(fileTreeDigest(installed), frozen.treeDigest, 'Installed package tree differs from the frozen manifest')
assert.equal(installed.length, frozen.files.length, 'Package manager left unexpected files')
const manifest = JSON.parse(await readFile(path.join(install, 'package.json'), 'utf8'))
assert.equal(manifest.version, frozen.pluginVersion)
const runtime = process.env.DSH_RUNTIME ? await loadRuntime(process.env.DSH_RUNTIME) : undefined
const receipt = { schemaVersion: 2, observedAt: new Date().toISOString(), surface: profile, home: path.resolve(home), profile,
  hostVersion: runtime?.version ?? null, hostCommit: runtime?.commit ?? null, pluginVersion: manifest.version,
  artifact: frozen.artifact, sha256: frozen.sha256, installedFilesMatched: installed.length, treeDigest: frozen.treeDigest,
  packageInstallation: 'verified-against-frozen-file-manifest', deviceBehavior: 'requires-independent-loaded-Host-and-UI-observation', publication: 'not-performed' }
if (output) await writeFile(output, JSON.stringify(receipt, null, 2) + '\n')
console.log(JSON.stringify(receipt, null, 2))
