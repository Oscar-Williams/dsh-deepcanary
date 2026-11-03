import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { tarEntries } from './release-artifact.mjs'
import { sha256, fileTreeDigest } from './candidate-inputs.mjs'

const patterns = [
  ['private-key', /-----BEGIN (?:RSA |OPENSSH |EC |DSA )?PRIVATE KEY-----/],
  ['github-token', /(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{50,})/],
  ['api-key', /sk-(?:proj-)?[A-Za-z0-9_-]{28,}/],
  ['authenticated-link', /https?:\/\/[^\s<>"']+[?&](?:token|auth|api_key)=[A-Za-z0-9_-]{20,}/i],
]
export function contentScanner() {
  const scanned = new Set()
  const secrets = Object.entries(process.env).filter(([key, value]) => /(?:TOKEN|SECRET|PASSWORD|API_KEY)/i.test(key) && value && value.length >= 12).map(([, value]) => value)
  return {
    scan(name, bytes) {
      const digest = sha256(bytes)
      if (scanned.has(digest)) return digest
      scanned.add(digest)
      if (bytes.includes(0)) return digest
      const text = bytes.toString('utf8')
      for (const [kind, pattern] of patterns) if (pattern.test(text)) throw new Error(`Public content scan: ${kind} in ${name}; matching value withheld`)
      if (secrets.some(value => text.includes(value))) throw new Error(`Public content scan: environment credential in ${name}; matching value withheld`)
      return digest
    },
    count: () => scanned.size,
  }
}
export function auditPackage(bytes, expected, scanner) {
  const entries = tarEntries(bytes)
  const pkg = JSON.parse(entries.get('package.json')?.toString('utf8') ?? 'null')
  if (pkg?.name !== expected.name || pkg.version !== expected.version) throw new Error('Candidate package identity differs from source')
  if (pkg.engines?.dsh !== '0.2.1-rc.5 || >=0.2.2-alpha.3') throw new Error('Candidate host admission differs from the supported contract')
  const required = ['package.json', 'lib/index.js', 'lib/index.d.ts', 'lib/client.js', 'lib/service.js', 'cordis.patch.yml', 'README.md', 'README.zh-CN.md', 'LICENSE']
  for (const name of required) if (!entries.has(name)) throw new Error(`Candidate omits ${name}`)
  const files = []
  for (const [name, content] of entries) {
    if (!['package.json', ...pkg.files].some(allowed => name === allowed || name.startsWith(allowed + '/'))) throw new Error(`Candidate file outside whitelist: ${name}`)
    if (/^(?:src|test|tests|node_modules|output|scripts|\.git|设计思路)/i.test(name) || /(?:\.credentials|\.env(?:\.|$)|workspace-policy|\bprivate\b|设计指南|(?:^|\/)AGENTS\.md)/i.test(name)) throw new Error(`Private or development file entered candidate: ${name}`)
    if (/^benchmark\/.*-receipt\.json$/.test(name)) throw new Error(`Historical receipt entered candidate: ${name}`)
    files.push({ path: name, bytes: content.length, sha256: scanner.scan('npm:' + name, content) })
  }
  const client = entries.get('lib/client.js').toString('utf8')
  if (!client.includes('window.__ModuleLoader__.load') || !client.includes('factory:')) throw new Error('Candidate client is not a DSH module factory')
  const service = entries.get('lib/service.js').toString('utf8')
  if (!service.includes(`const PLUGIN_VERSION = '${pkg.version}'`)) throw new Error('Candidate contains a stale runtime build')
  return { files, treeDigest: fileTreeDigest(files), libTreeDigest: fileTreeDigest(files.filter(file => file.path.startsWith('lib/')).map(file => ({ ...file, path: file.path.slice(4) }))),
    integrity: 'sha512-' + createHash('sha512').update(bytes).digest('base64') }
}
export function auditGitRange(root, scanner) {
  let base
  try { base = execFileSync('git', ['rev-parse', '--verify', 'origin/main'], { cwd: root, encoding: 'utf8', windowsHide: true }).trim() }
  catch { base = undefined }
  const commits = execFileSync('git', ['rev-list', '--reverse', base ? `${base}..HEAD` : 'HEAD'], { cwd: root, encoding: 'utf8', windowsHide: true }).trim().split('\n').filter(Boolean)
  const blobs = new Set()
  for (const commit of commits) {
    const records = execFileSync('git', ['diff-tree', '--root', '-m', '--no-commit-id', '-r', '-z', '--raw', '--diff-filter=ACMT', commit], { cwd: root, encoding: 'utf8', windowsHide: true }).split('\0')
    for (let index = 0; index + 1 < records.length; index += 2) {
      const fields = records[index].split(' ')
      const blob = fields[3]
      if (!blob || /^0+$/.test(blob) || blobs.has(blob)) continue
      blobs.add(blob)
      const file = records[index + 1]
      const bytes = execFileSync('git', ['cat-file', 'blob', blob], { cwd: root, windowsHide: true, maxBuffer: 32 * 1024 * 1024 })
      scanner.scan(`git:${file}`, bytes)
    }
  }
  return { base: base ?? null, commits: commits.length, blobs: blobs.size }
}
