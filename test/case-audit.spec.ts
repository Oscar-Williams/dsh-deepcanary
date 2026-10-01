import { execFile } from 'node:child_process'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { promisify } from 'node:util'
import { fileURLToPath } from 'node:url'
import { afterEach, describe, expect, it } from 'vitest'

const run = promisify(execFile)
const auditScript = fileURLToPath(new URL('../scripts/audit-attention-cases.mjs', import.meta.url))

type JsonObject = { [key: string]: unknown }
type Delivery = { userFacingUnits: number; visibleUnits: number; unknownVisibilityUnits: number; constructedOnlyUnits: number; visibleBySource: { inboxMaterialized: number; osObserved: number; userConfirmed: number } }
type NegativeOpportunity = { count: number; reviewed: number; unreviewed: number }
type RunRecord = {
  runId: string
  trialId: string
  pluginVersion: string
  runtimeTag: string
  taskOrigin: string
  taskRef: string | null
  taskRefPresent: boolean
  naturalQualified: boolean
  provenance: string
  captureMode: string
  observationCount: number
  reviewedObservations: number
  qualifiedReviews: number
  caseCount: number
  confirmedCaseCount: number
  pendingCaseCount: number
  userFeedbackCases: number
  userFeedback: { explicit: number; useful: number; notUseful: number; unrated: number }
  sourceHashes: string[]
  delivery: Delivery
  negativeOpportunities: Record<string, NegativeOpportunity>
}
type CaseRecord = {
  caseId: string
  category: string
  group: string
  detectedBy: string[]
  reviewState: string
  review: { label: string | null; policyReview: string | null; reviewSource: string | null; reviewBasis: string | null; qualified: boolean }
  rootCause: string
  modelNeedInferred: boolean
  engineeringReview: JsonObject[]
  userFeedback: { value: string; countedAsFeedback: boolean }[]
  observedDecision: { level: string | null; action: string | null; reasonCode: string | null } | null
}
type SourceRecord = { sha256: string | null; status: string; kind: string | null; occurrences: number; bundleCount: number; runIds: string[]; provenance: string | null; reasonCode: string | null }
type AuditReport = {
  inputMode: { explicitInputs: number; inputDirectories: number; jsonFilesRead: number; nonJsonFilesIgnored: number; subdirectoriesIgnored: number; ignoredFlagCount: number }
  summary: {
    sourcesRead: number; validSources: number; invalidSources: number; bundleSources: number; aggregateSources: number
    bundles: number; runs: number; naturalRuns: number; observations: number; caseCount: number
    confirmedCaseCount: number; pendingCaseCount: number; taskFailureCases: number; alertingFailureCases: number
    engineeringReviewCases: number; userFeedbackExplicit: number; usefulFeedback: number; notUsefulFeedback: number
    contentDuplicates: number; runTrialDuplicates: number; conflicts: number; mixedAggregates: number
  }
  caseCountsByCategory: Record<string, number>
  sources: SourceRecord[]
  duplicates: { kind: string; sha256: string[]; runId: string | null; trialId: string | null; occurrences: number }[]
  conflicts: { kind: string; sha256: string[]; runId: string | null; trialId: string | null; observationRef: string | null; fields: string[] }[]
  runs: RunRecord[]
  cases: CaseRecord[]
  negativeOpportunities: Record<string, NegativeOpportunity>
  delivery: Delivery
  judgeEntry: { status: string; eligibleCaseCount: number; eligibleCases: string[]; confirmedRuleHardCases: number; naturalQualifiedCases: number; reasons: string[] }
  privacy: { rawContentPersisted: boolean; promptTranscriptModelOutputToolArgsCredentialsAndCompletePathsIncluded: boolean; sourcePathsIncluded: boolean; whitelistedFieldsOnly: boolean }
  conclusion: string
}

const directories: string[] = []
let reportCounter = 0
afterEach(async () => {
  for (const directory of directories.splice(0)) await rm(directory, { recursive: true, force: true })
})

async function fixtureDirectory(): Promise<string> {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'deepcanary-case-audit-'))
  directories.push(directory)
  return directory
}

function runRecord(overrides: JsonObject = {}): JsonObject {
  return {
    schemaVersion: 1,
    runId: 'run-default-01',
    trialId: 'trial-default-01',
    provenance: 'controlled',
    taskFamily: 'coding',
    scenario: 'approval-boundary',
    pluginVersion: '0.1.3-rc.1',
    runtimeTag: 'dsh-v0.1.3-alpha.1',
    policyVersion: 'attention-policy.v1',
    startedAt: '2026-09-30T00:00:00.000Z',
    captureMode: 'manual',
    rawContentPersisted: false,
    ...overrides,
  }
}

function observation(runId: string, overrides: JsonObject = {}): JsonObject {
  return {
    schemaVersion: 1,
    observationRef: '0000000000000001',
    runId,
    occurredAt: '2026-09-30T00:01:00.000Z',
    eventClass: 'human-needed',
    eventSubtype: 'approval',
    eventSource: 'tool',
    authority: 'runtime',
    phase: 'human-wait',
    decisionDisposition: 'inbox',
    deliveryChannel: 'inbox',
    ...overrides,
  }
}

function bundle(runOverrides: JsonObject = {}, observations: JsonObject[] = []): JsonObject {
  const run = runRecord(runOverrides)
  return { schemaVersion: 1, run, observations, receipts: [] }
}

function aggregate(bundles: JsonObject[]): JsonObject {
  return { schemaVersion: 1, aggregateId: 'aggregate-01', generatedAt: '2026-09-30T00:02:00.000Z', rawContentPersisted: false, bundles }
}

function naturalRun(overrides: JsonObject = {}): JsonObject {
  return { runId: 'run-natural-01', trialId: 'trial-natural-01', provenance: 'real', captureMode: 'service', taskOrigin: 'natural', taskRef: 'a'.repeat(16), ...overrides }
}

async function writeJson(directory: string, name: string, value: unknown): Promise<string> {
  const filePath = path.join(directory, name)
  await mkdir(path.dirname(filePath), { recursive: true })
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8')
  return filePath
}

async function audit(directory: string, argv: string[]): Promise<{ report: AuditReport; text: string; stdout: string }> {
  reportCounter += 1
  const outputPath = path.join(directory, `report-${reportCounter}.json`)
  const result = await run(process.execPath, [auditScript, ...argv, '--out', outputPath], { windowsHide: true })
  const text = await readFile(outputPath, 'utf8')
  return { report: JSON.parse(text) as AuditReport, text, stdout: result.stdout }
}

describe('sanitized attention case audit', () => {
  it('requires an explicit input source and never scans implicitly', async () => {
    const directory = await fixtureDirectory()
    await expect(run(process.execPath, [auditScript, '--out', path.join(directory, 'report.json')], { windowsHide: true }))
      .rejects.toThrow(/explicit --input file or --input-dir/)
  })

  it('reads a named bundle and classifies an aborted run as a task failure', async () => {
    const directory = await fixtureDirectory()
    const file = await writeJson(directory, 'run.json', bundle({ runId: 'run-aborted-01', trialId: 'trial-aborted-01' }, [
      observation('run-aborted-01', { eventClass: 'completion', eventSubtype: 'aborted', phase: 'completion', decisionDisposition: 'inbox' }),
    ]))
    const { report } = await audit(directory, ['--input', file])
    expect(report.summary.validSources).toBe(1)
    expect(report.summary.runs).toBe(1)
    expect(report.summary.taskFailureCases).toBe(1)
    expect(report.cases).toHaveLength(1)
    expect(report.cases[0]).toMatchObject({ category: 'TASK_ABORTED', group: 'task-failure', detectedBy: ['event-subtype'], reviewState: 'pending', rootCause: 'unknown', modelNeedInferred: false })
    expect(report.caseCountsByCategory.TASK_ABORTED).toBe(1)
    expect(report.judgeEntry.status).toBe('not-entered')
  })

  it('never upgrades a controlled or unlabelled source to a natural run', async () => {
    const directory = await fixtureDirectory()
    const controlled = bundle({ runId: 'run-controlled-01', trialId: 'trial-controlled-01', provenance: 'controlled', captureMode: 'service', taskOrigin: 'natural', taskRef: 'b'.repeat(16) })
    const unlabelled = bundle({ runId: 'run-unlabelled-01', trialId: 'trial-unlabelled-01', provenance: 'real', captureMode: 'service' })
    const missingRef = bundle({ runId: 'run-missing-ref-01', trialId: 'trial-missing-ref-01', provenance: 'real', captureMode: 'service', taskOrigin: 'natural' })
    const manual = bundle(naturalRun({ runId: 'run-manual-01', trialId: 'trial-manual-01', captureMode: 'manual' }))
    const real = bundle(naturalRun({ runId: 'run-real-01', trialId: 'trial-real-01' }))
    await writeJson(directory, 'real-natural-task-001.json', controlled)
    await writeJson(directory, 'unlabelled.json', unlabelled)
    await writeJson(directory, 'missing-ref.json', missingRef)
    await writeJson(directory, 'manual.json', manual)
    await writeJson(directory, 'real.json', real)
    const { report } = await audit(directory, ['--input-dir', directory])
    const byId = new Map(report.runs.map(record => [record.runId, record]))
    expect(byId.get('run-controlled-01')?.naturalQualified).toBe(false)
    expect(byId.get('run-unlabelled-01')?.naturalQualified).toBe(false)
    expect(byId.get('run-missing-ref-01')?.naturalQualified).toBe(false)
    expect(byId.get('run-manual-01')?.naturalQualified).toBe(false)
    expect(byId.get('run-real-01')?.naturalQualified).toBe(true)
    expect(report.summary.naturalRuns).toBe(1)
    expect(byId.get('run-unlabelled-01')?.taskOrigin).toBe('unknown')
    expect(byId.get('run-unlabelled-01')?.taskRef).toBeNull()
    expect(byId.get('run-unlabelled-01')?.taskRefPresent).toBe(false)
  })

  it('splits a mixed aggregate into per-run records and keeps provenance honest', async () => {
    const directory = await fixtureDirectory()
    const mixed = aggregate([
      bundle(naturalRun({ runId: 'run-real-02', trialId: 'trial-real-02' })),
      bundle({ runId: 'run-controlled-02', trialId: 'trial-controlled-02', provenance: 'controlled', taskOrigin: 'controlled' }),
    ])
    const file = await writeJson(directory, 'mixed-aggregate.json', mixed)
    const { report } = await audit(directory, ['--input', file])
    expect(report.summary.aggregateSources).toBe(1)
    expect(report.summary.bundles).toBe(2)
    expect(report.summary.runs).toBe(2)
    expect(report.summary.naturalRuns).toBe(1)
    expect(report.summary.mixedAggregates).toBe(1)
    expect(report.sources[0]).toMatchObject({ status: 'valid', kind: 'aggregate', provenance: 'mixed', bundleCount: 2 })
    expect(report.runs.map(record => record.naturalQualified).sort()).toEqual([false, true])
  })

  it('counts a source, run, or trial once even when it is supplied twice', async () => {
    const directory = await fixtureDirectory()
    const first = bundle({ runId: 'run-duplicate-01', trialId: 'trial-duplicate-01', pluginVersion: '0.1.3-rc.1' }, [observation('run-duplicate-01')])
    const second = bundle({ runId: 'run-duplicate-01', trialId: 'trial-duplicate-01', pluginVersion: '0.1.3-rc.1' }, [
      observation('run-duplicate-01'),
      observation('run-duplicate-01', { observationRef: '0000000000000002', decisionDisposition: 'suppressed' }),
    ])
    const fileA = await writeJson(directory, 'run-a.json', first)
    const fileB = await writeJson(directory, 'run-b.json', second)
    const identical = await writeJson(directory, 'run-a-copy.json', first)
    const { report } = await audit(directory, ['--input', fileA, '--input', fileB, '--input', identical])
    expect(report.summary.runs).toBe(1)
    expect(report.summary.observations).toBe(2)
    expect(report.summary.runTrialDuplicates).toBe(1)
    expect(report.summary.contentDuplicates).toBe(1)
    expect(report.sources.find(source => source.occurrences === 2)?.status).toBe('valid')
    expect(report.runs[0]?.sourceHashes).toHaveLength(2)
  })

  it('flags a same run and trial identity that disagrees instead of merging it', async () => {
    const directory = await fixtureDirectory()
    const baseline = bundle({ runId: 'run-conflict-01', trialId: 'trial-conflict-01', pluginVersion: '0.1.3-rc.1' }, [observation('run-conflict-01')])
    const changed = bundle({ runId: 'run-conflict-01', trialId: 'trial-conflict-01', pluginVersion: '9.9.9' }, [observation('run-conflict-01')])
    const fileA = await writeJson(directory, 'baseline.json', baseline)
    const fileB = await writeJson(directory, 'changed.json', changed)
    const { report } = await audit(directory, ['--input', fileA, '--input', fileB])
    expect(report.summary.conflicts).toBe(1)
    expect(report.conflicts[0]).toMatchObject({ kind: 'run-trial-conflict', runId: 'run-conflict-01', trialId: 'trial-conflict-01', fields: ['pluginVersion'] })
    expect(report.summary.runs).toBe(1)
    expect(report.runs[0]?.pluginVersion).toBe('0.1.3-rc.1')
  })

  it('does not read directories, nested JSON, or non-JSON entries under --input-dir', async () => {
    const directory = await fixtureDirectory()
    await writeJson(directory, 'top.json', bundle({ runId: 'run-top-01', trialId: 'trial-top-01' }))
    await writeJson(directory, 'nested/deep.json', bundle({ runId: 'run-deep-01', trialId: 'trial-deep-01' }))
    await writeFile(path.join(directory, 'notes.txt'), 'not json', 'utf8')
    const { report } = await audit(directory, ['--input-dir', directory])
    expect(report.inputMode.subdirectoriesIgnored).toBeGreaterThanOrEqual(1)
    expect(report.inputMode.nonJsonFilesIgnored).toBeGreaterThanOrEqual(1)
    expect(report.summary.sourcesRead).toBe(1)
    expect(report.runs.map(record => record.runId)).toEqual(['run-top-01'])
  })

  it('only enters Judge for a natural-qualified run with a confirmed rule-hard case', async () => {
    const directory = await fixtureDirectory()
    const reviewed = observation('run-natural-03', {
      observationRef: '0000000000000011',
      decisionDisposition: 'suppressed',
      reviewLabel: 'missed-human-needed',
      reviewSource: 'engineering-review',
      reviewBasis: 'policy-expectation',
      reviewConfidence: 'high',
    })
    const natural = bundle(naturalRun({ runId: 'run-natural-03', trialId: 'trial-natural-03' }), [reviewed])
    const naturalFile = await writeJson(directory, 'natural-reviewed.json', natural)
    const ready = await audit(directory, ['--input', naturalFile])
    expect(ready.report.cases[0]).toMatchObject({ category: 'missed-human-needed', group: 'alerting-failure', reviewState: 'confirmed' })
    expect(ready.report.judgeEntry).toMatchObject({ status: 'requires-feasibility-review', eligibleCaseCount: 1 })
    expect(ready.report.judgeEntry.reasons).toContain('whitelisted-metadata-distinguishability-and-rule-insufficiency-not-proven')
    expect(ready.report.judgeEntry.eligibleCases).toHaveLength(1)

    const controlledReviewed = bundle({ runId: 'run-natural-03', trialId: 'trial-natural-03', provenance: 'controlled', captureMode: 'service', taskOrigin: 'natural', taskRef: 'a'.repeat(16) }, [reviewed])
    const controlledFile = await writeJson(directory, 'controlled-reviewed.json', controlledReviewed)
    const notNatural = await audit(directory, ['--input', controlledFile])
    expect(notNatural.report.judgeEntry).toMatchObject({ status: 'not-entered', eligibleCaseCount: 0, naturalQualifiedCases: 0 })

    const unqualified = observation('run-natural-03', { observationRef: '0000000000000011', decisionDisposition: 'suppressed', reviewLabel: 'missed-human-needed' })
    const unqualifiedFile = await writeJson(directory, 'unqualified.json', bundle(naturalRun({ runId: 'run-natural-03', trialId: 'trial-natural-03' }), [unqualified]))
    const pending = await audit(directory, ['--input', unqualifiedFile])
    expect(pending.report.cases[0]).toMatchObject({ reviewState: 'pending', rootCause: 'unknown' })
    expect(pending.report.judgeEntry).toMatchObject({ status: 'not-entered', confirmedRuleHardCases: 0, naturalQualifiedCases: 1 })
  })

  it('keeps engineering review, explicit user feedback, and unreviewed observations separate', async () => {
    const directory = await fixtureDirectory()
    const file = await writeJson(directory, 'reviews.json', bundle({ runId: 'run-review-01', trialId: 'trial-review-01' }, [
      observation('run-review-01', { observationRef: '0000000000000021', decisionDisposition: 'suppressed', reviewLabel: 'false-stall', reviewSource: 'engineering-review', reviewBasis: 'policy-expectation', reviewConfidence: 'medium' }),
      observation('run-review-01', { observationRef: '0000000000000022', decisionDisposition: 'interrupt', userFeedback: 'not-useful' }),
      observation('run-review-01', { observationRef: '0000000000000023', decisionDisposition: 'interrupt', userFeedback: 'unrated' }),
      observation('run-review-01', { observationRef: '0000000000000024', decisionDisposition: 'deduped' }),
    ]))
    const { report } = await audit(directory, ['--input', file])
    const falseStall = report.cases.find(record => record.category === 'false-stall')
    expect(falseStall).toMatchObject({ reviewState: 'confirmed' })
    expect(falseStall?.engineeringReview).toHaveLength(1)
    expect(falseStall?.engineeringReview[0]).toMatchObject({ reviewSource: 'engineering-review', reviewBasis: 'policy-expectation' })
    expect(falseStall?.userFeedback).toHaveLength(0)
    expect(report.summary.engineeringReviewCases).toBe(1)
    expect(report.runs[0]).toMatchObject({ userFeedback: { explicit: 2, useful: 0, notUseful: 1, unrated: 1 }, userFeedbackCases: 0 })
    expect(report.summary.userFeedbackExplicit).toBe(2)
    expect(report.summary.usefulFeedback).toBe(0)
    expect(report.summary.notUsefulFeedback).toBe(1)
    expect(report.summary.pendingCaseCount).toBe(0)
    expect(report.runs[0]?.reviewedObservations).toBe(3)
  })

  it('keeps C0, suppressed, deduped, and recovery-closed opportunities uninferred when unreviewed', async () => {
    const directory = await fixtureDirectory()
    const file = await writeJson(directory, 'negative.json', bundle({ runId: 'run-negative-01', trialId: 'trial-negative-01' }, [
      observation('run-negative-01', { observationRef: '0000000000000031', decisionDisposition: 'c0-silent', deliveryChannel: 'none' }),
      observation('run-negative-01', { observationRef: '0000000000000032', decisionDisposition: 'c0-silent', deliveryChannel: 'none', reviewLabel: 'correct-useful', reviewSource: 'engineering-review', reviewBasis: 'policy-expectation', reviewConfidence: 'low' }),
      observation('run-negative-01', { observationRef: '0000000000000033', decisionDisposition: 'suppressed', deliveryChannel: 'none' }),
      observation('run-negative-01', { observationRef: '0000000000000034', decisionDisposition: 'deduped', deliveryChannel: 'none' }),
      observation('run-negative-01', { observationRef: '0000000000000035', decisionDisposition: 'recovery-closed', deliveryChannel: 'none' }),
    ]))
    const { report } = await audit(directory, ['--input', file])
    expect(report.negativeOpportunities).toMatchObject({
      c0Silent: { count: 2, reviewed: 1, unreviewed: 1 },
      suppressed: { count: 1, reviewed: 0, unreviewed: 1 },
      deduped: { count: 1, reviewed: 0, unreviewed: 1 },
      recoveryClosed: { count: 1, reviewed: 0, unreviewed: 1 },
    })
    expect(report.runs[0]?.negativeOpportunities.c0Silent).toMatchObject({ count: 2, unreviewed: 1 })
    expect(report.cases).toHaveLength(0)
  })

  it('keeps visible and unknown delivery apart and never counts constructed as visible', async () => {
    const directory = await fixtureDirectory()
    const file = await writeJson(directory, 'delivery.json', bundle({ runId: 'run-delivery-01', trialId: 'trial-delivery-01' }, [
      observation('run-delivery-01', { observationRef: '0000000000000041', decisionDisposition: 'inbox', deliveryChannel: 'browser-notification', deliveryUnitRef: '1111111111111111', deliveryVisibility: { status: 'visible', source: 'browser-constructed' } }),
      observation('run-delivery-01', { observationRef: '0000000000000042', decisionDisposition: 'inbox', deliveryChannel: 'inbox', deliveryUnitRef: '2222222222222222', deliveryVisibility: { status: 'visible', source: 'inbox-materialized' } }),
      observation('run-delivery-01', { observationRef: '0000000000000043', decisionDisposition: 'interrupt', deliveryChannel: 'browser-notification', deliveryUnitRef: '3333333333333333' }),
    ]))
    const { report } = await audit(directory, ['--input', file])
    expect(report.delivery).toMatchObject({ userFacingUnits: 3, visibleUnits: 1, constructedOnlyUnits: 1, unknownVisibilityUnits: 1 })
    expect(report.delivery.visibleBySource).toMatchObject({ inboxMaterialized: 1, osObserved: 0, userConfirmed: 0 })
    expect(report.runs[0]?.delivery).toMatchObject({ visibleUnits: 1, constructedOnlyUnits: 1, unknownVisibilityUnits: 1 })
  })

  it('reports an invalid source by hash and status only, without copying content or paths', async () => {
    const directory = await fixtureDirectory()
    const secret = 'SECRET-PROMPT-TRANSCRIPT-CONTENT'
    const secretPath = 'C:/Users/secret-agent/transcripts/session-42.log'
    await writeFile(path.join(directory, 'invalid.json'), `{"prompt":"${secret}","sessionPath":"${secretPath}"`, 'utf8')
    const { report, text } = await audit(directory, ['--input-dir', directory])
    expect(report.summary.invalidSources).toBe(1)
    const invalid = report.sources.find(source => source.status === 'invalid')
    expect(invalid).toMatchObject({ status: 'invalid', reasonCode: 'unparseable-json', kind: null, bundleCount: 0 })
    expect(invalid?.sha256).toMatch(/^[a-f0-9]{64}$/)
    expect(text).not.toContain(secret)
    expect(text).not.toContain('secret-agent')
    expect(text).not.toContain('transcripts')
    expect(text).not.toContain('session-42')
    expect(text).not.toContain('sessionPath')
  })

  it('drops hostile text from otherwise valid bundles instead of leaking it', async () => {
    const directory = await fixtureDirectory()
    const hostile = bundle(
      { runId: 'run-hostile-01', trialId: 'trial-hostile-01', pluginVersion: 'C:/Users/secret-agent/v0.1.3', runtimeTag: 'dsh prompt transcript' },
      [observation('run-hostile-01', {
        eventClass: 'completion',
        eventSubtype: 'aborted secret transcript',
        phase: 'completion',
        decisionDisposition: 'dropped-event',
        observedDecision: { level: 'C1', action: 'INBOX', reasonCode: 'SECRET PROMPT TEXT' },
      })],
    )
    await writeJson(directory, 'hostile.json', hostile)
    const { report, text } = await audit(directory, ['--input-dir', directory])
    expect(report.summary.validSources).toBe(1)
    expect(report.runs[0]).toMatchObject({ pluginVersion: 'unknown', runtimeTag: 'unknown' })
    expect(report.cases[0]).toMatchObject({ category: 'dropped-event', eventSubtype: 'other' })
    expect(report.cases[0]?.observedDecision).toMatchObject({ level: 'C1', action: 'INBOX', reasonCode: null })
    expect(text).not.toContain('secret-agent')
    expect(text).not.toContain('C:/Users')
    expect(text).not.toContain('aborted secret transcript')
    expect(text).not.toContain('SECRET PROMPT TEXT')
    expect(text).not.toContain('dsh prompt transcript')
    expect(report.privacy).toMatchObject({ rawContentPersisted: false, sourcePathsIncluded: false, whitelistedFieldsOnly: true })
  })
})
