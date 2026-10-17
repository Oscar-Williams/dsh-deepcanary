import { mkdir, readFile, writeFile, access } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import path from 'node:path'
import { guardPack } from './guard-pack.mjs'
import { loadRuntime } from './runtime-checkout.mjs'
const root = process.cwd()
const manifest = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'))
const runtime = await loadRuntime(process.env.DSH_RUNTIME)
const [candidateVersion] = process.argv.slice(2)
if (!candidateVersion || manifest.version !== candidateVersion) throw new Error('Usage: node freeze-local-candidate.mjs <exact-current-version> (must match package.json)')
const dirty = execFileSync('git', ['status', '--porcelain', '--untracked-files=no'], { cwd: root, encoding: 'utf8', windowsHide: true }).trim()
if (dirty) throw new Error('Commit the reviewed public source and lib before freezing; tracked snapshot must be clean')
await guardPack(root)
const directory = path.join(root, 'output/releases', manifest.version)
const artifact = path.join(directory, `${manifest.name}-${manifest.version}.tgz`)
await mkdir(directory, { recursive: true })
try { await access(artifact); throw new Error('Frozen artifact exists; do not overwrite') } catch (error) { if (error.code !== 'ENOENT') throw error }
const npmCli = process.env.npm_execpath ?? path.join(path.dirname(process.execPath), 'node_modules/npm/bin/npm-cli.js')
const result = execFileSync(process.execPath, [npmCli, 'pack', '--json', '--pack-destination', directory], { cwd: root, encoding: 'utf8', windowsHide: true })
const bytes = await readFile(artifact)
const sha256 = createHash('sha256').update(bytes).digest('hex')
// Hash only committed source inputs; private local maintenance files are outside this identity.
const sourceFiles = execFileSync('git', ['ls-files', '-z', '--', 'package.json', 'package-lock.json', 'src', 'scripts', 'test', 'benchmark'], { cwd: root, encoding: 'utf8', windowsHide: true }).split('\0').filter(Boolean)
const codeDigest = createHash('sha256')
for (const file of sourceFiles.sort()) {
  const content = await readFile(path.join(root, file))
  codeDigest.update(file).update('\0').update(String(content.length)).update('\0').update(content)
}
const codeHash = codeDigest.digest('hex')
await writeFile(path.join(directory, 'local-candidate.json'), JSON.stringify({ schemaVersion: 1, status: 'frozen-local-unpublished-candidate', frozenAt: new Date().toISOString(), pluginVersion: manifest.version, artifact, sha256, bytes: bytes.length,
  sourceCommit: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8', windowsHide: true }).trim(), codeHash, codeHashScope: 'sorted-length-framed-path-and-bytes:package-manifests-src-scripts-test-benchmark', source: 'clean-tracked-source-commit', hostVersion: runtime.version, hostCommit: runtime.commit,
  publication: 'not-performed', deviceAcceptance: 'pending-independent-web-and-desktop', packageResult: result.slice(result.lastIndexOf('\n[') + 1) }, null, 2) + '\n', { flag: 'wx' })
console.log(JSON.stringify({ artifact, sha256, bytes: bytes.length, status: 'frozen-local-unpublished-candidate' }, null, 2))
