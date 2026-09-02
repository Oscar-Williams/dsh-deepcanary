import type { DogfoodBundle, DogfoodProvenance, DogfoodReport, DogfoodTaskFamily, DogfoodScenario } from './dogfood.js';
export declare const DOGFOOD_AGGREGATE_SCHEMA_VERSION: 1;
export interface DogfoodAggregate {
    schemaVersion: typeof DOGFOOD_AGGREGATE_SCHEMA_VERSION;
    aggregateId: string;
    generatedAt: string;
    rawContentPersisted: false;
    bundles: DogfoodBundle[];
}
export interface DogfoodRunSummary {
    runId: string;
    trialId: string;
    provenance: DogfoodProvenance;
    taskFamily: DogfoodTaskFamily;
    scenario: DogfoodScenario;
    pluginVersion: string;
    runtimeTag: string;
    policyVersion: string;
    observationCount: number;
    receiptCount: number;
}
export interface DogfoodAggregateReport {
    reportSchemaVersion: typeof DOGFOOD_AGGREGATE_SCHEMA_VERSION;
    aggregateSchemaVersion: typeof DOGFOOD_AGGREGATE_SCHEMA_VERSION;
    aggregateId: string;
    provenance: DogfoodProvenance | 'mixed';
    bundleCount: number;
    runCount: number;
    trialCount: number;
    observationCount: number;
    receiptCount: number;
    pluginVersions: string[];
    runtimeTags: string[];
    policyVersions: string[];
    runs: DogfoodRunSummary[];
    taxonomy: DogfoodReport['taxonomy'] & {
        byProvenance: Record<string, number>;
    };
    coverage: DogfoodReport['coverage'];
    metrics: DogfoodReport['metrics'];
    quality: {
        allReal: boolean;
        requiredTaskFamilies: {
            required: DogfoodTaskFamily[];
            observed: DogfoodTaskFamily[];
            missing: DogfoodTaskFamily[];
        };
        requiredScenarios: {
            required: DogfoodScenario[];
            observed: DogfoodScenario[];
            missing: DogfoodScenario[];
        };
    };
    generatedAt: string;
    conclusion: string;
}
export declare function isDogfoodAggregate(value: unknown): value is DogfoodAggregate;
export declare function createDogfoodAggregate(aggregateId: string, bundles: readonly DogfoodBundle[], generatedAt?: string): DogfoodAggregate;
export declare function summarizeDogfoodAggregate(aggregate: DogfoodAggregate): DogfoodAggregateReport;
//# sourceMappingURL=dogfoodAggregate.d.ts.map