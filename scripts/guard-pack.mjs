import { readFile, access } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { findReleaseReceipt, isPublished } from './release-artifact.mjs'

export async function guardPack(root, dryRun = false) {
  if (dryRun) return
  const manifest = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'))
  const receipt = await findReleaseReceipt(root, manifest)
  if (isPublished(receipt)) throw new Error(`${manifest.version} is already published. Do not repack it. Use its frozen tgz or bump to a new candidate version; pack:check remains available.`)
  const frozen = path.join(root, 'output/releases', manifest.version, `${manifest.name}-${manifest.version}.tgz`)
  const exists = await access(frozen).then(() => true, error => {
    if (error.code === 'ENOENT') return false
    throw error
  })
  if (exists) throw new Error(`A frozen ${manifest.version} artifact already exists. Preserve it; use a new candidate version for changed bytes.`)
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await guardPack(process.cwd(), process.env.npm_config_dry_run === 'true')
}
