import type { InboxItem } from './types.js';
export declare function hashMetadata(value: string): string;
export declare function resolveStateDir(value: string): string;
export declare class MetadataStore {
    readonly directory: string;
    readonly file: string;
    constructor(stateDir: string);
    load(): Promise<InboxItem[]>;
    save(items: readonly InboxItem[]): Promise<void>;
}
//# sourceMappingURL=persistence.d.ts.map