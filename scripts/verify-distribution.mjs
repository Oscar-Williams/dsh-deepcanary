import { access, readFile } from 'node:fs/promises'
import { execFile } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'
import { verifyDocs } from './verify-docs.mjs'

const root = fileURLToPath(new URL('..', import.meta.url))
const execFileAsync = promisify(execFile)
const manifest = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'))
const required = [
  'lib/index.js', 'lib/index.d.ts', 'lib/client.js', 'lib/service.js',
  'cordis.patch.yml', 'LICENSE',
  'assets/deepcanary-panel-en.png', 'assets/deepcanary-panel-zh.png',
  ...manifest.files.filter(file => file.endsWith('.md')),
]
for (const file of required) await access(path.join(root, file))
const entry = await readFile(path.join(root, 'lib/index.js'), 'utf8')
if (!entry.includes('dsh-deepcanary')) throw new Error('Distribution omits the plugin entry')
const client = await readFile(path.join(root, 'lib/client.js'), 'utf8')
if (!client.includes('window.__ModuleLoader__.load') || !client.includes('factory:') || /\bexport\s*\{/.test(client)) {
  throw new Error('Client must register a lazy-CJS DSH module factory')
}
if (manifest.exports?.['./client'] !== './lib/client.js' || manifest.main !== './lib/index.js' || manifest.types !== './lib/index.d.ts') {
  throw new Error('Package entry points are inconsistent')
}
const service = await readFile(path.join(root, 'lib/service.js'), 'utf8')
if (!service.includes(`const PLUGIN_VERSION = '${manifest.version}'`)) throw new Error('Runtime version is stale; run npm run build')
const npmArgs = ['pack', '--dry-run', '--json', '--ignore-scripts']
const npmCli = process.platform === 'win32'
  ? process.env.npm_execpath ?? path.join(path.dirname(process.execPath), 'node_modules', 'npm', 'bin', 'npm-cli.js')
  : undefined
const { stdout } = await execFileAsync(npmCli ? process.execPath : 'npm', npmCli ? [npmCli, ...npmArgs] : npmArgs, { cwd: root, maxBuffer: 2_000_000 })
const packed = new Set(JSON.parse(stdout)[0]?.files?.map(file => file.path) ?? [])
for (const file of required) if (!packed.has(file)) throw new Error(`Required package file is absent: ${file}`)
await verifyDocs(packed)
for (const file of packed) {
  if (/^(?:benchmark|src|test|tests|node_modules|output|scripts|\.git|设计思路)(?:\/|\\)/i.test(file) || /设计指南|设计方案|制作建议|(?:^|\/)(?:AGENTS\.md|screenshots\.json)$/.test(file)) {
    throw new Error(`Private or development file entered the package: ${file}`)
  }
  if (['lib/client.d.ts', 'lib/client.d.ts.map', 'lib/client.js.map', 'lib/client/index.js'].includes(file)) throw new Error(`Stale client output entered the package: ${file}`)
}
console.log(`Distribution ok: ${manifest.name}@${manifest.version}; ${packed.size} files`)
