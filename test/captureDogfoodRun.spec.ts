import { execFile } from 'node:child_process'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const repo = fileURLToPath(new URL('../', import.meta.url))
const script = path.join(repo, 'scripts', 'capture-dogfood-run.mjs')

function runCapture(args: string[]): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    execFile(process.execPath, [script, ...args], { cwd: repo }, (error, stdout, stderr) => {
      if (error !== null) {
        error.message = `${error.message}\n${stderr}`
        reject(error)
        return
      }
      resolve({ stdout, stderr })
    })
  })
}

async function makeStateDir(): Promise<string> {
  const stateDir = await mkdtemp(path.join(os.tmpdir(), 'deepcanary-capture-'))
  await writeFile(path.join(stateDir, 'inbox.json'), JSON.stringify({
    schemaVersion: 1,
    items: [{
      id: 'capture-item-1',
      occurredAt: '2026-09-03T15:00:00.000Z',
      reasonCode: 'TASK_COMPLETED',
      level: 'C1',
      action: 'INBOX',
      evidence: [],
      status: 'open',
    }],
  }))
  await writeFile(path.join(stateDir, 'outcomes.json'), JSON.stringify({ schemaVersion: 1, receipts: [] }))
  return stateDir
}

describe('capture-dogfood-run provenance contract', () => {
  it('emits controlled provenance for an explicit Inbox-only capture', async () => {
    const stateDir = await makeStateDir()
    const outputPath = path.join(stateDir, 'controlled.json')
    try {
      await runCapture([
        '--state-dir', stateDir,
        '--run-id', 'capture-controlled-run',
        '--trial-id', 'capture-controlled-trial',
        '--task-family', 'research',
        '--scenario', 'normal-completion',
        '--provenance', 'controlled',
        '--started-at', '2026-09-03T14:59:00.000Z',
        '--ended-at', '2026-09-03T15:01:00.000Z',
        '--out', outputPath,
      ])
      const bundle = JSON.parse(await readFile(outputPath, 'utf8')) as { run: { provenance: string }; observations: Array<{ eventSubtype: string }> }
      expect(bundle.run.provenance).toBe('controlled')
      expect(bundle.observations).toHaveLength(1)
      expect(bundle.observations[0]?.eventSubtype).toBe('completed')
    } finally {
      await rm(stateDir, { recursive: true, force: true })
    }
  })

  it('requires an explicit provenance choice before reading fallback state', async () => {
    const stateDir = await makeStateDir()
    try {
      await expect(runCapture([
        '--state-dir', stateDir,
        '--run-id', 'capture-missing-provenance',
        '--trial-id', 'capture-missing-provenance-trial',
        '--task-family', 'research',
        '--scenario', 'normal-completion',
        '--started-at', '2026-09-03T14:59:00.000Z',
        '--ended-at', '2026-09-03T15:01:00.000Z',
        '--out', path.join(stateDir, 'missing.json'),
      ])).rejects.toThrow('--provenance')
    } finally {
      await rm(stateDir, { recursive: true, force: true })
    }
  })
})
