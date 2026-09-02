import { mkdtemp, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { DOGFOOD_SCHEMA_VERSION, DogfoodLedger, isDogfoodBundle, summarizeDogfood } from '../src/dogfood.js'
import type { DogfoodBundle, DogfoodObservation, DogfoodRun } from '../src/dogfood.js'

const run: DogfoodRun = {
  schemaVersion: DOGFOOD_SCHEMA_VERSION,
  runId: 'run-test-01',
  trialId: 'trial-test-01',
  provenance: 'controlled',
  taskFamily: 'coding',
  scenario: 'approval-boundary',
  pluginVersion: '0.1.1-rc.1',
  runtimeTag: 'dsh-v0.1.2-alpha.5',
  policyVersion: 'attention-policy.v1',
  startedAt: '2026-09-02T00:00:00.000Z',
  captureMode: 'manual',
  rawContentPersisted: false,
}

function observation(partial: Partial<DogfoodObservation> & Pick<DogfoodObservation, 'observationRef' | 'decisionDisposition'>): DogfoodObservation {
  const base: DogfoodObservation = {
    schemaVersion: DOGFOOD_SCHEMA_VERSION,
    observationRef: '0000000000000000',
    runId: run.runId,
    occurredAt: '2026-09-02T00:01:00.000Z',
    eventClass: 'human-needed',
    eventSubtype: 'approval',
    eventSource: 'tool',
    authority: 'runtime',
    phase: 'human-wait',
    decisionDisposition: 'inbox',
    deliveryChannel: partial.deliveryChannel ?? 'browser-notification',
  }
  return { ...base, ...partial }
}

describe('dogfood observation and taxonomy', () => {
  it('keeps negative opportunities and review labels in a replayable report', () => {
    const bundle: DogfoodBundle = {
      schemaVersion: DOGFOOD_SCHEMA_VERSION,
      run,
      observations: [
        observation({ observationRef: 'aaaaaaaaaaaaaaaa', decisionDisposition: 'interrupt', deliveryUnitRef: 'bbbbbbbbbbbbbbbb', expectedDecision: { level: 'C2', action: 'INTERRUPT', reasonCode: 'HUMAN_APPROVAL_REQUIRED' }, observedDecision: { level: 'C2', action: 'INTERRUPT', reasonCode: 'HUMAN_APPROVAL_REQUIRED' }, reviewLabel: 'correct-useful' }),
        observation({ observationRef: 'cccccccccccccccc', decisionDisposition: 'c0-silent', deliveryChannel: 'none', expectedDecision: { level: 'C0', action: 'IGNORE', reasonCode: 'TASK_COMPLETED' }, observedDecision: { level: 'C0', action: 'IGNORE', reasonCode: 'TASK_COMPLETED' } }),
        observation({ observationRef: 'dddddddddddddddd', decisionDisposition: 'dropped-event', deliveryChannel: 'none', reviewLabel: 'dropped-event' }),
      ],
      receipts: [],
    }
    expect(isDogfoodBundle(bundle)).toBe(true)
    const report = summarizeDogfood(bundle)
    expect(report.coverage).toMatchObject({ decisions: 2, c0Silent: 1, droppedEvents: 1, deliveryUnits: 1, userFacingDeliveryUnits: 1, reviewedUserFacingUnits: 1 })
    expect(report.metrics.humanNeededRecall).toMatchObject({ numerator: 1, denominator: 1, status: 'insufficient-sample' })
    expect(report.metrics.reviewCoverage).toMatchObject({ numerator: 1, denominator: 1 })
    expect(report.taxonomy.byDisposition).toMatchObject({ interrupt: 1, 'c0-silent': 1, 'dropped-event': 1 })
  })

  it('keeps an unreviewed decision cohort out of release-ready coverage', () => {
    const bundle: DogfoodBundle = {
      schemaVersion: DOGFOOD_SCHEMA_VERSION,
      run,
      observations: Array.from({ length: 5 }, (_, index) => observation({
        observationRef: `${String(index + 1).padStart(16, '0')}`,
        decisionDisposition: 'interrupt',
        expectedDecision: { level: 'C2', action: 'INTERRUPT', reasonCode: 'HUMAN_APPROVAL_REQUIRED' },
      })),
      receipts: [],
    }
    const report = summarizeDogfood(bundle)
    expect(report.metrics.reviewCoverage).toMatchObject({ numerator: 0, denominator: 0, status: 'no-data' })
  })

  it('persists a sanitized bundle atomically and restores it', async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), 'deepcanary-dogfood-'))
    try {
      const ledger = new DogfoodLedger(directory, run)
      ledger.record(observation({ observationRef: 'eeeeeeeeeeeeeeee', decisionDisposition: 'interrupt', deliveryUnitRef: 'ffffffffffffffff' }))
      await ledger.save()
      const restored = new DogfoodLedger(directory, run)
      const bundle = await restored.load()
      expect(bundle.observations).toHaveLength(1)
      expect(bundle.observations[0]).toMatchObject({ observationRef: 'eeeeeeeeeeeeeeee', deliveryUnitRef: 'ffffffffffffffff' })
      expect(JSON.stringify(bundle)).not.toContain('prompt')
    } finally {
      await rm(directory, { recursive: true, force: true })
    }
  })
})
