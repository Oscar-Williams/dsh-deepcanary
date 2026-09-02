export const NOTIFICATION_EVIDENCE_SCHEMA_VERSION = 3;
const idPattern = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const evidenceIdPattern = /^evidence-[a-f0-9]{16}$/;
const opaqueRefPattern = /^[a-f0-9]{16}$/;
const printablePattern = /^[^\u0000-\u001f\u007f]{1,128}$/;
const titleKeyPattern = /^notification\.title\.[A-Z0-9_]+$/;
const permissions = new Set(['granted', 'denied', 'default', 'unsupported']);
const visibilities = new Set(['foreground', 'background', 'minimized', 'unknown']);
const observationStatuses = new Set(['observed', 'not-observed', 'not-tested']);
const sha256Pattern = /^[a-f0-9]{64}$/;
function isRecord(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
}
function isDate(value) {
    return typeof value === 'string' && Number.isFinite(Date.parse(value));
}
function isObservationRecord(value, keys) {
    return isRecord(value) && keys.every(key => observationStatuses.has(value[key]));
}
function hasExactKeys(value, keys) {
    const expected = new Set(keys);
    return Object.keys(value).every(key => expected.has(key)) && keys.every(key => key in value);
}
export function isNotificationEvidence(value) {
    if (!isRecord(value)
        || !hasExactKeys(value, ['schemaVersion', 'evidenceId', 'source', 'runId', 'trialId', 'provenance', 'pluginVersion', 'runtimeTag', 'runWindow', 'observedAt', 'decision', 'notification', 'browser', 'operatingSystem', 'evidenceArtifacts', 'rawContentPersisted'])
        || value.schemaVersion !== NOTIFICATION_EVIDENCE_SCHEMA_VERSION
        || typeof value.evidenceId !== 'string' || !evidenceIdPattern.test(value.evidenceId)
        || value.source !== 'manual-windows-observation'
        || typeof value.runId !== 'string' || !idPattern.test(value.runId)
        || typeof value.trialId !== 'string' || !idPattern.test(value.trialId)
        || (value.provenance !== 'real' && value.provenance !== 'controlled')
        || typeof value.pluginVersion !== 'string' || !printablePattern.test(value.pluginVersion)
        || typeof value.runtimeTag !== 'string' || !printablePattern.test(value.runtimeTag)
        || !isRecord(value.runWindow)
        || !hasExactKeys(value.runWindow, ['startedAt', 'endedAt'])
        || !isDate(value.runWindow.startedAt)
        || !isDate(value.runWindow.endedAt)
        || Date.parse(value.runWindow.endedAt) < Date.parse(value.runWindow.startedAt)
        || !isDate(value.observedAt)
        || Date.parse(value.observedAt) < Date.parse(value.runWindow.startedAt)
        || Date.parse(value.observedAt) > Date.parse(value.runWindow.endedAt)
        || value.rawContentPersisted !== false
        || !isRecord(value.decision)
        || !hasExactKeys(value.decision, ['observationRef', 'deliveryUnitRef', 'level', 'action', 'reasonCode'])
        || typeof value.decision.observationRef !== 'string' || !opaqueRefPattern.test(value.decision.observationRef)
        || typeof value.decision.deliveryUnitRef !== 'string' || !opaqueRefPattern.test(value.decision.deliveryUnitRef)
        || (value.decision.level !== 'C2' && value.decision.level !== 'C3')
        || (value.decision.action !== 'INTERRUPT' && value.decision.action !== 'ESCALATE')
        || typeof value.decision.reasonCode !== 'string' || !printablePattern.test(value.decision.reasonCode)
        || !isRecord(value.notification)
        || !hasExactKeys(value.notification, ['channel', 'notificationAttemptId', 'notificationRef', 'tagRef', 'titleKey', 'bodyFingerprint', 'minimalContentOnly'])
        || value.notification.channel !== 'browser-notification'
        || typeof value.notification.notificationAttemptId !== 'string' || !opaqueRefPattern.test(value.notification.notificationAttemptId)
        || typeof value.notification.notificationRef !== 'string' || !opaqueRefPattern.test(value.notification.notificationRef)
        || typeof value.notification.tagRef !== 'string' || !opaqueRefPattern.test(value.notification.tagRef)
        || typeof value.notification.titleKey !== 'string' || !titleKeyPattern.test(value.notification.titleKey)
        || typeof value.notification.bodyFingerprint !== 'string' || !opaqueRefPattern.test(value.notification.bodyFingerprint)
        || typeof value.notification.minimalContentOnly !== 'boolean'
        || !isRecord(value.browser)
        || !hasExactKeys(value.browser, ['name', 'version', 'notificationApi', 'permission', 'pageVisibility', 'browserReceiptRef', 'constructorObserved', 'clickHandlerObserved'])
        || value.browser.name !== 'edge'
        || typeof value.browser.version !== 'string' || !printablePattern.test(value.browser.version)
        || (value.browser.notificationApi !== 'supported' && value.browser.notificationApi !== 'unsupported')
        || !permissions.has(value.browser.permission)
        || !visibilities.has(value.browser.pageVisibility)
        || typeof value.browser.browserReceiptRef !== 'string' || !opaqueRefPattern.test(value.browser.browserReceiptRef)
        || typeof value.browser.constructorObserved !== 'boolean'
        || typeof value.browser.clickHandlerObserved !== 'boolean'
        || !isRecord(value.operatingSystem)
        || !hasExactKeys(value.operatingSystem, ['name', 'build', 'notificationsEnabled', 'edgeNotificationsEnabled', 'focusAssistOff', 'toastObserved', 'notificationCenterObserved', 'toastClicked', 'edgeFocusedAfterClick', 'returnedToDsh', 'targetVisibleInDsh'])
        || value.operatingSystem.name !== 'windows'
        || typeof value.operatingSystem.build !== 'string' || !printablePattern.test(value.operatingSystem.build)
        || !isObservationRecord(value.operatingSystem, ['notificationsEnabled', 'edgeNotificationsEnabled', 'focusAssistOff', 'toastObserved', 'notificationCenterObserved', 'toastClicked', 'edgeFocusedAfterClick', 'returnedToDsh', 'targetVisibleInDsh'])
        || !isRecord(value.evidenceArtifacts)
        || !hasExactKeys(value.evidenceArtifacts, ['screenshotSha256', 'automationTreeSha256'])
        || typeof value.evidenceArtifacts.screenshotSha256 !== 'string' || !sha256Pattern.test(value.evidenceArtifacts.screenshotSha256)
        || typeof value.evidenceArtifacts.automationTreeSha256 !== 'string' || !sha256Pattern.test(value.evidenceArtifacts.automationTreeSha256))
        return false;
    return true;
}
export function evaluateNotificationEvidence(value) {
    if (!isNotificationEvidence(value))
        return { status: 'pending', reasons: ['invalid-notification-evidence'] };
    const reasons = [];
    if (value.provenance !== 'real')
        reasons.push('provenance-must-be-real');
    if (value.browser.notificationApi !== 'supported')
        reasons.push('browser-notification-api-unavailable');
    if (value.browser.permission !== 'granted')
        reasons.push('browser-notification-permission-not-granted');
    if (!value.browser.constructorObserved)
        reasons.push('browser-notification-constructor-not-observed');
    if (!value.browser.clickHandlerObserved)
        reasons.push('browser-click-handler-not-observed');
    if (!value.notification.minimalContentOnly)
        reasons.push('notification-content-is-not-minimal');
    const os = value.operatingSystem;
    const requiredOsEvidence = [
        ['notificationsEnabled', 'windows-notifications-enabled'],
        ['edgeNotificationsEnabled', 'edge-notifications-enabled'],
        ['focusAssistOff', 'windows-focus-assist-off'],
        ['toastObserved', 'windows-toast-observed'],
        ['notificationCenterObserved', 'notification-center-retention-observed'],
        ['toastClicked', 'windows-toast-click-observed'],
        ['edgeFocusedAfterClick', 'edge-focus-after-toast-click-observed'],
        ['returnedToDsh', 'dsh-return-after-toast-click-observed'],
        ['targetVisibleInDsh', 'target-item-visible-after-return'],
    ];
    for (const [key, reason] of requiredOsEvidence) {
        if (os[key] === 'observed')
            continue;
        reasons.push(os[key] === 'not-tested' ? `${reason}-not-tested` : `${reason}-not-observed`);
    }
    return { status: reasons.length === 0 ? 'pass' : 'pending', reasons };
}
/**
 * Bind a developer-observed notification record to the exact sanitized
 * dogfood observation that produced it. The binding is shared by the CLI
 * validator and stable-gate evaluator so both reports enforce the same
 * evidence boundary.
 */
export function evaluateNotificationEvidenceBinding(value, bundles) {
    if (!isNotificationEvidence(value))
        return { status: 'pending', reasons: ['invalid-notification-evidence'] };
    if (bundles === undefined)
        return { status: 'pending', reasons: ['notification-dogfood-bundle-required'] };
    const run = bundles.find(candidate => candidate.run.runId === value.runId && candidate.run.trialId === value.trialId);
    const observation = run?.observations.find(candidate => candidate.observationRef === value.decision.observationRef);
    const reasons = [];
    if (run === undefined)
        reasons.push('notification-run-trial-not-found-in-dogfood');
    if (run !== undefined && run.run.pluginVersion !== value.pluginVersion)
        reasons.push('notification-plugin-version-mismatch');
    if (run !== undefined && run.run.runtimeTag !== value.runtimeTag)
        reasons.push('notification-runtime-tag-mismatch');
    if (observation === undefined)
        reasons.push('notification-observation-not-found-in-dogfood');
    if (observation !== undefined && observation.deliveryUnitRef !== value.decision.deliveryUnitRef)
        reasons.push('notification-delivery-unit-mismatch');
    if (observation !== undefined && observation.deliveryChannel !== value.notification.channel)
        reasons.push('notification-channel-mismatch');
    if (observation !== undefined && observation.observedDecision?.level !== value.decision.level)
        reasons.push('notification-level-mismatch');
    if (observation !== undefined && observation.observedDecision?.action !== value.decision.action)
        reasons.push('notification-action-mismatch');
    if (observation !== undefined && observation.observedDecision?.reasonCode !== value.decision.reasonCode)
        reasons.push('notification-reason-code-mismatch');
    if (observation !== undefined && Date.parse(value.runWindow.startedAt) > Date.parse(observation.occurredAt))
        reasons.push('notification-observation-before-run-window');
    if (observation !== undefined && Date.parse(value.runWindow.endedAt) < Date.parse(observation.occurredAt))
        reasons.push('notification-observation-after-run-window');
    if (Date.parse(value.runWindow.startedAt) > Date.parse(value.observedAt) || Date.parse(value.runWindow.endedAt) < Date.parse(value.observedAt))
        reasons.push('notification-evidence-outside-run-window');
    if (value.notification.titleKey !== `notification.title.${value.decision.reasonCode}`)
        reasons.push('notification-title-reason-mismatch');
    const delivery = observation?.notificationDelivery;
    if (delivery === undefined) {
        reasons.push('notification-delivery-record-not-found-in-dogfood');
    }
    else {
        if (delivery.notificationRef !== value.notification.notificationRef)
            reasons.push('notification-ref-mismatch');
        if (delivery.notificationAttemptId !== value.notification.notificationAttemptId)
            reasons.push('notification-attempt-mismatch');
        if (delivery.tagRef !== value.notification.tagRef)
            reasons.push('notification-tag-mismatch');
        if (delivery.titleKey !== value.notification.titleKey)
            reasons.push('notification-title-key-mismatch');
        if (delivery.bodyFingerprint !== value.notification.bodyFingerprint)
            reasons.push('notification-body-fingerprint-mismatch');
        if (value.browser.constructorObserved && !delivery.stages.includes('constructed'))
            reasons.push('notification-constructor-stage-missing');
        if (value.browser.clickHandlerObserved && !delivery.stages.includes('click-handler-attached'))
            reasons.push('notification-click-handler-stage-missing');
        if ((value.operatingSystem.toastClicked === 'observed' || value.operatingSystem.returnedToDsh === 'observed') && !delivery.stages.includes('clicked'))
            reasons.push('notification-click-stage-missing');
        const evidenceAt = Date.parse(value.observedAt);
        const firstDeliveryAt = Date.parse(delivery.firstObservedAt);
        if (Number.isFinite(evidenceAt) && Number.isFinite(firstDeliveryAt) && firstDeliveryAt > evidenceAt + 5 * 60 * 1000)
            reasons.push('notification-delivery-observed-after-evidence');
        if (delivery.clickedAt !== undefined && Number.isFinite(Date.parse(delivery.clickedAt)) && Number.isFinite(firstDeliveryAt) && Date.parse(delivery.clickedAt) < firstDeliveryAt)
            reasons.push('notification-click-before-construction');
    }
    return { status: reasons.length === 0 ? 'pass' : 'pending', reasons };
}
//# sourceMappingURL=notificationEvidence.js.map