import { describe, expect, it } from 'vitest'
import { createDogfoodAggregate, isDogfoodAggregate, summarizeDogfoodAggregate } from '../src/dogfoodAggregate.js'
import type { DogfoodBundle, DogfoodRun } from '../src/dogfood.js'

const makeBundle = (runId: string, taskFamily: DogfoodRun['taskFamily'], scenario: DogfoodRun['scenario']): DogfoodBundle => ({
  schemaVersion: 1,
  run: {
    schemaVersion: 1,
    runId,
    trialId: `${runId}-trial`,
    provenance: 'real',
    taskFamily,
    scenario,
    pluginVersion: '0.1.1-rc.1',
    runtimeTag: 'dsh-v0.1.2-alpha.5',
    policyVersion: 'attention-policy.v1',
    startedAt: '2026-09-02T00:00:00.000Z',
    captureMode: 'manual',
    rawContentPersisted: false,
  },
  observations: [],
  receipts: [],
})

describe('dogfood aggregate contract', () => {
  it('keeps independent runs and provenance visible', () => {
    const aggregate = createDogfoodAggregate('aggregate-test', [
      makeBundle('run-a', 'coding', 'normal-completion'),
      makeBundle('run-b', 'research', 'healthy-long-run'),
    ])
    expect(isDogfoodAggregate(aggregate)).toBe(true)
    const report = summarizeDogfoodAggregate(aggregate)
    expect(report).toMatchObject({ bundleCount: 2, runCount: 2, trialCount: 2, provenance: 'real' })
    expect(report.quality.requiredTaskFamilies.missing).toContain('subagent')
    expect(report.quality.requiredScenarios.missing).toContain('approval-boundary')
    expect(report.runtimeTags).toEqual(['dsh-v0.1.2-alpha.5'])
  })

  it('rejects duplicate run identities', () => {
    expect(() => createDogfoodAggregate('aggregate-duplicate', [
      makeBundle('run-a', 'coding', 'normal-completion'),
      makeBundle('run-a', 'research', 'healthy-long-run'),
    ])).toThrow('invalid dogfood aggregate')
  })
})
