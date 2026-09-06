import { createHash } from 'node:crypto'
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'
import { loadRuntimeCheckout, runtimeTypePaths } from './runtime-checkout.mjs'

const root = fileURLToPath(new URL('..', import.meta.url))
const run = promisify(execFile)
const runtimeMode = process.argv.includes('--alpha13')
const checkOnly = process.argv.includes('--typecheck')
const runtime = runtimeMode ? await loadRuntimeCheckout(process.env.DSH_ALPHA13_RUNTIME) : undefined
const packageJson = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'))
const config = ts.readConfigFile(path.join(root, 'tsconfig.json'), ts.sys.readFile)
if (config.error) throw new Error(ts.flattenDiagnosticMessageText(config.error.messageText, '\n'))
const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, root)
if (runtime) parsed.options.paths = { ...parsed.options.paths, ...runtimeTypePaths(runtime) }

async function digestTree(directory) {
  const hash = createHash('sha256')
  const walk = async current => {
    const entries = await readdir(current, { withFileTypes: true })
    entries.sort((a, b) => a.name.localeCompare(b.name, 'en'))
    for (const entry of entries) {
      const file = path.join(current, entry.name)
      if (entry.isDirectory()) await walk(file)
      else if (entry.isFile()) hash.update(path.relative(directory, file).replaceAll('\\', '/')).update('\0').update(await readFile(file))
    }
  }
  await walk(directory)
  return hash.digest('hex')
}

const input = createHash('sha256').update(await digestTree(path.join(root, 'src')))
for (const file of ['tsconfig.json', 'package-lock.json', 'scripts/build.mjs', 'scripts/build-client.mjs', 'scripts/runtime-checkout.mjs']) input.update(await readFile(path.join(root, file)))
input.update(JSON.stringify({ version: packageJson.version, dependencies: packageJson.dependencies, devDependencies: packageJson.devDependencies, runtime: runtime?.commit ?? 'npm-type-floor' }))
const inputHash = input.digest('hex')
const stampPath = path.join(root, 'output/build/stamp.json')
const stamp = await readFile(stampPath, 'utf8').then(JSON.parse).catch(() => undefined)
const outputHash = await digestTree(path.join(root, 'lib')).catch(() => undefined)
if (!checkOnly && !process.argv.includes('--force') && stamp?.inputHash === inputHash && stamp?.outputHash === outputHash) {
  console.log(`Build is current (${runtime?.version ?? 'npm compatibility type floor'}); no recompilation.`)
} else {
  const program = ts.createProgram(parsed.fileNames, { ...parsed.options, ...(checkOnly ? { noEmit: true } : {}) })
  const diagnostics = [...parsed.errors, ...ts.getPreEmitDiagnostics(program)]
  if (diagnostics.length) {
    console.error(ts.formatDiagnosticsWithColorAndContext(diagnostics, { getCanonicalFileName: file => file, getCurrentDirectory: () => root, getNewLine: () => '\n' }))
    process.exitCode = 1
  } else if (checkOnly) {
    console.log(`Types checked against actual DSH ${runtime?.version ?? 'npm dependencies'}.`)
  } else {
    const emitted = program.emit()
    if (emitted.emitSkipped) throw new Error('TypeScript skipped the build.')
    const result = await run(process.execPath, [path.join(root, 'scripts/build-client.mjs')], { cwd: root, windowsHide: true })
    console.log(result.stdout.trim())
    await mkdir(path.dirname(stampPath), { recursive: true })
    await writeFile(stampPath, `${JSON.stringify({ inputHash, outputHash: await digestTree(path.join(root, 'lib')), runtime: runtime?.version ?? 'npm-type-floor' }, null, 2)}\n`)
  }
}
