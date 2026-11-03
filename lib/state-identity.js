import { mkdir, readFile, writeFile, unlink, rename, rmdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { homedir } from 'node:os';
import { createHash, randomUUID } from 'node:crypto';
import { MetadataStore } from './persistence.js';
export function resolveStateIdentity(profile, entry, custom) {
    if (!/^[a-zA-Z0-9_-]+$/.test(entry))
        throw new Error('Invalid plugin instance identity');
    const home = profile?.home ?? process.env.DSH_HOME ?? join(homedir(), '.dsh');
    const dir = profile?.dir ?? join(home, 'profiles', 'standalone');
    const directory = resolve(custom ? custom.replace(/^~(?=[/\\]|$)/, homedir()) : join(dir, 'state', entry));
    const owner = createHash('sha256').update(resolve(dir).toLowerCase()).update('\0').update(entry).digest('hex');
    return { directory, owner, ...(profile ? { profile: profile.name } : {}), home };
}
/** Exclusive creation prevents two profiles from both adopting a custom directory. */
export async function claimStateDirectory(identity) {
    await mkdir(identity.directory, { recursive: true });
    const file = join(identity.directory, 'profile-owner.json');
    try {
        await writeFile(file, JSON.stringify({ schemaVersion: 1, owner: identity.owner }), { flag: 'wx', mode: 0o600 });
    }
    catch (error) {
        if (error.code !== 'EEXIST')
            throw error;
        const existing = JSON.parse(await readFile(file, 'utf8'));
        if (existing.owner !== identity.owner)
            throw new Error('DeepCanary state directory belongs to another profile/instance; shared writes refused');
    }
}
/** Hold one writer for the complete Host lifecycle, including the last queued save. */
export async function claimStateWriter(identity) {
    const file = join(identity.directory, 'inbox-writer.json');
    const token = randomUUID();
    const lock = join(identity.directory, 'inbox-writer.lock');
    const candidate = join(identity.directory, `inbox-writer.pending-${token}`);
    const owner = { schemaVersion: 1, owner: identity.owner, pid: process.pid, token };
    const readOwner = async (target) => {
        const value = JSON.parse(await readFile(target, 'utf8'));
        if (value.owner !== identity.owner || !Number.isSafeInteger(value.pid) || value.pid <= 0
            || typeof value.token !== 'string' || !/^[a-f0-9-]{36}$/.test(value.token))
            throw new Error('Invalid DeepCanary writer identity; original lock preserved');
        return value;
    };
    const alive = (pid) => {
        try {
            process.kill(pid, 0);
            return true;
        }
        catch (error) {
            if (error.code === 'ESRCH')
                return false;
            throw error;
        }
    };
    const removeOwnDirectory = async (target) => {
        try {
            if ((await readOwner(join(target, 'owner.json'))).token !== token)
                return;
            await unlink(join(target, 'owner.json'));
            await rmdir(target);
        }
        catch (error) {
            if (error.code !== 'ENOENT')
                throw error;
        }
    };
    // Publish a nonempty directory atomically. A stale directory is renamed to
    // its own fixed, nonempty tombstone: a second stale reader cannot rename a
    // replacement writer over that tombstone and steal the new claim.
    await mkdir(candidate);
    await writeFile(join(candidate, 'owner.json'), JSON.stringify(owner), { flag: 'wx', mode: 0o600 });
    try {
        try {
            await rename(candidate, lock);
        }
        catch {
            const previous = await readOwner(join(lock, 'owner.json'));
            if (alive(previous.pid))
                throw new Error('Another live Host owns the DeepCanary ledger');
            await rename(lock, join(identity.directory, `inbox-writer.stale-${previous.token}`));
            await rename(candidate, lock);
        }
    }
    catch (error) {
        await removeOwnDirectory(candidate);
        throw error;
    }
    const claim = async () => {
        await writeFile(file, JSON.stringify(owner), { flag: 'wx', mode: 0o600 });
    };
    try {
        try {
            await claim();
        }
        catch (error) {
            if (error.code !== 'EEXIST')
                throw error;
            const previous = await readOwner(file);
            if (alive(previous.pid))
                throw new Error('Another live Host owns the DeepCanary ledger');
            await unlink(file);
            await claim();
        }
    }
    catch (error) {
        await removeOwnDirectory(lock);
        throw error;
    }
    return async () => {
        const current = await readOwner(file);
        if (current.token !== token)
            throw new Error('DeepCanary writer ownership changed before release');
        await unlink(file);
        await removeOwnDirectory(lock);
    };
}
/** Desktop adopts legacy metadata only; navigation stays disabled until Host reconciliation. */
export async function importLegacyInbox(identity) {
    if (identity.profile !== 'desktop' || !identity.home)
        return;
    const target = new MetadataStore(identity.directory);
    const marker = join(identity.directory, 'legacy-inbox-import.json');
    try {
        await readFile(marker);
        return;
    }
    catch (error) {
        if (error.code !== 'ENOENT')
            throw error;
    }
    try {
        await readFile(target.file);
        return;
    }
    catch (error) {
        if (error.code !== 'ENOENT')
            throw error;
    }
    const source = new MetadataStore(join(identity.home, 'dsh-deepcanary'));
    if (source.directory === target.directory)
        return;
    const items = await source.load();
    if (!items.length)
        return;
    await target.save(items.map(item => ({ ...item, targetAvailable: false })));
    await writeFile(marker, JSON.stringify({ schemaVersion: 1, importedAt: new Date().toISOString() }), { flag: 'wx', mode: 0o600 });
}
//# sourceMappingURL=state-identity.js.map