import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('..', import.meta.url))
const packageJson = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'))
const args = new Map()
for (let index = 2; index < process.argv.length; index += 1) {
  const key = process.argv[index]
  const value = process.argv[index + 1]
  if (key?.startsWith('--') && value !== undefined && !value.startsWith('--')) {
    args.set(key.slice(2), value)
    index += 1
  }
}

const inputPath = path.resolve(root, args.get('input') ?? 'output/dogfood/outcomes.json')
const outputPath = path.resolve(root, args.get('out') ?? 'output/dogfood/outcome-report.json')
const requestedSource = args.get('source')
if (requestedSource !== undefined && !['real', 'controlled', 'replay'].includes(requestedSource)) {
  throw new Error('--source must be real, controlled, or replay')
}

const raw = JSON.parse(await readFile(inputPath, 'utf8'))
if (raw?.schemaVersion !== 1 || !Array.isArray(raw.receipts)) throw new Error('outcome input must be an OutcomeStore file with schemaVersion 1')
const { isOutcomeReceipt } = await import('../lib/outcome.js')
const invalid = raw.receipts.findIndex(receipt => !isOutcomeReceipt(receipt))
if (invalid >= 0) throw new Error(`outcome input contains an invalid receipt at index ${invalid}`)

const allReceipts = raw.receipts
const sources = [...new Set(allReceipts.map(receipt => receipt.source))]
if (requestedSource === undefined && sources.length > 1) {
  throw new Error('outcome input contains multiple sources; pass --source to keep aggregates separate')
}
const receipts = requestedSource === undefined ? allReceipts : allReceipts.filter(receipt => receipt.source === requestedSource)
const source = requestedSource ?? sources[0] ?? 'none'

const countBy = (values, key) => values.reduce((counts, value) => {
  const name = key(value)
  counts[name] = (counts[name] ?? 0) + 1
  return counts
}, {})

const countBoolean = key => receipts.filter(receipt => receipt[key]).length
const feedbackCounts = countBy(receipts, receipt => receipt.feedback)
const laterOutcomeCounts = countBy(receipts, receipt => receipt.laterOutcome)
const latencyBuckets = countBy(receipts, receipt => receipt.latencyBucket)
const reviewFlags = countBy(receipts.flatMap(receipt => receipt.reviewFlags), flag => flag)
const report = {
  reportSchemaVersion: 1,
  status: source === 'real' ? 'dogfood' : source === 'controlled' ? 'controlled' : source === 'replay' ? 'replay' : 'empty',
  source,
  pluginVersion: packageJson.version,
  policyVersions: [...new Set(receipts.map(receipt => receipt.policyVersion))].sort(),
  trialCount: new Set(receipts.map(receipt => receipt.trialId)).size,
  receiptCount: receipts.length,
  opened: countBoolean('opened'),
  acknowledged: countBoolean('acknowledged'),
  snoozed: countBoolean('snoozed'),
  muted: countBoolean('muted'),
  recoveredBeforeOpen: countBoolean('recoveredBeforeOpen'),
  feedbackCounts,
  laterOutcomeCounts,
  latencyBuckets,
  reviewFlags,
  byEventClass: countBy(receipts, receipt => receipt.eventClass),
  byReasonCode: countBy(receipts, receipt => receipt.reasonCode),
  byLevel: countBy(receipts, receipt => receipt.level),
  byAction: countBy(receipts, receipt => receipt.action),
  fieldCompleteness: {
    feedback: receipts.length === 0 ? null : receipts.filter(receipt => receipt.feedback !== 'unrated').length / receipts.length,
    laterOutcome: receipts.length === 0 ? null : receipts.filter(receipt => receipt.laterOutcome !== 'unknown').length / receipts.length,
    latency: receipts.length === 0 ? null : receipts.filter(receipt => receipt.latencyBucket !== 'unknown').length / receipts.length,
  },
  generatedAt: new Date().toISOString(),
  conclusion: receipts.length === 0
    ? 'No receipts matched the selected source.'
    : 'Outcome aggregate contains redacted metadata only; interpret value together with scenario coverage and reviewed missed or false-positive cases.',
}

await mkdir(path.dirname(outputPath), { recursive: true })
await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8')
console.log(`outcome report written: ${path.relative(root, outputPath)}`)
console.log(JSON.stringify({ source: report.source, receiptCount: report.receiptCount, feedbackCounts: report.feedbackCounts, reviewFlags: report.reviewFlags }, null, 2))
