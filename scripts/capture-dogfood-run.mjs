import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('..', import.meta.url))
const args = new Map()
for (let index = 2; index < process.argv.length; index += 1) {
  const key = process.argv[index]
  const value = process.argv[index + 1]
  if (key?.startsWith('--') && value !== undefined && !value.startsWith('--')) {
    args.set(key.slice(2), value)
    index += 1
  }
}

const stateDir = args.get('state-dir')
const runId = args.get('run-id')
const trialId = args.get('trial-id')
const taskFamily = args.get('task-family')
const scenario = args.get('scenario')
const startedAt = args.get('started-at')
const endedAt = args.get('ended-at')
const outputPath = path.resolve(root, args.get('out') ?? 'output/dogfood/real-run.json')
if (!stateDir || !runId || !trialId || !taskFamily || !scenario || !startedAt || !endedAt) {
  throw new Error('--state-dir, --run-id, --trial-id, --task-family, --scenario, --started-at, --ended-at, and --out are required')
}
const taskFamilies = new Set(['coding', 'build-test', 'research', 'multi-stage', 'subagent'])
const scenarios = new Set(['approval-boundary', 'network-recovery', 'healthy-long-run', 'normal-completion', 'explicit-failure', 'recovery-continued'])
if (!taskFamilies.has(taskFamily)) throw new Error(`unsupported task family: ${taskFamily}`)
if (!scenarios.has(scenario)) throw new Error(`unsupported dogfood scenario: ${scenario}`)
if (!Number.isFinite(Date.parse(startedAt)) || !Number.isFinite(Date.parse(endedAt)) || Date.parse(endedAt) < Date.parse(startedAt)) throw new Error('started-at and ended-at must be ordered ISO dates')

const resolvedStateDir = path.resolve(stateDir)
const inboxState = JSON.parse(await readFile(path.join(resolvedStateDir, 'inbox.json'), 'utf8'))
let outcomeState = { schemaVersion: 1, receipts: [] }
try { outcomeState = JSON.parse(await readFile(path.join(resolvedStateDir, 'outcomes.json'), 'utf8')) } catch (error) {
  if (!(error instanceof Error && 'code' in error && error.code === 'ENOENT')) throw error
}
if (inboxState?.schemaVersion !== 1 || !Array.isArray(inboxState.items)) throw new Error('state directory does not contain a valid inbox.json')
if (outcomeState?.schemaVersion !== 1 || !Array.isArray(outcomeState.receipts)) throw new Error('state directory does not contain a valid outcomes.json')

const { isDogfoodBundle } = await import('../lib/dogfood.js')
const runtimeFileName = args.get('dogfood-file')
const runtimeFile = path.join(resolvedStateDir, runtimeFileName ?? 'dogfood.json')
let runtimeBundle
try {
  const candidate = JSON.parse(await readFile(runtimeFile, 'utf8'))
  if (!isDogfoodBundle(candidate)) throw new Error('runtime dogfood ledger is not a valid privacy-safe bundle')
  if (candidate.run.runId !== runId || candidate.run.trialId !== trialId || candidate.run.provenance !== 'real') {
    throw new Error('runtime dogfood ledger identity does not match this capture')
  }
  if (candidate.run.taskFamily !== taskFamily || candidate.run.scenario !== scenario) {
    throw new Error('runtime dogfood ledger task family or scenario does not match this capture')
  }
  runtimeBundle = candidate
} catch (error) {
  if (!(error instanceof Error && 'code' in error && error.code === 'ENOENT')) throw error
}

const hash = value => createHash('sha256').update(String(value)).digest('hex').slice(0, 16)
const between = value => Number.isFinite(Date.parse(value)) && Date.parse(value) >= Date.parse(startedAt) && Date.parse(value) <= Date.parse(endedAt)
const classFor = reason => reason === 'HUMAN_APPROVAL_REQUIRED' || reason === 'HUMAN_QUESTION_PENDING'
  ? 'human-needed'
  : ['HOST_UNREACHABLE', 'HOST_STALL_RECOVERED'].includes(reason)
    ? 'host-health'
    : ['HOST_SUSPECTED_STALL', 'TOOL_FAILURE_LOOP', 'NO_MEANINGFUL_PROGRESS'].includes(reason)
      ? 'stuck-progress'
      : reason === 'SUBAGENT_PRESSURE'
        ? 'subagent-pressure'
        : ['CONTEXT_PRESSURE', 'COMPACTION_OCCURRED'].includes(reason)
          ? 'context-pressure'
          : 'completion'
const subtypeFor = reason => ({
  HUMAN_APPROVAL_REQUIRED: 'approval',
  HUMAN_QUESTION_PENDING: 'question',
  HOST_UNREACHABLE: 'unreachable',
  HOST_SUSPECTED_STALL: 'suspected-stall',
  TOOL_FAILURE_LOOP: 'failure-loop',
  NO_MEANINGFUL_PROGRESS: 'no-progress',
  SUBAGENT_PRESSURE: 'pressure',
  CONTEXT_PRESSURE: 'context',
  COMPACTION_OCCURRED: 'compaction',
  TASK_COMPLETED: 'completed',
  TASK_FAILED: 'failed',
  TASK_ABORTED: 'aborted',
  COMPLETION_SUSPICIOUS: 'suspicious',
  HOST_STALL_RECOVERED: 'recovered',
}[reason] ?? 'other')
const sourceFor = item => {
  const type = item.evidence?.[0]?.type
  if (type === 'tool-history') return 'tool'
  if (type === 'subagent-state') return 'subagent'
  if (type === 'runtime-probe') return 'host'
  return 'session'
}
const phaseFor = eventClass => eventClass === 'completion' ? 'completion' : eventClass === 'human-needed' ? 'human-wait' : eventClass === 'host-health' ? 'recovery' : 'running'
const dispositionFor = item => item.status === 'recovered' ? 'recovery-closed' : item.action === 'INBOX' ? 'inbox' : item.action === 'DIGEST' ? 'digest' : item.action === 'INTERRUPT' ? 'interrupt' : item.action === 'ESCALATE' ? 'escalate' : 'c0-silent'
const channelFor = item => item.action === 'INTERRUPT' || item.action === 'ESCALATE' ? 'browser-notification' : 'inbox'
const usefulnessReasonFor = item => item.feedback?.value === 'not-relevant'
  ? 'not-relevant'
  : item.feedback?.value === 'wrong-level'
    ? 'wrong-level'
    : item.feedback?.value === 'already-resolved'
      ? 'already-resolved'
      : item.feedback?.useful === true ? 'actionable' : 'status-only'

const selectedItems = inboxState.items.filter(item => between(item.occurredAt))
const selectedRefs = new Set(selectedItems.map(item => hash(item.id)))
const inboxObservations = selectedItems.map(item => {
  const eventClass = classFor(item.reasonCode)
  const disposition = dispositionFor(item)
  return {
    schemaVersion: 1,
    observationRef: hash(`${runId}:${item.id}`),
    runId,
    occurredAt: item.occurredAt,
    eventClass,
    eventSubtype: subtypeFor(item.reasonCode),
    eventSource: sourceFor(item),
    authority: item.evidence?.[0]?.authority === 'host' || item.evidence?.[0]?.authority === 'runtime' ? item.evidence[0].authority : 'derived',
    phase: phaseFor(eventClass),
    decisionDisposition: disposition,
    observedDecision: { level: item.level, action: item.action, reasonCode: item.reasonCode },
    deliveryChannel: channelFor(item),
    ...(disposition === 'inbox' || disposition === 'digest' || disposition === 'interrupt' || disposition === 'escalate' ? { deliveryUnitRef: hash(`${runId}:delivery:${item.id}`) } : {}),
    ...(typeof item.bundleKey === 'string' ? { bundleRef: hash(`${runId}:bundle:${item.bundleKey}`) } : {}),
    ...(item.feedback === undefined ? {} : {
      userFeedback: item.feedback.useful === true ? 'useful' : 'not-useful',
      usefulnessReason: usefulnessReasonFor(item),
    }),
    ...(item.status === 'recovered' ? { recoveredBeforeOpen: item.seenAt === undefined && item.acknowledgedAt === undefined && item.feedback === undefined } : {}),
  }
})
const observations = runtimeBundle === undefined
  ? inboxObservations
  : runtimeBundle.observations.filter(observation => between(observation.occurredAt))
const receipts = runtimeBundle === undefined
  ? outcomeState.receipts.filter(receipt => receipt.source === 'real' && receipt.trialId === trialId && selectedRefs.has(receipt.attentionRef))
  : [
      ...runtimeBundle.receipts,
      ...outcomeState.receipts.filter(receipt => receipt.source === 'real' && receipt.trialId === trialId),
    ].filter((receipt, index, all) => all.findIndex(candidate => candidate.receiptId === receipt.receiptId) === index)
const bundle = {
  schemaVersion: 1,
  run: {
    ...(runtimeBundle?.run ?? {}),
    schemaVersion: 1,
    runId,
    trialId,
    provenance: 'real',
    taskFamily,
    scenario,
    pluginVersion: runtimeBundle?.run.pluginVersion ?? args.get('plugin-version') ?? '0.1.1-rc.1',
    runtimeTag: runtimeBundle?.run.runtimeTag ?? args.get('runtime-tag') ?? 'dsh-v0.1.2-alpha.5',
    policyVersion: runtimeBundle?.run.policyVersion ?? args.get('policy-version') ?? 'attention-policy.v1',
    startedAt: new Date(startedAt).toISOString(),
    endedAt: new Date(endedAt).toISOString(),
    captureMode: 'service',
    rawContentPersisted: false,
  },
  observations,
  receipts,
}
if (!isDogfoodBundle(bundle)) throw new Error('captured state did not produce a valid privacy-safe dogfood bundle')
await mkdir(path.dirname(outputPath), { recursive: true })
await writeFile(outputPath, `${JSON.stringify(bundle, null, 2)}\n`, 'utf8')
console.log(`dogfood run captured: ${path.relative(root, outputPath)}`)
console.log(JSON.stringify({ taskFamily, scenario, observations: observations.length, receipts: receipts.length, source: runtimeBundle === undefined ? 'inbox-fallback' : 'runtime-observation-ledger', note: runtimeBundle === undefined ? 'No opt-in runtime observation ledger was found; this capture contains observed Inbox decisions only.' : 'Runtime observation ledger is authoritative for C0, suppression, dedupe, bundle, recovery, and delivery opportunities; reviewers must add expected decisions and usefulness labels for Gate D.' }, null, 2))
