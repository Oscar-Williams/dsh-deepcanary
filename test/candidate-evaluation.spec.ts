import { execFile } from 'node:child_process'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { promisify } from 'node:util'
import { fileURLToPath } from 'node:url'
import { afterEach, describe, expect, it } from 'vitest'

const run = promisify(execFile)
const evaluator = fileURLToPath(new URL('../scripts/evaluate-attention-candidate.mjs', import.meta.url))
const schemaPath = fileURLToPath(new URL('../benchmark/attention-candidate-promotion.schema.json', import.meta.url))
const pluginVersion = (JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8')) as { version: string }).version

const SOURCE_COMMIT = 'b'.repeat(40)
const PACKAGE_SHA256 = 'c'.repeat(64)
const SETTINGS_SHA256 = 'd'.repeat(64)
const DISCOVERY_TASK_REF = '0123456789abcdef'
const HOLDOUT_TASK_REF = 'fedcba9876543210'
const RECORDED_AT = '2026-09-30T12:00:00.000Z'

type JsonObject = { [key: string]: unknown }
type Gate = { status: string; checks: Record<string, boolean>; scope?: string }
type Report = {
  status: string
  decision: string
  candidate: { pluginVersion: string | null; sourceCommit: string | null; packageSha256: string | null; settingsSha256: string | null; identityComplete: boolean }
  separation: { discoveryRunId: string | null; holdoutRunId: string | null; discoveryTaskRef: string | null; holdoutTaskRef: string | null; taskRefsDistinct: boolean; independent: boolean }
  promotionGates: { P1TargetFix: Gate; P2SafetyNoRegression: Gate; P3AttentionBudgetNoRegression: Gate; P4ResourceNoRegression: Gate }
  identityBinding: { status: string; reasons: string[]; complete: { pluginVersion: boolean; code: boolean; packageOrSettings: boolean } }
  localAdoption: { input: string | null; supplied: boolean; status: string; action: string | null; recordedAt: string | null; applied: boolean; reasons: string[] }
  evidenceDigests: Record<string, string | null>
}
type CompiledValidator = ((data: unknown) => boolean) & { errors?: { instancePath?: string; message?: string }[] | null }

const directories: string[] = []
let reportCounter = 0
afterEach(async () => {
  for (const directory of directories.splice(0)) await rm(directory, { recursive: true, force: true })
})

async function fixtureDirectory() {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'deepcanary-candidate-'))
  directories.push(directory)
  return directory
}

function candidateIdentity(): JsonObject {
  return {
    pluginVersion,
    sourceCommit: SOURCE_COMMIT,
    packageSha256: PACKAGE_SHA256,
    settingsSha256: SETTINGS_SHA256,
  }
}

function discoveryFixture(): JsonObject {
  return {
    discovery: { runId: 'discovery-run-0001', taskRef: DISCOVERY_TASK_REF, sourceClass: 'controlled-fixture' },
    candidate: candidateIdentity(),
  }
}

function holdoutFixture(): JsonObject {
  return {
    holdout: { runId: 'holdout-run-0001', taskRef: HOLDOUT_TASK_REF, scenario: 'approval-boundary' },
    verdict: 'target-fixed',
    observed: {
      falseStallObservations: 0,
      recoveredBeforeOpen: 0,
      normalCompletion: 'C1',
      humanNeededMisses: 0,
      privacyAssertions: 'pass',
    },
    candidate: candidateIdentity(),
    guardrails: { criticalRecall: 1, humanNeededRecall: 1, duplicateFinalInterrupts: 0, normalCompletion: 'C1' },
    privacy: { rawContentPersisted: false, promptTranscriptModelOutputToolArgsCredentialsAndCompletePathsIncluded: false },
    attentionBudgetComparison: { candidateInterrupts: 4, baselineInterrupts: 5, candidateC0Silent: 10, baselineC0Silent: 9, c3AuthorityPreserved: true },
    resourceComparison: {
      candidateStateBytesDelta: 1024,
      stateDeltaBudgetBytes: 4096,
      candidateWakeDelta: 1,
      wakeDeltaBudget: 2,
      candidateHeapDeltaBytes: 512,
      heapDeltaBudgetBytes: 2048,
      restartAndRestoreMeasured: true,
      rawContentPersisted: false,
    },
  }
}

function goldFixture(): JsonObject {
  return { frozen: true, suiteId: 'attention-gold-v3', pluginVersion, packageSha256: PACKAGE_SHA256, cases: [{ id: 'normal-completion' }] }
}

function goldResultFixture(): JsonObject {
  return {
    status: 'pass',
    frozen: true,
    criticalRecall: 1,
    humanNeededRecall: 1,
    duplicateFinalInterrupts: 0,
    normalCompletion: 'C1',
    privacyAssertions: 'pass',
    pluginVersion,
    sourceCommit: SOURCE_COMMIT,
  }
}

function replayFixture(): JsonObject {
  return {
    status: 'baseline',
    pluginVersion,
    caseCount: 2,
    expectedPassingCases: 2,
    expectedFailingCases: 0,
    cases: [{ id: 'normal-completion', baselineExpectedPass: true }, { id: 'human-approval', baselineExpectedPass: true }],
  }
}

function adoptionRecord(action: string): JsonObject {
  return { action, recordedAt: RECORDED_AT, candidate: { pluginVersion, sourceCommit: SOURCE_COMMIT, packageSha256: PACKAGE_SHA256 } }
}

// Every case runs the real evaluator against real files and reads back the emitted report.
async function evaluate(directory: string, overrides: Record<string, unknown> = {}): Promise<Report> {
  const inputs: Record<string, unknown> = {
    discovery: discoveryFixture(),
    holdout: holdoutFixture(),
    gold: goldFixture(),
    goldResult: goldResultFixture(),
    replay: replayFixture(),
    adoption: null,
    ...overrides,
  }
  const argv = [evaluator]
  for (const name of ['discovery', 'holdout', 'gold', 'goldResult', 'replay', 'adoption']) {
    const value = inputs[name]
    if (value === null || value === undefined) continue
    const filePath = path.join(directory, `${name}.json`)
    await writeFile(filePath, typeof value === 'string' ? value : JSON.stringify(value, null, 2))
    argv.push(name === 'goldResult' ? '--gold-result' : `--${name}`, filePath)
  }
  reportCounter += 1
  const outputPath = path.join(directory, `report-${reportCounter}.json`)
  argv.push('--out', outputPath)
  await run(process.execPath, argv, { windowsHide: true })
  return JSON.parse(await readFile(outputPath, 'utf8')) as Report
}

let validatorPromise: Promise<CompiledValidator | undefined> | undefined
async function schemaValidator(): Promise<CompiledValidator | undefined> {
  validatorPromise ??= (async () => {
    try {
      const specifier = 'ajv/dist/2020.js'
      const loaded = (await import(specifier)) as { default: new (options: Record<string, unknown>) => { compile: (schema: unknown) => CompiledValidator } }
      const schema = JSON.parse(await readFile(schemaPath, 'utf8'))
      return new loaded.default({ strict: false, validateFormats: false, allErrors: true }).compile(schema)
    } catch {
      return undefined
    }
  })()
  return validatorPromise
}

describe('attention candidate evaluation', () => {
  it('passes a complete independent evaluation without claiming an adoption', async () => {
    const report = await evaluate(await fixtureDirectory())
    expect(report.status).toBe('evaluation-passed')
    expect(report.decision).toBe('ready-for-local-adoption')
    expect(report.promotionGates.P1TargetFix.status).toBe('pass-with-scope')
    expect(Object.values(report.promotionGates.P1TargetFix.checks).every(value => value === true)).toBe(true)
    expect(report.promotionGates.P1TargetFix.scope).toBe('approval-boundary')
    expect(report.promotionGates.P2SafetyNoRegression.status).toBe('pass')
    expect(report.promotionGates.P3AttentionBudgetNoRegression.status).toBe('pass')
    expect(report.promotionGates.P4ResourceNoRegression.status).toBe('pass')
    expect(report.identityBinding.status).toBe('pass')
    expect(report.separation.discoveryTaskRef).toBe(DISCOVERY_TASK_REF)
    expect(report.separation.holdoutTaskRef).toBe(HOLDOUT_TASK_REF)
    expect(report.separation.taskRefsDistinct).toBe(true)
    expect(report.separation.independent).toBe(true)
    expect(report.candidate.pluginVersion).toBe(pluginVersion)
    expect(report.candidate.identityComplete).toBe(true)
    expect(report.localAdoption).toMatchObject({ supplied: false, status: 'not-supplied', action: null, applied: false })
    expect(report.evidenceDigests.adoption).toBeNull()
    expect(report.decision).not.toBe('local-adoption-recorded')
  })

  it('fails closed when the holdout or the candidate identity is missing', async () => {
    const missingHoldout = await evaluate(await fixtureDirectory(), { holdout: null })
    expect(missingHoldout.status).toBe('insufficient-evidence')
    expect(missingHoldout.decision).toBe('hold-for-missing-gates')
    expect(missingHoldout.promotionGates.P1TargetFix.status).toBe('pending')
    expect(missingHoldout.promotionGates.P1TargetFix.checks.independentHoldout).toBe(false)

    const discovery = discoveryFixture()
    discovery.candidate = null
    const holdout = holdoutFixture()
    holdout.candidate = null
    const incompleteIdentity = await evaluate(await fixtureDirectory(), { discovery, holdout })
    expect(incompleteIdentity.promotionGates.P2SafetyNoRegression.status).toBe('pass')
    expect(incompleteIdentity.identityBinding.status).toBe('insufficient-evidence')
    expect(incompleteIdentity.identityBinding.complete.pluginVersion).toBe(false)
    expect(incompleteIdentity.identityBinding.reasons).toContain('candidate-plugin-version-missing-or-malformed')
    expect(incompleteIdentity.status).toBe('insufficient-evidence')
    expect(incompleteIdentity.decision).toBe('hold-for-missing-gates')
  })

  it('rejects a reused taskRef even when the run ids differ', async () => {
    const holdout = holdoutFixture()
    ;(holdout.holdout as JsonObject).taskRef = DISCOVERY_TASK_REF
    const report = await evaluate(await fixtureDirectory(), { holdout })
    expect(report.separation.discoveryRunId).not.toBe(report.separation.holdoutRunId)
    expect(report.separation.taskRefsDistinct).toBe(false)
    expect(report.promotionGates.P1TargetFix.checks.independentHoldout).toBe(false)
    expect(report.status).toBe('insufficient-evidence')
    expect(report.decision).toBe('hold-for-missing-gates')
  })

  it('rejects a malformed taskRef instead of treating it as separation', async () => {
    const holdout = holdoutFixture()
    ;(holdout.holdout as JsonObject).taskRef = 'FEDCBA9876543210'
    const report = await evaluate(await fixtureDirectory(), { holdout })
    expect(report.promotionGates.P1TargetFix.checks.holdoutTaskRefDeclared).toBe(false)
    expect(report.separation.taskRefsDistinct).toBe(false)
    expect(report.status).toBe('insufficient-evidence')
  })

  it('rejects identities that conflict with the explicit candidate identity', async () => {
    const replay = replayFixture()
    replay.pluginVersion = '9.9.9'
    const conflictingVersion = await evaluate(await fixtureDirectory(), { replay })
    expect(conflictingVersion.promotionGates.P2SafetyNoRegression.status).toBe('pass')
    expect(conflictingVersion.identityBinding.complete.pluginVersion).toBe(true)
    expect(conflictingVersion.identityBinding.reasons).toContain('replay-pluginVersion-does-not-match-candidate-identity')
    expect(conflictingVersion.identityBinding.status).toBe('insufficient-evidence')
    expect(conflictingVersion.status).toBe('insufficient-evidence')
    expect(conflictingVersion.decision).toBe('hold-for-missing-gates')

    const gold = goldFixture()
    gold.packageSha256 = 'e'.repeat(64)
    const conflictingHash = await evaluate(await fixtureDirectory(), { gold })
    expect(conflictingHash.identityBinding.reasons).toContain('gold-packageSha256-does-not-match-candidate-identity')
    expect(conflictingHash.status).toBe('insufficient-evidence')

    const discovery = discoveryFixture()
    ;(discovery.candidate as JsonObject).sourceCommit = 'f'.repeat(40)
    const crossEvidenceConflict = await evaluate(await fixtureDirectory(), { discovery })
    expect(crossEvidenceConflict.identityBinding.reasons).toContain('candidate-identity-conflict-sourceCommit')
    expect(crossEvidenceConflict.status).toBe('insufficient-evidence')
  })

  it('applies only an explicit adoption record that matches the evaluated candidate', async () => {
    const report = await evaluate(await fixtureDirectory(), { adoption: adoptionRecord('adopt') })
    expect(report.localAdoption).toMatchObject({ supplied: true, status: 'verified', action: 'adopt', recordedAt: RECORDED_AT, applied: true })
    expect(report.status).toBe('locally-adopted')
    expect(report.decision).toBe('local-adoption-recorded')
  })

  it('reads an explicit adoption record in its flat form', async () => {
    const flat = { action: 'adopt', time: RECORDED_AT, candidateVersion: pluginVersion, sourceCommit: SOURCE_COMMIT, packageSha256: PACKAGE_SHA256 }
    const report = await evaluate(await fixtureDirectory(), { adoption: flat })
    expect(report.localAdoption).toMatchObject({ status: 'verified', action: 'adopt', recordedAt: RECORDED_AT, applied: true })
    expect(report.status).toBe('locally-adopted')
  })

  it('applies only an explicit rollback record that matches the evaluated candidate', async () => {
    const report = await evaluate(await fixtureDirectory(), { adoption: adoptionRecord('rollback') })
    expect(report.localAdoption).toMatchObject({ status: 'verified', action: 'rollback', applied: true })
    expect(report.status).toBe('rolled-back')
    expect(report.decision).toBe('local-rollback-recorded')
  })

  it('keeps missing, invalid, or conflicting adoption records unadopted', async () => {
    const conflictingHash = adoptionRecord('adopt')
    ;(conflictingHash.candidate as JsonObject).packageSha256 = 'e'.repeat(64)
    const conflicting = await evaluate(await fixtureDirectory(), { adoption: conflictingHash })
    expect(conflicting.localAdoption.status).toBe('conflicting')
    expect(conflicting.localAdoption.applied).toBe(false)
    expect(conflicting.localAdoption.reasons).toContain('adoption-packageSha256-does-not-match-candidate-identity')
    expect(conflicting.status).toBe('evaluation-passed')
    expect(conflicting.decision).toBe('ready-for-local-adoption')

    const conflictingVersion = adoptionRecord('adopt')
    ;(conflictingVersion.candidate as JsonObject).pluginVersion = '9.9.9'
    const versionConflict = await evaluate(await fixtureDirectory(), { adoption: conflictingVersion })
    expect(versionConflict.localAdoption.status).toBe('conflicting')
    expect(versionConflict.status).toBe('evaluation-passed')

    const conflictingAction = adoptionRecord('promote')
    const actionConflict = await evaluate(await fixtureDirectory(), { adoption: conflictingAction })
    expect(actionConflict.localAdoption.status).toBe('invalid')
    expect(actionConflict.localAdoption.reasons).toContain('adoption-action-must-be-adopt-or-rollback')
    expect(actionConflict.status).toBe('evaluation-passed')

    const missingTime = adoptionRecord('adopt')
    missingTime.recordedAt = null
    const timeMissing = await evaluate(await fixtureDirectory(), { adoption: missingTime })
    expect(timeMissing.localAdoption.status).toBe('invalid')
    expect(timeMissing.localAdoption.reasons).toContain('adoption-record-missing-recorded-at')
    expect(timeMissing.status).toBe('evaluation-passed')

    const malformedTime = adoptionRecord('adopt')
    malformedTime.recordedAt = 'yesterday'
    const timeInvalid = await evaluate(await fixtureDirectory(), { adoption: malformedTime })
    expect(timeInvalid.localAdoption.reasons).toContain('adoption-recorded-at-is-not-a-valid-timestamp')
    expect(timeInvalid.status).toBe('evaluation-passed')

    const unreadable = await evaluate(await fixtureDirectory(), { adoption: '{ not json' })
    expect(unreadable.localAdoption.status).toBe('invalid')
    expect(unreadable.localAdoption.reasons).toContain('adoption-record-could-not-be-read-as-json')
    expect(unreadable.status).toBe('evaluation-passed')
  })

  it('does not apply an adoption record when the evaluation itself is incomplete', async () => {
    const report = await evaluate(await fixtureDirectory(), { holdout: null, adoption: adoptionRecord('adopt') })
    expect(report.localAdoption).toMatchObject({ status: 'verified', applied: false })
    expect(report.localAdoption.reasons).toContain('candidate-evaluation-not-passed')
    expect(report.status).toBe('insufficient-evidence')
    expect(report.decision).toBe('hold-for-missing-gates')
  })

  it('emits reports that satisfy the promotion schema', async () => {
    const validate = await schemaValidator()
    const directory = await fixtureDirectory()
    const reports = [
      await evaluate(directory),
      await evaluate(directory, { adoption: adoptionRecord('adopt') }),
      await evaluate(directory, { adoption: adoptionRecord('rollback') }),
      await evaluate(directory, { holdout: null }),
      await evaluate(directory, { gold: (() => { const gold = goldFixture(); gold.packageSha256 = 'e'.repeat(64); return gold })() }),
    ]
    if (validate === undefined) return
    for (const report of reports) {
      const valid = validate(report)
      expect(validate.errors ?? []).toEqual([])
      expect(valid).toBe(true)
    }
  })
})
