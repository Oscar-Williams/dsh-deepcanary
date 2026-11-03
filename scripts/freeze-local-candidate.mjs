import { mkdir, readFile, writeFile, access } from 'node:fs/promises'
import { execFileSync } from 'node:child_process'
import path from 'node:path'
import { preparePack } from './prepare-pack.mjs'
import { contentScanner, auditPackage, auditGitRange } from './distribution-audit.mjs'
import { candidateInputs, sha256 } from './candidate-inputs.mjs'

const root = process.cwd()
const manifest = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'))
const [version] = process.argv.slice(2)
if (!version || version !== manifest.version) throw new Error('Usage: node freeze-local-candidate.mjs <exact-current-version>')
const git = args => execFileSync('git', args, { cwd: root, encoding: 'utf8', windowsHide: true }).trim()
if (git(['status', '--porcelain', '--untracked-files=no'])) throw new Error('Commit the reviewed source and synchronized lib before freezing')
if (git(['ls-files', '--others', '--exclude-standard', '--', 'src', 'test', 'lib'])) throw new Error('Candidate source contains untracked implementation files')
const verified = await preparePack(root, { requireVerified: true })
const directory = path.join(root, 'output/releases', version)
const artifact = path.join(directory, `${manifest.name}-${version}.tgz`)
await mkdir(directory, { recursive: true })
try { await access(artifact); throw new Error('Frozen candidate exists; use the next RC for changed bytes') } catch (error) { if (error.code !== 'ENOENT') throw error }
const scanner = contentScanner()
const gitScan = auditGitRange(root, scanner)
const npmCli = process.env.npm_execpath ?? path.join(path.dirname(process.execPath), 'node_modules/npm/bin/npm-cli.js')
// The shared prepack preparation has already run. Inspect the actual resulting archive once.
execFileSync(process.execPath, [npmCli, 'pack', '--ignore-scripts', '--json', '--pack-destination', directory], { cwd: root, windowsHide: true, stdio: 'pipe' })
const bytes = await readFile(artifact)
const audit = auditPackage(bytes, manifest, scanner)
if (audit.libTreeDigest !== verified.libTreeDigest) throw new Error('Packed lib differs from the verified build; preserve this candidate and fix under a new RC')
const receipt = { schemaVersion: 2, status: 'frozen-local-unpublished-candidate', frozenAt: new Date().toISOString(),
  pluginVersion: version, artifact, sha256: sha256(bytes), bytes: bytes.length, integrity: audit.integrity,
  sourceCommit: git(['rev-parse', 'HEAD']), inputHash: await candidateInputs(root), verification: verified,
  files: audit.files, treeDigest: audit.treeDigest, scan: { git: gitScan, uniqueContents: scanner.count() },
  publication: 'not-performed', deviceAcceptance: 'pending-four-host-installations' }
await writeFile(path.join(directory, 'local-candidate.json'), JSON.stringify(receipt, null, 2) + '\n', { flag: 'wx' })
console.log(JSON.stringify({ artifact, sha256: receipt.sha256, integrity: receipt.integrity, bytes: bytes.length, status: receipt.status }, null, 2))
