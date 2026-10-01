import { execFileSync } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import { tarEntries } from './release-artifact.mjs'

// Print locations and categories only. Never print matched credential values.
const [mode, target] = process.argv.slice(2)
const git = args => execFileSync('git', args, { windowsHide: true, maxBuffer: 64_000_000 })
const denied = /(?:^|\/)(?:设计思路\(不提交\)|output|\.env(?:\..*)?|\.npmrc|\.playwright-cli)(?:\/|$)|(?:workspace-inventory|archive-legacy-candidate)\.mjs$/
const patterns = [
  ['private-key', /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/],
  ['credential-token', /\b(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{30,}|npm_[A-Za-z0-9]{30,}|AKIA[A-Z0-9]{16}|sk-[A-Za-z0-9_-]{24,})\b/],
  ['authenticated-url', /[?&](?:token|access_token|api_key)=[A-Za-z0-9_%.-]{16,}/i],
  ['machine-path', /(?:[FC]:[\\/](?:Agent_Related|Users[\\/]Oscar|Anaconda-3-2024))/i],
]
let inspected = 0
const findings = []
function inspect(label, entries) {
  for (const [file, bytes] of entries) {
    inspected++
    if (denied.test(file)) findings.push({ snapshot: label, file, category: 'private-file' })
    if (!/\.(?:[cm]?js|tsx?|json|ya?ml|md|map)$/.test(file)) continue
    const content = bytes.toString('utf8')
    for (const [category, pattern] of patterns) {
      const match = pattern.exec(content)
      if (match) findings.push({ snapshot: label, file, line: content.slice(0, match.index).split('\n').length, category })
    }
  }
}
function snapshot(ref) {
  const files = git(['ls-tree', '-r', '--name-only', '-z', ref]).toString().split('\0').filter(Boolean)
  return files.map(file => [file, git(['show', `${ref}:${file}`])])
}
if (mode === 'staged') {
  const files = git(['diff', '--cached', '--name-only', '--diff-filter=ACMR', '-z']).toString().split('\0').filter(Boolean)
  inspect('index', files.map(file => [file, git(['show', `:${file}`])]))
} else if (mode === 'commits' && target) {
  for (const commit of git(['rev-list', target]).toString().trim().split('\n').filter(Boolean)) inspect(commit, snapshot(commit))
} else if (mode === 'package' && target) {
  inspect('tgz', tarEntries(await readFile(target)))
} else throw new Error('Usage: scan-publication.mjs staged | commits <base..head> | package <tgz>')
console.log(JSON.stringify({ passed: findings.length === 0, inspected, findings }, null, 2))
if (findings.length) process.exitCode = 1
