import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { execFile } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
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

const resolveInput = name => args.has(name) ? path.resolve(root, args.get(name)) : undefined
const discoveryPath = resolveInput('discovery')
const holdoutPath = resolveInput('holdout')
const goldPath = resolveInput('gold')
const replayPath = resolveInput('replay')
const goldResultPath = resolveInput('gold-result')
const processPath = resolveInput('process')
const soakPath = resolveInput('soak')
const adoptionPath = resolveInput('adoption')
const outputPath = path.resolve(root, args.get('out') ?? 'output/gates/u4-candidate-promotion.json')
const packageJson = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'))

async function loadOptional(filePath) {
  if (filePath === undefined) return undefined
  try { return JSON.parse(await readFile(filePath, 'utf8')) } catch { return undefined }
}

async function loadAdoptionRecord(filePath) {
  if (filePath === undefined) return { supplied: false }
  try {
    return { supplied: true, value: JSON.parse(await readFile(filePath, 'utf8')) }
  } catch {
    return { supplied: true, value: undefined, unreadable: true }
  }
}

async function digest(filePath) {
  if (filePath === undefined) return null
  try { return createHash('sha256').update(await readFile(filePath)).digest('hex') } catch { return null }
}

async function command(name, commandArgs) {
  try { return (await execFileAsync(name, commandArgs, { cwd: root, maxBuffer: 2_000_000 })).stdout.trim() } catch { return '' }
}

function finite(value) { return typeof value === 'number' && Number.isFinite(value) }
function allTrue(values) { return values.every(value => value === true) }
function isPlainObject(value) { return value !== null && typeof value === 'object' && !Array.isArray(value) }
function nonEmptyString(value) { return typeof value === 'string' && value.trim().length > 0 }
function sha256Hex(value) { return typeof value === 'string' && /^[a-f0-9]{64}$/.test(value) }
function commitHex(value) { return typeof value === 'string' && /^[a-f0-9]{7,64}$/.test(value) }
function taskRefHex(value) { return typeof value === 'string' && /^[a-f0-9]{16}$/.test(value) }
function isoTimestamp(value) {
  return typeof value === 'string'
    && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.test(value)
    && Number.isFinite(Date.parse(value))
}
function distinct(values) { return [...new Set(values)] }
function sorted(values) { return [...new Set(values)].sort() }

const discovery = await loadOptional(discoveryPath)
const holdout = await loadOptional(holdoutPath)
const gold = await loadOptional(goldPath)
const replay = await loadOptional(replayPath)
const goldResult = await loadOptional(goldResultPath)
const processEvidence = await loadOptional(processPath)
const soak = await loadOptional(soakPath)
const holdoutId = holdout?.holdout?.runId ?? holdout?.runId ?? null
const discoveryId = discovery?.discovery?.runId ?? discovery?.runId ?? null
const holdoutObserved = holdout?.observed ?? {}
const sourceCommit = await command('git', ['rev-parse', 'HEAD'])
const worktreeDirty = Boolean(await command('git', ['status', '--porcelain', '--untracked-files=all']))

// Discovery and holdout are separate tasks, not merely separate runs: each side must declare an
// explicit opaque taskRef and the two references must differ. A differing runId proves nothing.
function declaredTaskRef(input, sections) {
  if (!isPlainObject(input)) return null
  for (const section of sections) {
    const container = section === '' ? input : input[section]
    if (isPlainObject(container) && typeof container.taskRef === 'string') return container.taskRef
  }
  return null
}
const discoveryTaskRef = declaredTaskRef(discovery, ['discovery', 'run', ''])
const holdoutTaskRef = declaredTaskRef(holdout, ['holdout', 'run', ''])
const taskRefsDistinct = taskRefHex(discoveryTaskRef) && taskRefHex(holdoutTaskRef) && discoveryTaskRef !== holdoutTaskRef

const p1Checks = {
  discoveryTaskRefDeclared: taskRefHex(discoveryTaskRef),
  holdoutTaskRefDeclared: taskRefHex(holdoutTaskRef),
  independentHoldout: taskRefsDistinct,
  targetFailureResolved: holdoutObserved.falseStallObservations === 0
    && holdoutObserved.recoveredBeforeOpen === 0
    && (holdout?.verdict === 'target-fixed' || holdout?.realHoldout?.targetFix === 'pass-with-scope'),
  normalCompletionRemainsC1: holdoutObserved.normalCompletion === 'C1',
  noHumanNeededMiss: holdoutObserved.humanNeededMisses === 0,
  privacyAssertions: holdoutObserved.privacyAssertions === 'pass'
    || holdout?.privacy?.rawContentPersisted === false,
}
const p1 = {
  status: allTrue(Object.values(p1Checks)) ? 'pass-with-scope' : 'pending',
  checks: p1Checks,
  evidence: holdoutPath === undefined ? 'independent holdout input not supplied' : path.relative(root, holdoutPath),
  scope: holdout?.holdout?.scenario ?? holdout?.scenario ?? 'unknown',
}

// Candidate identity binding. The candidate version plus its code and package/settings identity
// must be declared by the discovery/holdout evidence, and any identity a gold, gold-result, or
// replay record declares has to agree with that explicit candidate identity. Missing identity
// never passes, and a conflicting declaration is a rejection rather than a silent override.
const IDENTITY_KEYS = {
  pluginVersion: ['pluginVersion', 'packageVersion', 'pluginSemver', 'candidateVersion'],
  sourceCommit: ['sourceCommit', 'pluginSourceCommit'],
  codeHash: ['codeHash', 'sourceHash', 'pluginCodeHash'],
  packageSha256: ['packageSha256', 'packageHash', 'tarballSha256'],
  settingsSha256: ['settingsSha256', 'settingsHash', 'candidateSettingsSha256', 'candidateSha256'],
}
const IDENTITY_VALIDATORS = {
  pluginVersion: nonEmptyString,
  sourceCommit: commitHex,
  codeHash: sha256Hex,
  packageSha256: sha256Hex,
  settingsSha256: sha256Hex,
}
const IDENTITY_FIELDS = Object.keys(IDENTITY_KEYS)

function collectIdentityEntries(input) {
  const entries = []
  if (!isPlainObject(input)) return entries
  const containers = [
    ['', input],
    ['candidate', input.candidate],
    ['identity', input.identity],
    ['candidateIdentity', input.candidateIdentity],
    ['run', input.run],
  ]
  for (const [prefix, container] of containers) {
    if (!isPlainObject(container)) continue
    for (const field of IDENTITY_FIELDS) {
      for (const key of IDENTITY_KEYS[field]) {
        const value = container[key]
        if (value === undefined || value === null) continue
        entries.push({ field, value, where: prefix === '' ? key : `${prefix}.${key}` })
      }
    }
  }
  return entries
}

const identityEntries = {
  discovery: collectIdentityEntries(discovery),
  holdout: collectIdentityEntries(holdout),
  gold: collectIdentityEntries(gold),
  goldResult: collectIdentityEntries(goldResult),
  replay: collectIdentityEntries(replay),
}
const identityReasons = []
const identityConflicts = []
const malformedIdentityValues = []
const declaredReferenceFields = {}
for (const field of IDENTITY_FIELDS) {
  const entries = [...identityEntries.discovery, ...identityEntries.holdout].filter(entry => entry.field === field)
  if (entries.length === 0) continue
  const values = distinct(entries.map(entry => entry.value))
  if (values.length > 1) {
    identityConflicts.push(field)
    identityReasons.push(`candidate-identity-conflict-${field}`)
    continue
  }
  declaredReferenceFields[field] = values[0]
}
for (const [sourceName, entries] of Object.entries(identityEntries)) {
  for (const entry of entries) {
    if (IDENTITY_VALIDATORS[entry.field](entry.value)) continue
    malformedIdentityValues.push({ source: sourceName, where: entry.where, field: entry.field })
    identityReasons.push(`identity-value-malformed-${sourceName}-${entry.field}`)
  }
}
const validReferenceField = field => IDENTITY_VALIDATORS[field](declaredReferenceFields[field])
const candidateVersion = validReferenceField('pluginVersion') ? declaredReferenceFields.pluginVersion : null
const candidateSourceCommit = validReferenceField('sourceCommit') ? declaredReferenceFields.sourceCommit : null
const candidateCodeHash = validReferenceField('codeHash') ? declaredReferenceFields.codeHash : null
const candidatePackageSha256 = validReferenceField('packageSha256') ? declaredReferenceFields.packageSha256 : null
const candidateSettingsSha256 = validReferenceField('settingsSha256') ? declaredReferenceFields.settingsSha256 : null
const candidateCodePresent = candidateSourceCommit !== null || candidateCodeHash !== null
const candidatePackageOrSettingsPresent = candidatePackageSha256 !== null || candidateSettingsSha256 !== null
if (candidateVersion === null) identityReasons.push('candidate-plugin-version-missing-or-malformed')
if (!candidateCodePresent) identityReasons.push('candidate-code-identity-missing-or-malformed')
if (!candidatePackageOrSettingsPresent) identityReasons.push('candidate-package-or-settings-identity-missing-or-malformed')

const identitySources = {}
for (const [sourceName, entries] of Object.entries(identityEntries)) {
  const fields = {}
  for (const field of IDENTITY_FIELDS) {
    const fieldEntries = entries.filter(entry => entry.field === field)
    if (fieldEntries.length === 0) continue
    const values = distinct(fieldEntries.map(entry => entry.value))
    let status
    if (values.length > 1) status = 'conflicting'
    else if (!validReferenceField(field)) status = 'unbound'
    else if (values[0] === declaredReferenceFields[field]) status = 'match'
    else status = 'mismatch'
    if (status === 'conflicting' && !identityConflicts.includes(field)) {
      identityReasons.push(`${sourceName}-declares-conflicting-${field}`)
    }
    if (status === 'unbound') identityReasons.push(`${sourceName}-declares-${field}-absent-from-candidate-identity`)
    if (status === 'mismatch') identityReasons.push(`${sourceName}-${field}-does-not-match-candidate-identity`)
    fields[field] = {
      declared: values.length === 1 ? values[0] : values,
      status,
    }
  }
  identitySources[sourceName] = { declaredFields: Object.keys(fields).sort(), fields }
}
const identityBindingReasons = sorted(identityReasons)
const identityBinding = {
  status: identityBindingReasons.length === 0 ? 'pass' : 'insufficient-evidence',
  candidate: {
    pluginVersion: candidateVersion,
    sourceCommit: candidateSourceCommit,
    codeHash: candidateCodeHash,
    packageSha256: candidatePackageSha256,
    settingsSha256: candidateSettingsSha256,
  },
  complete: {
    pluginVersion: candidateVersion !== null,
    code: candidateCodePresent,
    packageOrSettings: candidatePackageOrSettingsPresent,
  },
  sources: identitySources,
  reasons: identityBindingReasons,
}

const replayRows = Array.isArray(replay?.cases) ? replay.cases : []
const replayPass = (replay?.status === 'baseline' || replay?.status === 'comparison')
  && replay?.expectedFailingCases === 0
  && replay?.expectedPassingCases === replay?.caseCount
  && replayRows.length === replay?.caseCount
  && replayRows.every(row => replay.status === 'comparison' ? row.candidateExpectedPass === true : row.baselineExpectedPass === true)
const goldFrozen = gold?.frozen === true && Array.isArray(gold?.cases) && gold.cases.length > 0
const goldEvaluationPass = goldResult?.status === 'pass'
  && goldResult?.frozen === true
  && goldResult?.criticalRecall === 1
  && goldResult?.humanNeededRecall === 1
  && goldResult?.duplicateFinalInterrupts === 0
  && goldResult?.normalCompletion === 'C1'
  && goldResult?.privacyAssertions === 'pass'
const holdoutGuardrails = holdout?.guardrails ?? holdout?.promotionGuardrails ?? {}
const p2Checks = {
  replayPass,
  frozenAttentionGoldPresent: goldFrozen,
  frozenAttentionGoldEvaluation: goldResultPath === undefined ? false : goldEvaluationPass,
  frozenCriticalRecall: holdoutGuardrails.criticalRecall === 1 || goldResult?.criticalRecall === 1,
  frozenHumanNeededRecall: holdoutGuardrails.humanNeededRecall === 1 || goldResult?.humanNeededRecall === 1,
  duplicateFinalInterruptsZero: holdoutGuardrails.duplicateFinalInterrupts === 0 || goldResult?.duplicateFinalInterrupts === 0,
  normalCompletionC1: holdoutGuardrails.normalCompletion === 'C1' || goldResult?.normalCompletion === 'C1',
  privacy: holdout?.privacy?.rawContentPersisted === false && holdout?.privacy?.promptTranscriptModelOutputToolArgsCredentialsAndCompletePathsIncluded === false,
}
const p2 = {
  status: allTrue(Object.values(p2Checks)) ? 'pass' : 'pending',
  checks: p2Checks,
  evidence: {
    replay: replayPath === undefined ? null : path.relative(root, replayPath),
    gold: goldPath === undefined ? null : path.relative(root, goldPath),
    goldResult: goldResultPath === undefined ? null : path.relative(root, goldResultPath),
  },
}

const attentionComparison = holdout?.attentionBudgetComparison ?? holdout?.comparison?.attentionBudget
const p3Checks = {
  comparisonPresent: attentionComparison !== undefined,
  candidateInterruptsNoMoreThanBaseline: finite(attentionComparison?.candidateInterrupts)
    && finite(attentionComparison?.baselineInterrupts)
    && attentionComparison.candidateInterrupts <= attentionComparison.baselineInterrupts,
  candidateC0SilentNoWorse: finite(attentionComparison?.candidateC0Silent)
    && finite(attentionComparison?.baselineC0Silent)
    && attentionComparison.candidateC0Silent >= attentionComparison.baselineC0Silent,
  c3AuthorityPreserved: attentionComparison?.c3AuthorityPreserved === true,
}
const p3 = {
  status: allTrue(Object.values(p3Checks)) ? 'pass' : 'pending',
  checks: p3Checks,
  evidence: attentionComparison === undefined ? 'real baseline-versus-candidate attention budget comparison is not present' : 'holdout attentionBudgetComparison',
}

const resourceComparison = holdout?.resourceComparison ?? holdout?.comparison?.resources
const p4Checks = {
  comparisonPresent: resourceComparison !== undefined,
  stateDeltaWithinBudget: finite(resourceComparison?.candidateStateBytesDelta)
    && finite(resourceComparison?.stateDeltaBudgetBytes)
    && resourceComparison.candidateStateBytesDelta <= resourceComparison.stateDeltaBudgetBytes,
  wakeDeltaWithinBudget: finite(resourceComparison?.candidateWakeDelta)
    && finite(resourceComparison?.wakeDeltaBudget)
    && resourceComparison.candidateWakeDelta <= resourceComparison.wakeDeltaBudget,
  heapDeltaWithinBudget: finite(resourceComparison?.candidateHeapDeltaBytes)
    && finite(resourceComparison?.heapDeltaBudgetBytes)
    && resourceComparison.candidateHeapDeltaBytes <= resourceComparison.heapDeltaBudgetBytes,
  restartAndRestoreMeasured: resourceComparison?.restartAndRestoreMeasured === true,
  privacy: resourceComparison?.rawContentPersisted === false,
}
const p4 = {
  status: allTrue(Object.values(p4Checks)) ? 'pass' : 'pending',
  checks: p4Checks,
  evidence: resourceComparison === undefined ? 'real baseline-versus-candidate resource comparison is not present' : 'holdout resourceComparison',
}

const processChecks = processEvidence?.checks ?? {}
const soakChecks = soak?.checks ?? {}
const supervisorSupplement = {
  processIntegration: processEvidence === undefined ? 'not-evaluated' : allTrue([
    processChecks.initialLeaseAcquired,
    processChecks.initialSnapshotDurable,
    processChecks.normalRestartRestoresSnapshot,
    processChecks.staleLeaseTakeover,
    processChecks.oldOwnerFenced,
    processChecks.delayedCallbackIdempotence,
    processChecks.corruptSnapshotFailSafe,
    processChecks.privacyBoundary,
    processChecks.rawContentPersisted === false,
  ]) ? 'pass' : 'pending',
  realElapsedSoak: soak === undefined ? 'not-evaluated' : allTrue([
    soakChecks.elapsedDuration,
    soakChecks.heartbeatObserved,
    soakChecks.snapshotsObserved,
    soakChecks.stateWithinBudget,
    soakChecks.boundedSessions,
    soakChecks.leaseReleased,
    soakChecks.privacyBoundary,
    soakChecks.rawContentPersisted === false,
    soakChecks.interrupted === false,
  ]) ? 'pass' : 'pending',
}

// A P1 that passes every check is a pass with an explicit target-fix scope; the scope stays
// visible instead of silently downgrading the gate to a non-passing status.
const PASSING_GATE_STATUSES = new Set(['pass', 'pass-with-scope'])
const gateStatuses = [p1.status, p2.status, p3.status, p4.status]
const gatesPass = gateStatuses.every(status => PASSING_GATE_STATUSES.has(status))
const identityBindingPass = identityBinding.status === 'pass'
const evaluationPassed = gatesPass && identityBindingPass

// Local adoption or rollback is read only from an explicit --adoption record. The evaluator never
// writes an adoption record, and a missing, invalid, or conflicting record leaves the candidate
// evaluated but not adopted.
const ADOPTION_TIME_KEYS = ['recordedAt', 'adoptedAt', 'rolledBackAt', 'decidedAt', 'occurredAt', 'timestamp', 'time', 'at']
function adoptionValues(input, keys) {
  const values = []
  if (!isPlainObject(input)) return values
  for (const container of [input, input.candidate, input.identity, input.candidateIdentity]) {
    if (!isPlainObject(container)) continue
    for (const key of keys) {
      const value = container[key]
      if (value === undefined || value === null) continue
      values.push(value)
    }
  }
  return values
}

function evaluateAdoption(record) {
  if (!record.supplied) {
    return {
      supplied: false,
      status: 'not-supplied',
      action: null,
      recordedAt: null,
      reasons: ['explicit-adoption-record-not-supplied'],
    }
  }
  if (record.unreadable) {
    return {
      supplied: true,
      status: 'invalid',
      action: null,
      recordedAt: null,
      reasons: ['adoption-record-could-not-be-read-as-json'],
    }
  }
  const input = record.value
  if (!isPlainObject(input)) {
    return {
      supplied: true,
      status: 'invalid',
      action: null,
      recordedAt: null,
      reasons: ['adoption-record-is-not-a-json-object'],
    }
  }
  const reasons = []
  let conflicting = false
  const actions = distinct(adoptionValues(input, ['action']))
  const action = actions.length === 1 && (actions[0] === 'adopt' || actions[0] === 'rollback') ? actions[0] : null
  if (actions.length === 0) reasons.push('adoption-record-missing-action')
  else if (actions.length > 1) {
    reasons.push('adoption-record-declares-conflicting-action')
    conflicting = true
  } else if (action === null) reasons.push('adoption-action-must-be-adopt-or-rollback')
  const times = distinct(adoptionValues(input, ADOPTION_TIME_KEYS))
  const recordedAt = times.length === 1 && isoTimestamp(times[0]) ? times[0] : null
  if (times.length === 0) reasons.push('adoption-record-missing-recorded-at')
  else if (times.length > 1) {
    reasons.push('adoption-record-declares-conflicting-recorded-at')
    conflicting = true
  } else if (recordedAt === null) reasons.push('adoption-recorded-at-is-not-a-valid-timestamp')

  const entries = collectIdentityEntries(input)
  const versionValues = distinct(entries.filter(entry => entry.field === 'pluginVersion').map(entry => entry.value))
  if (versionValues.length === 0) reasons.push('adoption-record-missing-candidate-version')
  else if (versionValues.length > 1) {
    reasons.push('adoption-record-declares-conflicting-candidate-version')
    conflicting = true
  } else if (candidateVersion === null || versionValues[0] !== candidateVersion) {
    reasons.push('adoption-candidate-version-does-not-match-candidate-identity')
    conflicting = true
  }
  let matchedIdentityHash = false
  for (const field of ['sourceCommit', 'codeHash', 'packageSha256', 'settingsSha256']) {
    const values = distinct(entries.filter(entry => entry.field === field).map(entry => entry.value))
    if (values.length === 0) continue
    if (!IDENTITY_VALIDATORS[field](values[0] ?? null)) {
      reasons.push(`adoption-${field}-is-malformed`)
      continue
    }
    if (values.length > 1) {
      reasons.push(`adoption-record-declares-conflicting-${field}`)
      conflicting = true
      continue
    }
    if (!validReferenceField(field)) {
      reasons.push(`adoption-record-declares-${field}-absent-from-candidate-identity`)
      conflicting = true
      continue
    }
    if (values[0] !== declaredReferenceFields[field]) {
      reasons.push(`adoption-${field}-does-not-match-candidate-identity`)
      conflicting = true
      continue
    }
    matchedIdentityHash = true
  }
  if (!matchedIdentityHash) reasons.push('adoption-record-missing-matching-candidate-identity-hash')

  const verdict = reasons.length === 0 ? 'verified' : conflicting ? 'conflicting' : 'invalid'
  return {
    supplied: true,
    status: verdict,
    action: action ?? (typeof actions[0] === 'string' ? actions[0] : null),
    recordedAt,
    reasons: sorted(reasons),
  }
}

const adoptionRecord = evaluateAdoption(await loadAdoptionRecord(adoptionPath))
const adoptionApplied = adoptionRecord.status === 'verified' && evaluationPassed
const localAdoption = {
  input: adoptionPath === undefined ? null : path.relative(root, adoptionPath),
  supplied: adoptionRecord.supplied,
  status: adoptionRecord.status,
  action: adoptionRecord.action,
  recordedAt: adoptionRecord.recordedAt,
  applied: adoptionApplied,
  reasons: sorted([
    ...adoptionRecord.reasons,
    ...(adoptionRecord.status === 'verified' && !evaluationPassed ? ['candidate-evaluation-not-passed'] : []),
  ]),
}

let status
let decision
if (!evaluationPassed) {
  status = 'insufficient-evidence'
  decision = 'hold-for-missing-gates'
} else if (adoptionApplied && localAdoption.action === 'rollback') {
  status = 'rolled-back'
  decision = 'local-rollback-recorded'
} else if (adoptionApplied && localAdoption.action === 'adopt') {
  status = 'locally-adopted'
  decision = 'local-adoption-recorded'
} else {
  status = 'evaluation-passed'
  decision = 'ready-for-local-adoption'
}

const conclusionByStatus = {
  'insufficient-evidence': 'The candidate remains held until every promotion gate and the candidate identity binding have evidence: missing measurements and unbound or conflicting identities stay pending rather than being inferred from activity or test volume.',
  'evaluation-passed': 'The candidate passed every promotion gate at one bound candidate identity; this is an evaluation result only and is ready for an explicit local adoption decision that this evaluator does not make.',
  'locally-adopted': 'The candidate passed every promotion gate and an explicit local adoption record matches the evaluated candidate identity.',
  'rolled-back': 'The candidate passed every promotion gate and an explicit local rollback record matches the evaluated candidate identity.',
}

const report = {
  schemaVersion: 1,
  reportId: `u4-candidate-${new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14)}`,
  pluginVersion: packageJson.version,
  candidate: {
    sourceClass: discovery?.discovery?.sourceClass ?? discovery?.sourceClass ?? 'unknown',
    pluginVersion: candidateVersion,
    sourceCommit: candidateSourceCommit,
    codeHash: candidateCodeHash,
    packageSha256: candidatePackageSha256,
    settingsSha256: candidateSettingsSha256,
    identityComplete: identityBindingPass,
    versionMatchesEvaluatedCheckout: candidateVersion !== null && candidateVersion === packageJson.version,
    sourceCommitMatchesEvaluatedCheckout: candidateSourceCommit !== null && sourceCommit !== '' && candidateSourceCommit === sourceCommit,
  },
  separation: {
    discoveryRunId: discoveryId,
    holdoutRunId: holdoutId,
    discoveryTaskRef: taskRefHex(discoveryTaskRef) ? discoveryTaskRef : null,
    holdoutTaskRef: taskRefHex(holdoutTaskRef) ? holdoutTaskRef : null,
    taskRefsDistinct,
    independent: p1Checks.independentHoldout,
    frozenGold: gold?.suiteId ?? null,
  },
  promotionGates: { P1TargetFix: p1, P2SafetyNoRegression: p2, P3AttentionBudgetNoRegression: p3, P4ResourceNoRegression: p4 },
  identityBinding,
  supervisorSupplement,
  status,
  decision,
  localAdoption,
  evidenceDigests: {
    discovery: await digest(discoveryPath),
    holdout: await digest(holdoutPath),
    gold: await digest(goldPath),
    goldResult: await digest(goldResultPath),
    replay: await digest(replayPath),
    processIntegration: await digest(processPath),
    realElapsedSoak: await digest(soakPath),
    adoption: await digest(adoptionPath),
  },
  identity: {
    sourceCommit: sourceCommit || 'unknown',
    worktreeDirty,
    pluginVersion: packageJson.version,
    evaluatorVersion: 'u4-candidate.v2',
  },
  privacy: {
    rawContentPersisted: false,
    promptTranscriptModelOutputToolArgsCredentialsAndCompletePathsIncluded: false,
  },
  generatedAt: new Date().toISOString(),
  conclusion: conclusionByStatus[status],
}

await mkdir(path.dirname(outputPath), { recursive: true })
await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8')
console.log(JSON.stringify({
  outputPath,
  status: report.status,
  decision: report.decision,
  gates: Object.fromEntries(Object.entries(report.promotionGates).map(([key, value]) => [key, value.status])),
  identityBinding: report.identityBinding.status,
  identityBindingReasons: report.identityBinding.reasons,
  localAdoption: { status: report.localAdoption.status, action: report.localAdoption.action, applied: report.localAdoption.applied },
  supervisorSupplement,
}, null, 2))
