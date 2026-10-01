/** An editor owns its revision for the entire dirty-draft lifetime. */
export interface DraftSource<T> {
    value: T | undefined;
    base: T | undefined;
    revision: number | undefined;
    writable: boolean;
}
export type DraftOperation = {
    op: 'unset';
    path: [string];
} | {
    op: 'set';
    path: [string];
    value: unknown;
};
export type DraftFailure = 'conflict' | 'transport' | 'readOnly' | 'unavailable';
export declare class SettingsDraft<T extends object> {
    private readonly keys;
    private readonly read;
    private readonly mutate;
    value: T | undefined;
    dirty: boolean;
    saving: boolean;
    failure: DraftFailure | undefined;
    private revision;
    private resetFields;
    constructor(keys: readonly (keyof T & string)[], read: () => DraftSource<T>, mutate: (operations: readonly DraftOperation[], revision: number) => Promise<boolean>);
    refresh(): void;
    edit<K extends keyof T>(key: K, value: T[K]): void;
    reset(): void;
    discard(): void;
    save(): Promise<boolean>;
}
//# sourceMappingURL=settings-draft.d.ts.map