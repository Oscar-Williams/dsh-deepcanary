import { defineTool } from '@deepseek-ai/dsh-tools'
import type { DeepCanaryService } from './service.js'

type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue }

function renderJson(_args: unknown, value: unknown) {
  return [{ type: 'text' as const, text: JSON.stringify(value) }]
}

function jsonOutput() {
  return {
    schema: { type: 'json' as const },
    render: renderJson,
  }
}

function asJson(value: unknown): JsonValue {
  return value as JsonValue
}

export function registerTools(ctx: unknown, service: DeepCanaryService): string[] {
  const tools = (ctx as { tools?: { register?: (definition: unknown) => unknown } }).tools
  if (!tools?.register) return []
  const names: string[] = []
  const register = (definition: { name: string }): void => {
    tools.register?.(definition)
    names.push(definition.name)
  }

  register(defineTool({
    name: 'deepcanary_status',
    description: 'Read the local DeepCanary status, active DSH session count, attention indicator, and notification capabilities.',
    parameters: {},
    output: jsonOutput(),
    execute: async () => asJson(service.status()),
  }))

  register(defineTool({
    name: 'deepcanary_inbox',
    description: 'Read recent DeepCanary attention items with their severity, reason, evidence summary, and current status.',
    parameters: {
      limit: { type: 'integer', description: 'Maximum number of items to return; defaults to 20.' },
    },
    output: jsonOutput(),
    execute: async args => asJson(service.inbox(args.limit ?? 20)),
  }))

  register(defineTool({
    name: 'deepcanary_acknowledge',
    description: 'Mark one DeepCanary inbox item as acknowledged. This only changes local metadata.',
    parameters: {
      id: { type: 'string', required: true, description: 'The inbox item id.' },
    },
    output: jsonOutput(),
    execute: async args => asJson({ id: args.id, updated: service.acknowledge(args.id) }),
  }))

  register(defineTool({
    name: 'deepcanary_snooze',
    description: 'Snooze one DeepCanary inbox item for a bounded number of minutes. This only changes local metadata.',
    parameters: {
      id: { type: 'string', required: true, description: 'The inbox item id.' },
      minutes: { type: 'integer', description: 'Minutes to snooze, bounded to 1–1440; defaults to 30.' },
    },
    output: jsonOutput(),
    execute: async args => asJson({ id: args.id, minutes: args.minutes ?? 30, updated: service.snooze(args.id, args.minutes ?? 30) }),
  }))

  register(defineTool({
    name: 'deepcanary_mute',
    description: 'Mute one DeepCanary inbox item. This only changes local metadata and never stops a DSH process.',
    parameters: {
      id: { type: 'string', required: true, description: 'The inbox item id.' },
    },
    output: jsonOutput(),
    execute: async args => asJson({ id: args.id, updated: service.mute(args.id) }),
  }))

  register(defineTool({
    name: 'deepcanary_feedback',
    description: 'Record whether one DeepCanary attention item was useful. Content is truncated and stored only as local metadata.',
    parameters: {
      id: { type: 'string', required: true, description: 'The inbox item id.' },
      useful: { type: 'boolean', required: true, description: 'Whether the attention item was useful.' },
      note: { type: 'string', description: 'Optional short feedback note.' },
    },
    output: jsonOutput(),
    execute: async args => asJson({ id: args.id, updated: service.feedback(args.id, args.useful, args.note) }),
  }))

  register(defineTool({
    name: 'deepcanary_explain',
    description: 'Explain one DeepCanary inbox item using its deterministic reason code and evidence summaries.',
    parameters: {
      id: { type: 'string', required: true, description: 'The inbox item id.' },
    },
    output: jsonOutput(),
    execute: async args => asJson(service.explain(args.id) ?? { id: args.id, found: false }),
  }))

  register(defineTool({
    name: 'deepcanary_jump',
    description: 'Return a local DSH navigation hint for one attention item. DeepCanary does not open, stop, restart, or mutate a session.',
    parameters: {
      id: { type: 'string', required: true, description: 'The inbox item id.' },
    },
    output: jsonOutput(),
    execute: async args => asJson(service.jump(args.id)),
  }))
  return names
}
