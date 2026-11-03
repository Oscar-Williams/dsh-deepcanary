import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { parseArgs } from 'node:util'
import path from 'node:path'
import { loadRuntime } from './runtime-checkout.mjs'
import { candidateInputs, sha256, fileTreeDigest, installedFileManifest } from './candidate-inputs.mjs'

const { values } = parseArgs({ options: { 'alpha-runtime': { type: 'string' }, 'rc5-runtime': { type: 'string' } } })
const root = process.cwd()
const runtimes = await Promise.all([loadRuntime(values['alpha-runtime'] ?? process.env.DSH_ALPHA_RUNTIME), loadRuntime(values['rc5-runtime'] ?? process.env.DSH_RC5_RUNTIME)])
if (runtimes[0].version !== '0.2.2-alpha.3' || runtimes[1].version !== '0.2.1-rc.5') throw new Error('Select the actual alpha.3 and RC5 installations for this candidate matrix.')
const inputHash = await candidateInputs(root)
const directory = path.join(root, 'output/verification')
await mkdir(directory, { recursive: true })
const reportFile = path.join(directory, 'candidate.json')
const prior = await readFile(reportFile, 'utf8').then(JSON.parse).catch(error => { if (error.code === 'ENOENT') return {}; throw error })
const report = { schemaVersion: 1, inputHash, node: process.versions.node, status: 'running', checks: {}, runtimes: runtimes.map(runtime => ({ root: runtime.root, version: runtime.version, commit: runtime.commit ?? null })) }
const run = promisify(execFile)
const sourceInputs = ['package.json', 'package-lock.json', 'tsconfig.json', 'src', 'scripts/build.mjs', 'scripts/build-client.mjs', 'scripts/runtime-checkout.mjs', 'scripts/verify-environment.mjs']
const save = () => writeFile(reportFile, JSON.stringify(report, null, 2) + '\n')
async function check(name, args, runtime) {
  const gateInputs = name === 'tests' || name === 'types:tests' ? inputHash
    : await candidateInputs(root, [...sourceInputs, ...args.filter(value => value.startsWith('scripts/')), ...(name === 'policy' ? ['benchmark/policy-replay.json'] : [])])
  const key = sha256(JSON.stringify({ inputHash: gateInputs, node: process.versions.node, args, runtime: runtime && { root: runtime.root, version: runtime.version, commit: runtime.commit } }))
  if (name !== 'build' && prior.checks?.[name]?.key === key && prior.checks[name].status === 'passed') {
    report.checks[name] = { ...prior.checks[name], reused: true }
    console.log(`Reuse ${name}`); await save(); return
  }
  console.log(`Run ${name}`)
  const started = Date.now()
  try {
    const result = await run(process.execPath, args, { cwd: root, windowsHide: true, maxBuffer: 16 * 1024 * 1024,
      env: { ...process.env, ...(runtime ? { DSH_RUNTIME: runtime.root } : {}) } })
    await writeFile(path.join(directory, name.replaceAll(':', '-') + '.log'), result.stdout + result.stderr)
    report.checks[name] = { key, status: 'passed', completedAt: new Date().toISOString(), milliseconds: Date.now() - started }
  } catch (error) {
    await writeFile(path.join(directory, name.replaceAll(':', '-') + '.log'), String(error.stdout ?? '') + String(error.stderr ?? ''))
    report.checks[name] = { key, status: 'failed', completedAt: new Date().toISOString(), exitCode: error.code ?? null }
    report.status = 'failed'; await save()
    throw new Error(`${name} failed; inspect its local verification log`)
  }
  await save()
}
await check('types:main', ['node_modules/typescript/bin/tsc', '-p', 'tsconfig.json', '--noEmit'])
await check('types:tests', ['node_modules/typescript/bin/tsc', '-p', 'tsconfig.test.json', '--noEmit'])
await check('tests', ['node_modules/vitest/vitest.mjs', 'run'])
// build.mjs validates both its source and output stamps before reusing emitted files.
await check('build', ['scripts/build.mjs'])
await check('policy', ['scripts/replay-attention-policy.mjs'])
for (const runtime of runtimes) {
  await check(`${runtime.version}:types`, ['scripts/build.mjs', '--host', '--typecheck'], runtime)
  for (const name of ['adapter', 'background', 'reminders', 'settings', 'connection']) await check(`${runtime.version}:${name}`, [`scripts/${name}-contract.mjs`], runtime)
}
report.buildStamp = JSON.parse(await readFile(path.join(root, 'output/build/stamp.json'), 'utf8'))
report.libTreeDigest = fileTreeDigest(await installedFileManifest(path.join(root, 'lib')))
report.status = 'passed'; report.completedAt = new Date().toISOString(); await save()
console.log(`Candidate checks passed: ${Object.keys(report.checks).length} checks; ${reportFile}`)
