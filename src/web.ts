import type { ConnectionFetchRoute, HostConnectionFetch } from '@deepseek-ai/dsh-client-connection'
import type { DeepCanaryService } from './service.js'
import { ATTENTION_PROTOCOL_VERSION, OUTCOME_RECEIPT_SCHEMA_VERSION } from './types.js'
import type { OutcomeSource } from './types.js'

/** Exact Fetch routes are admitted by DSH's public, authenticated shared API. */
export const API_BASE_PATH = '/api/dsh-deepcanary'
const MAX_BODY_BYTES = 32_000
type FetchRoute = ConnectionFetchRoute
interface ConnectionContext {
  connection?: { fetch?: HostConnectionFetch }
}

function json(status: number, value: unknown, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(value), { status, headers: {
    'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...headers,
  } })
}
function etagFor(revision: number): string { return `W/"dc-${revision}"` }
class InvalidBody extends Error {
  constructor(readonly status: number) { super('invalid request body') }
}
async function body(request: Request): Promise<Record<string, unknown>> {
  if (request.headers.get('content-type')?.split(';')[0]?.trim().toLowerCase() !== 'application/json') throw new InvalidBody(415)
  const declaredLength = Number(request.headers.get('content-length') ?? 0)
  if (declaredLength > MAX_BODY_BYTES) throw new InvalidBody(413)
  const reader = request.body?.getReader()
  if (!reader) throw new InvalidBody(400)
  const chunks: Uint8Array[] = []
  let size = 0
  try {
    for (;;) {
      const next = await reader.read()
      if (next.done) break
      size += next.value.byteLength
      // Releasing the reader stops consumption; the public bridge closes an unread request after its response.
      if (size > MAX_BODY_BYTES) throw new InvalidBody(413)
      chunks.push(next.value)
    }
  } finally { reader.releaseLock() }
  const bytes = new Uint8Array(size)
  let offset = 0
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength }
  const value: unknown = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes))
  if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new InvalidBody(400)
  return value as Record<string, unknown>
}
function sourceParam(value: string | null): OutcomeSource | undefined {
  if (value === null) return undefined
  if (value === 'real' || value === 'controlled' || value === 'replay') return value
  throw new Error('invalid source')
}
function outcomeQuery(request: Request) {
  const query = new URL(request.url).searchParams
  const trialId = query.get('trialId') ?? undefined
  if (trialId !== undefined && !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(trialId)) throw new Error('invalid trial')
  const source = sourceParam(query.get('source'))
  return { query, trialId, source }
}

export function installWebRoutes(ctx: unknown, service: DeepCanaryService): void {
  const context = ctx as { inject?: (services: string[], callback: (ctx: ConnectionContext) => unknown) => unknown }
  context.inject?.(['connection'], connectionCtx => {
    const registry = connectionCtx.connection?.fetch
    if (!registry?.register) return
    const register = (suffix: string, methods: FetchRoute['methods'], handler: FetchRoute['fetch']) => {
      // The registry owns contribution lifetime. No unauthenticated WebServer fallback.
      registry.register({ path: `${API_BASE_PATH}/${suffix}`, methods, requestBody: methods.includes('POST') ? 'streaming' : 'buffered', fetch: async request => {
        try { return await handler(request) } catch (error: unknown) {
          return json(error instanceof InvalidBody ? error.status : 400, {
            error: `invalid ${suffix} request`, schemaVersion: ATTENTION_PROTOCOL_VERSION,
          })
        }
      } })
    }
    register('state', ['GET'], async request => {
      const snapshot = service.snapshot()
      const etag = etagFor(snapshot.revision)
      if (request.headers.get('if-none-match') === etag) return new Response(null, { status: 304, headers: { etag, 'cache-control': 'no-store' } })
      return json(200, snapshot, { etag })
    })
    register('settings', ['GET'], async () => {
      const settings = service.settings()
      return json(200, settings, { etag: etagFor(service.status().revision) })
    })
    register('health', ['GET'], async () => {
      const status = service.status()
      return json(200, { ok: true, schemaVersion: ATTENTION_PROTOCOL_VERSION, revision: status.revision,
        plugin: status.plugin, sessions: status.sessions, tools: status.tools, supervisor: status.supervisor })
    })
    register('action', ['POST'], async request => {
      const payload = await body(request)
      const receipt = await service.performAction(typeof payload.requestId === 'string' ? payload.requestId : '',
        typeof payload.id === 'string' ? payload.id : '', typeof payload.action === 'string' ? payload.action : '', payload)
      return json(receipt.status, receipt.body)
    })
    register('explain', ['GET'], async request => {
      const result = service.explain(new URL(request.url).searchParams.get('id') ?? '')
      return result === undefined ? json(404, { found: false, schemaVersion: ATTENTION_PROTOCOL_VERSION }) : json(200, result)
    })
    register('dry-run', ['POST'], async request => json(200, await service.dryRun(await body(request) as unknown as Parameters<DeepCanaryService['dryRun']>[0])))
    register('outcomes', ['GET'], async request => {
      const { query, source, trialId } = outcomeQuery(request)
      const common = { schemaVersion: ATTENTION_PROTOCOL_VERSION, outcomeSchemaVersion: OUTCOME_RECEIPT_SCHEMA_VERSION }
      const limit = Number(query.get('limit') ?? 100)
      if (!Number.isSafeInteger(limit) || limit < 1 || limit > 2_000) throw new Error('invalid limit')
      const receipts = service.outcomes(limit, source, trialId)
      return json(200, { ...common, count: receipts.length, receipts })
    })
    register('outcomes/delete', ['POST'], async request => {
      const common = { schemaVersion: ATTENTION_PROTOCOL_VERSION, outcomeSchemaVersion: OUTCOME_RECEIPT_SCHEMA_VERSION }
      const filter = await body(request)
      if (Object.keys(filter).some(key => !['source', 'trialId', 'before'].includes(key))) throw new Error('invalid deletion filter')
      for (const value of Object.values(filter)) if (typeof value !== 'string') throw new Error('invalid deletion filter')
      const source = sourceParam(typeof filter.source === 'string' ? filter.source : null)
      const trialId = typeof filter.trialId === 'string' ? filter.trialId : undefined
      if (trialId !== undefined && !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(trialId)) throw new Error('invalid trial')
      const before = typeof filter.before === 'string' ? filter.before : undefined
      const removed = await service.deleteOutcomes({ ...(source === undefined ? {} : { source }),
        ...(trialId === undefined ? {} : { trialId }), ...(before === undefined ? {} : { before }) })
      return json(200, { ...common, removed, remaining: service.outcomes(2_000).length })
    })
    register('outcome', ['POST'], async request => {
      const payload = await body(request)
      const id = typeof payload.id === 'string' ? payload.id : ''
      delete payload.id
      const receipt = await service.recordOutcome(id, payload)
      const common = { schemaVersion: ATTENTION_PROTOCOL_VERSION, outcomeSchemaVersion: OUTCOME_RECEIPT_SCHEMA_VERSION }
      return receipt === undefined ? json(404, { ...common, found: false }) : json(200, { ...common, receipt })
    })
    register('supervisor', ['GET'], async () => {
      const status = service.supervisor.status()
      return json(200, { schemaVersion: ATTENTION_PROTOCOL_VERSION, supervisorSchemaVersion: status.schemaVersion,
        status, snapshot: service.supervisor.snapshot() })
    })
  })
}
