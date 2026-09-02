import { describe, expect, it } from 'vitest'
import { evaluateNotificationEvidence, evaluateNotificationEvidenceBinding, isNotificationEvidence } from '../src/notificationEvidence.js'
import type { DogfoodBundle } from '../src/dogfood.js'

const evidence = {
  schemaVersion: 3,
  evidenceId: 'evidence-aaaaaaaaaaaaaaaa',
  source: 'manual-windows-observation',
  runId: 'real-run-01',
  trialId: 'real-trial-01',
  provenance: 'real',
  pluginVersion: '0.1.0-rc.4',
  runtimeTag: 'dsh-v0.1.2-alpha.4',
  runWindow: {
    startedAt: '2026-09-02T11:59:00.000Z',
    endedAt: '2026-09-02T12:01:00.000Z',
  },
  observedAt: '2026-09-02T12:00:00.000Z',
  decision: {
    observationRef: 'aaaaaaaaaaaaaaaa',
    deliveryUnitRef: 'bbbbbbbbbbbbbbbb',
    level: 'C2',
    action: 'INTERRUPT',
    reasonCode: 'HOST_SUSPECTED_STALL',
  },
  notification: {
    channel: 'browser-notification',
    notificationAttemptId: 'ffffffffffffffff',
    notificationRef: 'cccccccccccccccc',
    tagRef: 'dddddddddddddddd',
    titleKey: 'notification.title.HOST_SUSPECTED_STALL',
    bodyFingerprint: 'eeeeeeeeeeeeeeee',
    minimalContentOnly: true,
  },
  browser: {
    name: 'edge',
    version: '140.0.0.0',
    notificationApi: 'supported',
    permission: 'granted',
    pageVisibility: 'background',
    browserReceiptRef: '1111111111111111',
    constructorObserved: true,
    clickHandlerObserved: true,
  },
  operatingSystem: {
    name: 'windows',
    build: 'Windows 11',
    notificationsEnabled: 'observed',
    edgeNotificationsEnabled: 'observed',
    focusAssistOff: 'observed',
    toastObserved: 'observed',
    notificationCenterObserved: 'observed',
    toastClicked: 'observed',
    edgeFocusedAfterClick: 'observed',
    returnedToDsh: 'observed',
    targetVisibleInDsh: 'observed',
  },
  evidenceArtifacts: {
    screenshotSha256: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    automationTreeSha256: 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
  },
  rawContentPersisted: false,
} as const

const boundBundle = {
  schemaVersion: 1,
  run: {
    schemaVersion: 1,
    runId: evidence.runId,
    trialId: evidence.trialId,
    provenance: 'real',
    taskFamily: 'coding',
    scenario: 'normal-completion',
    pluginVersion: evidence.pluginVersion,
    runtimeTag: evidence.runtimeTag,
    policyVersion: 'attention-policy.v1',
    startedAt: '2026-09-02T11:59:00.000Z',
    endedAt: '2026-09-02T12:01:00.000Z',
    captureMode: 'manual',
    rawContentPersisted: false,
  },
  observations: [{
    schemaVersion: 1,
    observationRef: evidence.decision.observationRef,
    runId: evidence.runId,
    occurredAt: evidence.observedAt,
    eventClass: 'stuck-progress',
    eventSubtype: 'suspected-stall',
    eventSource: 'host',
    authority: 'host',
    phase: 'running',
    decisionDisposition: 'interrupt',
    observedDecision: evidence.decision,
    deliveryChannel: 'browser-notification',
    deliveryUnitRef: evidence.decision.deliveryUnitRef,
  notificationDelivery: {
      notificationAttemptId: 'ffffffffffffffff',
      notificationRef: evidence.notification.notificationRef,
      tagRef: evidence.notification.tagRef,
      titleKey: evidence.notification.titleKey,
      bodyFingerprint: evidence.notification.bodyFingerprint,
      stages: ['constructed', 'click-handler-attached', 'clicked'],
      firstObservedAt: evidence.observedAt,
      clickedAt: '2026-09-02T12:00:02.000Z',
    },
  }],
  receipts: [],
} satisfies DogfoodBundle

describe('notification evidence contract', () => {
  it('requires a complete developer-observed Edge and Windows path', () => {
    expect(isNotificationEvidence(evidence)).toBe(true)
    expect(evaluateNotificationEvidence(evidence)).toEqual({ status: 'pass', reasons: [] })
  })

  it('keeps browser-only evidence pending for the OS gate', () => {
    const browserOnly = {
      ...evidence,
      operatingSystem: {
        ...evidence.operatingSystem,
        toastObserved: 'not-tested',
        notificationCenterObserved: 'not-tested',
        toastClicked: 'not-tested',
        edgeFocusedAfterClick: 'not-tested',
        returnedToDsh: 'not-tested',
        targetVisibleInDsh: 'not-tested',
      },
    }
    const result = evaluateNotificationEvidence(browserOnly)
    expect(result.status).toBe('pending')
    expect(result.reasons).toContain('windows-toast-observed-not-tested')
    expect(result.reasons).toContain('notification-center-retention-observed-not-tested')
  })

  it('rejects raw content fields and malformed identifiers', () => {
    expect(isNotificationEvidence({ ...evidence, prompt: 'redacted' })).toBe(false)
    expect(isNotificationEvidence({ ...evidence, evidenceId: 'raw-id' })).toBe(false)
  })

  it('binds OS evidence to the matching real dogfood delivery record', () => {
    expect(evaluateNotificationEvidenceBinding(evidence, [boundBundle])).toEqual({ status: 'pass', reasons: [] })
    const wrongReason = {
      ...evidence,
      decision: { ...evidence.decision, reasonCode: 'TASK_FAILED' },
      notification: { ...evidence.notification, titleKey: 'notification.title.TASK_FAILED' },
    }
    const result = evaluateNotificationEvidenceBinding(wrongReason, [boundBundle])
    expect(result.status).toBe('pending')
    expect(result.reasons).toContain('notification-reason-code-mismatch')
    expect(result.reasons).toContain('notification-title-key-mismatch')
  })
})
