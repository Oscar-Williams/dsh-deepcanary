import { access, readFile } from 'node:fs/promises'
import { execFile } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'

const root = fileURLToPath(new URL('..', import.meta.url))
const execFileAsync = promisify(execFile)
const packageJson = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'))
const required = [
  'lib/index.js',
  'lib/index.d.ts',
  'lib/client.js',
  'cordis.patch.yml',
  'README.md',
  'README.en.md',
  'CHANGELOG.md',
  'docs/architecture.md',
  'docs/compatibility.md',
  'docs/security.md',
  'docs/release-checklist.md',
  'benchmark/attention-gold.json',
  'benchmark/release-receipt.json',
  'LICENSE',
]

for (const file of required) await access(path.join(root, file))
const entry = await readFile(path.join(root, 'lib/index.js'), 'utf8')
if (!entry.includes("dsh-deepcanary")) throw new Error('lib/index.js does not contain the plugin entry')
const client = await readFile(path.join(root, 'lib/client.js'), 'utf8')
if (/\bexport\s*\{/.test(client)) throw new Error('lib/client.js must remain a classic script for DSH index injection')
if (packageJson.main !== './lib/index.js' || packageJson.types !== './lib/index.d.ts') throw new Error('package entry points are inconsistent')

const npmArgs = ['pack', '--dry-run', '--json', '--ignore-scripts']
const npmCli = process.platform === 'win32'
  ? process.env.npm_execpath ?? path.join(path.dirname(process.execPath), 'node_modules', 'npm', 'bin', 'npm-cli.js')
  : undefined
const npmCommand = npmCli === undefined ? 'npm' : process.execPath
const commandArgs = npmCli === undefined ? npmArgs : [npmCli, ...npmArgs]
const { stdout } = await execFileAsync(npmCommand, commandArgs, { cwd: root, maxBuffer: 2_000_000 })
const packReport = JSON.parse(stdout)
const packedFiles = new Set(packReport[0]?.files?.map(file => file.path) ?? [])
for (const file of ['lib/index.js', 'lib/client.js', 'cordis.patch.yml', 'benchmark/attention-gold.json']) {
  if (![...packedFiles].some(candidate => candidate === file || candidate.endsWith(`/${file}`))) throw new Error(`required file is absent from npm package: ${file}`)
}
for (const file of packedFiles) {
  if (/^(src|test|tests|node_modules|设计思路\(不提交\)|\.dsh-deepcanary-test)(\/|\\)/i.test(file) || /设计指南|设计方案|制作建议/.test(file)) {
    throw new Error(`private or development file entered the npm package: ${file}`)
  }
}
console.log(`distribution ok: ${packageJson.name}@${packageJson.version}`)
