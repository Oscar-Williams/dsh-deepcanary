import { access, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { execFile } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import os from 'node:os'
import { promisify } from 'node:util'

const root = fileURLToPath(new URL('..', import.meta.url))
const execFileAsync = promisify(execFile)
const args = new Map()
for (let index = 2; index < process.argv.length; index += 1) {
  const key = process.argv[index]
  const value = process.argv[index + 1]
  if (key?.startsWith('--') && value !== undefined && !value.startsWith('--')) {
    args.set(key.slice(2), value)
    index += 1
  }
}
const outputPath = path.resolve(root, args.get('out') ?? 'output/gates/stable-gates-report.json')
const replayPath = path.resolve(root, args.get('replay') ?? 'output/replay/policy-replay-report.json')
const dogfoodPath = args.get('dogfood') === undefined ? undefined : path.resolve(root, args.get('dogfood'))
const notificationEvidencePath = args.get('notification-evidence') === undefined ? undefined : path.resolve(root, args.get('notification-evidence'))
const auditPath = args.get('audit') === undefined ? undefined : path.resolve(root, args.get('audit'))
const supervisorSmokePath = path.resolve(root, 'output/gates/supervisor-smoke-report.json')
const supervisorSoakPath = path.resolve(root, 'output/gates/supervisor-soak-report.json')
const packageJson = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'))
const runtimeDependency = packageJson.devDependencies?.['@deepseek-ai/dsh-agent']
const runtimeBaseline = typeof runtimeDependency === 'string' ? `dsh-v${runtimeDependency}` : 'unknown'
const runtimeCommit = process.env.DSH_COMMIT ?? 'db6bdc3576c2d4e7c965e8e3ed0c2a731eed87f5'
const gateEvaluatorVersion = 'stable-gates.v2'

async function command(name, args) {
  try {
    const result = await execFileAsync(name, args, { cwd: root, maxBuffer: 2_000_000 })
    return result.stdout.trim()
  } catch {
    return ''
  }
}

async function digestFile(filePath) {
  try {
    return createHash('sha256').update(await readFile(filePath)).digest('hex')
  } catch {
    return null
  }
}

const gitCommit = await command('git', ['rev-parse', 'HEAD'])
const gitStatus = await command('git', ['status', '--porcelain'])
const sourceMaterial = [
  JSON.stringify(packageJson),
  await readFile(path.join(root, 'package-lock.json'), 'utf8').catch(() => ''),
  await readFile(path.join(root, 'lib/index.js'), 'utf8').catch(() => ''),
  await readFile(path.join(root, 'lib/client.js'), 'utf8').catch(() => ''),
].join('\n')
const sourceDigest = createHash('sha256').update(sourceMaterial).digest('hex')
const packDirectory = await mkdtemp(path.join(os.tmpdir(), 'deepcanary-stable-gate-'))
let tarballSha256 = ''
try {
  const npmCli = process.platform === 'win32'
    ? process.env.npm_execpath ?? path.join(path.dirname(process.execPath), 'node_modules', 'npm', 'bin', 'npm-cli.js')
    : undefined
  const npmCommand = npmCli === undefined ? 'npm' : process.execPath
  const npmArgs = ['pack', '--ignore-scripts', '--json', '--pack-destination', packDirectory]
  const commandArgs = npmCli === undefined ? npmArgs : [npmCli, ...npmArgs]
  const packed = JSON.parse((await execFileAsync(npmCommand, commandArgs, { cwd: root, maxBuffer: 2_000_000 })).stdout)
  const fileName = packed[0]?.filename
  if (typeof fileName === 'string') {
    const tarball = await readFile(path.join(packDirectory, fileName))
    tarballSha256 = createHash('sha256').update(tarball).digest('hex')
  }
} catch {
  tarballSha256 = ''
} finally {
  await rm(packDirectory, { recursive: true, force: true })
}

let replay
try {
  replay = JSON.parse(await readFile(replayPath, 'utf8'))
} catch {
  replay = undefined
}

let dogfood
let dogfoodInput
let dogfoodKind = 'none'
if (dogfoodPath !== undefined) {
  const input = JSON.parse(await readFile(dogfoodPath, 'utf8'))
  const { isDogfoodBundle, summarizeDogfood } = await import('../lib/dogfood.js')
  const { isDogfoodAggregate, summarizeDogfoodAggregate } = await import('../lib/dogfoodAggregate.js')
  if (input?.reportSchemaVersion === 1 && input.metrics && (input.run || input.aggregateId)) {
    dogfood = input
    dogfoodInput = input
    dogfoodKind = 'report'
  } else if (isDogfoodBundle(input)) {
    dogfood = summarizeDogfood(input)
    dogfoodInput = input
    dogfoodKind = 'bundle'
  } else if (isDogfoodAggregate(input)) {
    dogfood = summarizeDogfoodAggregate(input)
    dogfoodInput = input
    dogfoodKind = 'aggregate'
  }
  else throw new Error('stable gate dogfood input must be a sanitized bundle, aggregate, or report')
}

let notificationEvidence
if (notificationEvidencePath !== undefined) {
  try {
    const input = JSON.parse(await readFile(notificationEvidencePath, 'utf8'))
    const { evaluateNotificationEvidence, evaluateNotificationEvidenceBinding } = await import('../lib/notificationEvidence.js')
    const validation = evaluateNotificationEvidence(input)
    const bundles = dogfoodKind === 'aggregate'
      ? dogfoodInput.bundles
      : dogfoodKind === 'bundle'
        ? [dogfoodInput]
        : []
    const binding = evaluateNotificationEvidenceBinding(input, dogfoodKind === 'aggregate' || dogfoodKind === 'bundle' ? bundles : undefined)
    notificationEvidence = {
      status: validation.status === 'pass' && binding.status === 'pass' ? 'pass' : 'pending',
      reasons: [...validation.reasons, ...binding.reasons],
      binding,
      input: path.relative(root, notificationEvidencePath),
    }
  } catch (error) {
    notificationEvidence = { status: 'pending', reasons: [error instanceof Error ? error.message : 'invalid-notification-evidence'], input: path.relative(root, notificationEvidencePath) }
  }
} else {
  notificationEvidence = { status: 'pending', reasons: ['manual-windows-observation-required'], binding: { status: 'pending', reasons: ['manual-windows-observation-required'] } }
}

const requiredReplayCases = [
  'normal-completion',
  'c0-healthy-silence',
  'human-approval',
  'explicit-failure',
  'host-critical',
  'dedupe-repeat',
  'persistent-suppression',
  'bundle-escalation',
  'budget-downgrade',
  'quiet-hours',
  'recovery-closes-root',
  'recovery-continued-progress',
]
const replayPass = (replay?.status === 'baseline' || replay?.status === 'comparison')
  && replay.pluginVersion === packageJson.version
  && replay.fixtureVersion === 1
  && Array.isArray(replay.cases)
  && replay.caseCount >= requiredReplayCases.length
  && replay.expectedFailingCases === 0
  && replay.expectedPassingCases === replay.caseCount
  && requiredReplayCases.every(id => replay.cases.some(row => row?.id === id
    && (replay.status === 'comparison' ? row.candidateExpectedPass === true : row.baselineExpectedPass === true)))
const requiredTaskFamilies = ['coding', 'build-test', 'research', 'multi-stage', 'subagent']
const requiredScenarios = ['approval-boundary', 'network-recovery', 'healthy-long-run', 'normal-completion', 'explicit-failure', 'recovery-continued']
const dogfoodProvenance = dogfood?.provenance ?? dogfood?.run?.provenance
const dogfoodQuality = dogfood?.quality
const rawBundles = dogfoodKind === 'aggregate'
  ? dogfoodInput.bundles
  : dogfoodKind === 'bundle'
    ? [dogfoodInput]
    : []
const evidenceBundles = rawBundles.filter(bundle => bundle.observations.length > 0)
const observedTaskFamilies = rawBundles.length > 0
  ? [...new Set(evidenceBundles.map(bundle => bundle.run.taskFamily))].sort()
  : dogfoodQuality?.requiredTaskFamilies?.observed ?? (dogfood?.run?.taskFamily === undefined ? [] : [dogfood.run.taskFamily])
const missingTaskFamilies = rawBundles.length > 0
  ? requiredTaskFamilies.filter(value => !observedTaskFamilies.includes(value))
  : dogfoodQuality?.requiredTaskFamilies?.missing ?? requiredTaskFamilies.filter(value => !observedTaskFamilies.includes(value))
const scenarioEvidence = requiredScenarios.map(scenario => {
  const candidates = evidenceBundles.filter(bundle => bundle.run.scenario === scenario)
  const observations = candidates.flatMap(bundle => bundle.observations)
  const subtypes = new Set(observations.map(observation => observation.eventSubtype))
  const recoveryTimes = observations
    .filter(observation => observation.eventSubtype === 'recovered')
    .map(observation => Date.parse(observation.occurredAt))
    .filter(value => Number.isFinite(value))
  const continuedAfterRecovery = recoveryTimes.some(time => observations.some(observation => Date.parse(observation.occurredAt) > time))
  const hasEvidence = scenario === 'approval-boundary'
    ? observations.some(observation => observation.eventClass === 'human-needed' || subtypes.has('approval') || subtypes.has('question'))
    : scenario === 'network-recovery'
      ? subtypes.has('unreachable') && subtypes.has('recovered')
      : scenario === 'healthy-long-run'
        ? observations.some(observation => observation.decisionDisposition === 'c0-silent' || subtypes.has('healthy-heartbeat'))
        : scenario === 'normal-completion'
          ? subtypes.has('completed')
          : scenario === 'explicit-failure'
            ? subtypes.has('failed') || subtypes.has('aborted') || observations.some(observation => ['provider-error', 'sink-error', 'dropped-event'].includes(observation.decisionDisposition))
            : recoveryTimes.length > 0 && continuedAfterRecovery
  return { scenario, bundleCount: candidates.length, observationCount: observations.length, hasEvidence }
})
const observedScenarios = rawBundles.length > 0
  ? scenarioEvidence.filter(value => value.hasEvidence).map(value => value.scenario)
  : dogfoodQuality?.requiredScenarios?.observed ?? (dogfood?.run?.scenario === undefined ? [] : [dogfood.run.scenario])
const missingScenarios = rawBundles.length > 0
  ? requiredScenarios.filter(value => !observedScenarios.includes(value))
  : dogfoodQuality?.requiredScenarios?.missing ?? requiredScenarios.filter(value => !observedScenarios.includes(value))
const dogfoodMetricNames = ['humanNeededRecall', 'usefulnessRate', 'usefulInterruptPrecision', 'wrongLevelRate', 'falseStallRate', 'recoveryBeforeOpenRate', 'attentionCompressionRatio', 'droppedEventRate', 'reviewCoverage']
const metricsReady = dogfood?.metrics !== undefined && dogfoodMetricNames.every(name => dogfood.metrics[name]?.status === 'ok')
const negativeOpportunityCoverage = dogfood?.coverage === undefined
  ? { status: 'not-evaluated' }
  : {
      status: dogfood.coverage.c0Silent > 0 && dogfood.coverage.deduped > 0 && dogfood.coverage.suppressed > 0 ? 'pass' : 'insufficient-sample',
      c0Silent: dogfood.coverage.c0Silent,
      deduped: dogfood.coverage.deduped,
      suppressed: dogfood.coverage.suppressed,
    }
const realDogfood = dogfoodProvenance === 'real'
  ? {
      status: dogfoodKind === 'aggregate' && rawBundles.every(bundle => bundle.run.provenance === 'real' && bundle.run.pluginVersion === packageJson.version && bundle.run.runtimeTag === runtimeBaseline) && dogfood.observationCount >= 5 && metricsReady && missingTaskFamilies.length === 0 && missingScenarios.length === 0 && negativeOpportunityCoverage.status === 'pass' ? 'pass' : 'insufficient-sample',
      observationCount: dogfood.observationCount,
      bundleCount: dogfood.bundleCount ?? 1,
      trialCount: dogfood.trialCount ?? 1,
      metrics: dogfood.metrics,
      taskFamilies: { required: requiredTaskFamilies, observed: observedTaskFamilies, missing: missingTaskFamilies },
      scenarios: { required: requiredScenarios, observed: observedScenarios, missing: missingScenarios },
      scenarioEvidence,
      negativeOpportunityCoverage,
      inputKind: dogfoodKind,
    }
  : { status: dogfood === undefined ? 'not-evaluated' : 'invalid-provenance' }

const requiredFiles = ['lib/supervisor.js', 'lib/hostHealth.js', 'lib/adapters/dsh.js', 'lib/dogfood.js', 'lib/dogfoodAggregate.js', 'lib/notificationEvidence.js', 'benchmark/dogfood.schema.json', 'benchmark/dogfood-aggregate.schema.json', 'benchmark/notification-evidence.schema.json', 'benchmark/policy-replay.schema.json']
const fileChecks = await Promise.all(requiredFiles.map(async file => {
  try {
    await access(path.join(root, file))
    return { file, present: true }
  } catch {
    return { file, present: false }
  }
}))
const implementationPresent = fileChecks.every(check => check.present)
let supervisorSmoke
try {
  supervisorSmoke = JSON.parse(await readFile(supervisorSmokePath, 'utf8'))
} catch {
  supervisorSmoke = undefined
}
const supervisorSmokePass = supervisorSmoke?.passed === true
let supervisorSoak
try {
  const candidate = JSON.parse(await readFile(supervisorSoakPath, 'utf8'))
  const requiredSupplementalChecks = [
    'firstLeaseAcquired',
    'normalRestartContinuity',
    'crashTakeover',
    'oldOwnerFencing',
    'policyStateBounded',
    'deliveryLedgerBounded',
    'pendingBounded',
    'sessionsBounded',
    'stateWithinBudget',
    'privacyBoundary',
    'finalLeaseHeldBeforeShutdown',
    'shutdownLeaseReleased',
  ]
  const checksPass = requiredSupplementalChecks.every(name => candidate.checks?.[name] === true)
    && candidate.checks?.rawContentPersisted === false
  const identityMatch = candidate.identity?.sourceCommit === gitCommit
    && candidate.identity?.worktreeDirty === Boolean(gitStatus)
    && candidate.identity?.packageVersion === packageJson.version
    && candidate.identity?.packageSha256 === tarballSha256
    && candidate.identity?.dshTag === runtimeBaseline
    && candidate.identity?.dshCommit === runtimeCommit
  const shapePass = candidate.reportSchemaVersion === 1
    && candidate.pluginVersion === packageJson.version
    && candidate.runtimeBaseline === runtimeBaseline
    && candidate.policyVersion === (replay?.policyVersion ?? 'attention-policy.v1')
    && candidate.provenance === 'controlled-virtual'
    && candidate.stableGateUse === 'supplemental-only'
    && candidate.rawContentPersisted === false
    && candidate.virtualClock?.logicalSamples >= 480
    && candidate.virtualClock?.virtualDurationHours >= 8
    && candidate.restartCoverage?.normalRestarts === 3
    && candidate.restartCoverage?.staleLeaseTakeoverCount >= 1
    && candidate.resources?.maxStateBytes <= 2 * 1024 * 1024
  supervisorSoak = {
    status: shapePass && checksPass && identityMatch ? 'supplemental-pass' : 'pending',
    provenance: candidate.provenance,
    stableGateUse: candidate.stableGateUse,
    virtualDurationHours: candidate.virtualClock?.virtualDurationHours ?? null,
    checks: shapePass && checksPass ? 'pass' : 'pending',
    identity: identityMatch ? 'match' : 'stale-or-mismatched',
    reasons: [
      ...(shapePass ? [] : ['supplemental-soak-shape-or-bounds-incomplete']),
      ...(checksPass ? [] : ['supplemental-soak-check-failed']),
      ...(identityMatch ? [] : ['supplemental-soak-identity-does-not-match-fresh-gate-input']),
    ],
  }
} catch {
  supervisorSoak = { status: 'not-evaluated', provenance: 'unknown', stableGateUse: 'supplemental-only', virtualDurationHours: null, checks: 'not-evaluated', identity: 'not-evaluated', reasons: ['supplemental-supervisor-soak-report-unavailable'] }
}
const gateDReady = realDogfood.status === 'pass' && replayPass && notificationEvidence.status === 'pass' && notificationEvidence.binding?.status === 'pass'
const authoritativeSessionReconciliation = fileChecks.some(check => check.file === 'lib/adapters/dsh.js' && check.present)
  ? 'partial-adapter-surface'
  : 'pending-adapter-surface'
const gateEReady = implementationPresent && replayPass && supervisorSmokePass && authoritativeSessionReconciliation === 'pass'
const stableDecision = gateDReady && gateEReady ? 'STABLE_READY' : 'CONTINUE_RC'
const dogfoodBundleDigests = rawBundles.map(bundle => createHash('sha256').update(JSON.stringify(bundle)).digest('hex'))
const evidenceDigests = {
  dogfoodInput: dogfoodPath === undefined ? null : await digestFile(dogfoodPath),
  dogfoodBundleDigests,
  auditDigest: auditPath === undefined ? null : await digestFile(auditPath),
  notificationEvidenceDigests: notificationEvidencePath === undefined ? [] : [await digestFile(notificationEvidencePath)],
  supervisorSmokeDigest: await digestFile(supervisorSmokePath),
  supervisorSoakDigest: await digestFile(supervisorSoakPath),
  attentionGoldDigest: await digestFile(path.join(root, 'benchmark', 'attention-gold-v3.json')),
  replayReportDigest: await digestFile(replayPath),
}
const metricSample = name => {
  const metric = dogfood?.metrics?.[name]
  return metric === undefined
    ? { numerator: null, denominator: null, status: 'not-evaluated' }
    : { numerator: metric.numerator ?? null, denominator: metric.denominator ?? null, status: metric.status ?? 'unknown' }
}
const report = {
  reportSchemaVersion: 1,
  pluginVersion: packageJson.version,
  runtimeBaseline,
  runtime: { tag: runtimeBaseline, commit: runtimeCommit },
  policyVersion: replay?.policyVersion ?? 'attention-policy.v1',
  gateEvaluatorVersion,
  provenance: {
    dogfood: dogfoodProvenance ?? 'not-evaluated',
    inputKind: dogfoodKind,
    bundles: [...new Set(rawBundles.map(bundle => bundle.run.provenance))],
  },
  evidenceDigests,
  samples: {
    humanNeededRecall: metricSample('humanNeededRecall'),
    userFacingReviewCoverage: metricSample('reviewCoverage'),
    usefulness: metricSample('usefulnessRate'),
    wrongLevel: metricSample('wrongLevelRate'),
    falseStall: metricSample('falseStallRate'),
    recoveryBeforeOpen: metricSample('recoveryBeforeOpenRate'),
  },
  decision: stableDecision,
  identity: {
    gitCommit: gitCommit || 'unknown',
    sourceCommit: gitCommit || 'unknown',
    worktree: gitStatus ? 'dirty' : 'clean',
    worktreeDirty: Boolean(gitStatus),
    packageVersion: packageJson.version,
    dshTag: runtimeBaseline,
    dshCommit: runtimeCommit,
    packageSha256: tarballSha256 || null,
    tarballSha256: tarballSha256 || null,
    sourceDigest,
  },
  gateD: {
    status: gateDReady ? 'pass' : 'pending',
    policyReplay: replayPass ? 'pass' : 'pending',
    realDogfood,
    osNativeNotification: notificationEvidence,
    note: 'Only a validated developer-observed Edge/Windows record can satisfy Toast appearance, notification-center retention, and click-to-focus evidence; a legacy --native-toast-observed flag is not accepted as proof.',
  },
  gateE: {
    status: implementationPresent && replayPass && supervisorSmokePass ? 'prototype-ready' : 'pending',
    implementation: implementationPresent ? 'present' : 'incomplete',
    policyReplay: replayPass ? 'pass' : 'pending',
    supervisorSmoke: supervisorSmokePass ? 'pass' : supervisorSmoke === undefined ? 'not-evaluated' : 'pending',
    supervisorSoak,
    authoritativeSessionReconciliation,
    crossSinkDeliveryLedger: 'logical-browser-ledger-present-os-observation-pending',
    packageVersion: packageJson.version,
    note: 'Prototype readiness records the local lease/snapshot path, authoritative adapter slice, bounded orphan grace, and bounded logical browser delivery ledger. The Supervisor is experimental and off by default; Windows OS observation and full restart convergence remain separate Stable gates before any future default enablement.',
  },
  files: fileChecks,
  generatedAt: new Date().toISOString(),
  conclusion: gateDReady && gateEReady
    ? 'Fresh Gate D and Gate E evidence meets the configured Stable criteria; review any explicitly documented non-core exceptions before publication.'
    : 'The fresh report records the remaining real, Windows, or Supervisor evidence required for Stable promotion without converting missing observations into a pass.',
}

await mkdir(path.dirname(outputPath), { recursive: true })
await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8')
console.log(`stable gates report written: ${path.relative(root, outputPath)}`)
console.log(JSON.stringify({ decision: report.decision, gateD: report.gateD.status, gateE: report.gateE.status, policyReplay: report.gateD.policyReplay, realDogfood: report.gateD.realDogfood.status, windowsOsVisibleBrowserNotification: report.gateD.osNativeNotification }, null, 2))
