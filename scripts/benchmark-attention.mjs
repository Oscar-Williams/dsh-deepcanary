import { mkdtemp, readFile, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { performance } from 'node:perf_hooks'

const { DeepCanaryService } = await import('../lib/service.js')
const stateDir = await mkdtemp(path.join(os.tmpdir(), 'deepcanary-benchmark-'))
const service = new DeepCanaryService({ logger: {} }, {
  stateDir,
  notificationLevel: 'C1',
  dedupeWindowMinutes: 0,
  bundleWindowSeconds: 0,
  maxInboxItems: 500,
  healthPollSeconds: 300,
})
const requestedTotal = Number.parseInt(process.env.DSH_BENCHMARK_EVENTS ?? '1000', 10)
const total = Number.isSafeInteger(requestedTotal) && requestedTotal > 0 ? requestedTotal : 1000
const requestedSessions = Number.parseInt(process.env.DSH_BENCHMARK_SESSIONS ?? '4', 10)
const sessionCount = Number.isSafeInteger(requestedSessions) && requestedSessions > 0 ? Math.min(requestedSessions, 32) : 4
const started = performance.now()
const cpuStarted = process.cpuUsage()
const memoryStarted = process.memoryUsage()
let peakMemory = memoryStarted
let disposed = false
try {
  await service.ready
  const loadSignals = Array.from({ length: total }, (_, index) => {
    const sessionIndex = index % sessionCount
    const kind = index % 97 === 0
      ? 'HOST_UNREACHABLE'
      : index % 89 === 0
        ? 'HUMAN_QUESTION_PENDING'
        : 'TASK_COMPLETED'
    const authority = kind === 'HOST_UNREACHABLE' ? 'host' : 'runtime'
    return {
      schemaVersion: 1,
      id: `benchmark-${index}`,
      occurredAt: new Date(1_000 + index).toISOString(),
      source: kind === 'HOST_UNREACHABLE' ? 'host' : 'session',
      kind,
      sessionId: `benchmark-session-${sessionIndex}`,
      workspaceId: `benchmark-workspace-${sessionIndex % 2}`,
      severityHint: kind === 'HOST_UNREACHABLE' ? 3 : kind === 'HUMAN_QUESTION_PENDING' ? 2 : 1,
      evidence: [{ type: kind === 'HOST_UNREACHABLE' ? 'http-probe' : 'session-event', authority, ref: `benchmark-${index}`, summary: 'Synthetic benchmark event' }],
      dedupeKey: `benchmark-${index}`,
      bundleKey: `benchmark-session-${sessionIndex}`,
      data: {},
    }
  })
  const reconnectSignals = Array.from({ length: sessionCount }, (_, sessionIndex) => [
    {
      schemaVersion: 1,
      id: `reconnect-failure-${sessionIndex}`,
      occurredAt: new Date(10_000 + sessionIndex * 2).toISOString(),
      source: 'host',
      kind: 'HOST_UNREACHABLE',
      sessionId: `reconnect-session-${sessionIndex}`,
      evidence: [{ type: 'http-probe', authority: 'host', ref: `reconnect-failure-${sessionIndex}`, summary: 'Synthetic reconnect failure' }],
      dedupeKey: `reconnect-failure-${sessionIndex}`,
      bundleKey: `reconnect-session-${sessionIndex}`,
      data: {},
    },
    {
      schemaVersion: 1,
      id: `reconnect-recovered-${sessionIndex}`,
      occurredAt: new Date(10_001 + sessionIndex * 2).toISOString(),
      source: 'host',
      kind: 'HOST_STALL_RECOVERED',
      sessionId: `reconnect-session-${sessionIndex}`,
      evidence: [{ type: 'runtime-probe', authority: 'runtime', ref: `reconnect-recovered-${sessionIndex}`, summary: 'Synthetic reconnect recovery' }],
      dedupeKey: `reconnect-recovered-${sessionIndex}`,
      bundleKey: `reconnect-session-${sessionIndex}`,
      data: {},
    },
  ]).flat()

  const results = []
  const batchSize = 250
  for (let offset = 0; offset < loadSignals.length; offset += batchSize) {
    const batch = loadSignals.slice(offset, offset + batchSize)
    results.push(...await Promise.all(batch.map(signal => service.ingest(signal))))
    peakMemory = maxMemory(peakMemory, process.memoryUsage())
  }
  const reconnectResults = await Promise.all(reconnectSignals.map(signal => service.ingest(signal)))
  peakMemory = maxMemory(peakMemory, process.memoryUsage())
  const elapsedMs = Math.max(0.001, performance.now() - started)
  const cpuUsed = process.cpuUsage(cpuStarted)
  const memoryEnded = process.memoryUsage()
  const cpuMicros = cpuUsed.user + cpuUsed.system
  const eventsResolved = results.filter(Boolean).length + reconnectResults.filter(Boolean).length
  const report = {
    benchmark: 'attention-load',
    eventsSubmitted: loadSignals.length + reconnectSignals.length,
    eventsResolved,
    reconnectEventsSubmitted: reconnectSignals.length,
    reconnectEventsResolved: reconnectResults.filter(Boolean).length,
    droppedEvents: loadSignals.length + reconnectSignals.length - eventsResolved,
    elapsedMs: Number(elapsedMs.toFixed(3)),
    eventsPerSecond: Number((loadSignals.length / (elapsedMs / 1000)).toFixed(2)),
    sessions: sessionCount,
    loadBatchSize: batchSize,
    retainedInboxItems: service.snapshot().inbox.length,
    maxInboxItems: service.config.maxInboxItems,
    cpuUserMicros: cpuUsed.user,
    cpuSystemMicros: cpuUsed.system,
    cpuPercentOfOneCore: Number(((cpuMicros / 1_000) / elapsedMs * 100).toFixed(2)),
    heapUsedBytes: memoryEnded.heapUsed,
    heapDeltaBytes: memoryEnded.heapUsed - memoryStarted.heapUsed,
    rssDeltaBytes: memoryEnded.rss - memoryStarted.rss,
    peakHeapUsedBytes: peakMemory.heapUsed,
    peakRssBytes: peakMemory.rss,
    generatedAt: new Date().toISOString(),
  }
  await service.dispose()
  disposed = true
  report.stateBytes = (await readFile(service.store.file)).byteLength
  console.log(JSON.stringify(report, null, 2))
} finally {
  if (!disposed) await service.dispose()
  await rm(stateDir, { recursive: true, force: true })
}

function maxMemory(previous, current) {
  return {
    rss: Math.max(previous.rss, current.rss),
    heapTotal: Math.max(previous.heapTotal, current.heapTotal),
    heapUsed: Math.max(previous.heapUsed, current.heapUsed),
    external: Math.max(previous.external, current.external),
    arrayBuffers: Math.max(previous.arrayBuffers, current.arrayBuffers),
  }
}
