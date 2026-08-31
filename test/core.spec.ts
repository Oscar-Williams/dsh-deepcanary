import { describe, expect, it } from 'vitest'
import { DedupeLedger, InterruptBudget } from '../src/core/dedupe.js'
import { judgeSignal } from '../src/core/judge.js'
import type { CanarySignal } from '../src/types.js'

function signal(overrides: Partial<CanarySignal>): CanarySignal {
  return {
    schemaVersion: 1,
    id: 'test-event',
    occurredAt: new Date(1_000).toISOString(),
    source: 'session',
    kind: 'TASK_COMPLETED',
    evidence: [{ type: 'session-event', authority: 'runtime', ref: 'test', summary: 'test evidence' }],
    data: {},
    ...overrides,
  }
}

describe('attention judge', () => {
  it('keeps normal completion quiet but visible in the inbox', () => {
    expect(judgeSignal(signal({ kind: 'TASK_COMPLETED', severityHint: 1 }))).toMatchObject({ level: 'C1', action: 'INBOX' })
  })

  it('interrupts for human approval', () => {
    expect(judgeSignal(signal({ kind: 'HUMAN_APPROVAL_REQUIRED', severityHint: 2 }))).toMatchObject({ level: 'C2', action: 'INTERRUPT' })
  })

  it('requires authoritative evidence before assigning C3', () => {
    expect(judgeSignal(signal({ kind: 'HOST_UNREACHABLE', severityHint: 3, evidence: [{ type: 'model-judgment', authority: 'heuristic', ref: 'model', summary: 'heuristic only' }] }))).toMatchObject({ level: 'C2' })
    expect(judgeSignal(signal({ kind: 'HOST_UNREACHABLE', severityHint: 3 }))).toMatchObject({ level: 'C3', action: 'ESCALATE' })
  })

  it('emits a privacy-safe deterministic decision trace', () => {
    const verdict = judgeSignal(signal({ kind: 'HUMAN_APPROVAL_REQUIRED', severityHint: 2 }))
    expect(verdict.decisionTrace).toMatchObject({
      schemaVersion: 1,
      policyVersion: 'attention-policy.v1',
      verdictId: 'test-event',
      matchedRules: ['reason.default-c2'],
      appliedScopes: ['global'],
      suppressedBy: [],
      finalLevel: 'C2',
      finalAction: 'INTERRUPT',
      authoritySummary: { strongest: 'runtime', counts: { runtime: 1 } },
    })
  })
})

describe('dedupe and budget', () => {
  it('suppresses equivalent events within the configured window', () => {
    const ledger = new DedupeLedger(10_000)
    expect(ledger.accept('same', 1_000)).toBe(true)
    expect(ledger.accept('same', 5_000)).toBe(false)
    expect(ledger.accept('same', 11_001)).toBe(true)
  })

  it('allows three C2 interrupts and reserves C3 for urgent escalation', () => {
    const budget = new InterruptBudget(3)
    expect(budget.consume(1)).toBe(true)
    expect(budget.consume(2)).toBe(true)
    expect(budget.consume(3)).toBe(true)
    expect(budget.consume(4)).toBe(false)
    expect(budget.remaining(4)).toBe(0)
  })
})
