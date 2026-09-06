import { access, mkdir, readFile, writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { execFile } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'
import { resolveReleaseArtifact, verifyBuiltEntries } from './release-artifact.mjs'

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
const packageTgzPath = args.get('package-tgz') === undefined ? undefined : path.resolve(root, args.get('package-tgz'))
const dogfoodPath = args.get('dogfood') === undefined ? undefined : path.resolve(root, args.get('dogfood'))
const notificationEvidencePath = args.get('notification-evidence') === undefined ? undefined : path.resolve(root, args.get('notification-evidence'))
const auditPath = args.get('audit') === undefined ? undefined : path.resolve(root, args.get('audit'))
const supplementalPaths = {
  u4Candidate: args.get('u4-candidate') === undefined ? undefined : path.resolve(root, args.get('u4-candidate')),
  attentionGold: args.get('attentiongold') ?? args.get('attention-gold'),
  u5Status: args.get('u5-status'),
  alpha13: args.get('alpha13'),
  u7Process: args.get('u7-process'),
  u7RealSoak: args.get('u7-real-soak'),
  wslExisting: args.get('wsl-existing'),
  qualification: args.get('qualification'),
}
for (const [key, value] of Object.entries(supplementalPaths)) {
  if (value !== undefined && key !== 'u4Candidate') supplementalPaths[key] = path.resolve(root, value)
}
const supervisorSmokePath = path.resolve(root, 'output/gates/supervisor-smoke-report.json')
const supervisorSoakPath = path.resolve(root, 'output/gates/supervisor-soak-report.json')
const packageJson = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'))
const { decideStableDecision } = await import('../lib/stableDecision.js')
const runtimeDependency = packageJson.devDependencies?.['@deepseek-ai/dsh-agent']
const runtimeBaseline = typeof runtimeDependency === 'string' ? `dsh-v${runtimeDependency}` : 'unknown'
const runtimeCommit = process.env.DSH_COMMIT ?? 'db6bdc3576c2d4e7c965e8e3ed0c2a731eed87f5'
const gateEvaluatorVersion = 'stable-gates.v3'

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

async function readJsonOptional(filePath) {
  if (filePath === undefined) return undefined
  try {
    return JSON.parse(await readFile(filePath, 'utf8'))
  } catch {
    return undefined
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

const supplemental = {
  u4Candidate: await readJsonOptional(supplementalPaths.u4Candidate),
  attentionGold: await readJsonOptional(supplementalPaths.attentionGold),
  u5Status: await readJsonOptional(supplementalPaths.u5Status),
  alpha13: await readJsonOptional(supplementalPaths.alpha13),
  u7Process: await readJsonOptional(supplementalPaths.u7Process),
  u7RealSoak: await readJsonOptional(supplementalPaths.u7RealSoak),
  wslExisting: await readJsonOptional(supplementalPaths.wslExisting),
  qualification: await readJsonOptional(supplementalPaths.qualification),
}
const artifact = await resolveReleaseArtifact(root, packageJson, packageTgzPath)
await verifyBuiltEntries(root, artifact)
const tarballSha256 = artifact.sha256

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
const userFacingDispositions = new Set(['inbox', 'digest', 'interrupt', 'escalate'])
const stableReviewMinimum = 15
const stableHumanNeededMinimum = 10
const stableNaturalRunMinimum = 3
const stableNaturalWorkdayMinimum = 3

function deliveryReviewQualification(bundles) {
  const units = new Map()
  for (const bundle of bundles) {
    for (const observation of bundle.observations) {
      if (!userFacingDispositions.has(observation.decisionDisposition)
        || typeof observation.deliveryUnitRef !== 'string'
        || observation.deliveryChannel === 'none') continue
      const key = `${bundle.run.runId}:${observation.deliveryUnitRef}`
      const unit = units.get(key) ?? {
        runId: bundle.run.runId,
        deliveryUnitRef: observation.deliveryUnitRef,
        visible: false,
        unknown: false,
        reviewed: false,
        c2OrC3: false,
        source: undefined,
      }
      if (observation.deliveryVisibility?.status === 'visible') unit.visible = true
      else unit.unknown = true
      const review = observation.reviewLabel !== undefined || observation.policyReview !== undefined || observation.userFeedback !== undefined
      if (review
        && typeof observation.reviewSource === 'string'
        && observation.reviewSource !== 'unknown'
        && typeof observation.reviewBasis === 'string'
        && observation.reviewBasis !== 'unknown'
        && typeof observation.reviewConfidence === 'string') {
        unit.reviewed = true
        unit.source ??= observation.reviewSource
      }
      if (observation.observedDecision?.level === 'C2' || observation.observedDecision?.level === 'C3') unit.c2OrC3 = true
      units.set(key, unit)
    }
  }
  const all = [...units.values()]
  const eligible = all.filter(unit => unit.visible)
  const unknown = all.filter(unit => !unit.visible)
  const reviewed = eligible.filter(unit => unit.reviewed)
  const reviewedC2OrC3 = reviewed.filter(unit => unit.c2OrC3)
  const rate = eligible.length === 0 ? null : reviewed.length / eligible.length
  return {
    status: eligible.length >= stableReviewMinimum && reviewed.length >= stableReviewMinimum && reviewedC2OrC3.length >= 5 && rate !== null && rate >= 0.8 ? 'pass' : 'insufficient-sample',
    candidateFinalDeliveryUnits: all.length,
    eligibleFinalDeliveryUnits: eligible.length,
    reviewedFinalDeliveryUnits: reviewed.length,
    reviewedC2OrC3Units: reviewedC2OrC3.length,
    unknownVisibilityDeliveryUnits: unknown.length,
    reviewCoverage: { numerator: reviewed.length, denominator: eligible.length, rate },
    sources: {
      userFeedback: reviewed.filter(unit => unit.source === 'user-feedback').length,
      engineeringReview: reviewed.filter(unit => unit.source === 'engineering-review').length,
      independentAudit: reviewed.filter(unit => unit.source === 'independent-audit').length,
    },
  }
}

function naturalTaskCoverage(bundles) {
  const natural = bundles.filter(bundle => bundle.run.provenance === 'real' && bundle.run.taskOrigin === 'natural')
  const allExplicitNatural = bundles.length > 0 && natural.length === bundles.length
  const workdays = new Set(natural.map(bundle => new Date(bundle.run.startedAt).toISOString().slice(0, 10)))
  const taskFamilies = new Set(natural.map(bundle => bundle.run.taskFamily))
  return {
    status: allExplicitNatural && natural.length >= stableNaturalRunMinimum && workdays.size >= stableNaturalWorkdayMinimum && taskFamilies.size >= 3 ? 'pass' : 'insufficient-sample',
    naturalRunCount: natural.length,
    totalRunCount: bundles.length,
    workdayCount: workdays.size,
    taskFamilyCount: taskFamilies.size,
    taskFamilies: [...taskFamilies].sort(),
    reason: allExplicitNatural ? undefined : 'every Gate D bundle must explicitly declare taskOrigin=natural',
  }
}

function auditCount(input, keys) {
  const source = input?.counts ?? input?.summary ?? input?.dispositionCounts ?? {}
  for (const key of keys) {
    if (Number.isInteger(source[key]) && source[key] >= 0) return source[key]
  }
  return null
}

function auditRunIds(input) {
  const ids = new Set()
  if (typeof input?.runId === 'string') ids.add(input.runId)
  for (const key of ['runId']) {
    for (const row of input?.auditFiles ?? []) if (typeof row?.[key] === 'string') ids.add(row[key])
    for (const row of input?.sessions ?? []) if (typeof row?.[key] === 'string') ids.add(row[key])
    for (const row of input?.findings ?? []) if (typeof row?.[key] === 'string') ids.add(row[key])
  }
  return ids
}

function evaluateIndependentAudit(input, bundles) {
  if (input === undefined) return { status: 'not-evaluated', reasons: ['independent-dsh-audit-required'] }
  const delivered = auditCount(input, ['delivered'])
  const suppressed = auditCount(input, ['suppressedByPolicy', 'suppressed-by-policy'])
  const missed = auditCount(input, ['missed'])
  const notInScope = auditCount(input, ['notInScope', 'not-in-scope'])
  const validCounts = [delivered, suppressed, missed, notInScope].every(value => value !== null)
  const authority = input.authority === 'DSH-authoritative-session-history'
    || input.source === 'independent-dsh-anchor-audit'
    || input.authoritativeSource === 'DSH session history'
  const independent = input.scan?.independentOfRuntimeLedger === true
    || input.independence?.runtimeLedgerRole === 'matching-only'
    || (input.provenanceSubclass === 'natural-real' && typeof input.reviewerRole === 'string' && input.reviewerRole.includes('independent'))
  const rawSafe = input.rawContentPersisted === false || input.privacy?.rawContentPersisted === false
  const ids = auditRunIds(input)
  const bundleIds = new Set(bundles.map(bundle => bundle.run.runId))
  const bound = [...ids].some(id => bundleIds.has(id))
  const opportunityCount = (delivered ?? 0) + (suppressed ?? 0) + (missed ?? 0)
  const reasons = []
  if (!validCounts) reasons.push('audit-counts-incomplete')
  if (!authority) reasons.push('audit-authority-not-dsh-session-history')
  if (!independent) reasons.push('audit-is-not-independent-of-runtime-ledger')
  if (!rawSafe) reasons.push('audit-privacy-boundary-incomplete')
  if (!bound) reasons.push('audit-does-not-bind-to-input-run')
  if (opportunityCount < stableHumanNeededMinimum) reasons.push(`audit-needs-${stableHumanNeededMinimum}-human-needed-opportunities`)
  if ((missed ?? 0) > 0) reasons.push('critical-human-needed-miss')
  return {
    status: validCounts && authority && independent && rawSafe && bound && opportunityCount >= stableHumanNeededMinimum && missed === 0 ? 'pass' : 'insufficient-sample',
    delivered,
    suppressedByPolicy: suppressed,
    missed,
    notInScope,
    opportunityCount,
    boundRunIds: [...ids].filter(id => bundleIds.has(id)),
    reasons,
  }
}

const reviewQualification = rawBundles.length === 0
  ? { status: 'not-evaluated', reason: 'raw-bundles-required-for-review-qualification' }
  : deliveryReviewQualification(rawBundles)
const naturalCoverage = rawBundles.length === 0
  ? { status: 'not-evaluated', reason: 'raw-bundles-required-for-natural-task-qualification' }
  : naturalTaskCoverage(rawBundles)
const independentHumanNeededAudit = evaluateIndependentAudit(auditPath === undefined ? undefined : await readJsonOptional(auditPath), rawBundles)
const reviewCoverageMatchesBundle = dogfoodKind === 'aggregate'
  && dogfood?.coverage?.userFacingDeliveryUnits === reviewQualification.eligibleFinalDeliveryUnits
  && dogfood?.coverage?.reviewedUserFacingUnits === reviewQualification.reviewedFinalDeliveryUnits
  && dogfood?.coverage?.unknownVisibilityDeliveryUnits === reviewQualification.unknownVisibilityDeliveryUnits
const realDogfoodQualification = {
  status: naturalCoverage.status === 'pass'
    && independentHumanNeededAudit.status === 'pass'
    && reviewQualification.status === 'pass'
    && reviewCoverageMatchesBundle
    && metricsReady
    && missingTaskFamilies.length === 0
    && missingScenarios.length === 0
    && negativeOpportunityCoverage.status === 'pass'
    ? 'pass' : 'insufficient-sample',
  naturalTaskCoverage: naturalCoverage,
  independentHumanNeededAudit,
  reviewQualification: { ...reviewQualification, summaryMatchesBundle: reviewCoverageMatchesBundle },
  reasons: [
    ...(naturalCoverage.status === 'pass' ? [] : ['natural-task-coverage-incomplete']),
    ...(independentHumanNeededAudit.status === 'pass' ? [] : ['independent-human-needed-audit-incomplete']),
    ...(reviewQualification.status === 'pass' ? [] : ['qualified-final-delivery-review-incomplete']),
    ...(reviewCoverageMatchesBundle ? [] : ['reported-review-coverage-does-not-match-qualified-units']),
  ],
}
const realDogfood = dogfoodProvenance === 'real'
  ? {
      status: dogfoodKind === 'aggregate' && rawBundles.every(bundle => bundle.run.provenance === 'real' && bundle.run.pluginVersion === packageJson.version && bundle.run.runtimeTag === runtimeBaseline) && dogfood.observationCount >= 5 && realDogfoodQualification.status === 'pass' ? 'pass' : 'insufficient-sample',
      observationCount: dogfood.observationCount,
      bundleCount: dogfood.bundleCount ?? 1,
      trialCount: dogfood.trialCount ?? 1,
      metrics: dogfood.metrics,
      taskFamilies: { required: requiredTaskFamilies, observed: observedTaskFamilies, missing: missingTaskFamilies },
      scenarios: { required: requiredScenarios, observed: observedScenarios, missing: missingScenarios },
      scenarioEvidence,
      negativeOpportunityCoverage,
      qualification: realDogfoodQualification,
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

const u4Candidate = supplemental.u4Candidate
const attentionGold = supplemental.attentionGold
const u5Status = supplemental.u5Status
const alpha13 = supplemental.alpha13
const u7Process = supplemental.u7Process
const u7RealSoak = supplemental.u7RealSoak
const wslExisting = supplemental.wslExisting
const qualification = supplemental.qualification

function everyCheck(checks, names) {
  return names.every(name => checks?.[name] === true)
}

const processCheckNames = [
  'initialLeaseAcquired',
  'initialSnapshotDurable',
  'normalRestartRestoresSnapshot',
  'staleLeaseTakeover',
  'oldOwnerFenced',
  'delayedCallbackIdempotence',
  'corruptSnapshotFailSafe',
  'privacyBoundary',
]
const processIdentityMatch = u7Process !== undefined
  && u7Process.pluginVersion === packageJson.version
  && u7Process.identity?.sourceCommit === gitCommit
  && u7Process.identity?.packageSha256 === tarballSha256
  && u7Process.identity?.dshTag === runtimeBaseline
  && u7Process.identity?.dshCommit === runtimeCommit
const u7ProcessStatus = u7Process === undefined
  ? 'not-evaluated'
  : everyCheck(u7Process.checks, processCheckNames)
    && u7Process.checks?.rawContentPersisted === false
    && processIdentityMatch
    ? 'pass'
    : 'pending-or-stale'

const soakCheckNames = [
  'elapsedDuration',
  'heartbeatObserved',
  'snapshotsObserved',
  'stateWithinBudget',
  'boundedSessions',
  'leaseReleased',
  'privacyBoundary',
]
const realSoakIdentityMatch = u7RealSoak !== undefined
  && u7RealSoak.pluginVersion === packageJson.version
  && u7RealSoak.identity?.sourceCommit === gitCommit
  && u7RealSoak.identity?.packageSha256 === tarballSha256
  && u7RealSoak.identity?.dshTag === runtimeBaseline
  && u7RealSoak.identity?.dshCommit === runtimeCommit
const u7RealSoakStatus = u7RealSoak === undefined
  ? 'not-evaluated'
  : everyCheck(u7RealSoak.checks, soakCheckNames)
    && u7RealSoak.checks?.rawContentPersisted === false
    && u7RealSoak.checks?.interrupted === false
    && realSoakIdentityMatch
    ? 'pass'
    : 'pending-or-stale'

const alpha13Checks = [
  'runtimeVersion',
  'runtimeCommitResolved',
  'runtimeSourceClean',
  'profileBundlesPresent',
  'installedPluginVersion',
  'packageHashAvailable',
  'installedPackageMatchesTarball',
  'packageContentDigestAvailable',
  'webProcessResponded',
  'publicSessionListSurface',
  'publicSnapshotEventsSurface',
  'runtimeContractPassed',
  'uiEvidenceObserved',
  'privacyBoundary',
]
const alpha13Status = alpha13 === undefined
  ? 'not-evaluated'
  : everyCheck(alpha13.checks, alpha13Checks)
    && alpha13.checks?.rawContentPersisted === false
    && alpha13.pluginVersion === packageJson.version
    && alpha13.packageSha256 === tarballSha256
    ? 'pass'
    : 'pending'

const u5StatusSummary = u5Status === undefined
  ? { status: 'not-evaluated', capability: 'Windows OS-visible browser notification delivery' }
  : {
      status: u5Status.overallStatus ?? u5Status.status ?? 'unknown',
      capability: u5Status.capability ?? 'Windows OS-visible browser notification delivery',
      N1: u5Status.checks?.N1_C2_OSVisible?.status ?? u5Status.N1?.status ?? 'unknown',
      N2: u5Status.checks?.N2_C3_HumanNeeded?.status ?? u5Status.N2?.status ?? 'unknown',
      N3: u5Status.checks?.N3_PermissionDenied?.status ?? u5Status.N3?.status ?? 'unknown',
      N4: u5Status.checks?.N4_QuietAndBudget?.status ?? u5Status.N4?.status ?? 'unknown',
    }

const u4StatusSummary = u4Candidate === undefined
  ? { status: 'not-evaluated', gates: {} }
  : {
      status: u4Candidate.status ?? 'unknown',
      decision: u4Candidate.decision ?? 'unknown',
      gates: Object.fromEntries(Object.entries(u4Candidate.promotionGates ?? {}).map(([name, gate]) => [name, gate.status ?? 'unknown'])),
      discoveryRunId: u4Candidate.separation?.discoveryRunId ?? null,
      holdoutRunId: u4Candidate.separation?.holdoutRunId ?? null,
    }

const wslStatusSummary = wslExisting === undefined
  ? { status: 'not-evaluated', paused: true }
  : {
      status: everyCheck(wslExisting.checks, Object.keys(wslExisting.checks ?? {}).filter(name => name !== 'rawContentPersisted'))
        && (wslExisting.checks?.rawContentPersisted === false || wslExisting.rawContentPersisted === false) ? 'pass' : 'pending',
      paused: true,
      identity: wslExisting.identity ?? null,
    }
const qualificationStatus = qualification?.status
  ?? qualification?.qualifications?.[0]?.currentStatus
  ?? (qualification === undefined ? 'not-evaluated' : 'unknown')

async function runAuthoritativeSessionReconciliationCheck() {
  try {
    const { Context } = await import('@deepseek-ai/cordis')
    const { SessionStore } = await import('@deepseek-ai/dsh-session')
    const { ContextDshAdapter } = await import('../lib/adapters/dsh.js')
    const ctx = new Context()
    const storeFiber = await ctx.plugin(SessionStore)
    const session = ctx.sessions.create('stable-gate-reconciliation-session')
    session.append('turn/start', { turn: 1 })
    const received = []
    const adapter = new ContextDshAdapter(ctx, { hostVersion: runtimeBaseline })
    adapter.subscribe(event => received.push(event))
    try {
      await adapter.start()
      const status = adapter.getReconciliationStatus()
      const snapshot = await adapter.getSessionSnapshot(session.id)
      const checks = {
        publicSessionList: ctx.sessions.list().length === 1,
        publicSnapshotEvents: snapshot?.eventCount === 1 && snapshot.lastEventSeq === 0,
        subscriberFirst: received[0]?.type === 'session/created' && received[0]?.snapshot !== undefined,
        ready: status.phase === 'ready',
        authoritative: status.authoritative === true,
        verified: status.verified === true,
        noBufferedEvents: status.bufferedEvents === 0,
        runningProjection: snapshot?.running === true,
      }
      return { status: Object.values(checks).every(value => value === true) ? 'pass' : 'partial-adapter-surface', checks }
    } finally {
      await storeFiber.dispose()
    }
  } catch (error) {
    return { status: 'pending-adapter-surface', checks: { runtimeProbe: false }, error: error instanceof Error ? error.message : 'adapter reconciliation probe failed' }
  }
}

const adapterReconciliation = await runAuthoritativeSessionReconciliationCheck()
const gateDReady = realDogfood.status === 'pass' && replayPass && notificationEvidence.status === 'pass' && notificationEvidence.binding?.status === 'pass'
const authoritativeSessionReconciliation = adapterReconciliation.status
const gateEReady = implementationPresent && replayPass && supervisorSmokePass && authoritativeSessionReconciliation === 'pass'
const optionalExceptions = [
  ...(u7ProcessStatus === 'pass' ? [] : ['supervisor-process-integration-pending']),
  ...(u7RealSoakStatus === 'pass' ? [] : ['real-elapsed-soak-pending']),
  ...(alpha13Status === 'pass' ? [] : ['alpha13-compatibility-pending']),
  ...(wslStatusSummary.status === 'pass' ? [] : ['wsl-evidence-pending']),
]
const stableDecisionResult = decideStableDecision({
  gateDReady,
  gateEReady,
  implementationPresent,
  replayPass,
  replayObserved: replay !== undefined,
  supervisorSmokePass,
  supervisorSmokeObserved: supervisorSmoke !== undefined,
  realDogfoodStatus: realDogfood.status,
  optionalExceptions,
})
const stableDecision = stableDecisionResult.decision
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
  u4CandidateDigest: await digestFile(supplementalPaths.u4Candidate),
  attentionGoldEvaluationDigest: await digestFile(supplementalPaths.attentionGold),
  u5StatusDigest: await digestFile(supplementalPaths.u5Status),
  alpha13CompatibilityDigest: await digestFile(supplementalPaths.alpha13),
  u7ProcessDigest: await digestFile(supplementalPaths.u7Process),
  u7RealSoakDigest: await digestFile(supplementalPaths.u7RealSoak),
  wslExistingDigest: await digestFile(supplementalPaths.wslExisting),
  qualificationDigest: await digestFile(supplementalPaths.qualification),
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
  decisionReasons: stableDecisionResult.reasons,
  identity: {
    gitCommit: gitCommit || 'unknown',
    sourceCommit: gitCommit || 'unknown',
    worktree: gitStatus ? 'dirty' : 'clean',
    worktreeDirty: Boolean(gitStatus),
    packageVersion: packageJson.version,
    dshTag: runtimeBaseline,
    dshCommit: runtimeCommit,
    packageSha256: tarballSha256 || null,
    artifactSourceCommit: artifact.sourceCommit,
    tarballSha256: tarballSha256 || null,
    sourceDigest,
  },
  gateD: {
    status: gateDReady ? 'pass' : 'pending',
    policyReplay: replayPass ? 'pass' : 'pending',
    realDogfood,
    osNativeNotification: notificationEvidence,
    candidatePromotion: u4StatusSummary,
    currentWindowsRun: u5StatusSummary,
    note: 'Only a validated developer-observed Edge/Windows record can satisfy Toast appearance, notification-center retention, and click-to-focus evidence; a legacy --native-toast-observed flag is not accepted as proof.',
  },
  gateE: {
    status: implementationPresent && replayPass && supervisorSmokePass ? 'prototype-ready' : 'pending',
    stableEligible: gateEReady,
    implementation: implementationPresent ? 'present' : 'incomplete',
    policyReplay: replayPass ? 'pass' : 'pending',
    supervisorSmoke: supervisorSmokePass ? 'pass' : supervisorSmoke === undefined ? 'not-evaluated' : 'pending',
    supervisorSoak,
    authoritativeSessionReconciliation,
    u7ProcessIntegration: u7ProcessStatus,
    u7RealElapsedSoak: u7RealSoakStatus,
    alpha13Compatibility: alpha13Status,
    wslExistingEvidence: wslStatusSummary,
    crossSinkDeliveryLedger: 'logical-browser-ledger-present-os-observation-pending',
    packageVersion: packageJson.version,
    note: 'Prototype readiness records the local lease/snapshot path, authoritative adapter slice, bounded orphan grace, and bounded logical browser delivery ledger. The Supervisor is experimental and off by default; Windows OS observation and full restart convergence remain separate Stable gates before any future default enablement.',
  },
  supplementalEvidence: {
    u4Candidate: u4StatusSummary,
    attentionGoldEvaluation: attentionGold?.status ?? 'not-evaluated',
    u5Status: u5StatusSummary,
    alpha13Compatibility: alpha13Status,
    u7ProcessIntegration: u7ProcessStatus,
    u7RealElapsedSoak: u7RealSoakStatus,
    wslExisting: wslStatusSummary,
    qualification: qualificationStatus,
    adapterReconciliation,
  },
  files: fileChecks,
  generatedAt: new Date().toISOString(),
  conclusion: stableDecision === 'STABLE_READY' || stableDecision === 'STABLE_WITH_EXCEPTIONS'
    ? 'Fresh Gate D and Gate E evidence meets the configured Stable criteria; review any explicitly documented non-core exceptions before publication.'
    : 'The fresh report records the remaining real, Windows, or Supervisor evidence required for Stable promotion without converting missing observations into a pass.',
}

await mkdir(path.dirname(outputPath), { recursive: true })
await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8')
console.log(`stable gates report written: ${path.relative(root, outputPath)}`)
console.log(JSON.stringify({ decision: report.decision, gateD: report.gateD.status, gateE: report.gateE.status, policyReplay: report.gateD.policyReplay, realDogfood: report.gateD.realDogfood.status, windowsOsVisibleBrowserNotification: report.gateD.osNativeNotification }, null, 2))
