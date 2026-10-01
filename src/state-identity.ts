import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { homedir } from 'node:os'
import { createHash } from 'node:crypto'
import { MetadataStore } from './persistence.js'

export interface StateIdentity { directory: string; owner: string; profile?: string; home?: string }

export function resolveStateIdentity(profile: { name: string; dir: string; home: string } | undefined, entry: string, custom: string): StateIdentity {
  if (!/^[a-zA-Z0-9_-]+$/.test(entry)) throw new Error('Invalid plugin instance identity')
  const home = profile?.home ?? process.env.DSH_HOME ?? join(homedir(), '.dsh')
  const dir = profile?.dir ?? join(home, 'profiles', 'standalone')
  const directory = resolve(custom ? custom.replace(/^~(?=[/\\]|$)/, homedir()) : join(dir, 'state', entry))
  const owner = createHash('sha256').update(resolve(dir).toLowerCase()).update('\0').update(entry).digest('hex')
  return { directory, owner, ...(profile ? { profile: profile.name } : {}), home }
}

/** Exclusive creation prevents two profiles from both adopting a custom directory. */
export async function claimStateDirectory(identity: StateIdentity): Promise<void> {
  await mkdir(identity.directory, { recursive: true })
  const file = join(identity.directory, 'profile-owner.json')
  try {
    await writeFile(file, JSON.stringify({ schemaVersion: 1, owner: identity.owner }), { flag: 'wx', mode: 0o600 })
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error
    const existing = JSON.parse(await readFile(file, 'utf8')) as { owner?: string }
    if (existing.owner !== identity.owner) throw new Error('DeepCanary state directory belongs to another profile/instance; shared writes refused')
  }
}

/** Desktop adopts legacy metadata only; navigation stays disabled until Host reconciliation. */
export async function importLegacyInbox(identity: StateIdentity): Promise<void> {
  if (identity.profile !== 'desktop' || !identity.home) return
  const target = new MetadataStore(identity.directory)
  const marker = join(identity.directory, 'legacy-inbox-import.json')
  try { await readFile(marker); return } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error }
  try { await readFile(target.file); return } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error }
  const source = new MetadataStore(join(identity.home, 'dsh-deepcanary'))
  if (source.directory === target.directory) return
  const items = await source.load()
  if (!items.length) return
  await target.save(items.map(item => ({ ...item, targetAvailable: false })))
  await writeFile(marker, JSON.stringify({ schemaVersion: 1, importedAt: new Date().toISOString() }), { flag: 'wx', mode: 0o600 })
}
