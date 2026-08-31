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

const reasonCodes = [
  'HUMAN_APPROVAL_REQUIRED',
  'HUMAN_QUESTION_PENDING',
  'HOST_UNREACHABLE',
  'HOST_SUSPECTED_STALL',
  'TOOL_FAILURE_LOOP',
  'NO_MEANINGFUL_PROGRESS',
  'SUBAGENT_PRESSURE',
  'CONTEXT_PRESSURE',
  'COMPACTION_OCCURRED',
  'TASK_COMPLETED',
  'TASK_FAILED',
  'TASK_ABORTED',
  'COMPLETION_SUSPICIOUS',
  'HOST_STALL_RECOVERED',
] as const

const evidenceAuthorities = ['host', 'runtime', 'derived', 'heuristic'] as const
const attentionLevels = ['C1', 'C2', 'C3'] as const

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
    description: 'Explain one DeepCanary inbox item with its deterministic rules, evidence authority, policy scopes, suppression causes, and bundle state.',
    parameters: {
      id: { type: 'string', required: true, description: 'The inbox item id.' },
    },
    output: jsonOutput(),
    execute: async args => asJson(service.explain(args.id) ?? { id: args.id, found: false }),
  }))

  register(defineTool({
    name: 'deepcanary_dry_run',
    description: 'Preview a DeepCanary policy decision for one structured signal. This is read-only: it never sends notifications or changes a DSH session.',
    parameters: {
      kind: { type: 'string', enum: reasonCodes, required: true, description: 'Structured DeepCanary reason code.' },
      authority: { type: 'string', enum: evidenceAuthorities, required: true, description: 'Evidence authority available for the signal.' },
      severityHint: { type: 'integer', enum: [0, 1, 2, 3] as const, description: 'Optional severity hint from the provider.' },
      healthy: { type: 'boolean', description: 'Mark a long-running operation as healthy.' },
      userViewing: { type: 'boolean', description: 'Whether the user is already viewing the relevant DSH surface.' },
      threshold: { type: 'number', description: 'Optional numeric threshold used by the provider.' },
      failureCount: { type: 'number', description: 'Optional consecutive failure count.' },
      activeSubagents: { type: 'number', description: 'Optional active Subagent count.' },
      idleMs: { type: 'number', description: 'Optional idle duration in milliseconds.' },
      candidate: {
        type: 'object',
        additionalProperties: false,
        description: 'Optional candidate policy overlay. Only notificationLevel and quietHours are evaluated.',
        properties: {
          notificationLevel: { type: 'string', enum: attentionLevels, description: 'Candidate maximum delivery level.' },
          quietHours: {
            type: 'object',
            additionalProperties: false,
            properties: {
              enabled: { type: 'boolean' },
              start: { type: 'string', description: 'Start time in HH:MM format.' },
              end: { type: 'string', description: 'End time in HH:MM format.' },
            },
          },
        },
      },
    },
    output: jsonOutput(),
    execute: async args => asJson(await service.dryRun({
      signal: {
        kind: args.kind,
        authority: args.authority,
        ...(args.severityHint === undefined ? {} : { severityHint: args.severityHint }),
        ...(args.healthy === undefined ? {} : { healthy: args.healthy }),
        ...(args.userViewing === undefined ? {} : { userViewing: args.userViewing }),
        ...(args.threshold === undefined ? {} : { threshold: args.threshold }),
        ...(args.failureCount === undefined ? {} : { failureCount: args.failureCount }),
        ...(args.activeSubagents === undefined ? {} : { activeSubagents: args.activeSubagents }),
        ...(args.idleMs === undefined ? {} : { idleMs: args.idleMs }),
      },
      ...(args.candidate === undefined ? {} : { candidate: args.candidate }),
    })),
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
