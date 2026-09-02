import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('..', import.meta.url))
const inputPaths = []
let outputPath = path.resolve(root, 'output/dogfood/dogfood-aggregate.json')
for (let index = 2; index < process.argv.length; index += 1) {
  const key = process.argv[index]
  const value = process.argv[index + 1]
  if (key === '--input' && value !== undefined && !value.startsWith('--')) {
    inputPaths.push(path.resolve(root, value))
    index += 1
  } else if (key === '--out' && value !== undefined && !value.startsWith('--')) {
    outputPath = path.resolve(root, value)
    index += 1
  }
}
if (inputPaths.length === 0) throw new Error('at least one --input bundle is required')

const { isDogfoodBundle } = await import('../lib/dogfood.js')
const { createDogfoodAggregate } = await import('../lib/dogfoodAggregate.js')
const bundles = []
for (const inputPath of inputPaths) {
  const input = JSON.parse(await readFile(inputPath, 'utf8'))
  if (!isDogfoodBundle(input)) throw new Error(`input is not a validated dogfood bundle: ${path.relative(root, inputPath)}`)
  bundles.push(input)
}
const aggregate = createDogfoodAggregate(`aggregate-${Date.now()}`, bundles)
await mkdir(path.dirname(outputPath), { recursive: true })
await writeFile(outputPath, `${JSON.stringify(aggregate, null, 2)}\n`, 'utf8')
console.log(`dogfood aggregate written: ${path.relative(root, outputPath)}`)
console.log(JSON.stringify({ bundles: aggregate.bundles.length, runs: aggregate.bundles.map(bundle => bundle.run.runId), provenance: aggregate.bundles.map(bundle => bundle.run.provenance) }, null, 2))
