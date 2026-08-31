import type { IncomingMessage, ServerResponse } from 'node:http'
import type { DeepCanaryService } from './service.js'
import { ATTENTION_PROTOCOL_VERSION } from './types.js'

const basePath = '/dsh-deepcanary'

function sendJson(res: ServerResponse, status: number, value: unknown, headers: Record<string, string> = {}): void {
  const body = JSON.stringify(value)
  res.statusCode = status
  res.setHeader('content-type', 'application/json; charset=utf-8')
  res.setHeader('cache-control', 'no-store')
  for (const [name, value] of Object.entries(headers)) res.setHeader(name, value)
  res.end(body)
}

function sendNotModified(res: ServerResponse, etag: string): void {
  res.statusCode = 304
  res.setHeader('cache-control', 'no-store')
  res.setHeader('etag', etag)
  res.end()
}

function etagFor(revision: number): string {
  return `W/"dc-${revision}"`
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let value = ''
    req.setEncoding('utf8')
    req.on('data', chunk => {
      value += chunk
      if (value.length > 32_000) reject(new Error('request body too large'))
    })
    req.on('end', () => resolve(value))
    req.on('error', reject)
  })
}

async function actionHandler(req: IncomingMessage, res: ServerResponse, service: DeepCanaryService): Promise<void> {
  if (req.method !== 'POST') {
    sendJson(res, 405, { error: 'POST required' })
    return
  }
  try {
    const payload = JSON.parse(await readBody(req)) as Record<string, unknown>
    const id = typeof payload.id === 'string' ? payload.id : ''
    const action = typeof payload.action === 'string' ? payload.action : ''
    const requestId = typeof payload.requestId === 'string' ? payload.requestId : ''
    const receipt = await service.performAction(requestId, id, action, payload)
    sendJson(res, receipt.status, receipt.body)
  } catch {
    sendJson(res, 400, { error: 'invalid action payload', schemaVersion: ATTENTION_PROTOCOL_VERSION })
  }
}

export function installWebRoutes(ctx: unknown, service: DeepCanaryService): void {
  const context = ctx as {
    inject?: (services: string[], callback: (ctx: any) => unknown) => unknown
  }
  context.inject?.(['webServer'], (webCtx: any) => {
    const server = webCtx.webServer as {
      register?: (route: { kind: 'exact'; path: string; handler: (req: IncomingMessage, res: ServerResponse) => void | Promise<void> }) => () => void
    } | undefined
    if (!server?.register) return
    const disposers = [
      server.register({ kind: 'exact', path: `${basePath}/state`, handler: (req, res) => {
        if (req.method !== 'GET') sendJson(res, 405, { error: 'GET required' })
        else {
          const snapshot = service.snapshot()
          const etag = etagFor(snapshot.revision)
          if (req.headers['if-none-match'] === etag) sendNotModified(res, etag)
          else sendJson(res, 200, snapshot, { etag })
        }
      } }),
      server.register({ kind: 'exact', path: `${basePath}/settings`, handler: async (req, res) => {
        if (req.method === 'GET') {
          sendJson(res, 200, service.settings(), { etag: etagFor(service.status().revision) })
          return
        }
        if (req.method !== 'POST') {
          sendJson(res, 405, { error: 'GET or POST required' })
          return
        }
        try {
          const payload = JSON.parse(await readBody(req)) as Record<string, unknown>
          const settings = await service.updateSettings(payload)
          sendJson(res, 200, settings, { etag: etagFor(service.status().revision) })
        } catch (error: unknown) {
          sendJson(res, 400, { error: error instanceof Error ? error.message : 'invalid settings payload' })
        }
      } }),
      server.register({ kind: 'exact', path: `${basePath}/health`, handler: (req, res) => {
        if (req.method !== 'GET') sendJson(res, 405, { error: 'GET required' })
        else {
          const status = service.status()
          sendJson(res, 200, { ok: true, schemaVersion: ATTENTION_PROTOCOL_VERSION, revision: status.revision, plugin: status.plugin, sessions: status.sessions, tools: status.tools })
        }
      } }),
      server.register({ kind: 'exact', path: `${basePath}/action`, handler: (req, res) => actionHandler(req, res, service) }),
    ]

    webCtx.on?.('dispose', () => { for (const dispose of disposers) dispose() })
  })
}
