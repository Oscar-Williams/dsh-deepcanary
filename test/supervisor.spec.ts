import { readFile, writeFile, readdir, mkdtemp, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { PersistentSupervisor, supervisorSnapshotFor } from '../src/supervisor.js'

function snapshot(now: number, revision = 7) {
  return supervisorSnapshotFor(
    '0.1.2-alpha.5',
    'ready',
    revision,
    [{ sessionRef: 'session-hash', attentionLevel: 'C2', pendingCount: 1, lastEvidenceAt: new Date(now).toISOString() }],
    ['item-hash'],
    now,
  )
}

describe('PersistentSupervisor', () => {
  it('flushes the latest bounded snapshot, restores it, and releases its lease', async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), 'deepcanary-supervisor-'))
    try {
      const now = 1_756_800_000_000
      const first = new PersistentSupervisor({
        stateDir: directory,
        runtimeVersion: '0.1.2-alpha.5',
        now: () => now,
        pid: 101,
        instanceId: 'first-instance',
        heartbeatMs: 60_000,
      })
      expect(await first.start()).toBe(true)
      first.update(snapshot(now))
      await first.stop()

      const persisted = JSON.parse(await readFile(first.store.snapshotFile, 'utf8')) as { snapshot: { revision: number; pending: string[] } }
      expect(persisted.snapshot).toMatchObject({ revision: 7, pending: ['item-hash'] })
      expect(await first.store.loadLease()).toBeUndefined()

      const restored = new PersistentSupervisor({
        stateDir: directory,
        runtimeVersion: '0.1.2-alpha.5',
        now: () => now,
        pid: 102,
        instanceId: 'restored-instance',
        heartbeatMs: 60_000,
      })
      expect(await restored.start()).toBe(true)
      expect(restored.status()).toMatchObject({ state: 'running', restored: true, leaseHeld: true, revision: 7 })
      expect(restored.snapshot()).toMatchObject({ revision: 7, pending: ['item-hash'] })
      await restored.stop()
    } finally {
      await rm(directory, { recursive: true, force: true })
    }
  })

  it('persists and restores the bounded cross-sink delivery ledger', async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), 'deepcanary-supervisor-delivery-'))
    try {
      const now = 1_756_800_000_000
      const delivery = {
        logicalKeyHash: '1111111111111111',
        sink: 'browser' as const,
        attemptHash: '2222222222222222',
        attemptHashes: ['2222222222222222'],
        state: 'clicked' as const,
        attempts: 1,
        firstObservedAt: new Date(now).toISOString(),
        updatedAt: new Date(now + 1).toISOString(),
      }
      const first = new PersistentSupervisor({
        stateDir: directory,
        runtimeVersion: '0.1.2-alpha.5',
        now: () => now,
        pid: 151,
        instanceId: 'delivery-owner',
        heartbeatMs: 60_000,
      })
      expect(await first.start()).toBe(true)
      first.update(supervisorSnapshotFor('0.1.2-alpha.5', 'ready', 2, [], [], now, 2_000, undefined, [delivery]))
      await first.stop()

      const restored = new PersistentSupervisor({
        stateDir: directory,
        runtimeVersion: '0.1.2-alpha.5',
        now: () => now,
        pid: 152,
        instanceId: 'delivery-restored',
        heartbeatMs: 60_000,
      })
      expect(await restored.start()).toBe(true)
      expect(restored.snapshot().deliveryLedger).toEqual([delivery])
      await restored.stop()
    } finally {
      await rm(directory, { recursive: true, force: true })
    }
  })

  it('blocks a competing instance while the current lease is fresh', async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), 'deepcanary-supervisor-lease-'))
    try {
      const now = 1_756_800_000_000
      const first = new PersistentSupervisor({
        stateDir: directory,
        runtimeVersion: '0.1.2-alpha.5',
        now: () => now,
        pid: 201,
        instanceId: 'lease-owner',
        heartbeatMs: 60_000,
      })
      const contender = new PersistentSupervisor({
        stateDir: directory,
        runtimeVersion: '0.1.2-alpha.5',
        now: () => now,
        pid: 202,
        instanceId: 'lease-contender',
        heartbeatMs: 60_000,
      })
      expect(await first.start()).toBe(true)
      expect(await contender.start()).toBe(false)
      expect(contender.status()).toMatchObject({ state: 'standby', leaseHeld: false })
      await first.stop()
      await contender.stop()
    } finally {
      await rm(directory, { recursive: true, force: true })
    }
  })

  it('retries standby ownership and becomes the active supervisor after release', async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), 'deepcanary-supervisor-standby-'))
    try {
      const now = 1_756_800_000_000
      const first = new PersistentSupervisor({
        stateDir: directory,
        runtimeVersion: '0.1.2-alpha.5',
        now: () => now,
        pid: 251,
        instanceId: 'standby-owner',
        heartbeatMs: 60_000,
        standbyRetryMs: 5,
      })
      const contender = new PersistentSupervisor({
        stateDir: directory,
        runtimeVersion: '0.1.2-alpha.5',
        now: () => now,
        pid: 252,
        instanceId: 'standby-contender',
        heartbeatMs: 60_000,
        standbyRetryMs: 5,
      })
      expect(await first.start()).toBe(true)
      expect(await contender.start()).toBe(false)
      expect(contender.status().state).toBe('standby')
      await first.stop()
      await new Promise(resolve => setTimeout(resolve, 25))
      expect(contender.status()).toMatchObject({ state: 'running', leaseHeld: true })
      await contender.stop()
    } finally {
      await rm(directory, { recursive: true, force: true })
    }
  })

  it('takes over a stale lease and fences the previous instance', async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), 'deepcanary-supervisor-stale-'))
    try {
      let now = 1_756_800_000_000
      const previous = new PersistentSupervisor({
        stateDir: directory,
        runtimeVersion: '0.1.2-alpha.5',
        now: () => now,
        pid: 301,
        instanceId: 'stale-instance',
        heartbeatMs: 60_000,
        staleLeaseMs: 100,
      })
      expect(await previous.start()).toBe(true)
      now += 101
      const takeover = new PersistentSupervisor({
        stateDir: directory,
        runtimeVersion: '0.1.2-alpha.5',
        now: () => now,
        pid: 302,
        instanceId: 'takeover-instance',
        heartbeatMs: 60_000,
        staleLeaseMs: 100,
      })
      expect(await takeover.start()).toBe(true)
      expect(takeover.status()).toMatchObject({ state: 'running', staleLeaseRecovered: true, leaseHeld: true })

      previous.update(snapshot(now, 99))
      await previous.flush()
      expect(previous.status()).toMatchObject({ state: 'standby', leaseHeld: false })
      expect(takeover.status().leaseHeld).toBe(true)
      expect((await takeover.store.loadLease())?.instanceId).toBe('takeover-instance')
      const persisted = JSON.parse(await readFile(takeover.store.snapshotFile, 'utf8')) as { snapshot: { revision: number } }
      expect(persisted.snapshot.revision).not.toBe(99)

      await previous.stop()
      await takeover.stop()
    } finally {
      await rm(directory, { recursive: true, force: true })
    }
  })

  it('derives the default standby retry from a custom lease TTL', async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), 'deepcanary-supervisor-derived-retry-'))
    try {
      const now = 1_756_800_000_000
      const owner = new PersistentSupervisor({
        stateDir: directory,
        runtimeVersion: '0.1.2-alpha.5',
        now: () => now,
        pid: 351,
        instanceId: 'derived-retry-owner',
        heartbeatMs: 60_000,
        staleLeaseMs: 60,
      })
      const contender = new PersistentSupervisor({
        stateDir: directory,
        runtimeVersion: '0.1.2-alpha.5',
        now: () => now,
        pid: 352,
        instanceId: 'derived-retry-contender',
        heartbeatMs: 60_000,
        staleLeaseMs: 60,
      })
      expect(await owner.start()).toBe(true)
      expect(await contender.start()).toBe(false)
      await owner.stop()
      await new Promise(resolve => setTimeout(resolve, 120))
      expect(contender.status()).toMatchObject({ state: 'running', leaseHeld: true })
      await contender.stop()
    } finally {
      await rm(directory, { recursive: true, force: true })
    }
  })

  it('quarantines a corrupt snapshot and starts with an empty bounded projection', async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), 'deepcanary-supervisor-corrupt-'))
    try {
      const supervisor = new PersistentSupervisor({
        stateDir: directory,
        runtimeVersion: '0.1.2-alpha.5',
        instanceId: 'corrupt-recovery',
        pid: 401,
      })
      await writeFile(supervisor.store.snapshotFile, '{not-json', 'utf8')
      expect(await supervisor.start()).toBe(true)
      expect(supervisor.status()).toMatchObject({ state: 'running', restored: false, leaseHeld: true, revision: 0 })
      const names = await readdir(directory)
      expect(names.some(name => name.startsWith('supervisor.json.corrupt-'))).toBe(true)
      await supervisor.stop()
    } finally {
      await rm(directory, { recursive: true, force: true })
    }
  })

  it('quarantines a corrupt lease and recovers during the same startup', async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), 'deepcanary-supervisor-corrupt-lease-'))
    try {
      const supervisor = new PersistentSupervisor({
        stateDir: directory,
        runtimeVersion: '0.1.2-alpha.5',
        instanceId: 'corrupt-lease-recovery',
        pid: 402,
      })
      await writeFile(supervisor.store.leaseFile, '{not-json', 'utf8')
      expect(await supervisor.start()).toBe(true)
      expect(supervisor.status()).toMatchObject({ state: 'running', leaseHeld: true })
      const names = await readdir(directory)
      expect(names.some(name => name.startsWith('supervisor.lease.corrupt-'))).toBe(true)
      expect((await supervisor.store.loadLease())?.instanceId).toBe('corrupt-lease-recovery')
      await supervisor.stop()
    } finally {
      await rm(directory, { recursive: true, force: true })
    }
  })

  it('requires the full lease token when releasing a lease', async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), 'deepcanary-supervisor-lease-token-'))
    try {
      const supervisor = new PersistentSupervisor({
        stateDir: directory,
        runtimeVersion: '0.1.2-alpha.5',
        instanceId: 'lease-token-owner',
        pid: 403,
      })
      expect(await supervisor.start()).toBe(true)
      const current = await supervisor.store.loadLease()
      expect(current).toBeDefined()
      const forged = { ...current!, startedAt: new Date(Date.parse(current!.startedAt) + 1).toISOString() }
      expect(await supervisor.store.releaseLease(forged)).toBe(false)
      expect((await supervisor.store.loadLease())?.instanceId).toBe('lease-token-owner')
      await supervisor.stop()
    } finally {
      await rm(directory, { recursive: true, force: true })
    }
  })
})
