interface Descriptor {
    ns: string;
    user?: unknown;
    revision: number;
}
export interface MigrationSettings {
    describe(): Descriptor[];
    update(ns: string, patch: object, expectedRevision?: number): Promise<void>;
}
/** Whitelist first, then validate ALL known values before any Host write. */
export declare function legacySettingsPatch(legacy: unknown, user: unknown): Record<string, unknown>;
export declare function importLegacySettings(home: string, stateDir: string, settings: MigrationSettings): Promise<'absent' | 'already-imported' | 'imported'>;
export {};
//# sourceMappingURL=settings-migration.d.ts.map