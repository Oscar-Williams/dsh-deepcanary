import { describe, expect, it } from 'vitest'
import { SettingsDraft, type DraftSource } from '../src/settings-draft.js'

function fixture() {
  const source: DraftSource<{ count: number }> = { value: { count: 3 }, base: { count: 3 }, revision: 1, writable: true }
  const revisions: number[] = []
  const editor = new SettingsDraft(['count'], () => source, async (operations, revision) => {
    revisions.push(revision)
    if (revision !== source.revision) return false
    const operation = operations[0]!
    source.value = { count: operation.op === 'unset' ? 3 : operation.value as number }
    source.revision!++
    return true
  })
  return { source, editor, revisions }
}

describe('settings draft revision ownership', () => {
  it('rejects stale 8 after another writer saves 4 and the mirror refreshes', async () => {
    const { source, editor, revisions } = fixture()
    editor.edit('count', 8)
    source.value = { count: 4 }; source.revision = 2
    editor.refresh()
    expect(await editor.save()).toBe(false)
    expect(source.value?.count).toBe(4)
    expect(editor.value?.count).toBe(8)
    expect(editor.failure).toBe('conflict')
    expect(await editor.save()).toBe(false)
    expect(revisions).toEqual([1, 1])
    editor.discard(); editor.edit('count', 6)
    expect(await editor.save()).toBe(true)
    expect(source.value?.count).toBe(6)
    expect(editor.dirty).toBe(false)
  })

  it('protects restoration of inheritance with its original revision', async () => {
    const { source, editor } = fixture()
    editor.reset()
    source.value = { count: 4 }; source.revision = 2
    editor.refresh()
    expect(await editor.save()).toBe(false)
    expect(source.value?.count).toBe(4)
    editor.discard(); editor.reset()
    expect(await editor.save()).toBe(true)
    expect(source.value?.count).toBe(3)
  })

  it('keeps drafts on transport failure and prevents duplicate submissions', async () => {
    let reject!: (error: Error) => void
    let calls = 0
    const source = { value: { count: 3 }, base: { count: 3 }, revision: 1, writable: true }
    const editor = new SettingsDraft(['count'], () => source, () => {
      calls++
      return new Promise<boolean>((_, failure) => { reject = failure })
    })
    editor.edit('count', 8)
    const pending = editor.save()
    expect(await editor.save()).toBe(false)
    editor.discard()
    expect(editor.dirty).toBe(true)
    reject(new Error('offline'))
    expect(await pending).toBe(false)
    expect(calls).toBe(1)
    expect(editor.value?.count).toBe(8)
    expect(editor.failure).toBe('transport')
    source.writable = false
    expect(await editor.save()).toBe(false)
    expect(editor.failure).toBe('readOnly')
    expect(calls).toBe(1)
    expect(source.value.count).toBe(3)
  })
})
