import { createHash } from 'node:crypto'
import { readFile, readdir } from 'node:fs/promises'
import path from 'node:path'
import { gunzipSync } from 'node:zlib'
import { fileURLToPath } from 'node:url'
import { verifyPublicationReceipt } from './verify-publication-receipt.mjs'

export async function findReleaseReceipt(root, expected) {
  const directory = path.join(root, 'benchmark')
  const files = await readdir(directory).catch(error => {
    if (error.code === 'ENOENT') return []
    throw error
  })
  const matches = []
  for (const file of files.filter(file => file.endsWith('-receipt.json'))) {
    const receipt = JSON.parse(await readFile(path.join(directory, file), 'utf8'))
    if (receipt.plugin === expected.name && receipt.pluginVersion === expected.version) matches.push(receipt)
  }
  if (matches.length > 1) throw new Error(`Multiple release receipts for ${expected.version}; resolve the ambiguity first.`)
  return matches[0]
}

export function isPublished(receipt) {
  return receipt?.status === 'PUBLISHED' || receipt?.publication?.status === 'PUBLISHED'
    || Number.isFinite(Date.parse(receipt?.publication?.npm?.publishedAt ?? ''))
    || (receipt?.status === 'PASS' && typeof receipt.publication?.github?.release === 'string')
}

export function tarEntries(bytes) {
  const archive = gunzipSync(bytes)
  const entries = new Map()
  const text = (header, start, end) => header.subarray(start, end).toString('utf8').replace(/\0.*$/u, '')
  for (let offset = 0; offset + 512 <= archive.length;) {
    const header = archive.subarray(offset, offset + 512)
    if (header.every(byte => byte === 0)) break
    const size = Number.parseInt(text(header, 124, 136).trim() || '0', 8)
    if (!Number.isSafeInteger(size) || size < 0 || offset + 512 + size > archive.length) throw new Error('Invalid package tar entry size')
    const prefix = text(header, 345, 500)
    const name = `${prefix ? `${prefix}/` : ''}${text(header, 0, 100)}`
    const type = header[156]
    if (type === 0 || type === 48) {
      if (!name.startsWith('package/') || name.includes('\\') || name.split('/').includes('..')) throw new Error('Invalid package tar path')
      const relative = name.slice('package/'.length)
      if (entries.has(relative)) throw new Error(`Duplicate package entry: ${relative}`)
      entries.set(relative, archive.subarray(offset + 512, offset + 512 + size))
    }
    offset += 512 + Math.ceil(size / 512) * 512
  }
  return entries
}

// Read a frozen artifact. Verification must never create replacement package bytes.
export async function resolveReleaseArtifact(root, expected, explicitPath) {
  const file = path.resolve(root, explicitPath ?? `output/releases/${expected.version}/${expected.name}-${expected.version}.tgz`)
  const bytes = await readFile(file).catch(error => {
    if (error.code === 'ENOENT') throw new Error(`Frozen artifact missing: ${file}. Supply the exact tgz explicitly or restore it from the published release; this check does not repack.`)
    throw error
  })
  const entries = tarEntries(bytes)
  const manifest = JSON.parse(entries.get('package.json')?.toString('utf8') ?? 'null')
  if (manifest?.name !== expected.name || manifest?.version !== expected.version) throw new Error('Frozen artifact package name/version mismatch')
  const sha256 = createHash('sha256').update(bytes).digest('hex')
  const receipt = await findReleaseReceipt(root, expected)
  if (receipt?.receiptType === 'publication') verifyPublicationReceipt(receipt, bytes, expected)
  else if (receipt && (receipt.artifactSha256 ?? receipt.artifact?.sha256) !== sha256) throw new Error('Frozen artifact does not match the recorded receipt digest')
  return { file, bytes, entries, sha256, sourceCommit: receipt?.sourceCommit ?? receipt?.pluginCommit ?? null }
}

export async function verifyBuiltEntries(root, artifact) {
  const entries = [...artifact.entries].filter(([name]) => name.startsWith('lib/'))
  if (entries.length === 0) throw new Error('Frozen artifact has no built entries')
  for (const [name, bytes] of entries) {
    const local = await readFile(path.join(root, name))
    if (!bytes.equals(local)) throw new Error(`Working-tree ${name} differs from the frozen artifact; use a matching source checkout or a new candidate version.`)
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = process.cwd()
  const expected = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'))
  const artifact = await resolveReleaseArtifact(root, expected, process.argv[2])
  console.log(JSON.stringify({ version: expected.version, file: path.relative(root, artifact.file), sha256: artifact.sha256, sourceCommit: artifact.sourceCommit }))
}
