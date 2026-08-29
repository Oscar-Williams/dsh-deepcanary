import Schema from '@deepseek-ai/schemastery';
export const Config = Schema.object({
    stateDir: Schema.string().default('~/.dsh/dsh-deepcanary').description('Metadata-only local state directory'),
    notificationLevel: Schema.union(['C1', 'C2', 'C3']).default('C2').description('Highest level allowed to notify the user'),
    maxInterruptsPerHour: Schema.natural().min(0).max(10).default(3).description('C2 interrupt budget per rolling hour'),
    dedupeWindowMinutes: Schema.natural().min(0).max(120).default(10).description('Dedupe window for equivalent signals'),
    bundleWindowSeconds: Schema.natural().min(0).max(900).default(60).description('Window for bundling adjacent attention items'),
    longRunThresholdMinutes: Schema.natural().min(1).max(120).default(5).description('Idle threshold before a running session is checked for a stall'),
    subagentPressure: Schema.union(['relaxed', 'standard', 'strict']).default('standard').description('Subagent pressure thresholds'),
    quietHours: Schema.object({
        enabled: Schema.boolean().default(false),
        start: Schema.string().default('22:00'),
        end: Schema.string().default('08:00'),
    }).default({ enabled: false, start: '22:00', end: '08:00' }),
    privacySafeSummary: Schema.boolean().default(true).description('Keep content and prompts out of plugin state and notifications'),
    healthPollSeconds: Schema.natural().min(5).max(300).default(15).description('Local liveness check interval'),
    maxInboxItems: Schema.natural().min(50).max(5000).default(500).description('Maximum retained metadata inbox items'),
});
const defaults = {
    stateDir: '~/.dsh/dsh-deepcanary',
    notificationLevel: 'C2',
    maxInterruptsPerHour: 3,
    dedupeWindowMinutes: 10,
    bundleWindowSeconds: 60,
    longRunThresholdMinutes: 5,
    subagentPressure: 'standard',
    quietHours: { enabled: false, start: '22:00', end: '08:00' },
    privacySafeSummary: true,
    healthPollSeconds: 15,
    maxInboxItems: 500,
};
export function normalizeConfig(input) {
    const quietHours = input?.quietHours;
    return {
        ...defaults,
        ...input,
        quietHours: {
            ...defaults.quietHours,
            ...quietHours,
        },
    };
}
function integerPatch(value, name, min, max) {
    if (typeof value !== 'number' || !Number.isSafeInteger(value))
        throw new TypeError(`${name} must be an integer`);
    if (value < min || value > max)
        throw new RangeError(`${name} must be between ${min} and ${max}`);
    return value;
}
function clockPatch(value, name) {
    if (typeof value !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(value))
        throw new TypeError(`${name} must use HH:MM format`);
    return value;
}
/** Validate the browser settings surface without exposing stateDir or unknown keys. */
export function sanitizeConfigPatch(input) {
    const patch = {};
    for (const key of Object.keys(input)) {
        if (!['notificationLevel', 'maxInterruptsPerHour', 'dedupeWindowMinutes', 'bundleWindowSeconds', 'longRunThresholdMinutes', 'subagentPressure', 'quietHours', 'privacySafeSummary', 'healthPollSeconds', 'maxInboxItems'].includes(key)) {
            throw new TypeError(`unsupported setting: ${key}`);
        }
    }
    if (input.notificationLevel !== undefined) {
        if (input.notificationLevel !== 'C1' && input.notificationLevel !== 'C2' && input.notificationLevel !== 'C3')
            throw new TypeError('notificationLevel must be C1, C2, or C3');
        patch.notificationLevel = input.notificationLevel;
    }
    if (input.maxInterruptsPerHour !== undefined)
        patch.maxInterruptsPerHour = integerPatch(input.maxInterruptsPerHour, 'maxInterruptsPerHour', 0, 10);
    if (input.dedupeWindowMinutes !== undefined)
        patch.dedupeWindowMinutes = integerPatch(input.dedupeWindowMinutes, 'dedupeWindowMinutes', 0, 120);
    if (input.bundleWindowSeconds !== undefined)
        patch.bundleWindowSeconds = integerPatch(input.bundleWindowSeconds, 'bundleWindowSeconds', 0, 900);
    if (input.longRunThresholdMinutes !== undefined)
        patch.longRunThresholdMinutes = integerPatch(input.longRunThresholdMinutes, 'longRunThresholdMinutes', 1, 120);
    if (input.subagentPressure !== undefined) {
        if (input.subagentPressure !== 'relaxed' && input.subagentPressure !== 'standard' && input.subagentPressure !== 'strict')
            throw new TypeError('subagentPressure must be relaxed, standard, or strict');
        patch.subagentPressure = input.subagentPressure;
    }
    if (input.quietHours !== undefined) {
        if (input.quietHours === null || typeof input.quietHours !== 'object')
            throw new TypeError('quietHours must be an object');
        const quietHours = input.quietHours;
        for (const key of Object.keys(quietHours))
            if (!['enabled', 'start', 'end'].includes(key))
                throw new TypeError(`unsupported quiet-hours setting: ${key}`);
        if (quietHours.enabled !== undefined && typeof quietHours.enabled !== 'boolean')
            throw new TypeError('quietHours.enabled must be boolean');
        patch.quietHours = {
            ...(quietHours.enabled === undefined ? {} : { enabled: quietHours.enabled }),
            ...(quietHours.start === undefined ? {} : { start: clockPatch(quietHours.start, 'quietHours.start') }),
            ...(quietHours.end === undefined ? {} : { end: clockPatch(quietHours.end, 'quietHours.end') }),
        };
    }
    if (input.privacySafeSummary !== undefined) {
        if (typeof input.privacySafeSummary !== 'boolean')
            throw new TypeError('privacySafeSummary must be boolean');
        patch.privacySafeSummary = input.privacySafeSummary;
    }
    if (input.healthPollSeconds !== undefined)
        patch.healthPollSeconds = integerPatch(input.healthPollSeconds, 'healthPollSeconds', 5, 300);
    if (input.maxInboxItems !== undefined)
        patch.maxInboxItems = integerPatch(input.maxInboxItems, 'maxInboxItems', 50, 5000);
    return patch;
}
//# sourceMappingURL=config.js.map