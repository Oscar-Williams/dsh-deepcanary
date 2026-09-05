import { createHash } from 'node:crypto'
import { access, mkdir, readFile, writeFile } from 'node:fs/promises'
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
const outputPath = path.resolve(root, args.get('out') ?? 'output/gates/u4-candidate-promotion.json')
const packageJson = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'))

async function loadOptional(filePath) {
  if (filePath === undefined) return undefined
  try { return JSON.parse(await readFile(filePath, 'utf8')) } catch { return undefined }
}

async function digest(filePath) {
  if (filePath === undefined) return null
  try { return createHash('sha256').update(await readFile(filePath)).digest('hex') } catch { return null }
}

async function command(name, commandArgs) {
  try { return (await execFileAsync(name, commandArgs, { cwd: root, maxBuffer: 2_000_000 })).stdout.trim() } catch { return '' }
}

function bool(value) { return value === true }
function finite(value) { return typeof value === 'number' && Number.isFinite(value) }
function allTrue(values) { return values.every(value => value === true) }

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
const candidateIdentity = holdout?.candidate ?? holdout?.identity ?? {}

const p1Checks = {
  independentHoldout: Boolean(discoveryId && holdoutId && discoveryId !== holdoutId),
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

const gateStatuses = [p1.status, p2.status, p3.status, p4.status]
const allGatesPass = gateStatuses.every(status => status === 'pass')
const sourceCommit = await command('git', ['rev-parse', 'HEAD'])
const worktreeDirty = Boolean(await command('git', ['status', '--porcelain', '--untracked-files=all']))
const report = {
  schemaVersion: 1,
  reportId: `u4-candidate-${new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14)}`,
  pluginVersion: packageJson.version,
  candidate: {
    sourceClass: discovery?.discovery?.sourceClass ?? discovery?.sourceClass ?? 'unknown',
    pluginVersion: candidateIdentity.pluginVersion ?? packageJson.version,
    sourceCommit: candidateIdentity.sourceCommit ?? candidateIdentity.pluginSourceCommit ?? sourceCommit,
    packageSha256: candidateIdentity.packageSha256 ?? null,
    settingsSha256: holdout?.candidate?.candidateSettingsSha256 ?? holdout?.candidate?.candidateSha256 ?? null,
  },
  separation: {
    discoveryRunId: discoveryId,
    holdoutRunId: holdoutId,
    independent: p1Checks.independentHoldout,
    frozenGold: gold?.suiteId ?? null,
  },
  promotionGates: { P1TargetFix: p1, P2SafetyNoRegression: p2, P3AttentionBudgetNoRegression: p3, P4ResourceNoRegression: p4 },
  supervisorSupplement,
  status: allGatesPass ? 'promoted-after-manual-adoption' : 'not-promoted',
  decision: allGatesPass ? 'promote' : 'hold-for-missing-gates',
  evidenceDigests: {
    discovery: await digest(discoveryPath),
    holdout: await digest(holdoutPath),
    gold: await digest(goldPath),
    goldResult: await digest(goldResultPath),
    replay: await digest(replayPath),
    processIntegration: await digest(processPath),
    realElapsedSoak: await digest(soakPath),
  },
  identity: {
    sourceCommit: sourceCommit || 'unknown',
    worktreeDirty,
    pluginVersion: packageJson.version,
    evaluatorVersion: 'u4-candidate.v1',
  },
  privacy: {
    rawContentPersisted: false,
    promptTranscriptModelOutputToolArgsCredentialsAndCompletePathsIncluded: false,
  },
  generatedAt: new Date().toISOString(),
  conclusion: allGatesPass
    ? 'The candidate passed all four promotion gates and is ready for explicit manual adoption with rollback monitoring.'
    : 'The candidate remains held until every promotion gate has evidence at the same candidate identity; missing measurements remain pending rather than being inferred from activity or test volume.',
}

await mkdir(path.dirname(outputPath), { recursive: true })
await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8')
console.log(JSON.stringify({ outputPath, status: report.status, gates: Object.fromEntries(Object.entries(report.promotionGates).map(([key, value]) => [key, value.status])), supervisorSupplement }, null, 2))
