import { mkdtemp, readFile, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { readUserQuestionFacts } from '../src/adapters/user-questions.js'
import { DeepCanaryService } from '../src/service.js'
import { MetadataStore } from '../src/persistence.js'

describe('public question metadata boundary', () => {
  it('does not access question or answer payloads', () => {
    const sensitive = () => { throw new Error('private content accessed') }
    const registry = { snapshot: () => ({ asOfSeq: 4, values: { userQuestions: {
      active: [{ callId: 'q1', state: 'continued', get questions() { return sensitive() } }],
      settled: [{ callId: 'q2', get answers() { return sensitive() } }],
    } } }) }
    expect(readUserQuestionFacts(registry, {}, 4)).toEqual({ active: [{ callId: 'q1', state: 'continued' }], settledCallIds: ['q2'] })
  })

  it('rejects stale, unavailable and malformed snapshots instead of proving resolution', () => {
    const view = { active: [], settled: [] }
    expect(readUserQuestionFacts({ snapshot: () => ({ asOfSeq: 2, values: { userQuestions: view } }) }, {}, 3)).toBeUndefined()
    expect(readUserQuestionFacts({ snapshot: () => { throw new Error('unavailable') } }, {}, 3)).toBeUndefined()
    expect(readUserQuestionFacts({ snapshot: () => ({ asOfSeq: 3, values: {} }) }, {}, 3)).toBeUndefined()
    expect(readUserQuestionFacts({ snapshot: () => ({ asOfSeq: 3, values: { userQuestions: { active: [{ callId: 'q', state: 'bad' }], settled: [] } } }) }, {}, 3)).toBeUndefined()
  })
})

describe('timed question lifecycle', () => {
  async function fixture() {
    const directory = await mkdtemp(path.join(os.tmpdir(), 'deepcanary-timed-question-'))
    const listeners = new Map<string, (...args: any[]) => void>()
    const events: Array<{ type: string; seq: number; time: number; data: Record<string, unknown> }> = []
    const session = { id: 'timed-session', seq: 0, header: { createdAt: Date.now() }, snapshotEvents: () => events }
    let view: { active: Array<{ callId: string; state: 'open' | 'continued' }>; settled: Array<{ callId: string }> } = { active: [], settled: [] }
    let projectionAvailable = true
    const service = new DeepCanaryService({
      logger: {},
      on: (name: string, listener: (...args: any[]) => void) => { listeners.set(name, listener) },
      sessions: { list: () => [session] },
      get: (name: string) => name !== 'sessionProjections' ? undefined : {
        snapshot: () => ({ asOfSeq: session.seq - 1, values: projectionAvailable ? { userQuestions: view } : {} }),
      },
    } as never, { stateDir: directory })
    await service.ready
    service.start()
    await vi.waitFor(() => expect(service.status().sessions).toBe(1))
    function emit(type: string, data: Record<string, unknown> = {}) {
      const event = { type, seq: session.seq++, time: Date.now(), data }
      events.push(event)
      listeners.get('session/event')?.(session, event)
    }
    async function flush() { await (service as unknown as { questionChain: Promise<void> }).questionChain }
    return { service, directory, emit, flush,
      setView: (next: typeof view) => { view = next },
      unavailable: () => { projectionAvailable = false },
      cleanup: async () => { await service.dispose(); await rm(directory, { recursive: true, force: true }) },
    }
  }

  it('downgrades on timeout, survives turn end, and closes only after admitted reply', async () => {
    const f = await fixture()
    try {
      f.emit('turn/start')
      f.setView({ active: [{ callId: 'q1', state: 'open' }], settled: [] })
      f.emit('tool/call', { name: 'ask_user_question', callId: 'q1', arguments: 'PRIVATE_QUESTION' })
      await f.flush()
      const first = f.service.inbox(20).find(item => item.questionState === 'open')!
      expect(first).toMatchObject({ level: 'C3', taskState: 'waiting-human' })
      f.setView({ active: [{ callId: 'q1', state: 'continued' }], settled: [] })
      f.emit('tool/result', { message: { role: 'tool', toolCallId: 'q1', content: 'PRIVATE_RESULT' } })
      await f.flush()
      expect(f.service.inbox(20).find(item => item.id === first.id)).toMatchObject({ level: 'C1', action: 'INBOX', questionState: 'continued', taskState: 'running', status: 'open' })
      f.emit('turn/end', { reason: 'completed' })
      await f.flush()
      expect(f.service.inbox(20).find(item => item.id === first.id)?.status).toBe('open')
      expect(f.service.inbox(20).find(item => item.id === first.id)?.taskState).toBe('unknown')
      // Inbox staging/cancellation does not change the host's admitted projection.
      f.emit('inbox/queued')
      f.emit('inbox/cancelled')
      await f.flush()
      expect(f.service.inbox(20).find(item => item.id === first.id)?.status).toBe('open')
      f.setView({ active: [], settled: [{ callId: 'q1' }] })
      f.emit('user/message', { source: { kind: 'user-question-reply', callId: 'q1' }, content: 'PRIVATE_ANSWER' })
      await f.flush()
      expect(f.service.inbox(20).find(item => item.id === first.id)?.status).toBe('recovered')
      await f.service.dispose()
      const persisted = await readFile(path.join(f.directory, 'inbox.json'), 'utf8')
      expect(persisted).not.toMatch(/PRIVATE_QUESTION|PRIVATE_RESULT|PRIVATE_ANSWER|"callId"/)
      expect((await new MetadataStore(f.directory).load()).find(item => item.id === first.id)).toMatchObject({ questionState: 'continued', status: 'recovered' })
    } finally { await f.cleanup() }
  })

  it('joins concurrent questions separately and serializes back-to-back events', async () => {
    const f = await fixture()
    try {
      f.emit('turn/start')
      f.setView({ active: [{ callId: 'q1', state: 'open' }], settled: [] })
      f.emit('tool/call', { name: 'ask_user_question', callId: 'q1' })
      f.setView({ active: [{ callId: 'q1', state: 'continued' }, { callId: 'q2', state: 'open' }], settled: [] })
      f.emit('tool/call', { name: 'ask_user_question', callId: 'q2' })
      f.setView({ active: [{ callId: 'q2', state: 'open' }], settled: [{ callId: 'q1' }] })
      f.emit('user/message', { source: { kind: 'user-question-reply', callId: 'q1' } })
      await f.flush()
      const questions = f.service.inbox(20).filter(item => item.questionState !== undefined)
      expect(questions).toHaveLength(2)
      expect(questions.filter(item => item.status === 'open')).toHaveLength(1)
      expect(questions.find(item => item.status === 'open')).toMatchObject({ questionState: 'open', level: 'C3' })
    } finally { await f.cleanup() }
  })

  it('does not resolve a managed question when the projection disappears', async () => {
    const f = await fixture()
    try {
      f.emit('turn/start')
      f.setView({ active: [{ callId: 'q1', state: 'continued' }], settled: [] })
      f.emit('tool/ptc-dispatch')
      await f.flush()
      f.unavailable()
      f.emit('turn/end', { reason: 'completed' })
      await f.flush()
      expect(f.service.inbox(20).find(item => item.questionState === 'continued')?.status).toBe('open')
    } finally { await f.cleanup() }
  })

  it('respects acknowledgement instead of replaying the same answerable card', async () => {
    const f = await fixture()
    try {
      f.emit('turn/start')
      f.setView({ active: [{ callId: 'q1', state: 'continued' }], settled: [] })
      f.emit('tool/ptc-dispatch')
      await f.flush()
      const item = f.service.inbox(20).find(item => item.questionState === 'continued')!
      expect(f.service.acknowledge(item.id)).toBe(true)
      f.emit('turn/start')
      await f.flush()
      const questions = f.service.inbox(20).filter(item => item.questionState !== undefined)
      expect(questions).toHaveLength(1)
      expect(questions[0]?.status).toBe('acknowledged')
    } finally { await f.cleanup() }
  })
})
