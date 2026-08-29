import { mkdtemp, readFile, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { judgeSignal } from '../src/core/judge.js'
import { DeepCanaryService } from '../src/service.js'
import type { CanarySignal } from '../src/types.js'

type GoldSignal = {
  id?: string
  kind: CanarySignal['kind']
  severityHint?: 0 | 1 | 2 | 3
  authority: 'host' | 'runtime' | 'derived' | 'heuristic'
  data?: CanarySignal['data']
  dedupeKey?: string
  bundleKey?: string
}

type Gold = {
  fixtureVersion: number
  scenarios: Array<{
    id: string
    signal: GoldSignal
    expected: { level: string; action: string; reasonCode: string }
  }>
  serviceScenarios: Array<{
    id: string
    signals: GoldSignal[]
    expected: { items: number; bundleCount: number }
  }>
}

function makeSignal(input: GoldSignal, id: string, index: number): CanarySignal {
  return {
    schemaVersion: 1,
    id: input.id ?? id,
    occurredAt: new Date(1_000 + index).toISOString(),
    source: input.kind === 'SUBAGENT_PRESSURE' ? 'subagent' : input.kind === 'HOST_UNREACHABLE' || input.kind === 'HOST_SUSPECTED_STALL' || input.kind === 'HOST_STALL_RECOVERED' ? 'host' : input.kind === 'TOOL_FAILURE_LOOP' ? 'tool' : 'session',
    kind: input.kind,
    ...(input.severityHint === undefined ? {} : { severityHint: input.severityHint }),
    evidence: [{ type: input.authority === 'host' ? 'http-probe' : 'runtime-probe', authority: input.authority, ref: id, summary: id }],
    ...(input.dedupeKey ? { dedupeKey: input.dedupeKey } : {}),
    ...(input.bundleKey ? { bundleKey: input.bundleKey } : {}),
    data: input.data ?? {},
  }
}

describe('AttentionGold', () => {
  it('matches every frozen deterministic classification scenario', async () => {
    const root = path.resolve(fileURLToPath(new URL('..', import.meta.url)))
    const gold = JSON.parse(await readFile(path.join(root, 'benchmark', 'attention-gold.json'), 'utf8')) as Gold
    expect(gold.fixtureVersion).toBe(2)
    expect(gold.scenarios.length).toBeGreaterThanOrEqual(15)
    for (const scenario of gold.scenarios) {
      const verdict = judgeSignal(makeSignal(scenario.signal, scenario.id, 0))
      expect({ level: verdict.level, action: verdict.action, reasonCode: verdict.reasonCode }, scenario.id).toEqual(scenario.expected)
    }
  })

  it('proves duplicate suppression and shared-root Decision Bundle behavior', async () => {
    const root = path.resolve(fileURLToPath(new URL('..', import.meta.url)))
    const gold = JSON.parse(await readFile(path.join(root, 'benchmark', 'attention-gold.json'), 'utf8')) as Gold
    for (const scenario of gold.serviceScenarios) {
      const directory = await mkdtemp(path.join(os.tmpdir(), `deepcanary-gold-${scenario.id}-`))
      const service = new DeepCanaryService({ logger: {} } as never, { stateDir: directory, maxInboxItems: 50 })
      try {
        await service.ready
        for (const [index, input] of scenario.signals.entries()) await service.ingest(makeSignal(input, scenario.id, index))
        expect(service.inbox(50)).toHaveLength(scenario.expected.items)
        expect(service.inbox(1)[0]?.bundleCount ?? 0).toBe(scenario.expected.bundleCount)
      } finally {
        await service.dispose()
        await rm(directory, { recursive: true, force: true })
      }
    }
  })
})
