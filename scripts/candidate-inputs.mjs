import { createHash } from 'node:crypto'
import { readFile, readdir } from 'node:fs/promises'
import { execFileSync } from 'node:child_process'
import path from 'node:path'

export const sha256 = bytes => createHash('sha256').update(bytes).digest('hex')
export async function candidateInputs(root, paths = ['package.json', 'package-lock.json', 'tsconfig*.json', 'vitest.config.*', 'src', 'scripts', 'test', 'benchmark']) {
  const files = execFileSync('git', ['ls-files', '-z', '--', ...paths],
    { cwd: root, encoding: 'utf8', windowsHide: true }).split('\0').filter(file => file && !file.startsWith('lib/')).sort()
  const digest = createHash('sha256')
  for (const file of files) {
    const bytes = await readFile(path.join(root, file))
    digest.update(file).update('\0').update(String(bytes.length)).update('\0').update(bytes)
  }
  return digest.digest('hex')
}
export function fileTreeDigest(entries) {
  const hash = createHash('sha256')
  for (const row of [...entries].sort((a, b) => a.path.localeCompare(b.path, 'en'))) hash.update(row.path).update('\0').update(row.sha256).update('\0').update(String(row.bytes)).update('\n')
  return hash.digest('hex')
}
export async function installedFileManifest(root) {
  const files = []
  const walk = async (directory, prefix = '') => {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      // Package-manager metadata and dependency links are not package-owned files.
      if (!prefix && (entry.name === 'node_modules' || entry.name === '.pnpm')) continue
      const relative = prefix + entry.name
      if (entry.isDirectory()) await walk(path.join(directory, entry.name), relative + '/')
      else if (entry.isFile()) {
        const bytes = await readFile(path.join(directory, entry.name))
        files.push({ path: relative, bytes: bytes.length, sha256: sha256(bytes) })
      } else throw new Error(`Unexpected installed package link: ${relative}`)
    }
  }
  await walk(root)
  return files
}
