import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

// This contract proves publication identity, not Stable readiness or device coverage.
export function verifyPublicationReceipt(receipt, bytes, expected) {
  const require = (condition, message) => { if (!condition) throw new Error(message) }
  require(receipt.schemaVersion === 1 && receipt.receiptType === 'publication' && receipt.status === 'PUBLISHED', 'receipt must record a published artifact')
  require(receipt.plugin === expected.name && receipt.pluginVersion === expected.version, 'publication version does not match the expected package')
  require(/^[a-f0-9]{40}$/.test(receipt.sourceCommit ?? ''), 'source commit is missing or malformed')
  const fileName = `${expected.name}-${expected.version}.tgz`
  const sha256 = createHash('sha256').update(bytes).digest('hex')
  const sha1 = createHash('sha1').update(bytes).digest('hex')
  const integrity = `sha512-${createHash('sha512').update(bytes).digest('base64')}`
  require(bytes.length > 0 && receipt.artifact?.fileName === fileName && receipt.artifact?.bytes === bytes.length, 'artifact file or size mismatch')
  require(receipt.artifact.sha256 === sha256 && receipt.artifact.sha1 === sha1 && receipt.artifact.integrity === integrity, 'artifact digest mismatch')
  const tag = `v${expected.version}`
  const repository = 'https://github.com/Oscar-Williams/dsh-deepcanary'
  require(receipt.github?.tag === tag && receipt.github?.tagCommit === receipt.sourceCommit, 'GitHub tag commit mismatch')
  require(receipt.github.releaseUrl === `${repository}/releases/tag/${tag}`, 'GitHub release URL mismatch')
  require(receipt.github.assetUrl === `${repository}/releases/download/${tag}/${fileName}`, 'GitHub asset URL mismatch')
  require(receipt.github.assetDigest === `sha256:${sha256}`, 'GitHub asset digest mismatch')
  require(receipt.npm?.registry === 'https://registry.npmjs.org/' && receipt.npm.version === expected.version, 'npm registry or version mismatch')
  require(receipt.npm.distTagAtPublication === 'next', 'prerelease publication must use next')
  require(receipt.npm.tarball === `https://registry.npmjs.org/${expected.name}/-/${fileName}`, 'npm tarball URL mismatch')
  require(receipt.npm.shasum === sha1 && receipt.npm.integrity === integrity, 'npm integrity mismatch')
  require(Number.isFinite(Date.parse(receipt.npm.publishedAt ?? '')), 'npm publication timestamp is missing')
  return sha256
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [receiptPath, artifactPath] = process.argv.slice(2)
  if (!receiptPath || !artifactPath) throw new Error('Usage: node scripts/verify-publication-receipt.mjs <receipt.json> <artifact.tgz>')
  const receipt = JSON.parse(await readFile(receiptPath, 'utf8'))
  const digest = verifyPublicationReceipt(receipt, await readFile(artifactPath), { name: receipt.plugin, version: receipt.pluginVersion })
  console.log(`publication receipt ok: ${receipt.plugin}@${receipt.pluginVersion} (${digest})`)
}
