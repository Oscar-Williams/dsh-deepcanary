import { readFile, readdir } from 'node:fs/promises'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

export const alpha13 = { version: '0.1.3-alpha.1', tag: 'dsh-v0.1.3-alpha.1', commit: 'd347e703908d0406b7a7ef80e3a0e594d86b2215' }
const run = promisify(execFile)

export async function loadRuntimeCheckout(root) {
  if (!root) throw new Error('Set DSH_ALPHA13_RUNTIME to the built official 0.1.3-alpha.1 checkout.')
  root = path.resolve(root)
  const manifest = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'))
  const commit = (await run('git', ['rev-parse', 'HEAD'], { cwd: root, windowsHide: true })).stdout.trim()
  const dirty = (await run('git', ['status', '--porcelain', '--untracked-files=all'], { cwd: root, windowsHide: true })).stdout.trim()
  if (manifest.version !== alpha13.version || commit !== alpha13.commit || dirty) {
    throw new Error('The runtime must be the clean, pinned official 0.1.3-alpha.1 checkout; active runtimes are never upgraded by this check.')
  }
  const packages = new Map()
  const dirs = async base => (await readdir(base, { withFileTypes: true })).filter(entry => entry.isDirectory()).map(entry => path.join(base, entry.name))
  const candidates = [...await dirs(path.join(root, 'vendor'))]
  for (const group of await dirs(path.join(root, 'packages'))) candidates.push(...await dirs(group))
  for (const directory of candidates) {
    const json = await readFile(path.join(directory, 'package.json'), 'utf8').catch(() => undefined)
    if (json === undefined) continue
    const pkg = JSON.parse(json)
    if (typeof pkg.name === 'string') packages.set(pkg.name, { directory, manifest: pkg })
  }
  const importPackage = async name => {
    const pkg = packages.get(name)
    if (!pkg || typeof pkg.manifest.main !== 'string') throw new Error(`No built public entry for ${name}`)
    return import(pathToFileURL(path.join(pkg.directory, pkg.manifest.main)).href)
  }
  return { root, version: manifest.version, commit, packages, importPackage }
}

export function runtimeTypePaths(runtime) {
  const paths = {}
  const typesOf = value => {
    if (!value || typeof value !== 'object') return undefined
    if (typeof value.types === 'string') return value.types
    for (const child of Object.values(value)) {
      const found = typesOf(child)
      if (found) return found
    }
  }
  for (const [name, pkg] of runtime.packages) {
    if (typeof pkg.manifest.types === 'string') paths[name] = [path.resolve(pkg.directory, pkg.manifest.types)]
    for (const [key, entry] of Object.entries(pkg.manifest.exports ?? {})) {
      if (key !== '.' && !key.startsWith('./')) continue
      const types = typesOf(entry)
      if (types) paths[name + (key === '.' ? '' : key.slice(1))] = [path.resolve(pkg.directory, types)]
    }
  }
  return paths
}
