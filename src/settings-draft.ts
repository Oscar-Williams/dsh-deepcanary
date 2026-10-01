/** An editor owns its revision for the entire dirty-draft lifetime. */
export interface DraftSource<T> {
  value: T | undefined
  base: T | undefined
  revision: number | undefined
  writable: boolean
}

export type DraftOperation = { op: 'unset'; path: [string] } | { op: 'set'; path: [string]; value: unknown }
export type DraftFailure = 'conflict' | 'transport' | 'readOnly' | 'unavailable'

export class SettingsDraft<T extends object> {
  value: T | undefined
  dirty = false
  saving = false
  failure: DraftFailure | undefined
  private revision: number | undefined
  private resetFields = new Set<keyof T>()

  constructor(
    private readonly keys: readonly (keyof T & string)[],
    private readonly read: () => DraftSource<T>,
    private readonly mutate: (operations: readonly DraftOperation[], revision: number) => Promise<boolean>,
  ) { this.refresh() }

  refresh(): void {
    if (this.dirty || this.saving) return
    const source = this.read()
    this.value = source.value === undefined ? undefined : structuredClone(source.value)
    this.revision = source.revision
    this.resetFields.clear()
  }

  edit<K extends keyof T>(key: K, value: T[K]): void {
    if (this.saving || !this.read().writable) return
    if (!this.dirty) this.refresh()
    if (this.value === undefined) return
    this.value = { ...this.value, [key]: structuredClone(value) }
    this.dirty = true
    this.failure = undefined
    this.resetFields.delete(key)
  }

  reset(): void {
    const source = this.read()
    if (this.saving || !source.writable || source.base === undefined) return
    if (!this.dirty) this.revision = source.revision
    this.value = structuredClone(source.base)
    this.dirty = true
    this.failure = undefined
    this.resetFields = new Set(this.keys)
  }

  discard(): void {
    if (this.saving) return
    this.dirty = false
    this.failure = undefined
    this.refresh()
  }

  async save(): Promise<boolean> {
    if (!this.dirty || this.saving || this.value === undefined) return false
    if (!this.read().writable) { this.failure = 'readOnly'; return false }
    if (this.revision === undefined) { this.failure = 'unavailable'; return false }
    const operations: DraftOperation[] = this.keys.map(key => this.resetFields.has(key)
      ? { op: 'unset', path: [key] }
      : { op: 'set', path: [key], value: structuredClone(this.value![key]) })
    this.saving = true
    this.failure = undefined
    try {
      const accepted = await this.mutate(operations, this.revision)
      if (accepted !== true) { this.failure = 'conflict'; return false }
      this.dirty = false
      return true
    } catch {
      this.failure = 'transport'
      return false
    } finally {
      this.saving = false
      this.refresh()
    }
  }
}
