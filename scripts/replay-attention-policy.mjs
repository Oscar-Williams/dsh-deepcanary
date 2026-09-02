import { mkdtemp, readFile, rm } from 'node:fs/promises'
import os from 'node:os'
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

const inputPath = path.resolve(root, args.get('input') ?? 'benchmark/policy-replay.json')
const outputPath = path.resolve(root, args.get('out') ?? 'output/replay/policy-replay-report.json')
const candidatePath = args.get('candidate') === undefined ? undefined : path.resolve(root, args.get('candidate'))
const fixture = JSON.parse(await readFile(inputPath, 'utf8'))
if (fixture?.schemaVersion !== 1 || !Array.isArray(fixture.cases) || typeof fixture.fixtureVersion !== 'number') {
  throw new Error('replay input must be a policy replay fixture with schemaVersion 1')
}

const { DeepCanaryService } = await import('../lib/service.js')

function safeId(value, fallback) {
  return typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(value) ? value : fallback
}

function decision(item) {
  if (item === undefined) return null
  return {
    level: item.level,
    action: item.action,
    reasonCode: item.reasonCode,
    status: item.status,
    bundleCount: item.bundleCount,
  }
}

function safeData(value) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return {}
  const result = {}
  for (const [key, candidate] of Object.entries(value).slice(0, 32)) {
    if (!/^[A-Za-z][A-Za-z0-9_.:-]{0,63}$/.test(key)) continue
    if (typeof candidate === 'boolean' || (typeof candidate === 'number' && Number.isFinite(candidate))) result[key] = candidate
    else if (typeof candidate === 'string' && candidate.length <= 256) result[key] = candidate
  }
  return result
}

function equivalent(actual, expected) {
  if (expected === null) return actual === null
  if (actual === null || typeof actual !== 'object' || typeof expected !== 'object') return actual === expected
  return Object.entries(expected).every(([key, value]) => actual[key] === value)
}

function validateCase(candidate, index) {
  if (candidate === null || typeof candidate !== 'object' || !Array.isArray(candidate.signals)) throw new Error(`replay case ${index} is invalid`)
  const id = safeId(candidate.id, `case-${index + 1}`)
  if (candidate.suppressAfterIndex !== undefined
    && (!Number.isSafeInteger(candidate.suppressAfterIndex)
      || candidate.suppressAfterIndex < 0
      || candidate.suppressAfterIndex >= candidate.signals.length)) {
    throw new Error(`replay case ${id} suppressAfterIndex must identify an existing signal`)
  }
  for (const [signalIndex, signal] of candidate.signals.entries()) {
    if (signal === null || typeof signal !== 'object' || typeof signal.kind !== 'string' || typeof signal.source !== 'string') throw new Error(`replay case ${id} signal ${signalIndex} is invalid`)
    if (!Number.isSafeInteger(signal.offsetMs ?? 0)) throw new Error(`replay case ${id} signal ${signalIndex} offsetMs must be an integer`)
  }
  return { ...candidate, id }
}

function signalFor(raw, caseId, index, baseNow) {
  const authority = raw.authority ?? (raw.source === 'host' ? 'host' : 'runtime')
  const evidenceType = authority === 'host' ? 'http-probe' : raw.source === 'tool' ? 'tool-history' : 'session-event'
  const signal = {
    schemaVersion: 1,
    id: safeId(raw.id, `${caseId}-${index + 1}`),
    occurredAt: new Date(baseNow + (raw.offsetMs ?? index)).toISOString(),
    source: raw.source,
    kind: raw.kind,
    ...(raw.sessionId === undefined ? {} : { sessionId: safeId(raw.sessionId, `${caseId}-session`) }),
    ...(raw.workspaceId === undefined ? {} : { workspaceId: safeId(raw.workspaceId, `${caseId}-workspace`) }),
    ...(raw.severityHint === undefined ? {} : { severityHint: raw.severityHint }),
    evidence: [{ type: evidenceType, authority, ref: 'replay-evidence', summary: 'Sanitized structured replay evidence' }],
    ...(raw.dedupeKey === undefined ? {} : { dedupeKey: raw.dedupeKey }),
    ...(raw.bundleKey === undefined ? {} : { bundleKey: raw.bundleKey }),
    data: safeData(raw.data),
  }
  return signal
}

async function runCase(rawCase, configPatch, baseNow) {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'deepcanary-policy-replay-'))
  const originalNow = Date.now
  let currentNow = baseNow
  Date.now = () => currentNow
  const service = new DeepCanaryService({ logger: {} }, {
    stateDir: directory,
    ...configPatch,
  })
  try {
    await service.ready
    const steps = []
    for (const [index, rawSignal] of rawCase.signals.entries()) {
      currentNow = baseNow + (rawSignal.offsetMs ?? index)
      const item = await service.ingest(signalFor(rawSignal, rawCase.id, index, baseNow))
      steps.push(decision(item))
      if (rawCase.suppressAfterIndex === index && item !== undefined) service.suppress(item.id)
    }
    const finalInbox = service.snapshot().inbox.map(item => ({
      level: item.level,
      action: item.action,
      reasonCode: item.reasonCode,
      status: item.status,
      bundleCount: item.bundleCount,
    }))
    return {
      steps,
      finalInbox,
      finalInboxCount: finalInbox.length,
      interruptBudget: service.status().delivery.interruptBudget,
    }
  } finally {
    await service.dispose()
    Date.now = originalNow
    await rm(directory, { recursive: true, force: true })
  }
}

function expectedPass(actual, expected) {
  if (expected === undefined) return true
  if (!Array.isArray(expected.steps) || actual.steps.length !== expected.steps.length) return false
  if (!actual.steps.every((step, index) => equivalent(step, expected.steps[index]))) return false
  return expected.finalInboxCount === undefined || actual.finalInboxCount === expected.finalInboxCount
}

const cases = fixture.cases.map(validateCase)
const baseNow = Date.now()
const baselineConfig = fixture.defaults ?? {}
const candidateConfig = candidatePath === undefined ? undefined : JSON.parse(await readFile(candidatePath, 'utf8'))
if (candidateConfig !== undefined && (candidateConfig === null || typeof candidateConfig !== 'object' || Array.isArray(candidateConfig) || Object.hasOwn(candidateConfig, 'stateDir'))) {
  throw new Error('replay candidate must be a settings patch and cannot select a state directory')
}
const rows = []
for (const rawCase of cases) {
    const baseline = await runCase(rawCase, { ...baselineConfig, ...(rawCase.settings ?? {}) }, baseNow)
  const baselineExpectedPass = expectedPass(baseline, rawCase.expected)
  const row = {
    id: rawCase.id,
    expected: rawCase.expected ?? null,
    baseline,
    baselineExpectedPass,
  }
  if (candidateConfig !== undefined) {
    const candidate = await runCase(rawCase, { ...baselineConfig, ...(rawCase.settings ?? {}), ...candidateConfig }, baseNow)
    rows.push({ ...row, candidate, candidateExpectedPass: expectedPass(candidate, rawCase.expected), changed: JSON.stringify(baseline) !== JSON.stringify(candidate) })
  } else {
    rows.push(row)
  }
}

const candidatePasses = candidateConfig === undefined ? rows.filter(row => row.baselineExpectedPass).length : rows.filter(row => row.candidateExpectedPass).length
const report = {
  reportSchemaVersion: 1,
  status: candidateConfig === undefined ? 'baseline' : 'comparison',
  pluginVersion: packageJson.version,
  policyVersion: 'attention-policy.v1',
  fixtureVersion: fixture.fixtureVersion,
  input: path.relative(root, inputPath),
  candidate: candidatePath === undefined ? null : path.relative(root, candidatePath),
  clock: 'deterministic-date-now',
  caseCount: rows.length,
  expectedPassingCases: candidatePasses,
  expectedFailingCases: rows.length - candidatePasses,
  changedCases: rows.filter(row => row.changed === true).map(row => row.id),
  cases: rows,
  generatedAt: new Date().toISOString(),
  conclusion: candidateConfig === undefined
    ? 'Baseline replay executes judge, delivery policy, dedupe, bundling, quiet-hours, budget, and recovery for the supplied sanitized cases.'
    : 'Comparison replay reports case-level changes against the same sanitized inputs; promotion still requires real dogfood review and guardrail approval.',
}

await (await import('node:fs/promises')).mkdir(path.dirname(outputPath), { recursive: true })
await (await import('node:fs/promises')).writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8')
console.log(`policy replay report written: ${path.relative(root, outputPath)}`)
console.log(JSON.stringify({ status: report.status, cases: report.caseCount, passing: report.expectedPassingCases, failing: report.expectedFailingCases, changed: report.changedCases.length }, null, 2))
if (report.expectedFailingCases > 0) process.exitCode = 1
