import type { AttentionVerdict, InboxItem } from '../types.js';
export declare const MAX_NOTIFICATION_GENERATION = 2147483647;
export declare function notificationGeneration(item: {
    notificationGeneration?: number;
}): number;
/** Keep the original delivery identity readable while fencing each explicit reschedule. */
export declare function notificationKey(item: {
    id: string;
    notificationGeneration?: number;
}): string;
export declare function notificationCondition(item: InboxItem): string;
/** Reapply delivery preferences to the existing classification and evidence. */
export declare function reminderVerdict(item: InboxItem): AttentionVerdict;
//# sourceMappingURL=reminders.d.ts.map