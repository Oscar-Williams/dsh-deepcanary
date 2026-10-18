import type { InboxItem } from '../types.js';
/** Keep human waits and deliberately scheduled work during routine update bursts. */
export declare function retainInboxItems<T extends InboxItem>(items: readonly T[], limit: number): T[];
//# sourceMappingURL=inbox-retention.d.ts.map