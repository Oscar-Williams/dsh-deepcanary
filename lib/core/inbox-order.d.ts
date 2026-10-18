import type { PublicInboxItem } from '../types.js';
type OrderedItem = Pick<PublicInboxItem, 'level' | 'reasonCode' | 'occurredAt' | 'lastReminderAt'>;
/** Surface urgent pending work before routine updates, with stable recency within each class. */
export declare function compareInboxPriority(left: OrderedItem, right: OrderedItem): number;
export {};
//# sourceMappingURL=inbox-order.d.ts.map