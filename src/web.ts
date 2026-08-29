import { readFile } from 'node:fs/promises'
import type { IncomingMessage, ServerResponse } from 'node:http'
import type { DeepCanaryService } from './service.js'

const basePath = '/dsh-deepcanary'

function sendJson(res: ServerResponse, status: number, value: unknown): void {
  const body = JSON.stringify(value)
  res.statusCode = status
  res.setHeader('content-type', 'application/json; charset=utf-8')
  res.setHeader('cache-control', 'no-store')
  res.end(body)
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
    let updated = false
    if (action === 'acknowledge') updated = service.acknowledge(id)
    else if (action === 'mute') updated = service.mute(id)
    else if (action === 'snooze') updated = service.snooze(id, typeof payload.minutes === 'number' ? payload.minutes : 30)
    else if (action === 'feedback') updated = service.feedback(id, payload.useful === true, typeof payload.note === 'string' ? payload.note : undefined)
    else {
      sendJson(res, 400, { error: 'unsupported action' })
      return
    }
    sendJson(res, updated ? 200 : 404, { updated })
  } catch {
    sendJson(res, 400, { error: 'invalid action payload' })
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
        else sendJson(res, 200, service.snapshot())
      } }),
      server.register({ kind: 'exact', path: `${basePath}/health`, handler: (req, res) => {
        if (req.method !== 'GET') sendJson(res, 405, { error: 'GET required' })
        else sendJson(res, 200, { ok: true, plugin: service.status().plugin, sessions: service.status().sessions, tools: service.status().tools })
      } }),
      server.register({ kind: 'exact', path: `${basePath}/client.js`, handler: async (_req, res) => {
        try {
          const body = await readFile(new URL('./client.js', import.meta.url), 'utf8')
          res.statusCode = 200
          res.setHeader('content-type', 'application/javascript; charset=utf-8')
          res.setHeader('cache-control', 'no-store')
          res.end(body)
        } catch {
          sendJson(res, 503, { error: 'client bundle is not built' })
        }
      } }),
      server.register({ kind: 'exact', path: `${basePath}/action`, handler: (req, res) => actionHandler(req, res, service) }),
    ]

    webCtx.on?.('webserver/index-inject', (rows: any[]) => {
      rows.push({ kind: 'script-src', placement: 'body', src: `${basePath}/client.js` })
    })
    webCtx.on?.('dispose', () => { for (const dispose of disposers) dispose() })
  })
}
