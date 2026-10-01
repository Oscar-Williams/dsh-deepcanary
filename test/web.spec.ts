import { createServer } from 'node:http'
import type { Server } from 'node:http'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { DeepCanaryService } from '../src/service.js'
import { installWebRoutes } from '../src/web.js'
import type { CanarySignal } from '../src/types.js'

const servers: Server[] = []

afterEach(async () => {
  await Promise.all(servers.splice(0).map(server => new Promise<void>(resolve => server.close(() => resolve()))))
})

function signal(): CanarySignal {
  return {
    schemaVersion: 1,
    id: 'web-approval',
    occurredAt: new Date().toISOString(),
    source: 'tool',
    kind: 'HUMAN_APPROVAL_REQUIRED',
    sessionId: 'web-session',
    evidence: [{ type: 'tool-history', authority: 'runtime', ref: 'web', summary: 'approval boundary' }],
    data: {},
  }
}

async function listen(server: Server): Promise<number> {
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', () => resolve())
  })
  return (server.address() as { port: number }).port
}

describe('DeepCanary Web contract', () => {
  it('serves state, settings, and actions while leaving client mounting to DSH', async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), 'deepcanary-web-'))
    const service = new DeepCanaryService({ logger: {} } as never, { stateDir: directory, maxInboxItems: 50 })
    const routes = new Map<string, { methods: readonly string[]; fetch: (request: Request) => Promise<Response> }>()
    const injected: Array<(rows: any[]) => void> = []
    let disposeRoutes: (() => void) | undefined
    const context = {
      inject: (_services: string[], callback: (ctx: any) => void) => callback({
        connection: { fetch: {
          register: (route: { path: string; methods: readonly string[]; fetch: (request: Request) => Promise<Response> }) => {
            routes.set(route.path, route)
            return async () => { routes.delete(route.path) }
          },
        } },
        on: (event: string, listener: (rows: any[]) => void) => {
          if (event === 'webserver/index-inject') injected.push(listener)
          if (event === 'dispose') disposeRoutes = listener as unknown as () => void
        },
      }),
    }
    installWebRoutes(context, service)
    const server = createServer((req, res) => {
      const pathname = new URL(req.url ?? '/', 'http://127.0.0.1').pathname
      const route = routes.get(pathname)
      if (route === undefined) {
        res.statusCode = 404
        res.end()
        return
      }
      void (async () => {
        if (!route.methods.includes(req.method ?? 'GET')) { res.statusCode = 405; res.end(); return }
        const chunks: Buffer[] = []
        for await (const chunk of req) chunks.push(Buffer.from(chunk))
        const request = new Request(new URL(req.url ?? '/', 'http://127.0.0.1'), {
          method: req.method ?? 'GET', headers: req.headers as Record<string, string>,
          ...(chunks.length ? { body: Buffer.concat(chunks) } : {}),
        })
        const response = await route.fetch(request)
        res.statusCode = response.status
        response.headers.forEach((value, key) => res.setHeader(key, value))
        res.end(Buffer.from(await response.arrayBuffer()))
      })()
    })
    servers.push(server)
    const port = await listen(server)
    try {
      await service.ready
      const item = await service.ingest(signal())
      expect(item).toBeDefined()
      const state = await fetch(`http://127.0.0.1:${port}/api/dsh-deepcanary/state`)
      expect(state.status).toBe(200)
      const stateBody = await state.json()
      expect(stateBody.settings.maxInterruptsPerHour).toBe(3)
      expect(stateBody.status.workspace).not.toHaveProperty('canonicalId')
      expect(stateBody.status.workspace).not.toHaveProperty('hostPath')
      expect(stateBody.status.workspace).not.toHaveProperty('wslPath')
      expect(stateBody.status.reconciliation).toMatchObject({ phase: 'unavailable', authoritative: false, verified: false })
      expect(state.headers.get('etag')).toMatch(/^W\/"dc-\d+"$/)
      const supervisor = await fetch(`http://127.0.0.1:${port}/api/dsh-deepcanary/supervisor`)
      expect(supervisor.status).toBe(200)
      expect(await supervisor.json()).toMatchObject({
        schemaVersion: 2,
        supervisorSchemaVersion: 1,
        status: { state: 'inactive', leaseHeld: false },
        snapshot: { schemaVersion: 1, pending: expect.any(Array) },
      })
      const unchanged = await fetch(`http://127.0.0.1:${port}/api/dsh-deepcanary/state`, { headers: { 'if-none-match': state.headers.get('etag') ?? '' } })
      expect(unchanged.status).toBe(304)

      const settings = await fetch(`http://127.0.0.1:${port}/api/dsh-deepcanary/settings`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ maxInterruptsPerHour: 5, openOnCritical: true, quietHours: { enabled: true, start: '23:00', end: '07:00' } }) })
      expect(settings.status).toBe(405)
      expect(service.settings().maxInterruptsPerHour).toBe(3)

      const actionPayload = { id: item?.id, action: 'feedback', useful: true, requestId: 'web-feedback-1' }
      const action = await fetch(`http://127.0.0.1:${port}/api/dsh-deepcanary/action`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(actionPayload) })
      expect(action.status).toBe(200)
      const actionBody = await action.json()
      expect(actionBody).toMatchObject({ schemaVersion: 2, requestId: 'web-feedback-1', updated: true })
      const replay = await fetch(`http://127.0.0.1:${port}/api/dsh-deepcanary/action`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(actionPayload) })
      expect(replay.status).toBe(200)
      expect(await replay.json()).toEqual(actionBody)
      const explanation = await fetch(`http://127.0.0.1:${port}/api/dsh-deepcanary/explain?id=${encodeURIComponent(item?.id ?? '')}`)
      expect(explanation.status).toBe(200)
      expect((await explanation.json()).decisionTrace).toMatchObject({ finalLevel: 'C2', finalAction: 'INTERRUPT' })
      const dryRun = await fetch(`http://127.0.0.1:${port}/api/dsh-deepcanary/dry-run`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ signal: { kind: 'HUMAN_APPROVAL_REQUIRED', authority: 'runtime', severityHint: 2 }, candidate: { notificationLevel: 'C1' } }) })
      expect(dryRun.status).toBe(200)
      expect(await dryRun.json()).toMatchObject({ mode: 'dry-run', readOnly: true, changed: true, candidate: { action: 'INBOX' } })
      const outcome = await fetch(`http://127.0.0.1:${port}/api/dsh-deepcanary/outcome`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id: item?.id, source: 'controlled', trialId: 'web-controlled-01', opened: true, acknowledged: true, feedback: 'useful', laterOutcome: 'continued', latencyBucket: 'under-1m' }) })
      expect(outcome.status).toBe(200)
      expect((await outcome.json()).receipt).toMatchObject({ source: 'controlled', trialId: 'web-controlled-01', feedback: 'useful' })
      const outcomes = await fetch(`http://127.0.0.1:${port}/api/dsh-deepcanary/outcomes?source=controlled&trialId=web-controlled-01`)
      expect(outcomes.status).toBe(200)
      expect(await outcomes.json()).toMatchObject({ outcomeSchemaVersion: 1, count: 1 })
      const deleted = await fetch(`http://127.0.0.1:${port}/api/dsh-deepcanary/outcomes/delete`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ source: 'controlled', trialId: 'web-controlled-01' }) })
      expect(deleted.status).toBe(200)
      expect(await deleted.json()).toMatchObject({ outcomeSchemaVersion: 1, removed: 1, remaining: 0 })
      const invalidDelete = await fetch(`http://127.0.0.1:${port}/api/dsh-deepcanary/outcomes/delete`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' })
      expect(invalidDelete.status).toBe(400)
      const clientSource = await readFile(new URL('../src/client/index.ts', import.meta.url), 'utf8')
      expect(routes.has('/api/dsh-deepcanary/client.js')).toBe(false)
      expect(clientSource).toContain('textContent')
      expect(clientSource).not.toContain('innerHTML')
      expect(clientSource).toContain('sidebar.footer.action')
      expect(clientSource).toContain('shell.overlay')
      expect(clientSource).toContain('data-deepcanary-close')
      expect(clientSource).toContain('ResizeHandle')
      expect(clientSource).toContain('satisfies Record<keyof typeof zh, string>')
      expect(injected).toHaveLength(0)
      expect(routes.size).toBe(10)
      // Lifetime is scoped by the public connection registry.
      expect(disposeRoutes).toBeUndefined()
      const legacy = await fetch(`http://127.0.0.1:${port}/dsh-deepcanary/health`)
      expect(legacy.status).toBe(404)
      const oversized = await fetch(`http://127.0.0.1:${port}/api/dsh-deepcanary/action`, {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ secret: 'x'.repeat(32_001) }),
      })
      expect(oversized.status).toBe(413)
      const invalid = await fetch(`http://127.0.0.1:${port}/api/dsh-deepcanary/action`, { method: 'POST', body: '{}' })
      expect(invalid.status).toBe(415)
      const missing = await fetch(`http://127.0.0.1:${port}/api/dsh-deepcanary/explain?id=private-path`)
      expect(await missing.text()).not.toContain('private-path')
    } finally {
      await service.dispose()
      await rm(directory, { recursive: true, force: true })
    }
  })
})
