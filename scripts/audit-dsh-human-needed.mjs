import { createHash } from 'node:crypto'
import { execFile } from 'node:child_process'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'

const root = fileURLToPath(new URL('..', import.meta.url))
const execFileAsync = promisify(execFile)
const args = new Map()
for (let index = 2; index < process.argv.length; index += 1) {
  const key = process.argv[index]
  const value = process.argv[index + 1]
  if (key?.startsWith('--') && value !== undefined && !value.startsWith('--')) {
    args.set(key.slice(2), value)
    index += 1
  }
}

const sessionLog = args.get('session-log')
const runId = args.get('run-id')
const trialId = args.get('trial-id')
const outputPath = path.resolve(root, args.get('out') ?? 'output/dogfood/dsh-human-needed-audit.json')
const runtimeLedgerPath = args.has('runtime-ledger') ? path.resolve(root, args.get('runtime-ledger')) : undefined
if (!sessionLog || !runId || !trialId) throw new Error('--session-log, --run-id, and --trial-id are required')

const sessionLogPath = path.resolve(sessionLog)
const sessionLogBytes = await readFile(sessionLogPath)
const sessionLogDigest = createHash('sha256').update(sessionLogBytes).digest('hex')
let decompressed
if (sessionLogPath.endsWith('.zstd')) {
  const zstd = process.env.DSH_ZSTD_BIN ?? 'zstd.exe'
  decompressed = (await execFileAsync(zstd, ['-d', '-c', sessionLogPath], { maxBuffer: 64 * 1024 * 1024 })).stdout
} else {
  decompressed = sessionLogBytes.toString('utf8')
}

const events = []
for (const line of decompressed.split(String.fromCharCode(10)).filter(Boolean)) {
  try {
    const event = JSON.parse(line)
    if (event && typeof event === 'object') events.push(event)
  } catch {
    // A malformed line is reported as a scan failure below without retaining it.
  }
}
if (events.length === 0) throw new Error('session history contained no parseable events')

const hashRef = value => createHash('sha256').update(String(value)).digest('hex').slice(0, 16)
const firstSessionEvent = events.find(event => event.type === 'session' && typeof event.id === 'string')
const sessionRef = hashRef(firstSessionEvent?.id ?? sessionLogDigest)
const eventTypeCounts = new Map()
for (const event of events) eventTypeCounts.set(event.type ?? 'unknown', (eventTypeCounts.get(event.type ?? 'unknown') ?? 0) + 1)

function toolNameOf(event) {
  const data = event?.data
  if (!data || typeof data !== 'object') return undefined
  for (const key of ['toolName', 'name', 'tool', 'functionName']) {
    if (typeof data[key] === 'string') return data[key]
  }
  return undefined
}

function humanAnchorOf(event) {
  if (event.type === 'approval/asked') return { anchorKind: 'approval', expectedLevel: 'C3', expectedAction: 'ESCALATE' }
  if (event.type === 'user-questions/request') return { anchorKind: 'question', expectedLevel: 'C3', expectedAction: 'ESCALATE' }
  const toolName = toolNameOf(event)
  if (event.type === 'tool/call' && typeof toolName === 'string' && /ask[_-]?user[_-]?question|clarif|approval/i.test(toolName)) {
    return { anchorKind: /approval/i.test(toolName) ? 'approval' : 'question', expectedLevel: 'C3', expectedAction: 'ESCALATE' }
  }
  return undefined
}

let runtimeLedger
if (runtimeLedgerPath !== undefined) {
  runtimeLedger = JSON.parse(await readFile(runtimeLedgerPath, 'utf8'))
  if (!Array.isArray(runtimeLedger.observations)) throw new Error('runtime ledger has no observations array')
}

function runtimeMatch(anchor, event) {
  const observations = runtimeLedger?.observations ?? []
  const subtype = anchor.anchorKind === 'approval' ? 'approval' : 'question'
  const candidates = observations.filter(observation => observation.eventClass === 'human-needed'
    && (observation.eventSubtype === subtype || observation.eventSubtype === `${subtype}-pending`)
  )
  if (candidates.length !== 1) return undefined
  const candidate = candidates[0]
  if (typeof event.time === 'number' && typeof candidate.occurredAt === 'string' && Number.isFinite(Date.parse(candidate.occurredAt))) {
    if (Math.abs(event.time - Date.parse(candidate.occurredAt)) > 5 * 60 * 1000) return undefined
  }
  return candidate
}

const findings = []
for (const event of events) {
  const anchor = humanAnchorOf(event)
  if (anchor === undefined) continue
  const match = runtimeMatch(anchor, event)
  let disposition = 'missed'
  if (match?.decisionDisposition === 'c0-silent' || match?.decisionDisposition === 'deduped' || match?.decisionDisposition === 'bundle-merged' || match?.decisionDisposition === 'suppressed') disposition = 'suppressed-by-policy'
  else if (match?.deliveryChannel === 'inbox' || match?.deliveryChannel === 'browser-notification' || match?.deliveryChannel === 'native-toast') disposition = 'delivered'
  findings.push({
    anchorKind: anchor.anchorKind,
    disposition,
    expectedLevel: anchor.expectedLevel,
    expectedAction: anchor.expectedAction,
    sessionRef,
    ...(typeof event.seq === 'number' ? { sessionSeq: event.seq } : {}),
    ...(typeof event.time === 'number' ? { occurredAt: new Date(event.time).toISOString() } : {}),
    ...(match?.observationRef === undefined ? {} : { matchedObservationRef: match.observationRef }),
    ...(match?.deliveryUnitRef === undefined ? {} : { matchedDeliveryUnitRef: match.deliveryUnitRef }),
    primaryAttribution: match === undefined ? 'unmatched-runtime-observation' : 'runtime-ledger',
    evidenceRefs: [`session-log-sha256:${sessionLogDigest}`],
  })
}

const counts = {
  delivered: findings.filter(finding => finding.disposition === 'delivered').length,
  suppressedByPolicy: findings.filter(finding => finding.disposition === 'suppressed-by-policy').length,
  missed: findings.filter(finding => finding.disposition === 'missed').length,
  notInScope: [...eventTypeCounts.entries()]
    .filter(([type]) => type === 'permission/preset' || type === 'approval/policy' || type === 'sandbox/mode')
    .reduce((total, [, count]) => total + count, 0),
}
const report = {
  schemaVersion: 1,
  auditId: `dsh-history-${hashRef(`${runId}:${sessionRef}`)}`,
  runId,
  trialId,
  authority: 'DSH-authoritative-session-history',
  sessionRef,
  scan: {
    source: 'compressed-persisted-session-history',
    eventCount: events.length,
    eventTypeCounts: Object.fromEntries([...eventTypeCounts.entries()].sort(([a], [b]) => a.localeCompare(b))),
    independentOfRuntimeLedger: true,
    runtimeLedgerUsedOnlyForMatching: runtimeLedgerPath !== undefined,
  },
  findings,
  counts,
  humanNeededRecall: findings.length === 0 && counts.missed === 0
    ? { numerator: 0, denominator: 0, rate: null, status: 'no-data' }
    : { numerator: counts.delivered, denominator: counts.delivered + counts.missed, rate: counts.delivered / (counts.delivered + counts.missed), status: counts.missed === 0 ? 'observed-sample' : 'miss-detected' },
  reviewer: 'Codex',
  reviewedAt: new Date().toISOString(),
  evidenceRefs: [`session-log-sha256:${sessionLogDigest}`],
  privacy: {
    rawContentPersisted: false,
    promptTranscriptModelOutputToolArgsCredentialsAndCompletePathsIncluded: false,
  },
}
if (runtimeLedgerPath !== undefined) report.evidenceRefs.push(`runtime-ledger-sha256:${createHash('sha256').update(await readFile(runtimeLedgerPath)).digest('hex')}`)
await mkdir(path.dirname(outputPath), { recursive: true })
await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8')
console.log(JSON.stringify({ outputPath, sessionRef, events: events.length, findings: findings.length, counts, humanNeededRecall: report.humanNeededRecall }, null, 2))
if (counts.missed > 0) process.exitCode = 2
