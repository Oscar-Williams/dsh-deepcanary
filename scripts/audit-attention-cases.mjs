import { createHash } from 'node:crypto'
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  hasDogfoodReview,
  hasQualifiedDogfoodReview,
  isDogfoodBundle,
  isNaturalDogfoodRun,
  isUserFacingDeliveryObservation,
} from '../lib/dogfood.js'
import { isDogfoodAggregate, summarizeDogfoodAggregate } from '../lib/dogfoodAggregate.js'

// This audit reads only what an operator names explicitly: sanitized dogfood bundles or
// aggregates. It never enumerates sessions, logs, credentials, or any implicit location, and it
// never copies source text or source paths into its report.
const root = fileURLToPath(new URL('..', import.meta.url))
const inputPaths = []
const inputDirectoryPaths = []
let outputPath = path.resolve(root, 'output/dogfood/current/case-index.json')
let ignoredFlagCount = 0
for (let index = 2; index < process.argv.length; index += 1) {
  const key = process.argv[index]
  const value = process.argv[index + 1]
  const hasValue = value !== undefined && !value.startsWith('--')
  if (key === '--input' && hasValue) {
    inputPaths.push(path.resolve(root, value))
    index += 1
  } else if (key === '--input-dir' && hasValue) {
    inputDirectoryPaths.push(path.resolve(root, value))
    index += 1
  } else if (key === '--out' && hasValue) {
    outputPath = path.resolve(root, value)
    index += 1
  } else if (typeof key === 'string' && key.startsWith('--')) {
    ignoredFlagCount += 1
  }
}
if (inputPaths.length === 0 && inputDirectoryPaths.length === 0) {
  throw new Error('an explicit --input file or --input-dir directory is required; this audit never scans implicit locations such as sessions, logs, or credentials')
}

const SCHEMA_VERSION = 1
const TASK_FAILURE_CATEGORIES = ['TASK_FAILED', 'TASK_ABORTED', 'provider-error']
const ALERTING_FAILURE_CATEGORIES = ['missed-human-needed', 'false-stall', 'wrong-level', 'too-late', 'duplicate-final-interrupt', 'sink-error', 'dropped-event']
// A rule-hard case is an attention judgement the deterministic policy got wrong: the kind of case
// a Judge entry may evaluate later. Delivery-plane failures and plain task outcomes are not.
const RULE_HARD_CATEGORIES = ['missed-human-needed', 'false-stall', 'wrong-level', 'too-late', 'duplicate-final-interrupt']
const REVIEW_LABEL_CATEGORIES = ['missed-human-needed', 'false-stall', 'wrong-level', 'too-late', 'duplicate-final-interrupt', 'sink-error', 'dropped-event', 'provider-error']
const NEGATIVE_OPPORTUNITY_KEYS = { c0Silent: 'c0-silent', suppressed: 'suppressed', deduped: 'deduped', recoveryClosed: 'recovery-closed' }
const RUN_MATERIAL_FIELDS = ['pluginVersion', 'runtimeTag', 'policyVersion', 'provenance', 'captureMode', 'taskOrigin', 'taskRef', 'taskFamily', 'scenario']
const SAFE_LABEL = /^[A-Za-z0-9][A-Za-z0-9._+-]{0,63}$/
const SAFE_TOKEN = /^[A-Za-z0-9._:+-]*$/
const CASE_CONCLUSION = 'Case index built only from sanitized dogfood bundles and aggregates named explicitly on the command line; no Host session, log, credential, prompt, model output, tool argument, or source path was read or copied.'
const JUDGE_NOTE = 'Qualified cases are screening evidence only. Judge requires a separate feasibility review proving whitelisted metadata distinguishability and deterministic rule insufficiency; this audit never authorizes model calls.'
const PROSE_VALUES = new Set([CASE_CONCLUSION, JUDGE_NOTE])

function sha256Hex(bytes) {
  return createHash('sha256').update(bytes).digest('hex')
}
function safeLabel(value) {
  return typeof value === 'string' && SAFE_LABEL.test(value) ? value : 'unknown'
}
function safeSubtype(value) {
  return typeof value === 'string' && /^[a-z0-9][a-z0-9._-]{0,63}$/.test(value) ? value : 'other'
}
function safeReasonCode(value) {
  return typeof value === 'string' && /^[A-Z][A-Z0-9_]{0,63}$/.test(value) ? value : null
}
function pickDecision(decision) {
  if (decision === undefined || decision === null || typeof decision !== 'object') return null
  return {
    level: typeof decision.level === 'string' ? decision.level : null,
    action: typeof decision.action === 'string' ? decision.action : null,
    reasonCode: safeReasonCode(decision.reasonCode),
  }
}
function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`
  if (value !== null && typeof value === 'object') {
    return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(',')}}`
  }
  return JSON.stringify(value)
}
function sortedUnique(values) {
  return [...new Set(values)].sort()
}
function zeroCounts(names) {
  return Object.fromEntries(names.map(name => [name, 0]))
}

// --input-dir reads only regular top-level .json files. Subdirectories, symlinks, and non-JSON
// entries are counted and ignored so the audit cannot walk into unrelated trees.
async function listDirectorySources(directory) {
  const files = []
  const ignored = { nonJsonFiles: 0, subdirectories: 0 }
  let entries
  try {
    entries = await readdir(directory, { withFileTypes: true })
  } catch {
    return { files, ignored, readable: false }
  }
  for (const entry of entries) {
    if (entry.isDirectory()) {
      ignored.subdirectories += 1
      continue
    }
    if (!entry.isFile() || !entry.name.toLowerCase().endsWith('.json')) {
      ignored.nonJsonFiles += 1
      continue
    }
    files.push({ filePath: path.join(directory, entry.name), fromDirectory: true })
  }
  files.sort((left, right) => left.filePath.localeCompare(right.filePath))
  return { files, ignored, readable: true }
}

const inputMode = {
  explicitInputs: inputPaths.length,
  inputDirectories: inputDirectoryPaths.length,
  jsonFilesRead: 0,
  nonJsonFilesIgnored: 0,
  subdirectoriesIgnored: 0,
  ignoredFlagCount,
}
const fileCandidates = inputPaths.map(filePath => ({ filePath, fromDirectory: false }))
for (const directory of inputDirectoryPaths) {
  const scan = await listDirectorySources(directory)
  fileCandidates.push(...scan.files)
  inputMode.nonJsonFilesIgnored += scan.ignored.nonJsonFiles
  inputMode.subdirectoriesIgnored += scan.ignored.subdirectories
}

// Each source is bound to its SHA256 content identity. A repeated byte-identical file is one
// source with an occurrence count, never a second contribution.
const sources = []
const sourceByHash = new Map()
async function readSource(candidate) {
  let bytes
  try {
    bytes = await readFile(candidate.filePath)
  } catch {
    sources.push({ sha256: null, status: 'invalid', kind: null, occurrences: 1, bundleCount: 0, runIds: [], provenance: null, reasonCode: 'unreadable-file' })
    return undefined
  }
  const sha256 = sha256Hex(bytes)
  const known = sourceByHash.get(sha256)
  if (known !== undefined) {
    known.occurrences += 1
    return undefined
  }
  const source = { sha256, status: 'invalid', kind: null, occurrences: 1, bundleCount: 0, runIds: [], provenance: null, reasonCode: null }
  sourceByHash.set(sha256, source)
  sources.push(source)
  let value
  try {
    value = JSON.parse(bytes.toString('utf8'))
  } catch {
    source.reasonCode = 'unparseable-json'
    return undefined
  }
  if (isDogfoodBundle(value)) {
    source.status = 'valid'
    source.kind = 'bundle'
    source.bundleCount = 1
    source.runIds = [value.run.runId]
    return { source, bundles: [value] }
  }
  if (isDogfoodAggregate(value)) {
    let provenance = null
    try {
      provenance = summarizeDogfoodAggregate(value).provenance
    } catch {
      provenance = null
    }
    source.status = 'valid'
    source.kind = 'aggregate'
    source.bundleCount = value.bundles.length
    source.runIds = sortedUnique(value.bundles.map(bundle => bundle.run.runId))
    source.provenance = provenance
    return { source, bundles: value.bundles }
  }
  source.reasonCode = 'not-a-sanitized-dogfood-bundle-or-aggregate'
  return undefined
}

// Runs are identified by runId + trialId, observations by runId + observationRef. A repeated
// identity is counted once; disagreement is surfaced in the conflict summary instead of being
// silently merged or double counted.
const runs = new Map()
const observations = new Map()
const duplicates = []
const conflicts = []
const seenRuns = new Set()
const conflictingObservations = new Set()
for (const candidate of fileCandidates) {
  inputMode.jsonFilesRead += 1
  const parsed = await readSource(candidate)
  if (parsed === undefined) continue
  for (const bundle of parsed.bundles) {
    const run = bundle.run
    const runKey = `${run.runId}\u0000${run.trialId}`
    const existing = runs.get(runKey)
    if (existing === undefined) {
      runs.set(runKey, {
        runId: run.runId,
        trialId: run.trialId,
        pluginVersion: run.pluginVersion,
        runtimeTag: run.runtimeTag,
        policyVersion: run.policyVersion,
        taskFamily: run.taskFamily,
        scenario: run.scenario,
        provenance: run.provenance,
        captureMode: run.captureMode,
        taskOrigin: run.taskOrigin,
        taskRef: run.taskRef,
        sourceHashes: new Set([parsed.source.sha256]),
      })
    } else {
      existing.sourceHashes.add(parsed.source.sha256)
      const differing = RUN_MATERIAL_FIELDS.filter(field => (existing[field] ?? null) !== (run[field] ?? null))
      if (seenRuns.has(runKey)) {
        if (differing.length > 0) {
          conflicts.push({ kind: 'run-trial-conflict', sha256: sortedUnique([...existing.sourceHashes]), runId: run.runId, trialId: run.trialId, observationRef: null, fields: differing })
        } else {
          duplicates.push({ kind: 'run-trial-duplicate', sha256: sortedUnique([...existing.sourceHashes]), runId: run.runId, trialId: run.trialId, occurrences: existing.sourceHashes.size })
        }
      }
    }
    seenRuns.add(runKey)
    for (const observation of bundle.observations) {
      const observationKey = `${run.runId}\u0000${observation.observationRef}`
      const previous = observations.get(observationKey)
      if (previous === undefined) {
        observations.set(observationKey, { runKey, observation, sourceSha256: parsed.source.sha256 })
      } else if (stableStringify(previous.observation) !== stableStringify(observation)) {
        if (!conflictingObservations.has(observationKey)) {
          conflictingObservations.add(observationKey)
          conflicts.push({ kind: 'observation-conflict', sha256: sortedUnique([previous.sourceSha256, parsed.source.sha256]), runId: run.runId, trialId: run.trialId, observationRef: observation.observationRef, fields: [] })
        }
      }
    }
  }
}
for (const source of sources) {
  if (source.occurrences > 1) {
    duplicates.push({ kind: 'content-duplicate', sha256: source.sha256 === null ? [] : [source.sha256], runId: null, trialId: null, occurrences: source.occurrences })
  }
}

function caseCategories(observation) {
  const categories = new Map()
  const add = (category, detectedBy) => {
    const detected = categories.get(category) ?? new Set()
    detected.add(detectedBy)
    categories.set(category, detected)
  }
  if (observation.eventSubtype === 'failed') add('TASK_FAILED', 'event-subtype')
  if (observation.eventSubtype === 'aborted') add('TASK_ABORTED', 'event-subtype')
  if (observation.decisionDisposition === 'provider-error') add('provider-error', 'disposition')
  if (observation.reviewLabel === 'provider-error') add('provider-error', 'review-label')
  for (const category of REVIEW_LABEL_CATEGORIES) {
    if (category === 'provider-error' || category === 'sink-error' || category === 'dropped-event') continue
    if (observation.reviewLabel === category) add(category, 'review-label')
    if (observation.policyReview === category) add(category, 'policy-review')
  }
  if (observation.reviewLabel === 'sink-error') add('sink-error', 'review-label')
  if (observation.decisionDisposition === 'sink-error') add('sink-error', 'disposition')
  if (observation.reviewLabel === 'dropped-event') add('dropped-event', 'review-label')
  if (observation.decisionDisposition === 'dropped-event') add('dropped-event', 'disposition')
  return categories
}

function deliveryTier(observation) {
  const visibility = observation.deliveryVisibility
  if (visibility === undefined || visibility.status !== 'visible') return 'unknown'
  if (visibility.source === 'browser-constructed' || visibility.source === 'unknown') return 'constructed-not-visible'
  return 'visible'
}
const TIER_RANK = { unknown: 0, 'constructed-not-visible': 1, visible: 2 }

const cases = []
const caseIds = new Set()
const runStats = new Map()
for (const run of runs.values()) runStats.set(`${run.runId}\u0000${run.trialId}`, { cases: [], deliveryUnits: new Map(), userFeedback: { explicit: 0, useful: 0, notUseful: 0, unrated: 0 }, reviewedObservations: 0, qualifiedReviews: 0, engineeringReviewCases: 0 })
for (const entry of observations.values()) {
  const run = runs.get(entry.runKey)
  const stats = runStats.get(entry.runKey)
  const observation = entry.observation
  stats.reviewedObservations += hasDogfoodReview(observation) ? 1 : 0
  stats.qualifiedReviews += hasQualifiedDogfoodReview(observation) ? 1 : 0
  if (observation.userFeedback !== undefined) {
    stats.userFeedback.explicit += 1
    if (observation.userFeedback === 'useful') stats.userFeedback.useful += 1
    else if (observation.userFeedback === 'not-useful') stats.userFeedback.notUseful += 1
    else stats.userFeedback.unrated += 1
  }
  if (isUserFacingDeliveryObservation(observation) && observation.deliveryUnitRef !== undefined) {
    const unitKey = observation.deliveryUnitRef
    const tier = deliveryTier(observation)
    const previous = stats.deliveryUnits.get(unitKey)
    if (previous === undefined || TIER_RANK[tier] > TIER_RANK[previous.tier]) {
      stats.deliveryUnits.set(unitKey, { tier, source: observation.deliveryVisibility?.source ?? null })
    }
  }
  const categories = caseCategories(observation)
  if (categories.size === 0) continue
  const qualified = hasQualifiedDogfoodReview(observation)
  for (const [category, detected] of categories) {
    const caseId = `${run.runId}:${observation.observationRef}:${category}`
    if (caseIds.has(caseId)) continue
    caseIds.add(caseId)
    const engineeringReview = []
    if (observation.reviewSource === 'engineering-review' || observation.reviewSource === 'independent-audit') {
      engineeringReview.push({
        reviewSource: observation.reviewSource,
        reviewBasis: observation.reviewBasis ?? null,
        reviewConfidence: observation.reviewConfidence ?? null,
        reviewLabel: observation.reviewLabel ?? null,
        policyReview: observation.policyReview ?? null,
      })
      stats.engineeringReviewCases += 1
    }
    const userFeedback = []
    if (observation.userFeedback !== undefined) {
      userFeedback.push({
        value: observation.userFeedback,
        countedAsFeedback: observation.userFeedback === 'useful' || observation.userFeedback === 'not-useful',
        reviewSource: observation.reviewSource ?? null,
        reviewBasis: observation.reviewBasis ?? null,
      })
    }
    const naturalQualified = isNaturalDogfoodRun(run)
    const record = {
      caseId,
      runId: run.runId,
      trialId: run.trialId,
      observationRef: observation.observationRef,
      category,
      group: TASK_FAILURE_CATEGORIES.includes(category) ? 'task-failure' : 'alerting-failure',
      detectedBy: [...detected].sort(),
      eventClass: observation.eventClass,
      eventSubtype: safeSubtype(observation.eventSubtype),
      phase: observation.phase,
      decisionDisposition: observation.decisionDisposition,
      deliveryChannel: observation.deliveryChannel,
      attentionRef: observation.attentionRef ?? null,
      deliveryUnitRef: observation.deliveryUnitRef ?? null,
      naturalQualified,
      reviewState: qualified ? 'confirmed' : 'pending',
      review: {
        label: observation.reviewLabel ?? null,
        policyReview: observation.policyReview ?? null,
        reviewSource: observation.reviewSource ?? null,
        reviewBasis: observation.reviewBasis ?? null,
        reviewConfidence: observation.reviewConfidence ?? null,
        qualified,
      },
      // The sanitized schema carries no reviewed root-cause field, so no root cause and no model
      // need is inferred here; an unreviewed case stays unknown.
      rootCause: 'unknown',
      modelNeedInferred: false,
      engineeringReview,
      userFeedback,
      observedDecision: pickDecision(observation.observedDecision),
      expectedDecision: pickDecision(observation.expectedDecision),
    }
    cases.push(record)
    stats.cases.push(record)
  }
}
cases.sort((left, right) => left.caseId.localeCompare(right.caseId))
const hashKey = entry => (Array.isArray(entry.sha256) ? [...entry.sha256].sort().join(',') : entry.sha256 ?? '')
duplicates.sort((left, right) => left.kind.localeCompare(right.kind) || hashKey(left).localeCompare(hashKey(right)))
conflicts.sort((left, right) => left.kind.localeCompare(right.kind) || (left.runId ?? '').localeCompare(right.runId ?? ''))

const runRecords = [...runs.values()]
  .map(run => {
    const stats = runStats.get(`${run.runId}\u0000${run.trialId}`)
    const tiers = [...stats.deliveryUnits.values()]
    const visibleSources = tiers.filter(unit => unit.tier === 'visible').map(unit => unit.source)
    const negativeOpportunities = {}
    for (const [key, disposition] of Object.entries(NEGATIVE_OPPORTUNITY_KEYS)) {
      let count = 0
      let reviewed = 0
      for (const entry of observations.values()) {
        if (entry.runKey !== `${run.runId}\u0000${run.trialId}`) continue
        if (entry.observation.decisionDisposition !== disposition) continue
        count += 1
        if (hasDogfoodReview(entry.observation)) reviewed += 1
      }
      negativeOpportunities[key] = { count, reviewed, unreviewed: count - reviewed }
    }
    return {
      runId: run.runId,
      trialId: run.trialId,
      pluginVersion: safeLabel(run.pluginVersion),
      runtimeTag: safeLabel(run.runtimeTag),
      policyVersion: safeLabel(run.policyVersion),
      taskFamily: run.taskFamily,
      scenario: run.scenario,
      provenance: run.provenance,
      captureMode: run.captureMode,
      taskOrigin: run.taskOrigin ?? 'unknown',
      taskRef: run.taskRef ?? null,
      taskRefPresent: run.taskRef !== undefined,
      naturalQualified: isNaturalDogfoodRun(run),
      naturalBasis: {
        provenance: run.provenance,
        captureMode: run.captureMode,
        taskOrigin: run.taskOrigin ?? 'unknown',
        taskRefPresent: run.taskRef !== undefined,
      },
      observationCount: [...observations.values()].filter(entry => entry.runKey === `${run.runId}\u0000${run.trialId}`).length,
      reviewedObservations: stats.reviewedObservations,
      qualifiedReviews: stats.qualifiedReviews,
      engineeringReviewCases: stats.engineeringReviewCases,
      userFeedbackCases: stats.cases.filter(record => record.userFeedback.length > 0).length,
      userFeedback: { ...stats.userFeedback },
      sourceHashes: sortedUnique([...run.sourceHashes]),
      caseCount: stats.cases.length,
      confirmedCaseCount: stats.cases.filter(record => record.reviewState === 'confirmed').length,
      pendingCaseCount: stats.cases.filter(record => record.reviewState === 'pending').length,
      delivery: {
        userFacingUnits: tiers.length,
        visibleUnits: tiers.filter(unit => unit.tier === 'visible').length,
        unknownVisibilityUnits: tiers.filter(unit => unit.tier === 'unknown').length,
        constructedOnlyUnits: tiers.filter(unit => unit.tier === 'constructed-not-visible').length,
        visibleBySource: {
          inboxMaterialized: visibleSources.filter(source => source === 'inbox-materialized').length,
          osObserved: visibleSources.filter(source => source === 'os-observed').length,
          userConfirmed: visibleSources.filter(source => source === 'user-confirmed').length,
        },
      },
      negativeOpportunities,
    }
  })
  .sort((left, right) => left.runId.localeCompare(right.runId) || left.trialId.localeCompare(right.trialId))

const globalNegativeOpportunities = {}
for (const [key, disposition] of Object.entries(NEGATIVE_OPPORTUNITY_KEYS)) {
  let count = 0
  let reviewed = 0
  for (const entry of observations.values()) {
    if (entry.observation.decisionDisposition !== disposition) continue
    count += 1
    if (hasDogfoodReview(entry.observation)) reviewed += 1
  }
  globalNegativeOpportunities[key] = { count, reviewed, unreviewed: count - reviewed }
}
const globalDeliveryUnits = new Map()
for (const entry of observations.values()) {
  const observation = entry.observation
  if (!isUserFacingDeliveryObservation(observation) || observation.deliveryUnitRef === undefined) continue
  const unitKey = `${entry.observation.runId}:${observation.deliveryUnitRef}`
  const tier = deliveryTier(observation)
  const previous = globalDeliveryUnits.get(unitKey)
  if (previous === undefined || TIER_RANK[tier] > TIER_RANK[previous.tier]) globalDeliveryUnits.set(unitKey, { tier, source: observation.deliveryVisibility?.source ?? null })
}
const deliveryTiers = [...globalDeliveryUnits.values()]
const caseCountsByCategory = zeroCounts([...TASK_FAILURE_CATEGORIES, ...ALERTING_FAILURE_CATEGORIES])

// A Judge entry is only for a rule-hard attention failure that a qualified review confirmed on a
// natural-qualified run. With no such case the entry stays not-entered, and no empty Judge module
// or placeholder rule is written.
const eligibleJudgeCases = cases.filter(record => record.naturalQualified && record.reviewState === 'confirmed' && RULE_HARD_CATEGORIES.includes(record.category))
const judgeEntry = {
  status: eligibleJudgeCases.length > 0 ? 'requires-feasibility-review' : 'not-entered',
  eligibleCaseCount: eligibleJudgeCases.length,
  eligibleCases: eligibleJudgeCases.map(record => record.caseId),
  ruleHardCategories: [...RULE_HARD_CATEGORIES],
  requiredSourceQualification: 'natural-run-real-service-natural-origin-opaque-taskRef',
  requiredReviewState: 'confirmed',
  confirmedRuleHardCases: cases.filter(record => record.reviewState === 'confirmed' && RULE_HARD_CATEGORIES.includes(record.category)).length,
  naturalQualifiedCases: cases.filter(record => record.naturalQualified).length,
  reasons: eligibleJudgeCases.length > 0
    ? ['qualified-rule-hard-natural-cases-present', 'whitelisted-metadata-distinguishability-and-rule-insufficiency-not-proven']
    : ['no-natural-qualified-run-with-a-confirmed-rule-hard-case'],
  note: JUDGE_NOTE,
}

const summary = {
  sourcesRead: sources.length,
  validSources: sources.filter(source => source.status === 'valid').length,
  invalidSources: sources.filter(source => source.status === 'invalid').length,
  bundleSources: sources.filter(source => source.kind === 'bundle').length,
  aggregateSources: sources.filter(source => source.kind === 'aggregate').length,
  bundles: sources.reduce((total, source) => total + source.bundleCount, 0),
  runs: runRecords.length,
  naturalRuns: runRecords.filter(run => run.naturalQualified).length,
  observations: observations.size,
  caseCount: cases.length,
  confirmedCaseCount: cases.filter(record => record.reviewState === 'confirmed').length,
  pendingCaseCount: cases.filter(record => record.reviewState === 'pending').length,
  taskFailureCases: cases.filter(record => record.group === 'task-failure').length,
  alertingFailureCases: cases.filter(record => record.group === 'alerting-failure').length,
  engineeringReviewCases: cases.filter(record => record.engineeringReview.length > 0).length,
  userFeedbackExplicit: [...observations.values()].filter(entry => entry.observation.userFeedback !== undefined).length,
  usefulFeedback: [...observations.values()].filter(entry => entry.observation.userFeedback === 'useful').length,
  notUsefulFeedback: [...observations.values()].filter(entry => entry.observation.userFeedback === 'not-useful').length,
  contentDuplicates: duplicates.filter(duplicate => duplicate.kind === 'content-duplicate').length,
  runTrialDuplicates: duplicates.filter(duplicate => duplicate.kind === 'run-trial-duplicate').length,
  conflicts: conflicts.length,
  mixedAggregates: sources.filter(source => source.provenance === 'mixed').length,
}
for (const record of cases) caseCountsByCategory[record.category] += 1

const report = {
  reportSchemaVersion: SCHEMA_VERSION,
  reportId: `case-audit-${new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14)}`,
  generatedAt: new Date().toISOString(),
  inputMode,
  summary,
  caseCountsByCategory,
  sources,
  duplicates,
  conflicts,
  runs: runRecords,
  cases,
  negativeOpportunities: globalNegativeOpportunities,
  delivery: {
    userFacingUnits: deliveryTiers.length,
    visibleUnits: deliveryTiers.filter(unit => unit.tier === 'visible').length,
    unknownVisibilityUnits: deliveryTiers.filter(unit => unit.tier === 'unknown').length,
    constructedOnlyUnits: deliveryTiers.filter(unit => unit.tier === 'constructed-not-visible').length,
    visibleBySource: {
      inboxMaterialized: deliveryTiers.filter(unit => unit.tier === 'visible' && unit.source === 'inbox-materialized').length,
      osObserved: deliveryTiers.filter(unit => unit.tier === 'visible' && unit.source === 'os-observed').length,
      userConfirmed: deliveryTiers.filter(unit => unit.tier === 'visible' && unit.source === 'user-confirmed').length,
    },
  },
  taxonomy: {
    taskFailureCategories: [...TASK_FAILURE_CATEGORIES],
    alertingFailureCategories: [...ALERTING_FAILURE_CATEGORIES],
    judgeEligibleCategories: [...RULE_HARD_CATEGORIES],
    negativeOpportunityDispositions: Object.values(NEGATIVE_OPPORTUNITY_KEYS),
  },
  judgeEntry,
  privacy: {
    rawContentPersisted: false,
    promptTranscriptModelOutputToolArgsCredentialsAndCompletePathsIncluded: false,
    sourcePathsIncluded: false,
    whitelistedFieldsOnly: true,
  },
  conclusion: CASE_CONCLUSION,
}

// Output whitelist as an enforced invariant: every field name is declared in this script and every
// string is an opaque token, enum, hash, timestamp, or a fixed prose sentence.
const ALLOWED_KEYS = new Set([
  'reportSchemaVersion', 'reportId', 'generatedAt', 'inputMode', 'summary', 'caseCountsByCategory', 'sources', 'duplicates', 'conflicts', 'runs', 'cases', 'negativeOpportunities', 'delivery', 'taxonomy', 'judgeEntry', 'privacy', 'conclusion',
  'explicitInputs', 'inputDirectories', 'jsonFilesRead', 'nonJsonFilesIgnored', 'subdirectoriesIgnored', 'ignoredFlagCount',
  'sourcesRead', 'validSources', 'invalidSources', 'bundleSources', 'aggregateSources', 'bundles', 'runs', 'naturalRuns', 'observations', 'caseCount', 'confirmedCaseCount', 'pendingCaseCount', 'taskFailureCases', 'alertingFailureCases', 'engineeringReviewCases', 'userFeedbackExplicit', 'usefulFeedback', 'notUsefulFeedback', 'contentDuplicates', 'runTrialDuplicates', 'mixedAggregates',
  'TASK_FAILED', 'TASK_ABORTED', 'provider-error', 'missed-human-needed', 'false-stall', 'wrong-level', 'too-late', 'duplicate-final-interrupt', 'sink-error', 'dropped-event',
  'sha256', 'status', 'kind', 'occurrences', 'bundleCount', 'runIds', 'provenance', 'reasonCode', 'runId', 'trialId', 'observationRef', 'fields', 'id',
  'pluginVersion', 'runtimeTag', 'policyVersion', 'taskFamily', 'scenario', 'captureMode', 'taskOrigin', 'taskRef', 'taskRefPresent', 'naturalQualified', 'naturalBasis', 'observationCount', 'reviewedObservations', 'qualifiedReviews', 'userFeedbackCases', 'userFeedback', 'sourceHashes', 'confirmedCaseCount', 'pendingCaseCount', 'deliveryUnits', 'userFacingUnits', 'visibleUnits', 'unknownVisibilityUnits', 'constructedOnlyUnits', 'visibleBySource', 'inboxMaterialized', 'osObserved', 'userConfirmed', 'c0Silent', 'suppressed', 'deduped', 'recoveryClosed', 'count', 'reviewed', 'unreviewed',
  'caseId', 'category', 'group', 'detectedBy', 'eventClass', 'eventSubtype', 'phase', 'decisionDisposition', 'deliveryChannel', 'attentionRef', 'deliveryUnitRef', 'reviewState', 'review', 'rootCause', 'modelNeedInferred', 'engineeringReview', 'userFeedback', 'observedDecision', 'expectedDecision', 'label', 'policyReview', 'reviewSource', 'reviewBasis', 'reviewConfidence', 'qualified', 'level', 'action', 'reasonCode', 'value', 'countedAsFeedback', 'reviewLabel',
  'eligibleCaseCount', 'eligibleCases', 'ruleHardCategories', 'requiredSourceQualification', 'requiredReviewState', 'confirmedRuleHardCases', 'naturalQualifiedCases', 'reasons', 'note',
  'taskFailureCategories', 'alertingFailureCategories', 'judgeEligibleCategories', 'negativeOpportunityDispositions', 'rawContentPersisted', 'promptTranscriptModelOutputToolArgsCredentialsAndCompletePathsIncluded', 'sourcePathsIncluded', 'whitelistedFieldsOnly',
  'explicit', 'useful', 'notUseful', 'unrated',
])

function assertWhitelisted(value, trail) {
  if (typeof value === 'string') {
    if (!SAFE_TOKEN.test(value)) throw new Error(`audit report contains a non-token string at ${trail}`)
    return
  }
  if (value === null || typeof value === 'boolean' || (typeof value === 'number' && Number.isFinite(value))) return
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertWhitelisted(item, `${trail}[${index}]`))
    return
  }
  if (typeof value === 'object') {
    for (const [key, item] of Object.entries(value)) {
      if (!ALLOWED_KEYS.has(key)) throw new Error(`audit report contains a non-whitelisted field at ${trail}`)
      if (key === 'conclusion' || key === 'note') {
        if (typeof item !== 'string' || !PROSE_VALUES.has(item)) throw new Error(`audit report contains non-static prose at ${trail}`)
        continue
      }
      assertWhitelisted(item, `${trail}.${key}`)
    }
    return
  }
  throw new Error(`audit report contains a non-whitelisted value at ${trail}`)
}
assertWhitelisted(report, 'report')

await mkdir(path.dirname(outputPath), { recursive: true })
await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8')
console.log(JSON.stringify({
  outputPath,
  sources: summary.sourcesRead,
  validSources: summary.validSources,
  invalidSources: summary.invalidSources,
  runs: summary.runs,
  naturalRuns: summary.naturalRuns,
  observations: summary.observations,
  cases: summary.caseCount,
  confirmedCases: summary.confirmedCaseCount,
  duplicates: summary.contentDuplicates + summary.runTrialDuplicates,
  conflicts: summary.conflicts,
  judgeEntry: judgeEntry.status,
}, null, 2))
