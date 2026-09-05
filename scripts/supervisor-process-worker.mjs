import { createInterface } from 'node:readline'
import { PersistentSupervisor, supervisorSnapshotFor } from '../lib/supervisor.js'

const args = new Map()
for (let index = 2; index < process.argv.length; index += 1) {
  const value = process.argv[index]
  if (!value.startsWith('--')) continue
  const [key, inline] = value.slice(2).split('=', 2)
  args.set(key, inline ?? process.argv[++index])
}

const stateDir = args.get('state-dir')
if (typeof stateDir !== 'string' || stateDir.length === 0) throw new Error('--state-dir is required')
const instanceId = String(args.get('instance-id') ?? `u7-worker-${process.pid}`)
const staleLeaseMs = Number(args.get('stale-ms') ?? 500)
const heartbeatMs = Number(args.get('heartbeat-ms') ?? 100)
const runtimeVersion = String(args.get('runtime-version') ?? 'dsh-v0.1.2-alpha.5')

const supervisor = new PersistentSupervisor({
  stateDir,
  runtimeVersion,
  instanceId,
  staleLeaseMs,
  heartbeatMs,
  standbyRetryMs: 60_000,
  maxSessions: 16,
  maxPending: 64,
})

function emit(kind, extra = {}) {
  process.stdout.write(`${JSON.stringify({ kind, pid: process.pid, instanceId, ...extra })}\n`)
}

const started = await supervisor.start()
emit('started', { started, status: supervisor.status() })
if (started) {
  supervisor.update(supervisorSnapshotFor(
    runtimeVersion,
    'ready',
    1,
    [{ sessionRef: 'u7-session-a', attentionLevel: 'C3', pendingCount: 1 }],
    ['u7-item-a'],
    Date.now(),
  ))
  await supervisor.flush()
  emit('flushed', { status: supervisor.status(), snapshot: supervisor.snapshot() })
}

const input = createInterface({ input: process.stdin, crlfDelay: Infinity })
input.on('line', async line => {
  if (line.trim() === 'flush') {
    supervisor.update(supervisorSnapshotFor(
      runtimeVersion,
      'ready',
      2,
      [{ sessionRef: 'u7-session-b', attentionLevel: 'C2', pendingCount: 1 }],
      ['u7-item-b'],
      Date.now(),
    ))
    await supervisor.flush()
    emit('flush-result', { status: supervisor.status(), snapshot: supervisor.snapshot() })
    return
  }
  if (line.trim() === 'stop') {
    await supervisor.stop()
    emit('stopped', { status: supervisor.status() })
    input.close()
  }
})

await new Promise(resolve => input.once('close', resolve))
await supervisor.stop()
