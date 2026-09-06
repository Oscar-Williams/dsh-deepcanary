import { execFile } from 'node:child_process'
import { createHash } from 'node:crypto'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { promisify } from 'node:util'
import { fileURLToPath } from 'node:url'
import { afterEach, describe, expect, it } from 'vitest'

const run = promisify(execFile)
const script = fileURLToPath(new URL('../scripts/verify-publication-receipt.mjs', import.meta.url))
const directories: string[] = []
afterEach(async () => {
  for (const directory of directories.splice(0)) await rm(directory, { recursive: true, force: true })
})

async function fixture() {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'deepcanary-receipt-'))
  directories.push(directory)
  const bytes = Buffer.from('controlled artifact identity fixture')
  const sha256 = createHash('sha256').update(bytes).digest('hex')
  const sha1 = createHash('sha1').update(bytes).digest('hex')
  const integrity = `sha512-${createHash('sha512').update(bytes).digest('base64')}`
  const fileName = 'dsh-deepcanary-0.1.1-rc.5.tgz'
  const repository = 'https://github.com/Oscar-Williams/dsh-deepcanary'
  const receipt = {
    schemaVersion: 1, receiptType: 'publication', status: 'PUBLISHED',
    plugin: 'dsh-deepcanary', pluginVersion: '0.1.1-rc.5', sourceCommit: 'a'.repeat(40),
    artifact: { fileName, bytes: bytes.length, sha256, sha1, integrity },
    github: { tag: 'v0.1.1-rc.5', tagCommit: 'a'.repeat(40), releaseUrl: `${repository}/releases/tag/v0.1.1-rc.5`, assetUrl: `${repository}/releases/download/v0.1.1-rc.5/${fileName}`, assetDigest: `sha256:${sha256}` },
    npm: { registry: 'https://registry.npmjs.org/', version: '0.1.1-rc.5', distTagAtPublication: 'next', tarball: `https://registry.npmjs.org/dsh-deepcanary/-/${fileName}`, shasum: sha1, integrity, publishedAt: '2026-09-06T00:00:00.000Z' },
  }
  const artifactPath = path.join(directory, fileName)
  const receiptPath = path.join(directory, 'receipt.json')
  await writeFile(artifactPath, bytes)
  return { receipt, artifactPath, receiptPath }
}

describe('publication artifact identity', () => {
  it('accepts matching local, GitHub, and npm identities', async () => {
    const data = await fixture()
    await writeFile(data.receiptPath, JSON.stringify(data.receipt))
    const result = await run(process.execPath, [script, data.receiptPath, data.artifactPath])
    expect(result.stdout).toContain('publication receipt ok')
  })

  it.each(['bytes', 'tag', 'npm', 'status'] as const)('rejects a mismatched %s record', async field => {
    const data = await fixture()
    if (field === 'bytes') await writeFile(data.artifactPath, 'different bytes')
    if (field === 'tag') data.receipt.github.tagCommit = 'b'.repeat(40)
    if (field === 'npm') data.receipt.npm.integrity = 'sha512-wrong'
    if (field === 'status') data.receipt.status = 'PREPARING'
    await writeFile(data.receiptPath, JSON.stringify(data.receipt))
    await expect(run(process.execPath, [script, data.receiptPath, data.artifactPath])).rejects.toThrow()
  })
})
