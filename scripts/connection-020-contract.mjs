import { request as httpRequest } from 'node:http'
import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { loadRuntimeCheckout, rc020 } from './runtime-checkout.mjs'
import { installWebRoutes } from '../lib/web.js'
import { DeepCanaryService } from '../lib/service.js'

const runtime = await loadRuntimeCheckout(process.env.DSH_020_RUNTIME, rc020)
const { Context } = await runtime.importPackage('@deepseek-ai/cordis')
const { CredentialProvider } = await runtime.importPackage('@deepseek-ai/dsh-credentials')
const { default: WebServer } = await runtime.importPackage('@deepseek-ai/dsh-host-webserver')
const connectionPlugin = await runtime.importPackage('@deepseek-ai/dsh-client-connection')
class TestCredentials extends CredentialProvider {
  records = new Map()
  async modifyRecord(key, mutate) {
    const value = await mutate(this.records.get(key))
    if (value === undefined) this.records.delete(key)
    else this.records.set(key, value)
    return value
  }
}
const ctx = new Context()
const fibers = []
const directory = await mkdtemp(path.join(os.tmpdir(), 'deepcanary-auth-contract-'))
let service
const checks = {}
try {
  fibers.push(await ctx.plugin(TestCredentials))
  fibers.push(await ctx.plugin(WebServer, { host: '127.0.0.1', port: 0 }))
  fibers.push(await ctx.plugin(connectionPlugin, { maxRequestBodyBytes: 64_000 }))
  service = new DeepCanaryService(ctx, { stateDir: directory })
  await service.ready
  const routeFiber = await ctx.plugin(pluginCtx => installWebRoutes(pluginCtx, service))
  fibers.push(routeFiber)
  const base = `http://127.0.0.1:${ctx.webServer.port}`
  const health = `${base}/api/dsh-deepcanary/health`
  assert.equal((await fetch(health)).status, 401)
  checks.unauthenticatedRejected = true
  // Exercise the public index exchange with newly generated test-only credentials.
  const disposeIndex = ctx.webServer.register({ kind: 'exact', path: '/', handler: (req, res) => {
    if (ctx.connection.authorizeIndex(req, res)) { res.statusCode = 200; res.end('test index') }
  } })
  const exchange = await fetch(ctx.connection.authenticatedUrl(`${base}/`), { redirect: 'manual' })
  const cookie = exchange.headers.get('set-cookie')?.split(';')[0]
  assert.ok(cookie)
  const headers = { cookie }
  const response = await fetch(health, { headers })
  assert.equal(response.status, 200)
  assert.equal((await response.json()).plugin.version, '0.1.4-rc.1')
  checks.authenticatedVersion = true
  assert.equal((await fetch(health, { headers: { ...headers, origin: 'https://untrusted.example' } })).status, 403)
  const untrustedHost = await new Promise((resolve, reject) => {
    const req = httpRequest(health, { headers: { ...headers, host: 'untrusted.example' } }, res => {
      res.resume()
      res.on('end', () => resolve(res.statusCode))
    })
    req.on('error', reject)
    req.end()
  })
  assert.equal(untrustedHost, 403)
  checks.originAndHostRejected = true
  assert.equal((await fetch(`${base}/dsh-deepcanary/health`, { headers })).status, 404)
  checks.legacyRouteRemoved = true
  for (const payload of ['[]', 'null', '{broken', JSON.stringify({ id: 'x'.repeat(32_001) })]) {
    const result = await fetch(`${base}/api/dsh-deepcanary/action`, {
      method: 'POST', headers: { ...headers, 'content-type': 'application/json' }, body: payload,
    })
    assert.ok([400, 413].includes(result.status))
    assert.ok(!(await result.text()).includes(directory))
  }
  const oversized = await fetch(`${base}/api/dsh-deepcanary/action`, {
    method: 'POST', headers: { ...headers, 'content-type': 'application/json' }, body: 'x'.repeat(64_001),
  })
  assert.equal(oversized.status, 413)
  const chunkedStatus = await new Promise((resolve, reject) => {
    const req = httpRequest(base + '/api/dsh-deepcanary/action', {
      method: 'POST', headers: { ...headers, 'content-type': 'application/json' },
    }, res => { res.resume(); res.on('end', () => resolve(res.statusCode)) })
    req.on('error', reject)
    for (let i = 0; i < 33; i++) req.write('x'.repeat(1_024))
    req.end()
  })
  assert.equal(chunkedStatus, 413)
  const snapshot = await (await fetch(base + '/api/dsh-deepcanary/state', { headers })).json()
  for (const field of ['hostPath', 'wslPath', 'canonicalId']) assert.ok(!(field in snapshot.status.workspace))
  checks.bodyLimitsAndMalformedInput = true
  checks.chunkedStreamBoundAndPathPrivacy = true
  assert.equal(service.inbox(20).length, 0)
  await routeFiber.dispose()
  assert.equal((await fetch(health, { headers })).status, 404)
  checks.registrationLifetime = true
  disposeIndex()
  console.log(JSON.stringify({ passed: true, runtimeVersion: runtime.version, runtimeCommit: runtime.commit,
    provenance: 'controlled-public-connection-with-ephemeral-test-authentication', checks }, null, 2))
} finally {
  await service?.dispose()
  for (const fiber of fibers.reverse()) await fiber.dispose()
  await rm(directory, { recursive: true, force: true })
}
