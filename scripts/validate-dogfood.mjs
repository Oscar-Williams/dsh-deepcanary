import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('..', import.meta.url))
const args = new Map()
for (let index = 2; index < process.argv.length; index += 1) {
  const key = process.argv[index]
  const value = process.argv[index + 1]
  if (key?.startsWith('--') && value !== undefined && !value.startsWith('--')) {
    args.set(key.slice(2), value)
    index += 1
  }
}

const inputPath = path.resolve(root, args.get('input') ?? 'output/dogfood/dogfood.json')
const outputPath = path.resolve(root, args.get('out') ?? 'output/dogfood/dogfood-report.json')
const bundle = JSON.parse(await readFile(inputPath, 'utf8'))
const { isDogfoodBundle, summarizeDogfood } = await import('../lib/dogfood.js')
const { isDogfoodAggregate, summarizeDogfoodAggregate } = await import('../lib/dogfoodAggregate.js')
const report = isDogfoodBundle(bundle)
  ? summarizeDogfood(bundle)
  : isDogfoodAggregate(bundle)
    ? summarizeDogfoodAggregate(bundle)
    : undefined
if (report === undefined) throw new Error('dogfood input does not satisfy the sanitized bundle or aggregate contract')
await mkdir(path.dirname(outputPath), { recursive: true })
await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8')
console.log(`dogfood report written: ${path.relative(root, outputPath)}`)
console.log(JSON.stringify({ runId: report.run?.runId ?? null, aggregateId: report.aggregateId ?? null, observations: report.observationCount, receipts: report.receiptCount, reviewCoverage: report.metrics.reviewCoverage, usefulnessRate: report.metrics.usefulnessRate }, null, 2))
