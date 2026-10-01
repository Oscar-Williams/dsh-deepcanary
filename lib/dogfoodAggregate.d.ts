import type { DogfoodBundle, DogfoodProvenance, DogfoodReport, DogfoodRun, DogfoodTaskFamily, DogfoodScenario } from './dogfood.js';
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
    taskOrigin: NonNullable<DogfoodRun['taskOrigin']>;
    declaredTaskOrigin: NonNullable<DogfoodRun['taskOrigin']>;
    taskRef?: string;
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
    /** Cohort metrics never mix unknown/controlled task intent into natural calibration. */
    cohorts: Record<NonNullable<DogfoodRun['taskOrigin']>, {
        runCount: number;
        observationCount: number;
        metrics: DogfoodReport['metrics'];
    }>;
    quality: {
        allReal: boolean;
        naturalRunCount: number;
        byTaskOrigin: Record<string, number>;
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