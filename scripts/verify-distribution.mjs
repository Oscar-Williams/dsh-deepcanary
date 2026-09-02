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
  'benchmark/attention-gold-v3.json',
  'benchmark/attention-quality-report.schema.json',
  'benchmark/outcome-receipt.schema.json',
  'benchmark/outcome-report.schema.json',
  'benchmark/dogfood.schema.json',
  'benchmark/dogfood-aggregate.schema.json',
  'benchmark/notification-evidence.schema.json',
  'benchmark/supervisor-smoke-report.schema.json',
  'benchmark/policy-replay.schema.json',
  'benchmark/policy-replay-report.schema.json',
  'benchmark/stable-gates-report.schema.json',
  'benchmark/policy-replay.json',
  'benchmark/alpha3-compatibility-receipt.json',
  'benchmark/release-candidate-receipt.json',
  'benchmark/release-receipt.json',
  'LICENSE',
]

for (const file of required) await access(path.join(root, file))
const entry = await readFile(path.join(root, 'lib/index.js'), 'utf8')
if (!entry.includes("dsh-deepcanary")) throw new Error('lib/index.js does not contain the plugin entry')
const client = await readFile(path.join(root, 'lib/client.js'), 'utf8')
if (!client.includes('window.__ModuleLoader__.load') || !client.includes('factory:')) {
  throw new Error('lib/client.js must register the DSH client-module factory')
}
if (/\bexport\s*\{/.test(client)) throw new Error('lib/client.js must remain a lazy-CJS factory bundle for DSH client modules')
if (packageJson.exports?.['./client'] !== './lib/client.js') throw new Error('package client export must resolve to lib/client.js')
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
for (const file of ['lib/index.js', 'lib/client.js', 'cordis.patch.yml', 'benchmark/attention-gold.json', 'benchmark/attention-gold-v3.json', 'benchmark/attention-quality-report.schema.json', 'benchmark/outcome-receipt.schema.json', 'benchmark/outcome-report.schema.json', 'benchmark/dogfood.schema.json', 'benchmark/dogfood-aggregate.schema.json', 'benchmark/notification-evidence.schema.json', 'benchmark/supervisor-smoke-report.schema.json', 'benchmark/policy-replay.schema.json', 'benchmark/policy-replay-report.schema.json', 'benchmark/stable-gates-report.schema.json', 'benchmark/policy-replay.json']) {
  if (![...packedFiles].some(candidate => candidate === file || candidate.endsWith(`/${file}`))) throw new Error(`required file is absent from npm package: ${file}`)
}
for (const receipt of [
  'benchmark/alpha3-compatibility-receipt.json',
  'benchmark/release-candidate-receipt.json',
  'benchmark/release-receipt.json',
]) {
  if ([...packedFiles].some(candidate => candidate === receipt || candidate.endsWith(`/${receipt}`))) {
    throw new Error(`release evidence must remain outside the npm package: ${receipt}`)
  }
}
for (const file of ['lib/client.d.ts', 'lib/client.d.ts.map', 'lib/client.js.map', 'lib/client/index.js']) {
  if ([...packedFiles].some(candidate => candidate === file || candidate.endsWith(`/${file}`))) {
    throw new Error(`stale legacy client artifact entered the npm package: ${file}`)
  }
}
for (const file of packedFiles) {
  if (/^(src|test|tests|node_modules|设计思路\(不提交\)|\.dsh-deepcanary-test)(\/|\\)/i.test(file) || /设计指南|设计方案|制作建议/.test(file)) {
    throw new Error(`private or development file entered the npm package: ${file}`)
  }
}
console.log(`distribution ok: ${packageJson.name}@${packageJson.version}`)
