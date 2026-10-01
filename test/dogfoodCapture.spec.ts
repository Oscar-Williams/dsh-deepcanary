import { execFile } from 'node:child_process'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { promisify } from 'node:util'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const execute = promisify(execFile)
const script = fileURLToPath(new URL('../scripts/capture-dogfood-run.mjs', import.meta.url))
const startedAt = '2026-10-01T17:00:00.000Z'
const endedAt = '2026-10-01T17:01:00.000Z'

describe('dogfood capture identity', () => {
  it('preserves unknown legacy origin and refuses export-time task relabeling', async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), 'deepcanary-capture-'))
    const output = path.join(dir, 'export.json')
    const args = ['--state-dir', dir, '--run-id', 'legacy', '--trial-id', 'legacy-trial', '--task-family', 'coding', '--scenario', 'normal-completion', '--provenance', 'real', '--started-at', startedAt, '--ended-at', endedAt, '--out', output]
    try {
      await writeFile(path.join(dir, 'inbox.json'), JSON.stringify({ schemaVersion: 1, items: [] }))
      await writeFile(path.join(dir, 'dogfood.json'), JSON.stringify({ schemaVersion: 1, run: { schemaVersion: 1, runId: 'legacy', trialId: 'legacy-trial', provenance: 'real', taskFamily: 'coding', scenario: 'normal-completion', pluginVersion: '0.1.2-rc.1', runtimeTag: '0.2.0-rc.2', policyVersion: 'attention-policy.v1', startedAt, endedAt, captureMode: 'service', rawContentPersisted: false }, observations: [], receipts: [] }))
      await execute(process.execPath, [script, ...args])
      const exported = JSON.parse(await readFile(output, 'utf8'))
      expect(exported.run).toMatchObject({ taskOrigin: 'unknown', pluginVersion: '0.1.2-rc.1', captureMode: 'service' })
      await expect(execute(process.execPath, [script, ...args, '--task-origin', 'natural'])).rejects.toThrow('cannot relabel')
      await expect(execute(process.execPath, [script, ...args, '--task-ref', '0123456789abcdef'])).rejects.toThrow('cannot relabel')
      const earlier = [...args]; earlier[earlier.indexOf('--started-at') + 1] = '2026-10-01T16:59:00.000Z'
      await expect(execute(process.execPath, [script, ...earlier])).rejects.toThrow('capture window')
      await rm(path.join(dir, 'dogfood.json'))
      const controlled = [...args]; controlled[controlled.indexOf('--provenance') + 1] = 'controlled'
      await execute(process.execPath, [script, ...controlled])
      expect(JSON.parse(await readFile(output, 'utf8')).run).toMatchObject({ taskOrigin: 'controlled', captureMode: 'manual' })
      await expect(execute(process.execPath, [script, ...controlled, '--task-origin', 'natural'])).rejects.toThrow('already attributed')
    } finally { await rm(dir, { recursive: true, force: true }) }
  })
})
