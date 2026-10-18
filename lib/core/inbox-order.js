const level = { C0: 0, C1: 1, C2: 2, C3: 3 };
const human = (item) => item.reasonCode === 'HUMAN_QUESTION_PENDING' || item.reasonCode === 'HUMAN_APPROVAL_REQUIRED' ? 1 : 0;
/** Surface urgent pending work before routine updates, with stable recency within each class. */
export function compareInboxPriority(left, right) {
    return level[right.level] - level[left.level] || human(right) - human(left)
        || Date.parse(right.lastReminderAt ?? right.occurredAt) - Date.parse(left.lastReminderAt ?? left.occurredAt);
}
//# sourceMappingURL=inbox-order.js.map