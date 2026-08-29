import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { judgeSignal } from '../src/core/judge.js'
import type { CanarySignal } from '../src/types.js'

describe('AttentionGold', () => {
  it('matches every checked-in deterministic scenario', async () => {
    const root = path.resolve(fileURLToPath(new URL('.', import.meta.url)), '..')
    const gold = JSON.parse(await readFile(path.join(root, 'benchmark', 'attention-gold.json'), 'utf8')) as { scenarios: Array<{ id: string; signal: { kind: CanarySignal['kind']; severityHint?: 0 | 1 | 2 | 3; authority: 'host' | 'runtime' | 'derived' | 'heuristic' }; expected: { level: string; action: string; reasonCode: string } }> }
    for (const scenario of gold.scenarios) {
      const verdict = judgeSignal({
        schemaVersion: 1,
        id: scenario.id,
        occurredAt: new Date(1_000).toISOString(),
        source: scenario.signal.kind === 'SUBAGENT_PRESSURE' ? 'subagent' : scenario.signal.kind === 'HOST_UNREACHABLE' ? 'host' : 'session',
        kind: scenario.signal.kind,
        ...(scenario.signal.severityHint === undefined ? {} : { severityHint: scenario.signal.severityHint }),
        evidence: [{ type: scenario.signal.authority === 'host' ? 'http-probe' : 'runtime-probe', authority: scenario.signal.authority, ref: scenario.id, summary: scenario.id }],
        data: {},
      })
      expect({ level: verdict.level, action: verdict.action, reasonCode: verdict.reasonCode }, scenario.id).toEqual(scenario.expected)
    }
  })
})
