import { mkdtemp, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { DeepCanaryService } from '../src/service.js'
import { registerTools } from '../src/tools.js'

describe('DSH tool registration', () => {
  it('registers explicit JSON tools with the DSH registry contract', async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), 'deepcanary-tools-'))
    const service = new DeepCanaryService({ logger: {} } as never, { stateDir: directory })
    const definitions: Array<{ name: string; output?: unknown }> = []
    registerTools({ tools: { register: (definition: { name: string; output?: unknown }) => definitions.push(definition) } }, service)
    expect(definitions.map(definition => definition.name)).toEqual([
      'deepcanary_status',
      'deepcanary_inbox',
      'deepcanary_acknowledge',
      'deepcanary_snooze',
      'deepcanary_mute',
      'deepcanary_feedback',
      'deepcanary_explain',
      'deepcanary_jump',
    ])
    expect(definitions.every(definition => typeof definition.output === 'object')).toBe(true)
    await service.dispose()
    await rm(directory, { recursive: true, force: true })
  })
})
