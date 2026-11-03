import { readFile } from 'node:fs/promises'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { guardPack } from './guard-pack.mjs'
import { candidateInputs } from './candidate-inputs.mjs'

export async function preparePack(root, { requireVerified = false } = {}) {
  await guardPack(root, process.env.npm_config_dry_run === 'true')
  const report = await readFile(path.join(root, 'output/verification/candidate.json'), 'utf8').then(JSON.parse)
    .catch(error => { if (error.code === 'ENOENT') return undefined; throw error })
  const stamp = await readFile(path.join(root, 'output/build/stamp.json'), 'utf8').then(JSON.parse)
    .catch(error => { if (error.code === 'ENOENT') return undefined; throw error })
  if (report?.status === 'passed' && report.inputHash === await candidateInputs(root) && report.buildStamp?.inputHash === stamp?.inputHash
    && report.buildStamp?.outputHash === stamp?.outputHash) return report
  if (requireVerified) throw new Error('Candidate checks are missing or stale; run verify:candidate before freezing')
  execFileSync(process.execPath, ['scripts/build.mjs'], { cwd: root, windowsHide: true, stdio: 'inherit' })
  execFileSync(process.execPath, ['scripts/verify-distribution.mjs'], { cwd: root, windowsHide: true, stdio: 'inherit' })
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await preparePack(process.cwd())
