import { mkdtemp, readFile, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { DeepCanaryService } from '../src/service.js'
import { isOutcomeReceipt, normalizeOutcomeInput } from '../src/outcome.js'
import type { CanarySignal } from '../src/types.js'

function signal(): CanarySignal {
  return {
    schemaVersion: 1,
    id: 'outcome-approval',
    occurredAt: new Date().toISOString(),
    source: 'tool',
    kind: 'HUMAN_APPROVAL_REQUIRED',
    sessionId: 'private-session-id',
    workspaceId: 'private-workspace-id',
    evidence: [{ type: 'tool-history', authority: 'runtime', ref: 'approval-boundary', summary: 'Approval boundary observed.' }],
    dedupeKey: 'outcome-approval',
    data: {},
  }
}

describe('OutcomeReceipt', () => {
  it('accepts bounded provenance and outcome fields', () => {
    expect(normalizeOutcomeInput({
      source: 'real',
      trialId: 'trial-2026-09',
      opened: true,
      acknowledged: true,
      feedback: 'useful',
      laterOutcome: 'continued',
      latencyBucket: 'under-1m',
      reviewFlags: ['wrong-level'],
    })).toMatchObject({ source: 'real', trialId: 'trial-2026-09', opened: true, feedback: 'useful', reviewFlags: ['wrong-level'] })
    expect(() => normalizeOutcomeInput({ source: 'real', trialId: 'C:\\secrets\\trial' })).toThrow('outcome.trialId')
    expect(() => normalizeOutcomeInput({ source: 'real', trialId: 'trial-1', note: 'raw transcript' })).toThrow('unsupported outcome field')
    expect(() => normalizeOutcomeInput({ source: 'real', trialId: 'trial-1', reviewFlags: ['raw-content'] })).toThrow('reviewFlags')
  })

  it('persists only a redacted decision-to-outcome record and restores it', async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), 'deepcanary-outcome-'))
    const first = new DeepCanaryService({ logger: {} } as never, { stateDir: directory, maxInboxItems: 50 })
    await first.ready
    const item = await first.ingest(signal())
    expect(item).toBeDefined()
    const receipt = await first.recordOutcome(item?.id ?? '', {
      source: 'real',
      trialId: 'manual-alpha5-01',
      opened: true,
      acknowledged: true,
      feedback: 'useful',
      laterOutcome: 'continued',
      latencyBucket: 'under-1m',
    })
    expect(receipt).toMatchObject({ source: 'real', trialId: 'manual-alpha5-01', feedback: 'useful', laterOutcome: 'continued' })
    expect(receipt?.attentionRef).toMatch(/^[a-f0-9]{16}$/)
    expect(isOutcomeReceipt({ ...receipt, prompt: 'must not be retained' })).toBe(false)
    await first.dispose()

    const persisted = await readFile(first.outcomeStore.file, 'utf8')
    expect(persisted).toContain('manual-alpha5-01')
    expect(persisted).not.toContain('private-session-id')
    expect(persisted).not.toContain('private-workspace-id')

    const second = new DeepCanaryService({ logger: {} } as never, { stateDir: directory, maxInboxItems: 50 })
    await second.ready
    expect(second.outcomes()).toHaveLength(1)
    expect(second.outcomes()[0]).toMatchObject({ source: 'real', trialId: 'manual-alpha5-01', feedback: 'useful' })
    await second.dispose()
    await rm(directory, { recursive: true, force: true })
  })

  it('updates an existing outcome from local user actions and keeps trial provenance stable', async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), 'deepcanary-outcome-actions-'))
    const service = new DeepCanaryService({ logger: {} } as never, { stateDir: directory, maxInboxItems: 50 })
    await service.ready
    const item = await service.ingest(signal())
    expect(item).toBeDefined()
    await service.recordOutcome(item?.id ?? '', { source: 'controlled', trialId: 'controlled-01', opened: true, acknowledged: true, snoozed: true, muted: true })
    await service.recordOutcome(item?.id ?? '', { source: 'controlled', trialId: 'controlled-01', opened: false, acknowledged: false, snoozed: false, muted: false })
    expect(service.outcomes()[0]).toMatchObject({ opened: true, acknowledged: true, snoozed: true, muted: true })
    expect(service.seen(item?.id ?? '')).toBe(true)
    expect(service.feedback(item?.id ?? '', true, 'Useful reminder')).toBe(true)
    expect(service.outcomes()[0]).toMatchObject({ opened: true, feedback: 'useful' })
    await service.recordOutcome(item?.id ?? '', { source: 'real', trialId: 'real-01' })
    expect(service.outcomes()).toHaveLength(2)
    expect(await service.deleteOutcomes({ source: 'controlled', trialId: 'controlled-01' })).toBe(1)
    expect(service.outcomes()).toHaveLength(1)
    expect(service.outcomes()[0]).toMatchObject({ source: 'real', trialId: 'real-01' })
    await service.dispose()
    const persisted = JSON.parse(await readFile(service.outcomeStore.file, 'utf8')) as { receipts: Array<Record<string, unknown>> }
    expect(persisted.receipts).toHaveLength(1)
    await rm(directory, { recursive: true, force: true })
  })
})
