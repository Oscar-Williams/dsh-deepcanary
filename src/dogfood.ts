import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { resolveStateDir } from './persistence.js'
import { isOutcomeReceipt } from './outcome.js'
import type {
  AttentionAction,
  AttentionLevel,
  EvidenceAuthority,
  OutcomeReceipt,
  OutcomeEventClass,
  ReasonCode,
} from './types.js'

export const DOGFOOD_SCHEMA_VERSION = 1 as const

export type DogfoodProvenance = 'real' | 'controlled' | 'replay'
export type DogfoodTaskFamily = 'coding' | 'build-test' | 'research' | 'multi-stage' | 'subagent'
export type DogfoodScenario = 'approval-boundary' | 'network-recovery' | 'healthy-long-run' | 'normal-completion' | 'explicit-failure' | 'recovery-continued'
export type DogfoodEventClass = OutcomeEventClass | 'healthy-run'
export type DogfoodPhase = 'startup' | 'running' | 'human-wait' | 'recovery' | 'completion'
export type DogfoodDecisionDisposition = 'c0-silent' | 'deduped' | 'bundle-merged' | 'suppressed' | 'inbox' | 'digest' | 'interrupt' | 'escalate' | 'recovery-closed' | 'provider-error' | 'sink-error' | 'dropped-event'
export type DogfoodDeliveryChannel = 'none' | 'inbox' | 'browser-notification' | 'native-toast'
export type DogfoodReviewLabel = 'correct-useful' | 'correct-low-value' | 'not-relevant' | 'already-resolved' | 'wrong-level' | 'false-stall' | 'missed-human-needed' | 'duplicate-final-interrupt' | 'too-late' | 'provider-error' | 'sink-error' | 'dropped-event' | 'uncertain'
export type DogfoodPolicyReview = 'correct' | 'wrong-level' | 'false-stall' | 'missed-human-needed' | 'duplicate-final-interrupt' | 'too-late' | 'uncertain'
export type DogfoodUserFeedback = 'useful' | 'not-useful' | 'unrated' | 'not-applicable'
export type DogfoodUsefulnessReason = 'actionable' | 'prevented-block' | 'status-only' | 'not-relevant' | 'already-resolved' | 'wrong-level' | 'too-late' | 'duplicate'
export type DogfoodNotificationStage = 'attempted' | 'constructed' | 'click-handler-attached' | 'clicked' | 'error'
export type DogfoodEventSource = 'session' | 'agent' | 'subagent' | 'tool' | 'host' | 'windows' | 'usage' | 'external'

/** Privacy-safe browser notification delivery facts linked to one Inbox item. */
export interface DogfoodNotificationDelivery {
  /** Server-side attempt identity shared by all browser stages for one try. */
  notificationAttemptId: string
  notificationRef: string
  tagRef: string
  titleKey: string
  bodyFingerprint: string
  stages: DogfoodNotificationStage[]
  firstObservedAt: string
  clickedAt?: string
}

export interface DogfoodDecision {
  level: AttentionLevel
  action: AttentionAction
  reasonCode: ReasonCode
}

export interface DogfoodRun {
  schemaVersion: typeof DOGFOOD_SCHEMA_VERSION
  runId: string
  trialId: string
  provenance: DogfoodProvenance
  taskFamily: DogfoodTaskFamily
  scenario: DogfoodScenario
  pluginVersion: string
  runtimeTag: string
  policyVersion: string
  startedAt: string
  endedAt?: string
  captureMode: 'service' | 'manual' | 'replay'
  rawContentPersisted: false
}

export interface DogfoodObservation {
  schemaVersion: typeof DOGFOOD_SCHEMA_VERSION
  observationRef: string
  runId: string
  /** Opaque link to the corresponding Inbox item, when one was delivered. */
  attentionRef?: string
  occurredAt: string
  eventClass: DogfoodEventClass
  eventSubtype: string
  eventSource: DogfoodEventSource
  authority: EvidenceAuthority
  phase: DogfoodPhase
  decisionDisposition: DogfoodDecisionDisposition
  observedDecision?: DogfoodDecision
  expectedDecision?: DogfoodDecision
  deliveryChannel: DogfoodDeliveryChannel
  deliveryUnitRef?: string
  bundleRef?: string
  reviewLabel?: DogfoodReviewLabel
  /** Structured policy adjudication; reviewLabel remains for v1 compatibility. */
  policyReview?: DogfoodPolicyReview
  /** User value is kept separate from policy correctness. */
  userFeedback?: DogfoodUserFeedback
  usefulnessReason?: DogfoodUsefulnessReason
  /** Browser-sink facts are recorded without notification text or content. */
  notificationDelivery?: DogfoodNotificationDelivery
  recoveredBeforeOpen?: boolean
}

export interface DogfoodBundle {
  schemaVersion: typeof DOGFOOD_SCHEMA_VERSION
  run: DogfoodRun
  observations: DogfoodObservation[]
  receipts: OutcomeReceipt[]
}

export interface DogfoodMetric {
  numerator: number
  denominator: number
  rate: number | null
  status: 'ok' | 'insufficient-sample' | 'no-data'
}

export interface DogfoodReport {
  reportSchemaVersion: typeof DOGFOOD_SCHEMA_VERSION
  run: DogfoodRun
  observationCount: number
  receiptCount: number
  taxonomy: {
    byTaskFamily: Record<string, number>
    byScenario: Record<string, number>
    byEventClass: Record<string, number>
    byEventSubtype: Record<string, number>
    byPhase: Record<string, number>
    byDisposition: Record<string, number>
    byReviewLabel: Record<string, number>
  }
  coverage: {
    reviewedDecisions: number
    decisions: number
    deliveryUnits: number
    /** User-facing review coverage uses unique delivery units as its denominator. */
    userFacingDeliveryUnits: number
    reviewedUserFacingUnits: number
    negativeOpportunityUnits: number
    bundles: number
    c0Silent: number
    suppressed: number
    deduped: number
    droppedEvents: number
  }
  metrics: {
    humanNeededRecall: DogfoodMetric
    usefulnessRate: DogfoodMetric
    usefulInterruptPrecision: DogfoodMetric
    wrongLevelRate: DogfoodMetric
    falseStallRate: DogfoodMetric
    recoveryBeforeOpenRate: DogfoodMetric
    attentionCompressionRatio: DogfoodMetric
    droppedEventRate: DogfoodMetric
    reviewCoverage: DogfoodMetric
  }
  generatedAt: string
  conclusion: string
}

interface PersistedDogfoodState {
  schemaVersion: typeof DOGFOOD_SCHEMA_VERSION
  bundle: DogfoodBundle
}

const runIdPattern = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/
const opaqueRefPattern = /^[a-f0-9]{16}$/
const printablePattern = /^[^\u0000-\u001f\u007f]{1,128}$/
const eventClasses = new Set<DogfoodEventClass>(['human-needed', 'host-health', 'stuck-progress', 'subagent-pressure', 'context-pressure', 'completion', 'healthy-run'])
const provenances = new Set<DogfoodProvenance>(['real', 'controlled', 'replay'])
const taskFamilies = new Set<DogfoodTaskFamily>(['coding', 'build-test', 'research', 'multi-stage', 'subagent'])
const scenarios = new Set<DogfoodScenario>(['approval-boundary', 'network-recovery', 'healthy-long-run', 'normal-completion', 'explicit-failure', 'recovery-continued'])
const phases = new Set<DogfoodPhase>(['startup', 'running', 'human-wait', 'recovery', 'completion'])
const dispositions = new Set<DogfoodDecisionDisposition>(['c0-silent', 'deduped', 'bundle-merged', 'suppressed', 'inbox', 'digest', 'interrupt', 'escalate', 'recovery-closed', 'provider-error', 'sink-error', 'dropped-event'])
const deliveryChannels = new Set<DogfoodDeliveryChannel>(['none', 'inbox', 'browser-notification', 'native-toast'])
const reviewLabels = new Set<DogfoodReviewLabel>(['correct-useful', 'correct-low-value', 'not-relevant', 'already-resolved', 'wrong-level', 'false-stall', 'missed-human-needed', 'duplicate-final-interrupt', 'too-late', 'provider-error', 'sink-error', 'dropped-event', 'uncertain'])
const policyReviews = new Set<DogfoodPolicyReview>(['correct', 'wrong-level', 'false-stall', 'missed-human-needed', 'duplicate-final-interrupt', 'too-late', 'uncertain'])
const userFeedbackValues = new Set<DogfoodUserFeedback>(['useful', 'not-useful', 'unrated', 'not-applicable'])
const usefulnessReasons = new Set<DogfoodUsefulnessReason>(['actionable', 'prevented-block', 'status-only', 'not-relevant', 'already-resolved', 'wrong-level', 'too-late', 'duplicate'])
const notificationStages = new Set<DogfoodNotificationStage>(['attempted', 'constructed', 'click-handler-attached', 'clicked', 'error'])
const eventSources = new Set<DogfoodEventSource>(['session', 'agent', 'subagent', 'tool', 'host', 'windows', 'usage', 'external'])
const authorities = new Set<EvidenceAuthority>(['host', 'runtime', 'derived', 'heuristic'])
const levels = new Set<AttentionLevel>(['C0', 'C1', 'C2', 'C3'])
const actions = new Set<AttentionAction>(['IGNORE', 'INBOX', 'DIGEST', 'INTERRUPT', 'ESCALATE'])

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function isIsoDate(value: unknown): value is string {
  return typeof value === 'string' && Number.isFinite(Date.parse(value))
}

function isPrintable(value: unknown): value is string {
  return typeof value === 'string' && printablePattern.test(value)
}

function isDecision(value: unknown): value is DogfoodDecision {
  if (!isRecord(value) || !levels.has(value.level as AttentionLevel) || !actions.has(value.action as AttentionAction) || typeof value.reasonCode !== 'string') return false
  return value.reasonCode.length > 0 && value.reasonCode.length <= 128
}

function isDogfoodRun(value: unknown): value is DogfoodRun {
  return isRecord(value)
    && value.schemaVersion === DOGFOOD_SCHEMA_VERSION
    && typeof value.runId === 'string' && runIdPattern.test(value.runId)
    && typeof value.trialId === 'string' && runIdPattern.test(value.trialId)
    && provenances.has(value.provenance as DogfoodProvenance)
    && taskFamilies.has(value.taskFamily as DogfoodTaskFamily)
    && scenarios.has(value.scenario as DogfoodScenario)
    && isPrintable(value.pluginVersion)
    && isPrintable(value.runtimeTag)
    && isPrintable(value.policyVersion)
    && isIsoDate(value.startedAt)
    && (value.endedAt === undefined || isIsoDate(value.endedAt))
    && (value.captureMode === 'service' || value.captureMode === 'manual' || value.captureMode === 'replay')
    && value.rawContentPersisted === false
}

function isDogfoodObservation(value: unknown, runId: string): value is DogfoodObservation {
  if (!isRecord(value)
    || value.schemaVersion !== DOGFOOD_SCHEMA_VERSION
    || typeof value.observationRef !== 'string' || !opaqueRefPattern.test(value.observationRef)
    || value.runId !== runId
    || !isIsoDate(value.occurredAt)
    || !eventClasses.has(value.eventClass as OutcomeEventClass)
    || !isPrintable(value.eventSubtype)
    || !eventSources.has(value.eventSource as DogfoodEventSource)
    || !authorities.has(value.authority as EvidenceAuthority)
    || !phases.has(value.phase as DogfoodPhase)
    || !dispositions.has(value.decisionDisposition as DogfoodDecisionDisposition)
    || !deliveryChannels.has(value.deliveryChannel as DogfoodDeliveryChannel)) return false
  if (value.attentionRef !== undefined && (typeof value.attentionRef !== 'string' || !opaqueRefPattern.test(value.attentionRef))) return false
  if (value.observedDecision !== undefined && !isDecision(value.observedDecision)) return false
  if (value.expectedDecision !== undefined && !isDecision(value.expectedDecision)) return false
  if (value.deliveryUnitRef !== undefined && (typeof value.deliveryUnitRef !== 'string' || !opaqueRefPattern.test(value.deliveryUnitRef))) return false
  if (value.bundleRef !== undefined && (typeof value.bundleRef !== 'string' || !opaqueRefPattern.test(value.bundleRef))) return false
  if (value.reviewLabel !== undefined && !reviewLabels.has(value.reviewLabel as DogfoodReviewLabel)) return false
  if (value.policyReview !== undefined && !policyReviews.has(value.policyReview as DogfoodPolicyReview)) return false
  if (value.userFeedback !== undefined && !userFeedbackValues.has(value.userFeedback as DogfoodUserFeedback)) return false
  if (value.usefulnessReason !== undefined && !usefulnessReasons.has(value.usefulnessReason as DogfoodUsefulnessReason)) return false
  if (value.notificationDelivery !== undefined) {
    const delivery = value.notificationDelivery
    if (!isRecord(delivery)
      || typeof delivery.notificationAttemptId !== 'string' || !opaqueRefPattern.test(delivery.notificationAttemptId)
      || typeof delivery.notificationRef !== 'string' || !opaqueRefPattern.test(delivery.notificationRef)
      || typeof delivery.tagRef !== 'string' || !opaqueRefPattern.test(delivery.tagRef)
      || typeof delivery.titleKey !== 'string' || !/^notification\.title\.[A-Z0-9_]+$/.test(delivery.titleKey)
      || typeof delivery.bodyFingerprint !== 'string' || !opaqueRefPattern.test(delivery.bodyFingerprint)
      || !Array.isArray(delivery.stages) || delivery.stages.length === 0
      || !delivery.stages.every(stage => notificationStages.has(stage as DogfoodNotificationStage))
      || new Set(delivery.stages).size !== delivery.stages.length
      || !isIsoDate(delivery.firstObservedAt)
      || (delivery.clickedAt !== undefined && (!isIsoDate(delivery.clickedAt) || Date.parse(delivery.clickedAt) < Date.parse(delivery.firstObservedAt)))) return false
  }
  return value.recoveredBeforeOpen === undefined || typeof value.recoveredBeforeOpen === 'boolean'
}

export function isDogfoodBundle(value: unknown): value is DogfoodBundle {
  if (!isRecord(value) || value.schemaVersion !== DOGFOOD_SCHEMA_VERSION || !isDogfoodRun(value.run) || !Array.isArray(value.observations) || !Array.isArray(value.receipts)) return false
  const run = value.run
  if (!value.observations.every(observation => isDogfoodObservation(observation, run.runId))) return false
  const refs = value.observations.map(observation => observation.observationRef)
  if (new Set(refs).size !== refs.length) return false
  if (run.endedAt !== undefined && Date.parse(run.endedAt) < Date.parse(run.startedAt)) return false
  return value.receipts.every(receipt => isOutcomeReceipt(receipt) && receipt.source === run.provenance && receipt.trialId === run.trialId)
}

function countBy<T>(values: readonly T[], key: (value: T) => string): Record<string, number> {
  return values.reduce<Record<string, number>>((result, value) => {
    const name = key(value)
    result[name] = (result[name] ?? 0) + 1
    return result
  }, {})
}

function metric(numerator: number, denominator: number, minimumSample = 5, requirePositiveNumerator = false, minimumRate?: number): DogfoodMetric {
  return {
    numerator,
    denominator,
    rate: denominator === 0 ? null : numerator / denominator,
    status: denominator === 0 || denominator < minimumSample || (requirePositiveNumerator && numerator === 0) || (minimumRate !== undefined && (denominator === 0 || numerator / denominator < minimumRate))
      ? denominator === 0 ? 'no-data' : 'insufficient-sample'
      : 'ok',
  }
}

function levelAtLeast(level: AttentionLevel | undefined, minimum: AttentionLevel): boolean {
  if (level === undefined) return false
  const values: Record<AttentionLevel, number> = { C0: 0, C1: 1, C2: 2, C3: 3 }
  return values[level] >= values[minimum]
}

export function summarizeDogfood(bundle: DogfoodBundle): DogfoodReport {
  const observations = bundle.observations
  const labeled = observations.filter(observation => observation.reviewLabel !== undefined || observation.policyReview !== undefined || observation.userFeedback !== undefined)
  const reviewed = labeled.filter(observation => observation.observedDecision !== undefined || observation.expectedDecision !== undefined)
  const decisions = observations.filter(observation => observation.observedDecision !== undefined || observation.expectedDecision !== undefined)
  const humanNeeded = observations.filter(observation => observation.eventClass === 'human-needed' && levelAtLeast(observation.expectedDecision?.level, 'C2'))
  const humanNeededHits = humanNeeded.filter(observation => levelAtLeast(observation.observedDecision?.level, 'C2'))
  const usefulness = reviewed.filter(observation => userFeedbackOf(observation) === 'useful' || userFeedbackOf(observation) === 'not-useful')
  const useful = usefulness.filter(observation => userFeedbackOf(observation) === 'useful')
  const interruptDecisions = observations.filter(observation => observation.observedDecision?.action === 'INTERRUPT')
  const usefulInterrupts = interruptDecisions.filter(observation => userFeedbackOf(observation) === 'useful')
  const reviewedInterrupts = interruptDecisions.filter(observation => observation.reviewLabel !== undefined || observation.policyReview !== undefined || observation.userFeedback !== undefined)
  const wrongLevel = reviewed.filter(observation => policyReviewOf(observation) === 'wrong-level')
  const stallReviews = observations.filter(observation => observation.eventClass === 'stuck-progress' && (observation.reviewLabel !== undefined || observation.policyReview !== undefined))
  const falseStalls = stallReviews.filter(observation => policyReviewOf(observation) === 'false-stall')
  const recoveryOpportunities = observations.filter(observation => observation.recoveredBeforeOpen !== undefined)
  const recoveredBeforeOpen = recoveryOpportunities.filter(observation => observation.recoveredBeforeOpen === true)
  const deliveryUnits = new Set(observations.filter(observation => observation.deliveryUnitRef !== undefined).map(observation => observation.deliveryUnitRef))
  const userFacing = observations.filter(observation => observation.decisionDisposition === 'inbox' || observation.decisionDisposition === 'digest' || observation.decisionDisposition === 'interrupt' || observation.decisionDisposition === 'escalate')
  const userFacingDeliveryUnits = new Set(userFacing.flatMap(observation => observation.deliveryUnitRef === undefined ? [] : [observation.deliveryUnitRef]))
  const reviewedUserFacingUnits = new Set(userFacing
    .filter(observation => observation.deliveryUnitRef !== undefined && (observation.reviewLabel !== undefined || observation.policyReview !== undefined || observation.userFeedback !== undefined))
    .map(observation => observation.deliveryUnitRef as string))
  const negativeOpportunityUnits = new Set(observations
    .filter(observation => observation.expectedDecision !== undefined && observation.expectedDecision.action === 'IGNORE')
    .map(observation => observation.deliveryUnitRef ?? observation.observationRef))
  const dropped = observations.filter(observation => observation.decisionDisposition === 'dropped-event' || observation.reviewLabel === 'dropped-event')
  const report: DogfoodReport = {
    reportSchemaVersion: DOGFOOD_SCHEMA_VERSION,
    run: bundle.run,
    observationCount: observations.length,
    receiptCount: bundle.receipts.length,
    taxonomy: {
      byTaskFamily: { [bundle.run.taskFamily]: observations.length },
      byScenario: { [bundle.run.scenario]: observations.length },
      byEventClass: countBy(observations, observation => observation.eventClass),
      byEventSubtype: countBy(observations, observation => observation.eventSubtype),
      byPhase: countBy(observations, observation => observation.phase),
      byDisposition: countBy(observations, observation => observation.decisionDisposition),
      byReviewLabel: countBy(labeled, observation => observation.reviewLabel ?? observation.policyReview ?? observation.userFeedback ?? 'unreviewed'),
    },
    coverage: {
      reviewedDecisions: reviewed.length,
      decisions: decisions.length,
      deliveryUnits: deliveryUnits.size,
      userFacingDeliveryUnits: userFacingDeliveryUnits.size,
      reviewedUserFacingUnits: reviewedUserFacingUnits.size,
      negativeOpportunityUnits: negativeOpportunityUnits.size,
      bundles: new Set(observations.filter(observation => observation.bundleRef !== undefined).map(observation => observation.bundleRef)).size,
      c0Silent: observations.filter(observation => observation.decisionDisposition === 'c0-silent').length,
      suppressed: observations.filter(observation => observation.decisionDisposition === 'suppressed').length,
      deduped: observations.filter(observation => observation.decisionDisposition === 'deduped').length,
      droppedEvents: dropped.length,
    },
    metrics: {
      humanNeededRecall: metric(humanNeededHits.length, humanNeeded.length),
      usefulnessRate: metric(useful.length, usefulness.length),
      usefulInterruptPrecision: metric(usefulInterrupts.length, reviewedInterrupts.length),
      wrongLevelRate: metric(wrongLevel.length, reviewed.length),
      falseStallRate: metric(falseStalls.length, stallReviews.length),
      recoveryBeforeOpenRate: metric(recoveredBeforeOpen.length, recoveryOpportunities.length),
      attentionCompressionRatio: metric(observations.length, Math.max(1, deliveryUnits.size || userFacing.length)),
      droppedEventRate: metric(dropped.length, observations.length),
      reviewCoverage: metric(reviewedUserFacingUnits.size, userFacingDeliveryUnits.size, 5, true, 0.8),
    },
    generatedAt: new Date().toISOString(),
    conclusion: observations.length === 0
      ? 'No sanitized dogfood observations were supplied.'
      : 'This report keeps opportunity counts, delivery outcomes, and human review labels separate. Rates marked insufficient-sample require a larger reviewed cohort before a release decision.',
  }
  return report
}

export class DogfoodLedger {
  readonly directory: string
  readonly file: string
  private bundleValue: DogfoodBundle

  constructor(stateDir: string, run: DogfoodRun, fileName = 'dogfood.json') {
    this.directory = resolveStateDir(stateDir)
    this.file = path.join(this.directory, fileName)
    this.bundleValue = { schemaVersion: DOGFOOD_SCHEMA_VERSION, run, observations: [], receipts: [] }
  }

  async load(): Promise<DogfoodBundle> {
    try {
      const raw = JSON.parse(await readFile(this.file, 'utf8')) as unknown
      if (isDogfoodBundle(raw)) {
        if (raw.run.runId !== this.bundleValue.run.runId || raw.run.trialId !== this.bundleValue.run.trialId) {
          throw new Error('dogfood state belongs to a different run or trial')
        }
        this.bundleValue = raw
      }
    } catch (error: unknown) {
      if (!(error instanceof Error && 'code' in error && (error as NodeJS.ErrnoException).code === 'ENOENT')) throw error
    }
    return this.bundle()
  }

  record(observation: DogfoodObservation): void {
    if (!isDogfoodObservation(observation, this.bundleValue.run.runId)) throw new TypeError('invalid dogfood observation')
    if (this.bundleValue.observations.some(candidate => candidate.observationRef === observation.observationRef)) {
      throw new Error(`dogfood observation already exists: ${observation.observationRef}`)
    }
    this.bundleValue.observations.push({ ...observation })
  }

  setReceipts(receipts: readonly OutcomeReceipt[]): void {
    if (!receipts.every(receipt => isOutcomeReceipt(receipt) && receipt.source === this.bundleValue.run.provenance && receipt.trialId === this.bundleValue.run.trialId)) {
      throw new TypeError('dogfood receipts must match the run provenance and trial')
    }
    this.bundleValue.receipts = [...receipts]
  }

  updateObservationsByAttention(attentionRef: string, patch: Pick<DogfoodObservation, 'reviewLabel' | 'policyReview' | 'userFeedback' | 'usefulnessReason'>): number {
    if (!opaqueRefPattern.test(attentionRef)) throw new TypeError('dogfood attentionRef is invalid')
    let updated = 0
    for (const [index, observation] of this.bundleValue.observations.entries()) {
      if (observation.attentionRef !== attentionRef) continue
      const candidate: DogfoodObservation = { ...observation, ...patch }
      if (!isDogfoodObservation(candidate, this.bundleValue.run.runId)) throw new TypeError('invalid dogfood observation review patch')
      this.bundleValue.observations[index] = candidate
      updated += 1
    }
    return updated
  }

  /** Join browser-sink delivery stages to the same privacy-safe observation. */
  updateNotificationDelivery(attentionRef: string, delivery: DogfoodNotificationDelivery): number {
    if (!opaqueRefPattern.test(attentionRef) || !isNotificationDelivery(delivery)) throw new TypeError('dogfood notification delivery is invalid')
    let updated = 0
    for (const [index, observation] of this.bundleValue.observations.entries()) {
      if (observation.attentionRef !== attentionRef) continue
      const previous = observation.notificationDelivery
      const firstObservedAt = previous === undefined || Date.parse(delivery.firstObservedAt) < Date.parse(previous.firstObservedAt)
        ? delivery.firstObservedAt
        : previous.firstObservedAt
      const stages = [...new Set([...(previous?.stages ?? []), ...delivery.stages])]
      const clickedAt = delivery.clickedAt ?? previous?.clickedAt
      const candidate: DogfoodObservation = {
        ...observation,
        notificationDelivery: {
          notificationAttemptId: delivery.notificationAttemptId,
          notificationRef: delivery.notificationRef,
          tagRef: delivery.tagRef,
          titleKey: delivery.titleKey,
          bodyFingerprint: delivery.bodyFingerprint,
          stages,
          firstObservedAt,
          ...(clickedAt === undefined ? {} : { clickedAt }),
        },
      }
      if (!isDogfoodObservation(candidate, this.bundleValue.run.runId)) throw new TypeError('invalid dogfood notification delivery patch')
      this.bundleValue.observations[index] = candidate
      updated += 1
    }
    return updated
  }

  finish(endedAt = new Date().toISOString()): void {
    if (!isIsoDate(endedAt) || Date.parse(endedAt) < Date.parse(this.bundleValue.run.startedAt)) {
      throw new TypeError('dogfood endedAt must be an ISO date after startedAt')
    }
    if (this.bundleValue.run.endedAt !== undefined) return
    this.bundleValue.run = { ...this.bundleValue.run, endedAt }
  }

  bundle(): DogfoodBundle {
    return {
      schemaVersion: DOGFOOD_SCHEMA_VERSION,
      run: { ...this.bundleValue.run },
      observations: this.bundleValue.observations.map(observation => ({ ...observation })),
      receipts: [...this.bundleValue.receipts],
    }
  }

  async save(): Promise<void> {
    await mkdir(this.directory, { recursive: true })
    const temporary = `${this.file}.${process.pid}.tmp`
    await writeFile(temporary, `${JSON.stringify(this.bundleValue, null, 2)}\n`, 'utf8')
    await rename(temporary, this.file)
  }
}

function isNotificationDelivery(value: unknown): value is DogfoodNotificationDelivery {
  if (!isRecord(value)
    || typeof value.notificationAttemptId !== 'string' || !opaqueRefPattern.test(value.notificationAttemptId)
    || typeof value.notificationRef !== 'string' || !opaqueRefPattern.test(value.notificationRef)
    || typeof value.tagRef !== 'string' || !opaqueRefPattern.test(value.tagRef)
    || typeof value.titleKey !== 'string' || !/^notification\.title\.[A-Z0-9_]+$/.test(value.titleKey)
    || typeof value.bodyFingerprint !== 'string' || !opaqueRefPattern.test(value.bodyFingerprint)
    || !Array.isArray(value.stages) || value.stages.length === 0
    || !value.stages.every(stage => notificationStages.has(stage as DogfoodNotificationStage))
    || new Set(value.stages).size !== value.stages.length
    || !isIsoDate(value.firstObservedAt)
    || (value.clickedAt !== undefined && (!isIsoDate(value.clickedAt) || Date.parse(value.clickedAt) < Date.parse(value.firstObservedAt)))) return false
  return true
}

function policyReviewOf(observation: DogfoodObservation): DogfoodPolicyReview | undefined {
  if (observation.policyReview !== undefined) return observation.policyReview
  switch (observation.reviewLabel) {
    case 'correct-useful':
    case 'correct-low-value':
      return 'correct'
    case 'wrong-level':
    case 'false-stall':
    case 'missed-human-needed':
    case 'duplicate-final-interrupt':
    case 'too-late':
      return observation.reviewLabel
    default:
      return undefined
  }
}

function userFeedbackOf(observation: DogfoodObservation): DogfoodUserFeedback {
  if (observation.userFeedback !== undefined) return observation.userFeedback
  switch (observation.reviewLabel) {
    case 'correct-useful': return 'useful'
    case 'correct-low-value':
    case 'not-relevant':
    case 'already-resolved':
    case 'wrong-level':
    case 'false-stall':
    case 'missed-human-needed':
    case 'duplicate-final-interrupt':
    case 'too-late':
      return 'not-useful'
    default:
      return 'unrated'
  }
}
