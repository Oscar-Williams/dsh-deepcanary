import { readFile } from 'node:fs/promises'
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
const inputPath = path.resolve(root, args.get('input') ?? 'output/notifications/notification-evidence.json')
const input = JSON.parse(await readFile(inputPath, 'utf8'))
const { evaluateNotificationEvidence, evaluateNotificationEvidenceBinding, isNotificationEvidence } = await import('../lib/notificationEvidence.js')
if (!isNotificationEvidence(input)) throw new Error('notification evidence does not satisfy the privacy-safe manual observation contract')
const result = evaluateNotificationEvidence(input)
const dogfoodPath = args.get('dogfood') === undefined ? undefined : path.resolve(root, args.get('dogfood'))
let binding
if (dogfoodPath !== undefined) {
  const dogfood = JSON.parse(await readFile(dogfoodPath, 'utf8'))
  const { isDogfoodBundle } = await import('../lib/dogfood.js')
  const { isDogfoodAggregate } = await import('../lib/dogfoodAggregate.js')
  const bundles = isDogfoodAggregate(dogfood) ? dogfood.bundles : isDogfoodBundle(dogfood) ? [dogfood] : undefined
  binding = evaluateNotificationEvidenceBinding(input, bundles)
  if (bundles === undefined) binding = { status: 'pending', reasons: ['notification-dogfood-input-invalid'] }
} else {
  binding = evaluateNotificationEvidenceBinding(input, undefined)
}
const status = result.status === 'pass' && binding.status === 'pass' ? 'pass' : 'pending'
console.log(JSON.stringify({ input: path.relative(root, inputPath), status, reasons: [...result.reasons, ...binding.reasons], binding }, null, 2))
if (status !== 'pass') process.exitCode = 1
