import type { DogfoodBundle } from './dogfood.js';
export declare const NOTIFICATION_EVIDENCE_SCHEMA_VERSION: 3;
export type NotificationPermission = 'granted' | 'denied' | 'default' | 'unsupported';
export type NotificationPageVisibility = 'foreground' | 'background' | 'minimized' | 'unknown';
export type NotificationEvidenceSource = 'manual-windows-observation';
export type NotificationObservationStatus = 'observed' | 'not-observed' | 'not-tested';
export interface NotificationEvidence {
    schemaVersion: typeof NOTIFICATION_EVIDENCE_SCHEMA_VERSION;
    evidenceId: string;
    source: NotificationEvidenceSource;
    runId: string;
    trialId: string;
    provenance: 'real' | 'controlled';
    pluginVersion: string;
    runtimeTag: string;
    runWindow: {
        startedAt: string;
        endedAt: string;
    };
    observedAt: string;
    decision: {
        observationRef: string;
        deliveryUnitRef: string;
        level: 'C2' | 'C3';
        action: 'INTERRUPT' | 'ESCALATE';
        reasonCode: string;
    };
    notification: {
        channel: 'browser-notification';
        notificationAttemptId: string;
        notificationRef: string;
        tagRef: string;
        titleKey: string;
        bodyFingerprint: string;
        minimalContentOnly: boolean;
    };
    browser: {
        name: 'edge';
        version: string;
        notificationApi: 'supported' | 'unsupported';
        permission: NotificationPermission;
        pageVisibility: NotificationPageVisibility;
        browserReceiptRef: string;
        constructorObserved: boolean;
        clickHandlerObserved: boolean;
    };
    operatingSystem: {
        name: 'windows';
        build: string;
        notificationsEnabled: NotificationObservationStatus;
        edgeNotificationsEnabled: NotificationObservationStatus;
        focusAssistOff: NotificationObservationStatus;
        toastObserved: NotificationObservationStatus;
        notificationCenterObserved: NotificationObservationStatus;
        toastClicked: NotificationObservationStatus;
        edgeFocusedAfterClick: NotificationObservationStatus;
        returnedToDsh: NotificationObservationStatus;
        targetVisibleInDsh: NotificationObservationStatus;
    };
    evidenceArtifacts: {
        screenshotSha256: string;
        automationTreeSha256: string;
    };
    rawContentPersisted: false;
}
export interface NotificationEvidenceResult {
    status: 'pass' | 'pending';
    reasons: string[];
}
export declare function isNotificationEvidence(value: unknown): value is NotificationEvidence;
export declare function evaluateNotificationEvidence(value: unknown): NotificationEvidenceResult;
/**
 * Bind a developer-observed notification record to the exact sanitized
 * dogfood observation that produced it. The binding is shared by the CLI
 * validator and stable-gate evaluator so both reports enforce the same
 * evidence boundary.
 */
export declare function evaluateNotificationEvidenceBinding(value: unknown, bundles: readonly DogfoodBundle[] | undefined): NotificationEvidenceResult;
//# sourceMappingURL=notificationEvidence.d.ts.map