import { afterEach, describe, expect, it } from 'vitest'
import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { gzipSync } from 'node:zlib'
import os from 'node:os'
import path from 'node:path'

const run = promisify(execFile)
const directories: string[] = []
const scripts = new URL('../scripts/', import.meta.url)
const manifest = { name: 'dsh-deepcanary', version: '0.1.1-rc.5', devDependencies: { typescript: '^5.6.0' } }
const frozenPath = 'output/releases/0.1.1-rc.5/dsh-deepcanary-0.1.1-rc.5.tgz'
afterEach(async () => {
  for (const directory of directories.splice(0)) await rm(directory, { recursive: true, force: true })
})

async function put(root: string, name: string, value: string | Buffer) {
  await mkdir(path.dirname(path.join(root, name)), { recursive: true })
  await writeFile(path.join(root, name), value)
}

function tar(version = manifest.version) {
  const files = { 'package/package.json': JSON.stringify({ ...manifest, version }), 'package/lib/index.js': 'export const version = 1' }
  const blocks: Buffer[] = []
  for (const [name, value] of Object.entries(files)) {
    const bytes = Buffer.from(value)
    const header = Buffer.alloc(512)
    header.write(name)
    header.write(bytes.length.toString(8).padStart(11, '0'), 124)
    header[156] = 48
    blocks.push(header, bytes, Buffer.alloc((512 - bytes.length % 512) % 512))
  }
  return gzipSync(Buffer.concat([...blocks, Buffer.alloc(1024)]))
}

async function fixture() {
  const root = await mkdtemp(path.join(os.tmpdir(), 'deepcanary-tooling-'))
  directories.push(root)
  await put(root, 'package.json', JSON.stringify(manifest))
  await put(root, 'package-lock.json', JSON.stringify({ name: manifest.name, version: manifest.version, packages: { '': manifest, 'node_modules/typescript': { version: '5.9.3' } } }))
  await put(root, 'node_modules/typescript/package.json', JSON.stringify({ version: '5.9.3' }))
  return root
}

function invoke(root: string, script: string, code: string) {
  return run(process.execPath, ['--input-type=module', '-e', `import * as subject from ${JSON.stringify(new URL(script, scripts).href)}; ${code}`], { cwd: root, windowsHide: true, env: { ...process.env, DSH_ALPHA13_RUNTIME: '', DSH_ALPHA13_PROFILE: '', DSH_ALPHA13_WEB_PORT: '', DSH_U7_SOAK_STATE_DIR: '' } })
}

const resolve = (root: string, explicit?: string) => invoke(root, 'release-artifact.mjs', `console.log((await subject.resolveReleaseArtifact(process.cwd(), ${JSON.stringify(manifest)}, ${JSON.stringify(explicit)})).sha256)`)

describe('frozen artifact selection', () => {
  it('resolves only the canonical artifact and validates its manifest', async () => {
    const root = await fixture()
    const bytes = tar()
    await put(root, frozenPath, bytes)
    expect((await resolve(root)).stdout.trim()).toBe(createHash('sha256').update(bytes).digest('hex'))
  })

  it('does not use a legacy same-name tarball or silently repack when canonical bytes are missing', async () => {
    const root = await fixture()
    await put(root, 'output/local-pack/dsh-deepcanary-0.1.1-rc.5.tgz', tar())
    await expect(resolve(root)).rejects.toThrow('this check does not repack')
    expect(await readdir(path.join(root, 'output'))).toEqual(['local-pack'])
  })

  it('allows an explicit artifact location', async () => {
    const root = await fixture()
    await put(root, 'candidate.tgz', tar())
    expect((await resolve(root, 'candidate.tgz')).stdout).toMatch(/[a-f0-9]{64}/)
  })

  it('rejects a misleading same-name tarball with another internal version', async () => {
    const root = await fixture()
    await put(root, frozenPath, tar('0.1.1-rc.4'))
    await expect(resolve(root)).rejects.toThrow('name/version mismatch')
  })

  it('rejects same-version bytes that differ from the receipt', async () => {
    const root = await fixture()
    await put(root, frozenPath, tar())
    await put(root, 'benchmark/test-receipt.json', JSON.stringify({ plugin: manifest.name, pluginVersion: manifest.version, artifactSha256: 'a'.repeat(64) }))
    await expect(resolve(root)).rejects.toThrow('receipt digest')
  })

  it('refuses to label a changed working-tree build with an old artifact hash', async () => {
    const root = await fixture()
    await put(root, frozenPath, tar())
    await put(root, 'lib/index.js', 'different local code')
    await expect(invoke(root, 'release-artifact.mjs', `const artifact = await subject.resolveReleaseArtifact(process.cwd(), ${JSON.stringify(manifest)}); await subject.verifyBuiltEntries(process.cwd(), artifact)`)).rejects.toThrow('differs from the frozen artifact')
  })
})

describe('pack safety', () => {
  it('blocks repacking published versions but allows a dry-run', async () => {
    const root = await fixture()
    await put(root, 'benchmark/test-receipt.json', JSON.stringify({ plugin: manifest.name, pluginVersion: manifest.version, status: 'PUBLISHED' }))
    await expect(invoke(root, 'guard-pack.mjs', 'await subject.guardPack(process.cwd())')).rejects.toThrow('already published')
    await invoke(root, 'guard-pack.mjs', 'await subject.guardPack(process.cwd(), true)')
  })

  it('blocks reuse of a frozen candidate even before publication', async () => {
    const root = await fixture()
    await put(root, frozenPath, tar())
    await expect(invoke(root, 'guard-pack.mjs', 'await subject.guardPack(process.cwd())')).rejects.toThrow('already exists')
  })

  it('allows packing an unfrozen, unpublished candidate', async () => {
    await invoke(await fixture(), 'guard-pack.mjs', 'await subject.guardPack(process.cwd())')
  })

  it('recognizes a legacy candidate receipt with a completed npm publication', async () => {
    const root = await fixture()
    await put(root, 'benchmark/test-receipt.json', JSON.stringify({ plugin: manifest.name, pluginVersion: manifest.version, status: 'CANDIDATE', publication: { npm: { publishedAt: '2026-09-02T13:48:23.848Z' } } }))
    await expect(invoke(root, 'guard-pack.mjs', 'await subject.guardPack(process.cwd())')).rejects.toThrow('already published')
  })
})

describe('locked dependency environment', () => {
  it('distinguishes a declared range from the resolved installed version', async () => {
    const result = await invoke(await fixture(), 'verify-environment.mjs', 'console.log(JSON.stringify(await subject.verifyEnvironment(process.cwd(), "24.19.0")))')
    expect(JSON.parse(result.stdout).dependencies[0]).toEqual({ name: 'typescript', requested: '^5.6.0', locked: '5.9.3', installed: '5.9.3' })
  })

  it('rejects a stale compiler installation', async () => {
    const root = await fixture()
    await put(root, 'node_modules/typescript/package.json', JSON.stringify({ version: '5.6.2' }))
    await expect(invoke(root, 'verify-environment.mjs', 'await subject.verifyEnvironment(process.cwd())')).rejects.toThrow('run npm ci')
  })

  it('rejects a stale root lockfile version', async () => {
    const root = await fixture()
    const lock = JSON.parse(await readFile(path.join(root, 'package-lock.json'), 'utf8'))
    lock.packages[''].version = '0.1.1-rc.4'
    await put(root, 'package-lock.json', JSON.stringify(lock))
    await expect(invoke(root, 'verify-environment.mjs', 'await subject.verifyEnvironment(process.cwd())')).rejects.toThrow('version fields must match')
  })

  it('rejects an out-of-lane DSH dependency', async () => {
    const root = await fixture()
    const changed = { ...manifest, devDependencies: { '@deepseek-ai/dsh-session': '0.1.3-alpha.1' } }
    await put(root, 'package.json', JSON.stringify(changed))
    await put(root, 'package-lock.json', JSON.stringify({ name: changed.name, version: changed.version, packages: { '': changed, 'node_modules/@deepseek-ai/dsh-session': { version: '0.1.3-alpha.1' } } }))
    await put(root, 'node_modules/@deepseek-ai/dsh-session/package.json', JSON.stringify({ version: '0.1.3-alpha.1' }))
    await expect(invoke(root, 'verify-environment.mjs', 'await subject.verifyEnvironment(process.cwd())')).rejects.toThrow('alpha.5 npm build lane')
  })

  it.each(['22.18.0', '23.1.0'])('rejects unsupported DSH development Node %s', async version => {
    await expect(invoke(await fixture(), 'verify-environment.mjs', `await subject.verifyEnvironment(process.cwd(), ${JSON.stringify(version)})`)).rejects.toThrow('Use Node')
  })
})

describe('explicit isolated runtime inputs', () => {
  it('does not probe a historical alpha13 profile by default', async () => {
    await expect(invoke(await fixture(), 'alpha13-compat-canary.mjs', '')).rejects.toThrow('Set DSH_ALPHA13_RUNTIME explicitly')
  })

  it('does not start a real-time soak in historical state by default', async () => {
    await expect(invoke(await fixture(), 'supervisor-real-soak.mjs', '')).rejects.toThrow('Set DSH_U7_SOAK_STATE_DIR')
  })
})
