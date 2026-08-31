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
    const routes = new Map<string, { handler: (req: any, res: any) => void | Promise<void> }>()
    const injected: Array<(rows: any[]) => void> = []
    let disposeRoutes: (() => void) | undefined
    const context = {
      inject: (_services: string[], callback: (ctx: any) => void) => callback({
        webServer: {
          register: (route: { path: string; handler: (req: any, res: any) => void | Promise<void> }) => {
            routes.set(route.path, route)
            return () => routes.delete(route.path)
          },
        },
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
      void route.handler(req, res)
    })
    servers.push(server)
    const port = await listen(server)
    try {
      await service.ready
      const item = await service.ingest(signal())
      expect(item).toBeDefined()
      const state = await fetch(`http://127.0.0.1:${port}/dsh-deepcanary/state`)
      expect(state.status).toBe(200)
      expect((await state.json()).settings.maxInterruptsPerHour).toBe(3)
      expect(state.headers.get('etag')).toMatch(/^W\/"dc-\d+"$/)
      const unchanged = await fetch(`http://127.0.0.1:${port}/dsh-deepcanary/state`, { headers: { 'if-none-match': state.headers.get('etag') ?? '' } })
      expect(unchanged.status).toBe(304)

      const settings = await fetch(`http://127.0.0.1:${port}/dsh-deepcanary/settings`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ maxInterruptsPerHour: 5, openOnCritical: true, quietHours: { enabled: true, start: '23:00', end: '07:00' } }) })
      expect(settings.status).toBe(200)
      expect((await settings.json()).maxInterruptsPerHour).toBe(5)

      const actionPayload = { id: item?.id, action: 'feedback', useful: true, requestId: 'web-feedback-1' }
      const action = await fetch(`http://127.0.0.1:${port}/dsh-deepcanary/action`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(actionPayload) })
      expect(action.status).toBe(200)
      const actionBody = await action.json()
      expect(actionBody).toMatchObject({ schemaVersion: 2, requestId: 'web-feedback-1', updated: true })
      const replay = await fetch(`http://127.0.0.1:${port}/dsh-deepcanary/action`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(actionPayload) })
      expect(replay.status).toBe(200)
      expect(await replay.json()).toEqual(actionBody)
      const clientSource = await readFile(new URL('../src/client/index.ts', import.meta.url), 'utf8')
      expect(routes.has('/dsh-deepcanary/client.js')).toBe(false)
      expect(clientSource).toContain('textContent')
      expect(clientSource).not.toContain('innerHTML')
      expect(clientSource).toContain('sidebar.footer.action')
      expect(clientSource).toContain('shell.overlay')
      expect(clientSource).toContain('data-deepcanary-close')
      expect(clientSource).toContain('ResizeHandle')
      expect(clientSource).toContain('satisfies Record<keyof typeof zh, string>')
      expect(injected).toHaveLength(0)
      expect(routes.size).toBe(4)
      disposeRoutes?.()
      expect(routes.size).toBe(0)
      installWebRoutes(context, service)
      expect(routes.size).toBe(4)
      disposeRoutes?.()
      expect(routes.size).toBe(0)
    } finally {
      await service.dispose()
      await rm(directory, { recursive: true, force: true })
    }
  })
})
