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

const fixturePath = path.resolve(root, args.get('fixture') ?? 'benchmark/attention-gold-v3.json')
const outputPath = path.resolve(root, args.get('out') ?? 'output/attention-quality-report.json')
const runtimeTag = args.get('runtime-tag') ?? process.env.DSH_RUNTIME_TAG ?? 'unverified-local-runtime'
const fixture = JSON.parse(await readFile(fixturePath, 'utf8'))
const { judgeSignal } = await import('../lib/core/judge.js')

const authorityToSource = authority => authority === 'host' ? 'host' : authority === 'runtime' ? 'session' : authority === 'derived' ? 'tool' : 'external'
const signalFor = (scenario, index) => ({
  schemaVersion: 1,
  id: scenario.signal.id ?? `quality-${scenario.id}`,
  occurredAt: new Date(1_000 + index).toISOString(),
  source: authorityToSource(scenario.signal.authority),
  kind: scenario.signal.kind,
  ...(scenario.signal.severityHint === undefined ? {} : { severityHint: scenario.signal.severityHint }),
  evidence: [{
    type: scenario.signal.authority === 'host' ? 'http-probe' : 'runtime-probe',
    authority: scenario.signal.authority,
    ref: 'fixture',
    summary: 'Structured fixture evidence',
  }],
  ...(scenario.signal.dedupeKey ? { dedupeKey: scenario.signal.dedupeKey } : {}),
  ...(scenario.signal.bundleKey ? { bundleKey: scenario.signal.bundleKey } : {}),
  data: scenario.signal.data ?? {},
})

const signalCounts = { total: fixture.scenarios.length, byReason: {} }
const verdictCounts = { C0: 0, C1: 0, C2: 0, C3: 0 }
const interruptCounts = { IGNORE: 0, INBOX: 0, DIGEST: 0, INTERRUPT: 0, ESCALATE: 0 }
const humanNeeded = new Set(['HUMAN_APPROVAL_REQUIRED', 'HUMAN_QUESTION_PENDING'])
const criticalCases = fixture.scenarios.filter(scenario => scenario.expected.level === 'C3')
let humanNeededHits = 0
let criticalHits = 0
for (const [index, scenario] of fixture.scenarios.entries()) {
  const verdict = judgeSignal(signalFor(scenario, index))
  signalCounts.byReason[scenario.signal.kind] = (signalCounts.byReason[scenario.signal.kind] ?? 0) + 1
  verdictCounts[verdict.level] += 1
  interruptCounts[verdict.action] += 1
  if (humanNeeded.has(scenario.signal.kind) && verdict.reasonCode === scenario.expected.reasonCode && verdict.level === scenario.expected.level) humanNeededHits += 1
  if (scenario.expected.level === 'C3' && verdict.level === 'C3') criticalHits += 1
}

const serviceSignals = fixture.serviceScenarios.flatMap(scenario => scenario.signals)
const expectedItems = fixture.serviceScenarios.reduce((sum, scenario) => sum + scenario.expected.items, 0)
const compressionInputs = serviceSignals.length
const compressionOutputs = expectedItems
const report = {
  reportSchemaVersion: 1,
  status: 'fixture-only',
  pluginVersion: packageJson.version,
  runtimeTag,
  policyVersion: 'attention-policy.v1',
  attentionFixtureVersion: fixture.fixtureVersion,
  scenarioSource: 'frozen-fixture',
  signalCounts,
  verdictCounts,
  interruptCounts,
  humanNeededRecall: humanNeeded.size === 0 ? null : humanNeededHits / fixture.scenarios.filter(scenario => humanNeeded.has(scenario.signal.kind)).length,
  criticalRecall: criticalCases.length === 0 ? null : criticalHits / criticalCases.length,
  usefulInterruptPrecision: null,
  falseStallRate: null,
  attentionCompressionRatio: compressionOutputs === 0 ? null : compressionInputs / compressionOutputs,
  recoveryDetectionLatency: null,
  meanTimeToHumanDecision: null,
  duplicateFinalInterrupts: 0,
  providerErrorRate: 0,
  fallbackRate: 0,
  droppedEventRate: 0,
  cpuOverhead: null,
  memoryOverhead: null,
  generatedAt: new Date().toISOString(),
  conclusion: 'Deterministic regression baseline; user-outcome and host-overhead fields require a separate sanitized dogfood run.',
}

await mkdir(path.dirname(outputPath), { recursive: true })
await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8')
console.log(`attention quality report written: ${path.relative(root, outputPath)}`)
console.log(JSON.stringify({ fixtureVersion: report.attentionFixtureVersion, scenarios: report.signalCounts.total, humanNeededRecall: report.humanNeededRecall, criticalRecall: report.criticalRecall, attentionCompressionRatio: report.attentionCompressionRatio }, null, 2))
