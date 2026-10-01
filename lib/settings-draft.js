export class SettingsDraft {
    keys;
    read;
    mutate;
    value;
    dirty = false;
    saving = false;
    failure;
    revision;
    resetFields = new Set();
    constructor(keys, read, mutate) {
        this.keys = keys;
        this.read = read;
        this.mutate = mutate;
        this.refresh();
    }
    refresh() {
        if (this.dirty || this.saving)
            return;
        const source = this.read();
        this.value = source.value === undefined ? undefined : structuredClone(source.value);
        this.revision = source.revision;
        this.resetFields.clear();
    }
    edit(key, value) {
        if (this.saving || !this.read().writable)
            return;
        if (!this.dirty)
            this.refresh();
        if (this.value === undefined)
            return;
        this.value = { ...this.value, [key]: structuredClone(value) };
        this.dirty = true;
        this.failure = undefined;
        this.resetFields.delete(key);
    }
    reset() {
        const source = this.read();
        if (this.saving || !source.writable || source.base === undefined)
            return;
        if (!this.dirty)
            this.revision = source.revision;
        this.value = structuredClone(source.base);
        this.dirty = true;
        this.failure = undefined;
        this.resetFields = new Set(this.keys);
    }
    discard() {
        if (this.saving)
            return;
        this.dirty = false;
        this.failure = undefined;
        this.refresh();
    }
    async save() {
        if (!this.dirty || this.saving || this.value === undefined)
            return false;
        if (!this.read().writable) {
            this.failure = 'readOnly';
            return false;
        }
        if (this.revision === undefined) {
            this.failure = 'unavailable';
            return false;
        }
        const operations = this.keys.map(key => this.resetFields.has(key)
            ? { op: 'unset', path: [key] }
            : { op: 'set', path: [key], value: structuredClone(this.value[key]) });
        this.saving = true;
        this.failure = undefined;
        try {
            const accepted = await this.mutate(operations, this.revision);
            if (accepted !== true) {
                this.failure = 'conflict';
                return false;
            }
            this.dirty = false;
            return true;
        }
        catch {
            this.failure = 'transport';
            return false;
        }
        finally {
            this.saving = false;
            this.refresh();
        }
    }
}
//# sourceMappingURL=settings-draft.js.map