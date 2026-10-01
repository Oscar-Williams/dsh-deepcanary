import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { DeepCanaryService } from '../src/service.js'
import { isOutcomeReceipt, normalizeOutcomeInput, OutcomeStore } from '../src/outcome.js'
import type { CanarySignal, OutcomeReceipt } from '../src/types.js'

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

/** A schemaVersion 1 record written before taskOrigin/taskRef existed. */
function legacyReceipt(): OutcomeReceipt {
  return {
    schemaVersion: 1,
    receiptId: `outcome-${'a'.repeat(16)}`,
    attentionRef: 'b'.repeat(16),
    trialId: 'legacy-alpha5-01',
    source: 'real',
    policyVersion: 'attention-policy.v1',
    eventClass: 'human-needed',
    reasonCode: 'HUMAN_APPROVAL_REQUIRED',
    level: 'C2',
    action: 'INTERRUPT',
    sourceAuthority: 'runtime',
    opened: true,
    acknowledged: false,
    snoozed: false,
    muted: false,
    feedback: 'unrated',
    laterOutcome: 'unknown',
    recoveredBeforeOpen: false,
    latencyBucket: 'unknown',
    reviewFlags: [],
    recordedAt: '2026-01-05T00:00:00.000Z',
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

  it('accepts only a bounded task origin and an opaque 16-hex task reference', () => {
    expect(normalizeOutcomeInput({
      source: 'real',
      trialId: 'trial-2026-09',
      taskOrigin: 'natural',
      taskRef: '0123456789abcdef',
    })).toMatchObject({ taskOrigin: 'natural', taskRef: '0123456789abcdef' })

    // Capture provenance and task intent are independent axes.
    expect(normalizeOutcomeInput({ source: 'replay', trialId: 'trial-1', taskOrigin: 'natural' }))
      .toMatchObject({ source: 'replay', taskOrigin: 'natural' })
    expect(normalizeOutcomeInput({ source: 'real', trialId: 'trial-1', taskOrigin: 'unknown' }))
      .toMatchObject({ source: 'real', taskOrigin: 'unknown' })

    expect(() => normalizeOutcomeInput({ source: 'real', trialId: 'trial-1', taskOrigin: 'dogfood' })).toThrow('outcome.taskOrigin')
    expect(() => normalizeOutcomeInput({ source: 'real', trialId: 'trial-1', taskOrigin: 'NATURAL' })).toThrow('outcome.taskOrigin')
    // Capture source must not be used to carry task intent.
    expect(() => normalizeOutcomeInput({ source: 'natural', trialId: 'trial-1' })).toThrow('outcome.source')
    expect(() => normalizeOutcomeInput({ source: 'real', trialId: 'trial-1', taskOrigin: null })).toThrow('outcome.taskOrigin')
    // Raw task identities and malformed references are refused, never hashed or stored.
    expect(() => normalizeOutcomeInput({ source: 'real', trialId: 'trial-1', taskRef: 'C:\\secrets\\task' })).toThrow('outcome.taskRef')
    expect(() => normalizeOutcomeInput({ source: 'real', trialId: 'trial-1', taskRef: 'private-session-id' })).toThrow('outcome.taskRef')
    expect(() => normalizeOutcomeInput({ source: 'real', trialId: 'trial-1', taskRef: '0123456789ABCDEF' })).toThrow('outcome.taskRef')
    expect(() => normalizeOutcomeInput({ source: 'real', trialId: 'trial-1', taskRef: '0123456789abcde' })).toThrow('outcome.taskRef')
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
    // No task intent was supplied, so the record states unknown rather than assuming natural.
    expect(receipt).toMatchObject({ taskOrigin: 'unknown' })
    expect(receipt).not.toHaveProperty('taskRef')
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
    expect(second.outcomes()[0]).toMatchObject({ source: 'real', trialId: 'manual-alpha5-01', feedback: 'useful', taskOrigin: 'unknown' })
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

  it('reads legacy receipts without a task origin and never infers or upgrades one', async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), 'deepcanary-outcome-legacy-'))
    const store = new OutcomeStore(directory)
    await writeFile(store.file, `${JSON.stringify({ schemaVersion: 1, receipts: [legacyReceipt()] }, null, 2)}\n`, 'utf8')

    const loaded = await store.load()
    expect(loaded).toHaveLength(1)
    expect(isOutcomeReceipt(loaded[0])).toBe(true)
    expect(loaded[0]).not.toHaveProperty('taskOrigin')
    expect(loaded[0]).not.toHaveProperty('taskRef')

    // A legacy record stays unknown on disk: reloading must not invent natural.
    await store.save(loaded)
    const reloaded = await new OutcomeStore(directory).load()
    expect(reloaded).toHaveLength(1)
    expect(reloaded[0]?.taskOrigin).not.toBe('natural')
    expect(reloaded[0]?.taskOrigin ?? 'unknown').toBe('unknown')
    const persisted = JSON.parse(await readFile(store.file, 'utf8')) as { receipts: Array<Record<string, unknown>> }
    expect(persisted.receipts[0]).not.toHaveProperty('taskOrigin')

    // The persistence whitelist rejects an out-of-enum origin or non-opaque reference.
    expect(isOutcomeReceipt({ ...legacyReceipt(), taskOrigin: 'natural', taskRef: '0123456789abcdef' })).toBe(true)
    expect(isOutcomeReceipt({ ...legacyReceipt(), taskOrigin: 'dogfood' })).toBe(false)
    expect(isOutcomeReceipt({ ...legacyReceipt(), taskOrigin: 1 })).toBe(false)
    expect(isOutcomeReceipt({ ...legacyReceipt(), taskRef: '0123456789ABCDEF' })).toBe(false)
    expect(isOutcomeReceipt({ ...legacyReceipt(), taskRef: 'private-session-id' })).toBe(false)
    await rm(directory, { recursive: true, force: true })
  })

  it('persists one task identity, inherits it on partial updates, and refuses a relabel', async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), 'deepcanary-outcome-origin-'))
    const service = new DeepCanaryService({ logger: {} } as never, { stateDir: directory, maxInboxItems: 50 })
    await service.ready
    const item = await service.ingest(signal())
    const id = item?.id ?? ''
    expect(id).not.toBe('')

    const recorded = await service.recordOutcome(id, {
      source: 'real',
      trialId: 'natural-alpha-01',
      taskOrigin: 'natural',
      taskRef: '0123456789abcdef',
      opened: true,
      feedback: 'useful',
    })
    expect(recorded).toMatchObject({ source: 'real', taskOrigin: 'natural', taskRef: '0123456789abcdef' })

    // A partial update carries no task identity and must inherit the recorded one.
    expect(await service.recordOutcome(id, { source: 'real', trialId: 'natural-alpha-01', snoozed: true }))
      .toMatchObject({ taskOrigin: 'natural', taskRef: '0123456789abcdef', snoozed: true, opened: true, feedback: 'useful' })
    // Local Inbox actions patch the same receipt without any task fields.
    expect(service.seen(id)).toBe(true)
    expect(service.outcomes()[0]).toMatchObject({ taskOrigin: 'natural', taskRef: '0123456789abcdef' })
    // Restating the same identity is idempotent; only a change is a relabel.
    expect(await service.recordOutcome(id, {
      source: 'real',
      trialId: 'natural-alpha-01',
      taskOrigin: 'natural',
      taskRef: '0123456789abcdef',
      laterOutcome: 'continued',
    })).toMatchObject({ taskOrigin: 'natural', taskRef: '0123456789abcdef', laterOutcome: 'continued' })

    await expect(service.recordOutcome(id, { source: 'real', trialId: 'natural-alpha-01', taskOrigin: 'controlled' }))
      .rejects.toThrow('task origin')
    await expect(service.recordOutcome(id, { source: 'real', trialId: 'natural-alpha-01', taskRef: 'fedcba9876543210' }))
      .rejects.toThrow('task reference')
    expect(service.outcomes()[0]).toMatchObject({ taskOrigin: 'natural', taskRef: '0123456789abcdef' })

    // Capture provenance stays independent: a controlled capture may still observe natural work.
    expect(await service.recordOutcome(id, { source: 'controlled', trialId: 'controlled-01', taskOrigin: 'natural' }))
      .toMatchObject({ source: 'controlled', taskOrigin: 'natural' })
    expect(service.outcomes()).toHaveLength(2)
    await service.dispose()

    const second = new DeepCanaryService({ logger: {} } as never, { stateDir: directory, maxInboxItems: 50 })
    await second.ready
    const reloaded = second.outcomes()
    expect(reloaded.find(receipt => receipt.trialId === 'natural-alpha-01'))
      .toMatchObject({ source: 'real', taskOrigin: 'natural', taskRef: '0123456789abcdef', snoozed: true, acknowledged: false, opened: true })
    expect(reloaded.find(receipt => receipt.trialId === 'controlled-01'))
      .toMatchObject({ source: 'controlled', taskOrigin: 'natural' })
    await second.dispose()
    await rm(directory, { recursive: true, force: true })
  })
})
