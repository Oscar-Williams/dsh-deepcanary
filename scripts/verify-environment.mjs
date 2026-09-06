import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export async function verifyEnvironment(root, nodeVersion = process.versions.node) {
  const [major, minor] = nodeVersion.split('.').map(Number)
  if (!((major === 22 && minor >= 19) || major >= 24)) throw new Error('Use Node 22.19+ in the 22.x line, or Node 24+ for the DSH development workflow.')
  const json = async file => JSON.parse(await readFile(path.join(root, file), 'utf8'))
  const manifest = await json('package.json')
  const lock = await json('package-lock.json')
  if (lock.name !== manifest.name || lock.version !== manifest.version || lock.packages?.['']?.version !== manifest.version) throw new Error('Package and both lockfile version fields must match.')
  const rows = []
  for (const section of ['dependencies', 'devDependencies']) {
    const declared = manifest[section] ?? {}
    const locked = lock.packages[''][section] ?? {}
    if (Object.keys(declared).length !== Object.keys(locked).length) throw new Error(`${section} differ between manifest and lockfile; review and regenerate the lockfile.`)
    for (const [name, requested] of Object.entries(declared)) {
      if (locked[name] !== requested) throw new Error(`${name} spec differs between manifest and lockfile.`)
      const version = lock.packages[`node_modules/${name}`]?.version
      const installed = await json(`node_modules/${name}/package.json`).catch(() => undefined)
      if (!version || installed?.version !== version) throw new Error(`Installed ${name} ${installed?.version ?? '(missing)'} differs from lockfile ${version}; run npm ci.`)
      if (name.startsWith('@deepseek-ai/dsh-') && (requested !== '0.1.2-alpha.5' || version !== requested)) throw new Error(`${name} must remain pinned to the alpha.5 npm build lane.`)
      rows.push({ name, requested, locked: version, installed: installed.version })
    }
  }
  return { passed: true, node: nodeVersion, pluginVersion: manifest.version, runtimeLane: 'npm-0.1.2-alpha.5', dependencies: rows }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  console.log(JSON.stringify(await verifyEnvironment(process.cwd()), null, 2))
}
