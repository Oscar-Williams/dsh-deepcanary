import { readFile, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { load, JSON_SCHEMA } from 'js-yaml';
import { normalizeConfig, sanitizeConfigPatch } from './config.js';
const record = (value) => value !== null && typeof value === 'object' && !Array.isArray(value) ? value : {};
/** Whitelist first, then validate ALL known values before any Host write. */
export function legacySettingsPatch(legacy, user) {
    const source = record(legacy);
    const known = Object.fromEntries(Object.keys(normalizeConfig(undefined)).filter(key => key !== 'stateDir' && Object.hasOwn(source, key)).map(key => [key, source[key]]));
    if (Object.hasOwn(known, 'quietHours')) {
        if (known.quietHours === null || typeof known.quietHours !== 'object' || Array.isArray(known.quietHours))
            throw new TypeError('Invalid legacy quietHours');
        known.quietHours = Object.fromEntries(Object.entries(record(known.quietHours)).filter(([key]) => ['enabled', 'start', 'end'].includes(key)));
    }
    sanitizeConfigPatch(known);
    const explicit = record(user);
    const missing = {};
    for (const [key, value] of Object.entries(known)) {
        if (key === 'quietHours') {
            if (Object.hasOwn(explicit, key) && (explicit[key] === null || typeof explicit[key] !== 'object'))
                continue;
            const children = Object.fromEntries(Object.entries(record(value)).filter(([child]) => !Object.hasOwn(record(explicit[key]), child)));
            if (Object.keys(children).length)
                missing[key] = children;
        }
        else if (!Object.hasOwn(explicit, key))
            missing[key] = value;
    }
    return missing;
}
export async function importLegacySettings(home, stateDir, settings) {
    const marker = join(stateDir, 'legacy-settings-import.json');
    try {
        await stat(marker);
        return 'already-imported';
    }
    catch (error) {
        if (error.code !== 'ENOENT')
            throw error;
    }
    let legacy;
    for (const name of ['settings.yaml.imported', 'settings.yaml']) {
        const file = join(home, name);
        try {
            if ((await stat(file)).size > 1024 * 1024)
                throw new Error('Legacy settings exceed size limit');
            const document = record(load(await readFile(file, 'utf8'), { schema: JSON_SCHEMA }));
            if (Object.hasOwn(document, 'dsh-deepcanary')) {
                legacy = document['dsh-deepcanary'];
                break;
            }
        }
        catch (error) {
            if (error.code !== 'ENOENT')
                throw error;
        }
    }
    if (legacy === undefined)
        return 'absent';
    if (legacy === null || typeof legacy !== 'object' || Array.isArray(legacy))
        throw new TypeError('Invalid legacy DeepCanary section');
    for (let attempt = 0; attempt < 2; attempt++) {
        const descriptor = settings.describe().find(row => row.ns === 'deepcanary');
        if (!descriptor)
            throw new Error('DeepCanary Host settings not served');
        const patch = legacySettingsPatch(legacy, descriptor.user);
        try {
            if (Object.keys(patch).length)
                await settings.update('deepcanary', patch, descriptor.revision);
            await writeFile(marker, JSON.stringify({ schemaVersion: 1, importedAt: new Date().toISOString() }), { flag: 'wx', mode: 0o600 });
            return 'imported';
        }
        catch (error) {
            if (attempt === 0 && error instanceof Error && error.name === 'SettingsConflictError')
                continue;
            throw error;
        }
    }
    throw new Error('Legacy settings migration conflict');
}
//# sourceMappingURL=settings-migration.js.map