import assert from 'node:assert/strict'
import { readFile, writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import path from 'node:path'
import { tarEntries } from './release-artifact.mjs'
import { loadRuntime } from './runtime-checkout.mjs'
const [candidateReceipt, home, profile, output] = process.argv.slice(2)
if (!candidateReceipt || !home || !['web', 'desktop'].includes(profile)) throw new Error('Usage: node verify-installed-candidate.mjs <local-candidate.json> <home> <web|desktop> [receipt]')
const frozen = JSON.parse(await readFile(candidateReceipt, 'utf8'))
assert.equal(frozen.status, 'frozen-local-unpublished-candidate')
assert.match(frozen.sha256, /^[a-f0-9]{64}$/)
const artifact = path.resolve(frozen.artifact)
const bytes = await readFile(artifact)
const sha256 = createHash('sha256').update(bytes).digest('hex')
assert.equal(sha256, frozen.sha256)
assert.equal(bytes.length, frozen.bytes)
const install = path.join(home, 'profiles', profile, 'node_modules', 'dsh-deepcanary')
const entries = tarEntries(bytes)
const manifest = JSON.parse(entries.get('package.json').toString('utf8'))
assert.equal(manifest.name, 'dsh-deepcanary')
assert.equal(manifest.version, frozen.pluginVersion)
for (const [file, expected] of entries) assert.ok((await readFile(path.join(install, file))).equals(expected), `Installed file differs: ${file}`)
const runtime = process.env.DSH_RUNTIME ? await loadRuntime(process.env.DSH_RUNTIME) : undefined
const receipt = { schemaVersion: 1, observedAt: new Date().toISOString(), surface: profile, home: path.resolve(home), profile, hostVersion: runtime?.version ?? null, hostCommit: runtime?.commit ?? null, buildHostVersion: frozen.hostVersion, buildHostCommit: frozen.hostCommit ?? null, pluginVersion: manifest.version, artifact, sha256, installedFilesMatched: entries.size, packageInstallation: 'verified-byte-for-byte', deviceBehavior: 'not-implied-by-installation', publication: 'not-performed' }
if (output) await writeFile(output, JSON.stringify(receipt, null, 2) + '\n')
console.log(JSON.stringify(receipt, null, 2))
