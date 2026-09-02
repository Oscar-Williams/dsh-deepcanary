import { isDogfoodBundle, summarizeDogfood } from './dogfood.js';
export const DOGFOOD_AGGREGATE_SCHEMA_VERSION = 1;
const aggregateIdPattern = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const requiredTaskFamilies = ['coding', 'build-test', 'research', 'multi-stage', 'subagent'];
const requiredScenarios = ['approval-boundary', 'network-recovery', 'healthy-long-run', 'normal-completion', 'explicit-failure', 'recovery-continued'];
function isRecord(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
}
function isIsoDate(value) {
    return typeof value === 'string' && Number.isFinite(Date.parse(value));
}
function countBy(values, key) {
    return values.reduce((result, value) => {
        const name = key(value);
        result[name] = (result[name] ?? 0) + 1;
        return result;
    }, {});
}
function metric(numerator, denominator, minimumSample = 5, requirePositiveNumerator = false, minimumRate) {
    return {
        numerator,
        denominator,
        rate: denominator === 0 ? null : numerator / denominator,
        status: denominator === 0 || denominator < minimumSample || (requirePositiveNumerator && numerator === 0) || (minimumRate !== undefined && (denominator === 0 || numerator / denominator < minimumRate))
            ? denominator === 0 ? 'no-data' : 'insufficient-sample'
            : 'ok',
    };
}
function combineMetric(reports, key, requirePositiveNumerator = false, minimumRate) {
    const numerator = reports.reduce((sum, report) => sum + report.metrics[key].numerator, 0);
    const denominator = reports.reduce((sum, report) => sum + report.metrics[key].denominator, 0);
    return metric(numerator, denominator, 5, requirePositiveNumerator, minimumRate);
}
function scopedRef(observation, ref) {
    return `${observation.runId}:${ref}`;
}
export function isDogfoodAggregate(value) {
    if (!isRecord(value)
        || value.schemaVersion !== DOGFOOD_AGGREGATE_SCHEMA_VERSION
        || typeof value.aggregateId !== 'string'
        || !aggregateIdPattern.test(value.aggregateId)
        || !isIsoDate(value.generatedAt)
        || value.rawContentPersisted !== false
        || !Array.isArray(value.bundles)
        || value.bundles.length === 0
        || !value.bundles.every(isDogfoodBundle))
        return false;
    const runs = value.bundles.map(bundle => bundle.run.runId);
    const trials = value.bundles.map(bundle => `${bundle.run.provenance}:${bundle.run.trialId}`);
    return new Set(runs).size === runs.length && new Set(trials).size === trials.length;
}
export function createDogfoodAggregate(aggregateId, bundles, generatedAt = new Date().toISOString()) {
    const aggregate = {
        schemaVersion: DOGFOOD_AGGREGATE_SCHEMA_VERSION,
        aggregateId,
        generatedAt,
        rawContentPersisted: false,
        bundles: bundles.map(bundle => ({
            schemaVersion: bundle.schemaVersion,
            run: { ...bundle.run },
            observations: bundle.observations.map(observation => ({ ...observation })),
            receipts: bundle.receipts.map(receipt => ({ ...receipt, reviewFlags: [...receipt.reviewFlags] })),
        })),
    };
    if (!isDogfoodAggregate(aggregate))
        throw new TypeError('cannot create an invalid dogfood aggregate');
    return aggregate;
}
export function summarizeDogfoodAggregate(aggregate) {
    if (!isDogfoodAggregate(aggregate))
        throw new TypeError('invalid dogfood aggregate');
    const reports = aggregate.bundles.map(summarizeDogfood);
    const observations = aggregate.bundles.flatMap(bundle => bundle.observations);
    const provenanceValues = aggregate.bundles.map(bundle => bundle.run.provenance);
    const provenance = new Set(provenanceValues).size === 1 ? (provenanceValues[0] ?? 'mixed') : 'mixed';
    const taskValues = aggregate.bundles.map(bundle => bundle.run.taskFamily);
    const scenarioValues = aggregate.bundles.map(bundle => bundle.run.scenario);
    const observedTasks = [...new Set(taskValues)].sort();
    const observedScenarios = [...new Set(scenarioValues)].sort();
    const deliveryUnits = new Set(observations.flatMap(observation => observation.deliveryUnitRef === undefined ? [] : [scopedRef(observation, observation.deliveryUnitRef)]));
    const userFacing = observations.filter(observation => ['inbox', 'digest', 'interrupt', 'escalate'].includes(observation.decisionDisposition));
    const userFacingDeliveryUnits = new Set(userFacing.flatMap(observation => observation.deliveryUnitRef === undefined ? [] : [scopedRef(observation, observation.deliveryUnitRef)]));
    const reviewedUserFacingUnits = new Set(userFacing
        .filter(observation => observation.deliveryUnitRef !== undefined && (observation.reviewLabel !== undefined || observation.policyReview !== undefined || observation.userFeedback !== undefined))
        .map(observation => scopedRef(observation, observation.deliveryUnitRef)));
    const negativeOpportunityUnits = new Set(observations
        .filter(observation => observation.expectedDecision?.action === 'IGNORE')
        .map(observation => scopedRef(observation, observation.deliveryUnitRef ?? observation.observationRef)));
    const bundles = new Set(observations.flatMap(observation => observation.bundleRef === undefined ? [] : [scopedRef(observation, observation.bundleRef)]));
    const labeled = observations.filter(observation => observation.reviewLabel !== undefined || observation.policyReview !== undefined || observation.userFeedback !== undefined);
    const decisions = observations.filter(observation => observation.observedDecision !== undefined || observation.expectedDecision !== undefined);
    const dropped = observations.filter(observation => observation.decisionDisposition === 'dropped-event' || observation.reviewLabel === 'dropped-event');
    const taxonomy = {
        byTaskFamily: countBy(observations, observation => aggregate.bundles.find(bundle => bundle.run.runId === observation.runId)?.run.taskFamily ?? 'unknown'),
        byScenario: countBy(observations, observation => aggregate.bundles.find(bundle => bundle.run.runId === observation.runId)?.run.scenario ?? 'unknown'),
        byEventClass: countBy(observations, observation => observation.eventClass),
        byEventSubtype: countBy(observations, observation => observation.eventSubtype),
        byPhase: countBy(observations, observation => observation.phase),
        byDisposition: countBy(observations, observation => observation.decisionDisposition),
        byReviewLabel: countBy(labeled, observation => observation.reviewLabel ?? observation.policyReview ?? observation.userFeedback ?? 'unreviewed'),
        byProvenance: countBy(observations, observation => aggregate.bundles.find(bundle => bundle.run.runId === observation.runId)?.run.provenance ?? 'unknown'),
    };
    const coverage = {
        reviewedDecisions: labeled.filter(observation => observation.observedDecision !== undefined || observation.expectedDecision !== undefined).length,
        decisions: decisions.length,
        deliveryUnits: deliveryUnits.size,
        userFacingDeliveryUnits: userFacingDeliveryUnits.size,
        reviewedUserFacingUnits: reviewedUserFacingUnits.size,
        negativeOpportunityUnits: negativeOpportunityUnits.size,
        bundles: bundles.size,
        c0Silent: observations.filter(observation => observation.decisionDisposition === 'c0-silent').length,
        suppressed: observations.filter(observation => observation.decisionDisposition === 'suppressed').length,
        deduped: observations.filter(observation => observation.decisionDisposition === 'deduped').length,
        droppedEvents: dropped.length,
    };
    const missingTasks = requiredTaskFamilies.filter(value => !observedTasks.includes(value));
    const missingScenarios = requiredScenarios.filter(value => !observedScenarios.includes(value));
    return {
        reportSchemaVersion: DOGFOOD_AGGREGATE_SCHEMA_VERSION,
        aggregateSchemaVersion: DOGFOOD_AGGREGATE_SCHEMA_VERSION,
        aggregateId: aggregate.aggregateId,
        provenance,
        bundleCount: aggregate.bundles.length,
        runCount: new Set(aggregate.bundles.map(bundle => bundle.run.runId)).size,
        trialCount: new Set(aggregate.bundles.map(bundle => `${bundle.run.provenance}:${bundle.run.trialId}`)).size,
        observationCount: observations.length,
        receiptCount: aggregate.bundles.reduce((sum, bundle) => sum + bundle.receipts.length, 0),
        pluginVersions: [...new Set(aggregate.bundles.map(bundle => bundle.run.pluginVersion))].sort(),
        runtimeTags: [...new Set(aggregate.bundles.map(bundle => bundle.run.runtimeTag))].sort(),
        policyVersions: [...new Set(aggregate.bundles.map(bundle => bundle.run.policyVersion))].sort(),
        runs: aggregate.bundles.map(bundle => ({
            runId: bundle.run.runId,
            trialId: bundle.run.trialId,
            provenance: bundle.run.provenance,
            taskFamily: bundle.run.taskFamily,
            scenario: bundle.run.scenario,
            pluginVersion: bundle.run.pluginVersion,
            runtimeTag: bundle.run.runtimeTag,
            policyVersion: bundle.run.policyVersion,
            observationCount: bundle.observations.length,
            receiptCount: bundle.receipts.length,
        })),
        taxonomy,
        coverage,
        metrics: {
            humanNeededRecall: combineMetric(reports, 'humanNeededRecall'),
            usefulnessRate: combineMetric(reports, 'usefulnessRate'),
            usefulInterruptPrecision: combineMetric(reports, 'usefulInterruptPrecision'),
            wrongLevelRate: combineMetric(reports, 'wrongLevelRate'),
            falseStallRate: combineMetric(reports, 'falseStallRate'),
            recoveryBeforeOpenRate: combineMetric(reports, 'recoveryBeforeOpenRate'),
            attentionCompressionRatio: metric(observations.length, Math.max(1, deliveryUnits.size || observations.filter(observation => ['inbox', 'digest', 'interrupt', 'escalate'].includes(observation.decisionDisposition)).length)),
            droppedEventRate: metric(dropped.length, observations.length),
            reviewCoverage: combineMetric(reports, 'reviewCoverage', true, 0.8),
        },
        quality: {
            allReal: provenance === 'real',
            requiredTaskFamilies: { required: [...requiredTaskFamilies], observed: observedTasks, missing: missingTasks },
            requiredScenarios: { required: [...requiredScenarios], observed: observedScenarios, missing: missingScenarios },
        },
        generatedAt: new Date().toISOString(),
        conclusion: provenance === 'real' && missingTasks.length === 0 && missingScenarios.length === 0
            ? 'This aggregate covers every declared real-task family and scenario; metric status still determines release readiness.'
            : 'This aggregate is a traceable multi-run diagnostic. Missing provenance, task families, scenarios, or reviewed opportunities remain explicit in quality and metric fields.',
    };
}
//# sourceMappingURL=dogfoodAggregate.js.map