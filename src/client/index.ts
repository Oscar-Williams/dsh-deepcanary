import { createElement, useEffect, useLayoutEffect, useRef, useState } from 'react'
import type {
  CSSProperties, FormEvent, KeyboardEvent as ReactKeyboardEvent,
  PointerEvent as ReactPointerEvent, ReactNode,
} from 'react'
import type { SettingsScope, SettingsScopeSnapshot } from '@deepseek-ai/dsh-client-ui-settings/client'
import type { SettingsPluginItemOwnerProps } from '@deepseek-ai/dsh-client-ui-settings-plugins/client'
import { handleNotificationClick, positionSelectedAttention } from './attention-navigation.js'

type Translate = (key: string, params?: Record<string, unknown>) => string

type ClientItem = {
  id: string
  sessionId?: string
  occurredAt: string
  level: 'C0' | 'C1' | 'C2' | 'C3'
  action: string
  reasonCode: string
  reasonCodes: string[]
  messageKey?: string
  messageParams?: Record<string, string | number | boolean>
  suggestionKey?: string
  policyVersion?: string
  why: string
  suggestedAction?: string
  evidence: Array<{ type: string; authority: string; summary: string }>
  decisionTrace?: {
    policyVersion: string
    matchedRules: string[]
    appliedScopes: string[]
    suppressedBy: string[]
    bundledWith?: { eventCount: number; reasonCodes: string[] }
    authoritySummary: { strongest: string; counts: Record<string, number> }
    finalLevel: 'C0' | 'C1' | 'C2' | 'C3'
    finalAction: string
    recoveryRule?: string
  }
  status: string
  snoozedUntil?: string
  seenAt?: string
  acknowledgedAt?: string
  recoveredAt?: string
  expiredAt?: string
  bundleCount: number
}

type ClientSettings = {
  notificationLevel: 'C1' | 'C2' | 'C3'
  openOnCritical: boolean
  maxInterruptsPerHour: number
  dedupeWindowMinutes: number
  bundleWindowSeconds: number
  longRunThresholdMinutes: number
  subagentPressure: 'relaxed' | 'standard' | 'strict'
  quietHours: { enabled: boolean; start: string; end: string }
  privacySafeSummary: boolean
  healthPollSeconds: number
  maxInboxItems: number
}

type ClientSnapshot = {
  schemaVersion?: number
  revision?: number
  generatedAt?: string
  status: {
    indicator: 'gray' | 'yellow' | 'orange' | 'red'
    openInbox: number
    sessions: number
    plugin: { state: string; version: string }
    revision?: number
    capabilities: { browserNotification: boolean; nativeToast: boolean; windowsInterop: string }
  }
  settings: ClientSettings
  inbox: ClientItem[]
}

type JumpResult = { available: boolean; url?: string; note: string }

type ClientContext = {
  effect: (setup: () => void | (() => void), label?: string) => unknown
  locale: { register: (namespace: string, dictionaries: { zh: Record<string, string>; en: Record<string, string> }) => () => void }
  slots: {
    inject: (name: string, callback: () => unknown) => unknown
    register: (options: Record<string, unknown>, component: unknown) => unknown
  }
  settingsScope?: {
    bind: <T>(spec: { namespace: string; decode?: (section: unknown) => T | undefined }) => SettingsScope<T>
  }
}

type ControllerState = {
  open: boolean
  snapshot: ClientSnapshot | undefined
  loading: boolean
  failed: boolean
  width: number
  height: number
  selectedId: string | undefined
  pending: ReadonlySet<string>
  lastSyncedAt: string | undefined
  protocolUnsupported: boolean
}

type Controller = {
  getState: () => ControllerState
  subscribe: (listener: () => void) => () => void
  start: () => void
  dispose: () => void
  refresh: () => Promise<void>
  open: (id?: string) => void
  close: () => void
  toggle: () => void
  setTrigger: (element: HTMLButtonElement | null) => void
  setSize: (width: number, height: number) => void
  action: (id: string, payload: Record<string, unknown>) => Promise<void>
  jump: (id: string) => Promise<void>
}

const NS = 'deepcanary'
/** Settings namespace shared by the Host registration and keyed settings card. */
const SETTINGS_NS = 'dsh-deepcanary'
const STYLE_ID = 'dsh-deepcanary-client-style'
const SIZE_KEY = 'dsh-deepcanary-ui'
const SEEN_KEY = 'dsh-deepcanary-notified'
const AUTO_OPEN_KEY = 'dsh-deepcanary-auto-opened'
const MIN_WIDTH = 320
const MAX_WIDTH = 640
const MIN_HEIGHT = 320
const MAX_HEIGHT = 720
const AUTO_OPEN_REASONS = new Set(['HOST_UNREACHABLE', 'SUBAGENT_PRESSURE'])

const zh = {
  'trigger.open': '打开 DeepCanary',
  'trigger.close': '关闭 DeepCanary',
  'trigger.label': 'DeepCanary 注意力提醒',
  'trigger.count': '{count} 条待处理提醒',
  'panel.title': 'DeepCanary',
  'panel.subtitle': '本地注意力监督',
  'panel.status.ready': '运行正常',
  'panel.status.loading': '加载中',
  'panel.status.offline': '暂时无法同步',
  'panel.close': '关闭面板',
  'panel.refresh': '刷新状态',
  'panel.refreshing': '正在刷新',
  'panel.empty': '目前没有待处理提醒',
  'panel.emptyHint': '新的注意力事件会显示在这里。',
  'panel.sessions': '{count} 个活动会话',
  'panel.notification.enable': '启用浏览器通知',
  'panel.notification.enabled': '浏览器通知已启用',
  'panel.notification.unavailable': '当前浏览器不支持通知',
  'panel.settings': '提醒设置',
  'panel.settingsHint': '请在 DSH 设置 > Plugins 中调整提醒策略；这里不重复嵌入完整设置表单。',
  'panel.settingsLocation': '设置位置：DSH 设置 > Plugins',
  'panel.bodyLabel': 'DeepCanary 待处理提醒',
  'panel.updateRequired': 'DeepCanary 状态协议需要更新插件。',
  'panel.lastSynced': '最近同步：{time}',
  'panel.save': '保存设置',
  'panel.saved': '设置已保存',
  'panel.settings.notificationLevel': '提醒级别',
  'panel.settings.maxInterrupts': '每小时最多打断',
  'panel.settings.longRun': '停滞阈值（分钟）',
  'panel.settings.bundle': '相邻事件合并（秒）',
  'panel.settings.subagent': 'Subagent 压力',
  'panel.settings.subagent.relaxed': '宽松',
  'panel.settings.subagent.standard': '标准',
  'panel.settings.subagent.strict': '严格',
  'panel.settings.quiet': '静默时段',
  'panel.settings.quietEnable': '启用静默时段',
  'panel.settings.quietStart': '开始',
  'panel.settings.quietEnd': '结束',
  'panel.settings.privacy': '仅使用隐私安全摘要',
  'panel.resize.width': '调整面板宽度',
  'panel.resize.height': '调整面板高度',
  'settings.title': 'DeepCanary 提醒策略',
  'settings.description': '控制提醒级别、节流策略和注意力监督范围。',
  'settings.hint': '设置写入 DSH 的 dsh-deepcanary 命名空间，不会修改会话内容。',
  'settings.unsaved': '未保存',
  'settings.readOnly': '当前设置源为只读；请在可写的 DSH 配置环境中修改。',
  'settings.save': '保存',
  'settings.saving': '保存中',
  'settings.discard': '放弃修改',
  'settings.reset': '恢复默认',
  'settings.saveFailed': '保存失败，请检查连接后重试。',
  'settings.conflict': '设置已被其他窗口修改，请重新读取后再保存。',
  'settings.level': '最低提醒级别',
  'settings.openOnCritical': '遇到允许列表中的 C3 事件时自动唤起面板',
  'settings.maxInterrupts': '每小时最多打断次数',
  'settings.dedupe': '等价事件去重窗口（分钟）',
  'settings.bundle': '相邻事件合并窗口（秒）',
  'settings.longRun': '停滞检查阈值（分钟）',
  'settings.subagent': 'Subagent 压力策略',
  'settings.subagent.relaxed': '宽松',
  'settings.subagent.standard': '标准',
  'settings.subagent.strict': '严格',
  'settings.quiet': '静默时段',
  'settings.quietEnable': '启用静默时段',
  'settings.quietStart': '开始时间',
  'settings.quietEnd': '结束时间',
  'settings.privacy': '仅使用隐私安全摘要',
  'settings.healthPoll': 'Host 健康检查间隔（秒）',
  'settings.maxInbox': '最多保留的 Inbox 条目',
  'item.reason.HUMAN_APPROVAL_REQUIRED': 'DSH 正在等待人工审批。',
  'item.reason.HUMAN_QUESTION_PENDING': 'DSH 正在等待你的回答。',
  'item.reason.HOST_UNREACHABLE': 'DSH 主机暂时无法访问。',
  'item.reason.HOST_SUSPECTED_STALL': '会话可能已长时间没有进展。',
  'item.reason.TOOL_FAILURE_LOOP': '同一工具连续返回失败结果。',
  'item.reason.NO_MEANINGFUL_PROGRESS': '会话持续运行，但暂未观察到有效进展。',
  'item.reason.SUBAGENT_PRESSURE': '活动 Subagent 数量已达到压力阈值。',
  'item.reason.CONTEXT_PRESSURE': '会话上下文压力需要关注。',
  'item.reason.COMPACTION_OCCURRED': 'DSH 已执行一次上下文压缩。',
  'item.reason.TASK_COMPLETED': '会话报告了一次正常完成。',
  'item.reason.TASK_FAILED': '会话报告执行失败。',
  'item.reason.TASK_ABORTED': '会话被中止，可能需要确认是否继续。',
  'item.reason.COMPLETION_SUSPICIOUS': '任务看似完成，但最终证据仍值得检查。',
  'item.reason.HOST_STALL_RECOVERED': '会话已重新产生事件。',
  'item.reason.unknown': '检测到需要关注的运行时事件。',
  'item.suggestion.HUMAN_APPROVAL_REQUIRED': '在 DSH 中查看待审批请求并决定是否允许。',
  'item.suggestion.HUMAN_QUESTION_PENDING': '准备好后，在 DSH 中回答待处理问题。',
  'item.suggestion.HOST_UNREACHABLE': '检查 DSH 主机和浏览器连接。',
  'item.suggestion.HOST_SUSPECTED_STALL': '检查会话，再决定继续还是停止。',
  'item.suggestion.TOOL_FAILURE_LOOP': '检查重复失败的工具调用和运行环境。',
  'item.suggestion.NO_MEANINGFUL_PROGRESS': '查看会话状态，决定是否需要调整任务。',
  'item.suggestion.SUBAGENT_PRESSURE': '检查活动 Subagent 及其预算；插件不会自动取消。',
  'item.suggestion.CONTEXT_PRESSURE': '检查上下文状态，考虑使用更精简的续接。',
  'item.suggestion.COMPACTION_OCCURRED': '检查压缩后的会话上下文是否仍然完整。',
  'item.suggestion.TASK_FAILED': '检查失败证据，再决定是否重试。',
  'item.suggestion.TASK_ABORTED': '确认是否需要恢复已中止的任务。',
  'item.suggestion.COMPLETION_SUSPICIOUS': '接受完成结果前检查最终证据。',
  'item.suggestion.HOST_STALL_RECOVERED': '如恢复并非预期，请检查该会话。',
  'item.suggestion.unknown': '查看收件箱中的证据后决定下一步。',
  'item.level': '注意力级别 {level}',
  'item.events': '{count} 个相关事件',
  'item.suggestion': '建议：{text}',
  'item.evidence': '查看技术证据',
  'item.evidenceLine': '{type} · {authority}',
  'item.evidence.session': '会话事件',
  'item.evidence.runtime': '运行时探针',
  'item.evidence.tool': '工具记录',
  'item.evidence.subagent': 'Subagent 状态',
  'item.evidence.http': 'HTTP 探针',
  'item.authority.host': '主机',
  'item.authority.runtime': '运行时',
  'item.authority.derived': '派生',
  'item.authority.heuristic': '启发式',
  'item.technicalDetail': '依据：{text}',
  'item.policyTrace': '查看决策轨迹',
  'item.policyVersion': '策略版本：{version}',
  'item.matchedRules': '命中规则：{rules}',
  'item.appliedScopes': '生效范围：{scopes}',
  'item.suppressedBy': '抑制因素：{values}',
  'item.authoritySummary': '证据权威：{text}',
  'item.finalDecision': '最终判定：{level} / {action}',
  'item.bundled': 'Bundle 聚合：{count} 个事件',
  'item.recoveryRule': '恢复规则：{rule}',
  'item.none': '无',
  'item.acknowledge': '已处理',
  'item.snooze': '稍后提醒',
  'item.mute': '静音',
  'item.useful': '有用',
  'item.irrelevant': '不相关',
  'item.jump': '跳转到 DSH',
  'item.unknownReason': '未知原因码：{code}',
  'state.failed': '暂时无法读取 DeepCanary 状态。',
  'state.retry': '重试',
  'common.yes': '是',
  'common.no': '否',
} satisfies Record<string, string>

const en = {
  'trigger.open': 'Open DeepCanary',
  'trigger.close': 'Close DeepCanary',
  'trigger.label': 'DeepCanary attention alerts',
  'trigger.count': '{count} pending alerts',
  'panel.title': 'DeepCanary',
  'panel.subtitle': 'Local attention supervision',
  'panel.status.ready': 'Running normally',
  'panel.status.loading': 'Loading',
  'panel.status.offline': 'Sync temporarily unavailable',
  'panel.close': 'Close panel',
  'panel.refresh': 'Refresh status',
  'panel.refreshing': 'Refreshing',
  'panel.empty': 'There are no pending alerts',
  'panel.emptyHint': 'New attention events will appear here.',
  'panel.sessions': '{count} active sessions',
  'panel.notification.enable': 'Enable browser notifications',
  'panel.notification.enabled': 'Browser notifications enabled',
  'panel.notification.unavailable': 'Notifications are not supported by this browser',
  'panel.settings': 'Alert settings',
  'panel.settingsHint': 'Adjust alert policy in DSH Settings > Plugins; the full form is not duplicated in this panel.',
  'panel.settingsLocation': 'Settings: DSH Settings > Plugins',
  'panel.bodyLabel': 'DeepCanary pending alerts',
  'panel.updateRequired': 'The DeepCanary state protocol requires a newer plugin.',
  'panel.lastSynced': 'Last sync: {time}',
  'panel.save': 'Save settings',
  'panel.saved': 'Settings saved',
  'panel.settings.notificationLevel': 'Alert level',
  'panel.settings.maxInterrupts': 'Maximum interrupts per hour',
  'panel.settings.longRun': 'Stall threshold (minutes)',
  'panel.settings.bundle': 'Adjacent-event bundle window (seconds)',
  'panel.settings.subagent': 'Subagent pressure',
  'panel.settings.subagent.relaxed': 'Relaxed',
  'panel.settings.subagent.standard': 'Standard',
  'panel.settings.subagent.strict': 'Strict',
  'panel.settings.quiet': 'Quiet hours',
  'panel.settings.quietEnable': 'Enable quiet hours',
  'panel.settings.quietStart': 'Start',
  'panel.settings.quietEnd': 'End',
  'panel.settings.privacy': 'Use privacy-safe summaries only',
  'panel.resize.width': 'Resize panel width',
  'panel.resize.height': 'Resize panel height',
  'settings.title': 'DeepCanary alert policy',
  'settings.description': 'Control alert levels, throttling, and attention supervision scope.',
  'settings.hint': 'Settings are written to DSH namespace dsh-deepcanary and never modify session content.',
  'settings.unsaved': 'Unsaved',
  'settings.readOnly': 'The current settings source is read-only; use a writable DSH configuration to edit it.',
  'settings.save': 'Save',
  'settings.saving': 'Saving',
  'settings.discard': 'Discard changes',
  'settings.reset': 'Reset to defaults',
  'settings.saveFailed': 'Save failed. Check the connection and try again.',
  'settings.conflict': 'Settings changed in another window. Reload them before saving.',
  'settings.level': 'Minimum alert level',
  'settings.openOnCritical': 'Open the panel automatically for allowlisted C3 events',
  'settings.maxInterrupts': 'Maximum interrupts per hour',
  'settings.dedupe': 'Equivalent-event dedupe window (minutes)',
  'settings.bundle': 'Adjacent-event bundle window (seconds)',
  'settings.longRun': 'Stall-check threshold (minutes)',
  'settings.subagent': 'Subagent pressure policy',
  'settings.subagent.relaxed': 'Relaxed',
  'settings.subagent.standard': 'Standard',
  'settings.subagent.strict': 'Strict',
  'settings.quiet': 'Quiet hours',
  'settings.quietEnable': 'Enable quiet hours',
  'settings.quietStart': 'Start time',
  'settings.quietEnd': 'End time',
  'settings.privacy': 'Use privacy-safe summaries only',
  'settings.healthPoll': 'Host health-check interval (seconds)',
  'settings.maxInbox': 'Maximum retained Inbox items',
  'item.reason.HUMAN_APPROVAL_REQUIRED': 'DSH is waiting for human approval.',
  'item.reason.HUMAN_QUESTION_PENDING': 'DSH is waiting for your answer.',
  'item.reason.HOST_UNREACHABLE': 'The DSH host is temporarily unreachable.',
  'item.reason.HOST_SUSPECTED_STALL': 'The session may have made no progress for a while.',
  'item.reason.TOOL_FAILURE_LOOP': 'The same tool has returned repeated failures.',
  'item.reason.NO_MEANINGFUL_PROGRESS': 'The session is running without meaningful progress so far.',
  'item.reason.SUBAGENT_PRESSURE': 'Active subagents have reached a pressure threshold.',
  'item.reason.CONTEXT_PRESSURE': 'The session context pressure needs attention.',
  'item.reason.COMPACTION_OCCURRED': 'DSH has performed a context compaction.',
  'item.reason.TASK_COMPLETED': 'The session reported a normal completion.',
  'item.reason.TASK_FAILED': 'The session reported a failure.',
  'item.reason.TASK_ABORTED': 'The session was aborted and may need a follow-up decision.',
  'item.reason.COMPLETION_SUSPICIOUS': 'The task looks complete, but its final evidence is worth checking.',
  'item.reason.HOST_STALL_RECOVERED': 'The session has started producing events again.',
  'item.reason.unknown': 'A runtime event needs your attention.',
  'item.suggestion.HUMAN_APPROVAL_REQUIRED': 'Review the pending request in DSH and decide whether to allow it.',
  'item.suggestion.HUMAN_QUESTION_PENDING': 'Answer the pending question in DSH when you are ready.',
  'item.suggestion.HOST_UNREACHABLE': 'Check the DSH host and browser connection.',
  'item.suggestion.HOST_SUSPECTED_STALL': 'Inspect the session before deciding whether to continue or stop.',
  'item.suggestion.TOOL_FAILURE_LOOP': 'Review the repeated tool failure and the runtime environment.',
  'item.suggestion.NO_MEANINGFUL_PROGRESS': 'Review the session and decide whether the task needs adjustment.',
  'item.suggestion.SUBAGENT_PRESSURE': 'Review active subagents and their budgets; no automatic cancellation is performed.',
  'item.suggestion.CONTEXT_PRESSURE': 'Review the context state and consider a concise continuation.',
  'item.suggestion.COMPACTION_OCCURRED': 'Check whether the session context remains complete after compaction.',
  'item.suggestion.TASK_FAILED': 'Inspect the failure evidence before deciding whether to retry.',
  'item.suggestion.TASK_ABORTED': 'Confirm whether the aborted task should be resumed.',
  'item.suggestion.COMPLETION_SUSPICIOUS': 'Check the final evidence before accepting the task as complete.',
  'item.suggestion.HOST_STALL_RECOVERED': 'Review the session if the recovery was unexpected.',
  'item.suggestion.unknown': 'Review the Inbox evidence before deciding what to do next.',
  'item.level': 'Attention level {level}',
  'item.events': '{count} related events',
  'item.suggestion': 'Suggested next step: {text}',
  'item.evidence': 'View technical evidence',
  'item.evidenceLine': '{type} · {authority}',
  'item.evidence.session': 'Session event',
  'item.evidence.runtime': 'Runtime probe',
  'item.evidence.tool': 'Tool history',
  'item.evidence.subagent': 'Subagent state',
  'item.evidence.http': 'HTTP probe',
  'item.authority.host': 'Host',
  'item.authority.runtime': 'Runtime',
  'item.authority.derived': 'Derived',
  'item.authority.heuristic': 'Heuristic',
  'item.technicalDetail': 'Evidence basis: {text}',
  'item.policyTrace': 'View decision trace',
  'item.policyVersion': 'Policy version: {version}',
  'item.matchedRules': 'Matched rules: {rules}',
  'item.appliedScopes': 'Applied scopes: {scopes}',
  'item.suppressedBy': 'Suppressed by: {values}',
  'item.authoritySummary': 'Evidence authority: {text}',
  'item.finalDecision': 'Final decision: {level} / {action}',
  'item.bundled': 'Bundle aggregation: {count} events',
  'item.recoveryRule': 'Recovery rule: {rule}',
  'item.none': 'None',
  'item.acknowledge': 'Acknowledge',
  'item.snooze': 'Snooze',
  'item.mute': 'Mute',
  'item.useful': 'Useful',
  'item.irrelevant': 'Not relevant',
  'item.jump': 'Open in DSH',
  'item.unknownReason': 'Unknown reason code: {code}',
  'state.failed': 'DeepCanary status is temporarily unavailable.',
  'state.retry': 'Retry',
  'common.yes': 'Yes',
  'common.no': 'No',
} satisfies Record<keyof typeof zh, string>

type LocaleKey = keyof typeof zh

const reasonKeys: Record<string, LocaleKey> = {
  HUMAN_APPROVAL_REQUIRED: 'item.reason.HUMAN_APPROVAL_REQUIRED',
  HUMAN_QUESTION_PENDING: 'item.reason.HUMAN_QUESTION_PENDING',
  HOST_UNREACHABLE: 'item.reason.HOST_UNREACHABLE',
  HOST_SUSPECTED_STALL: 'item.reason.HOST_SUSPECTED_STALL',
  TOOL_FAILURE_LOOP: 'item.reason.TOOL_FAILURE_LOOP',
  NO_MEANINGFUL_PROGRESS: 'item.reason.NO_MEANINGFUL_PROGRESS',
  SUBAGENT_PRESSURE: 'item.reason.SUBAGENT_PRESSURE',
  CONTEXT_PRESSURE: 'item.reason.CONTEXT_PRESSURE',
  COMPACTION_OCCURRED: 'item.reason.COMPACTION_OCCURRED',
  TASK_COMPLETED: 'item.reason.TASK_COMPLETED',
  TASK_FAILED: 'item.reason.TASK_FAILED',
  TASK_ABORTED: 'item.reason.TASK_ABORTED',
  COMPLETION_SUSPICIOUS: 'item.reason.COMPLETION_SUSPICIOUS',
  HOST_STALL_RECOVERED: 'item.reason.HOST_STALL_RECOVERED',
}

const suggestionKeys: Record<string, LocaleKey> = {
  HUMAN_APPROVAL_REQUIRED: 'item.suggestion.HUMAN_APPROVAL_REQUIRED',
  HUMAN_QUESTION_PENDING: 'item.suggestion.HUMAN_QUESTION_PENDING',
  HOST_UNREACHABLE: 'item.suggestion.HOST_UNREACHABLE',
  HOST_SUSPECTED_STALL: 'item.suggestion.HOST_SUSPECTED_STALL',
  TOOL_FAILURE_LOOP: 'item.suggestion.TOOL_FAILURE_LOOP',
  NO_MEANINGFUL_PROGRESS: 'item.suggestion.NO_MEANINGFUL_PROGRESS',
  SUBAGENT_PRESSURE: 'item.suggestion.SUBAGENT_PRESSURE',
  CONTEXT_PRESSURE: 'item.suggestion.CONTEXT_PRESSURE',
  COMPACTION_OCCURRED: 'item.suggestion.COMPACTION_OCCURRED',
  TASK_FAILED: 'item.suggestion.TASK_FAILED',
  TASK_ABORTED: 'item.suggestion.TASK_ABORTED',
  COMPLETION_SUSPICIOUS: 'item.suggestion.COMPLETION_SUSPICIOUS',
  HOST_STALL_RECOVERED: 'item.suggestion.HOST_STALL_RECOVERED',
}

function interpolate(text: string, params: Record<string, unknown> | undefined): string {
  if (params === undefined) return text
  return text.replace(/\{(\w+)\}/g, (_match, key: string) => String(params[key] ?? ''))
}

function fallbackTranslator(isZh: boolean): Translate {
  const dictionary = isZh ? zh : en
  return (key, params) => interpolate(dictionary[key as LocaleKey] ?? key, params)
}

function chineseLocale(): boolean {
  const lang = document.documentElement.lang.trim().toLowerCase()
  return lang === '' || lang.startsWith('zh')
}

function translate(t: Translate, key: LocaleKey, params?: Record<string, unknown>): string {
  const value = t(key, params)
  return value === key ? fallbackTranslator(chineseLocale())(key, params) : value
}

function clamp(value: number, min: number, max: number): number {
  return Math.round(Math.max(min, Math.min(max, value)))
}

function viewportBounds(): { minWidth: number; maxWidth: number; minHeight: number; maxHeight: number } {
  const availableWidth = Math.max(220, window.innerWidth - 16)
  const availableHeight = Math.max(220, window.innerHeight - 16)
  return {
    minWidth: Math.min(MIN_WIDTH, availableWidth),
    maxWidth: Math.max(Math.min(MAX_WIDTH, availableWidth), Math.min(MIN_WIDTH, availableWidth)),
    minHeight: Math.min(MIN_HEIGHT, availableHeight),
    maxHeight: Math.max(Math.min(MAX_HEIGHT, availableHeight), Math.min(MIN_HEIGHT, availableHeight)),
  }
}

function safeSize(): { width: number; height: number } {
  let saved: { width?: unknown; height?: unknown } = {}
  try {
    const raw = window.localStorage.getItem(SIZE_KEY)
    const parsed: unknown = raw === null ? {} : JSON.parse(raw)
    if (parsed !== null && typeof parsed === 'object') saved = parsed as { width?: unknown; height?: unknown }
  } catch {
    saved = {}
  }
  const width = typeof saved.width === 'number' && Number.isFinite(saved.width) ? saved.width : 420
  const height = typeof saved.height === 'number' && Number.isFinite(saved.height) ? saved.height : 560
  return { width, height }
}

function clampSize(width: number, height: number): { width: number; height: number } {
  const bounds = viewportBounds()
  return {
    width: clamp(width, bounds.minWidth, bounds.maxWidth),
    height: clamp(height, bounds.minHeight, bounds.maxHeight),
  }
}

function persistSize(width: number, height: number): void {
  try {
    window.localStorage.setItem(SIZE_KEY, JSON.stringify({ width, height }))
  } catch {
    // Size persistence is optional; the panel remains usable when storage is unavailable.
  }
}

function makeRequestId(): string {
  const generated = globalThis.crypto?.randomUUID?.()
  return generated ?? `dsc-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

function createController(): Controller {
  const initial = safeSize()
  let state: ControllerState = {
    open: false,
    snapshot: undefined,
    loading: true,
    failed: false,
    ...clampSize(initial.width, initial.height),
    selectedId: undefined,
    pending: new Set(),
    lastSyncedAt: undefined,
    protocolUnsupported: false,
  }
  const listeners = new Set<() => void>()
  let disposed = false
  let started = false
  let inFlight = false
  let timer: number | undefined
  let abort: AbortController | undefined
  let trigger: HTMLButtonElement | null = null
  let failureCount = 0
  let etag: string | undefined
  let visibilityHandler: (() => void) | undefined
  let resizeHandler: (() => void) | undefined

  const publish = (patch: Partial<ControllerState>): void => {
    state = { ...state, ...patch }
    for (const listener of [...listeners]) listener()
  }

  const request = async (path: string, init?: RequestInit): Promise<Response | undefined> => {
    try {
      return await fetch(path, { cache: 'no-store', ...init })
    } catch {
      return undefined
    }
  }

  const schedule = (delay: number): void => {
    if (disposed) return
    if (timer !== undefined) window.clearTimeout(timer)
    timer = window.setTimeout(() => {
      timer = undefined
      void controller.refresh()
    }, delay)
  }

  const nextPollDelay = (): number => {
    if (document.visibilityState === 'hidden') return 30_000
    return Math.min(60_000, 5_000 * (2 ** Math.min(failureCount, 4)))
  }

  const controller: Controller = {
    getState: () => state,
    subscribe: listener => {
      listeners.add(listener)
      return () => { listeners.delete(listener) }
    },
    start: () => {
      if (started) return
      started = true
      visibilityHandler = () => {
        if (document.visibilityState === 'visible') {
          failureCount = 0
          void controller.refresh()
        } else {
          schedule(30_000)
        }
      }
      resizeHandler = () => {
        const next = clampSize(state.width, state.height)
        if (next.width !== state.width || next.height !== state.height) {
          persistSize(next.width, next.height)
          publish(next)
        }
      }
      document.addEventListener('visibilitychange', visibilityHandler)
      window.addEventListener('resize', resizeHandler)
      void controller.refresh()
    },
    dispose: () => {
      if (disposed) return
      disposed = true
      started = false
      if (timer !== undefined) window.clearTimeout(timer)
      abort?.abort()
      if (visibilityHandler !== undefined) document.removeEventListener('visibilitychange', visibilityHandler)
      if (resizeHandler !== undefined) window.removeEventListener('resize', resizeHandler)
      listeners.clear()
    },
    refresh: async () => {
      if (disposed || inFlight) return
      inFlight = true
      abort?.abort()
      abort = new AbortController()
      try {
        const response = await fetch('/dsh-deepcanary/state', {
          cache: 'no-store',
          signal: abort.signal,
          ...(etag ? { headers: { 'if-none-match': etag } } : {}),
        })
        if (response.status === 304) {
          failureCount = 0
          publish({ loading: false, failed: false, lastSyncedAt: new Date().toISOString() })
          return
        }
        if (!response.ok) throw new Error('state request failed')
        etag = response.headers.get('etag') ?? etag
        const snapshot = await response.json() as ClientSnapshot
        failureCount = 0
        publish({
          snapshot,
          loading: false,
          failed: false,
          lastSyncedAt: snapshot.generatedAt ?? new Date().toISOString(),
          protocolUnsupported: typeof snapshot.schemaVersion === 'number' && snapshot.schemaVersion > 2,
        })
      } catch {
        if (!disposed) {
          failureCount = Math.min(4, failureCount + 1)
          publish({ loading: false, failed: true })
        }
      } finally {
        inFlight = false
        schedule(nextPollDelay())
      }
    },
    open: id => {
      publish({ open: true, selectedId: id })
      if (id !== undefined) void controller.action(id, { action: 'seen' })
    },
    close: () => {
      publish({ open: false, selectedId: undefined })
      window.requestAnimationFrame(() => { trigger?.focus() })
    },
    toggle: () => {
      if (state.open) controller.close()
      else controller.open()
    },
    setTrigger: element => { trigger = element },
    setSize: (width, height) => {
      const next = clampSize(width, height)
      persistSize(next.width, next.height)
      publish(next)
    },
    action: async (id, payload) => {
      if (state.pending.has(id)) return
      const nextPending = new Set(state.pending)
      nextPending.add(id)
      publish({ pending: nextPending })
      try {
        const response = await request('/dsh-deepcanary/action', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ id, requestId: makeRequestId(), ...payload }),
        })
        if (!response?.ok) throw new Error('action request failed')
        await controller.refresh()
      } catch {
        // Card actions are best-effort. Keep the panel usable and, most
        // importantly, do not turn a transient local WebServer failure into
        // an unhandled promise rejection from a button handler.
      } finally {
        const finished = new Set(state.pending)
        finished.delete(id)
        publish({ pending: finished })
      }
    },
    jump: async id => {
      const response = await request('/dsh-deepcanary/action', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ id, action: 'jump', requestId: makeRequestId() }),
      })
      if (!response?.ok) return
      const body = await response.json() as JumpResult | { result?: JumpResult }
      const result = 'result' in body && body.result !== undefined ? body.result : body as JumpResult
      if (result.available && result.url) window.location.assign(result.url)
    },
  }
  return controller
}

function injectStyles(): () => void {
  const existing = document.getElementById(STYLE_ID)
  if (existing) return () => {}
  const style = document.createElement('style')
  style.id = STYLE_ID
  style.textContent = [
    '.dsc-trigger-layer{position:relative;display:flex;align-items:center;width:100%;height:42px;margin:8px 0 0;flex:none;font:inherit}',
    '.dsc-trigger-layer[data-rail="true"]{width:36px;height:36px;margin:0}',
    '.dsc-trigger{display:inline-flex;align-items:center;gap:8px;width:calc(100% + 4px);height:42px;margin:0 -2px;padding:0 10px 0 8px;border:0;border-radius:12px;background:transparent;color:var(--dsw-alias-label-primary,#202124);font:inherit;cursor:pointer;overflow:hidden}',
    '.dsc-trigger:hover,.dsc-trigger:focus-visible{background:var(--dsw-alias-interactive-bg-hover,rgba(128,128,128,.12));outline:none}',
    '.dsc-trigger[data-active="true"]{background:var(--dsw-alias-interactive-bg-hover,rgba(128,128,128,.12))}',
    '.dsc-trigger-layer[data-rail="true"] .dsc-trigger{justify-content:center;gap:0;width:36px;height:36px;padding:0;border-radius:50%}',
    '.dsc-trigger-label{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
    '.dsc-trigger-count{flex:none;margin-left:auto;color:var(--dsw-alias-label-tertiary,#6b7280);font-size:12px;font-variant-numeric:tabular-nums}',
    '.dsc-mark{display:inline-flex;align-items:center;justify-content:center;flex:none;width:20px;height:20px;color:var(--dsw-alias-state-warn-primary,#c77700)}',
    '.dsc-mark svg{width:18px;height:18px;fill:currentColor}',
    '.dsc-overlay-root{position:relative;width:100%;height:100%;pointer-events:none}',
    '.dsc-panel{position:fixed;right:16px;bottom:16px;z-index:30;display:flex;flex-direction:column;width:min(var(--dsc-width),calc(100vw - 16px));height:min(var(--dsc-height),calc(100dvh - 16px));min-width:320px;min-height:320px;max-width:calc(100vw - 16px);max-height:calc(100dvh - 16px);box-sizing:border-box;pointer-events:auto;overflow:visible;border:1px solid var(--dsw-alias-border-inverted,var(--dsw-alias-border-l2,#d9dce1));border-radius:14px;background:var(--dsw-specific-menu,var(--dsw-alias-bg-primary,#fff));box-shadow:var(--dsw-shadow-lv3,0 14px 42px rgba(0,0,0,.22));color:var(--dsw-alias-label-primary,#202124);font:13px/1.45 system-ui,sans-serif}',
    '.dsc-header{display:flex;align-items:center;gap:10px;flex:none;min-height:52px;padding:10px 12px;box-sizing:border-box;border-bottom:1px solid var(--dsw-alias-border-l2,#eceef1)}',
    '.dsc-heading{min-width:0;flex:1;display:flex;flex-direction:column;gap:1px}',
    '.dsc-title{font-size:14px;font-weight:600;line-height:20px}',
    '.dsc-subtitle{color:var(--dsw-alias-label-tertiary,#6b7280);font-size:11px;line-height:16px}',
    '.dsc-header-count{flex:none;color:var(--dsw-alias-label-tertiary,#6b7280);font-size:12px;font-variant-numeric:tabular-nums}',
    '.dsc-icon-button{display:inline-flex;align-items:center;justify-content:center;flex:none;width:30px;height:30px;padding:0;border:0;border-radius:8px;background:transparent;color:var(--dsw-alias-label-secondary,#4b5563);font:inherit;cursor:pointer}',
    '.dsc-icon-button:hover,.dsc-icon-button:focus-visible{background:var(--dsw-alias-interactive-bg-hover,rgba(128,128,128,.12));outline:none}',
    '.dsc-close{font-size:20px;line-height:1}',
    '.dsc-toolbar{display:flex;align-items:center;gap:7px;flex:none;min-height:44px;padding:7px 12px;border-bottom:1px solid var(--dsw-alias-border-l2,#eceef1)}',
    '.dsc-status{display:inline-flex;align-items:center;gap:6px;min-width:0;flex:1;color:var(--dsw-alias-label-tertiary,#6b7280);font-size:11px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
    '.dsc-status-dot{width:7px;height:7px;flex:none;border-radius:50%;background:var(--dsw-alias-state-success-primary,#16803c)}',
    '.dsc-status-dot[data-state="loading"]{background:var(--dsw-alias-state-warn-primary,#c77700)}',
    '.dsc-status-dot[data-state="offline"]{background:var(--dsw-alias-state-error-primary,#c5221f)}',
    '.dsc-toolbar-button,.dsc-save{display:inline-flex;align-items:center;justify-content:center;min-height:28px;padding:4px 8px;border:1px solid var(--dsw-alias-border-l2,#d9dce1);border-radius:8px;background:transparent;color:var(--dsw-alias-label-secondary,#4b5563);font:inherit;font-size:11px;cursor:pointer}',
    '.dsc-toolbar-button:hover,.dsc-toolbar-button:focus-visible,.dsc-save:hover,.dsc-save:focus-visible{background:var(--dsw-alias-interactive-bg-hover,rgba(128,128,128,.12));outline:none}',
    '.dsc-body{min-height:0;flex:1;overflow:auto;padding:0 12px 14px}',
    '.dsc-note{margin:18px 4px;color:var(--dsw-alias-label-tertiary,#6b7280);text-align:center}',
    '.dsc-note strong{display:block;margin-bottom:4px;color:var(--dsw-alias-label-secondary,#4b5563);font-size:13px}',
    '.dsc-group-title{margin:11px 2px 7px;color:var(--dsw-alias-label-caption,#8a8f98);font-size:10px;font-weight:600;letter-spacing:.06em;text-transform:uppercase}',
    '.dsc-card{display:flex;flex-direction:column;gap:7px;margin:0 0 8px;padding:11px 10px 10px;border:1px solid var(--dsw-alias-border-l2,#eceef1);border-radius:11px;background:var(--dsw-alias-bg-secondary,transparent)}',
    '.dsc-card[data-selected="true"]{border-color:var(--dsw-alias-state-warn-primary,#c77700);box-shadow:0 0 0 2px color-mix(in srgb,var(--dsw-alias-state-warn-primary,#c77700) 18%,transparent)}',
    '.dsc-card-head{display:flex;align-items:center;gap:7px;min-width:0}',
    '.dsc-level{display:inline-flex;align-items:center;justify-content:center;flex:none;min-width:27px;height:20px;padding:0 5px;border-radius:6px;background:var(--dsw-alias-state-warn-tertiary,#fff0d0);color:var(--dsw-alias-state-warn-label,#8a4b00);font-size:10px;font-weight:700}',
    '.dsc-level[data-level="C3"]{background:var(--dsw-alias-interactive-bg-hover-danger,#fce8e6);color:var(--dsw-alias-state-error-primary,#c5221f)}',
    '.dsc-level[data-level="C1"]{background:var(--dsw-alias-button-ghost-active-fill,#eef0f2);color:var(--dsw-alias-label-caption,#6b7280)}',
    '.dsc-card-reason{min-width:0;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:12px;font-weight:600}',
    '.dsc-card-time{flex:none;color:var(--dsw-alias-label-caption,#8a8f98);font-size:10px}',
    '.dsc-card-copy{margin:0;color:var(--dsw-alias-label-secondary,#4b5563);font-size:12px}',
    '.dsc-card-suggestion{margin:0;color:var(--dsw-alias-label-tertiary,#6b7280);font-size:11px}',
    '.dsc-card-actions{display:flex;flex-wrap:wrap;gap:5px;margin-top:1px}',
    '.dsc-card-action{padding:4px 7px;border:1px solid var(--dsw-alias-border-l2,#d9dce1);border-radius:7px;background:transparent;color:var(--dsw-alias-label-secondary,#4b5563);font:inherit;font-size:11px;cursor:pointer}',
    '.dsc-card-action[data-primary="true"]{border-color:var(--dsw-alias-state-warn-primary,#c77700);color:var(--dsw-alias-state-warn-label,#8a4b00)}',
    '.dsc-card-action:hover:not(:disabled),.dsc-card-action:focus-visible{background:var(--dsw-alias-interactive-bg-hover,rgba(128,128,128,.12));outline:none}',
    '.dsc-card-action:disabled{cursor:default;opacity:.45}',
    '.dsc-evidence{margin-top:1px;color:var(--dsw-alias-label-tertiary,#6b7280);font-size:11px}',
    '.dsc-evidence summary{cursor:pointer}',
    '.dsc-evidence p{margin:5px 0 0;white-space:pre-wrap;overflow-wrap:anywhere}',
    '.dsc-settings-card{margin:12px 0;border:1px solid var(--dsw-alias-border-l2,#eceef1);border-radius:12px;list-style:none;background:var(--dsw-alias-bg-secondary,transparent)}',
    '.dsc-settings-card-header{display:flex;align-items:center;gap:8px;width:100%;padding:12px;border:0;border-radius:12px;background:transparent;color:inherit;font:inherit;text-align:left;cursor:pointer}',
    '.dsc-settings-card-header:hover,.dsc-settings-card-header:focus-visible{background:var(--dsw-alias-interactive-bg-hover,rgba(128,128,128,.12));outline:none}',
    '.dsc-settings-card-heading{display:flex;flex:1;min-width:0;flex-direction:column;gap:2px}',
    '.dsc-settings-card-heading strong{font-size:13px;font-weight:600}',
    '.dsc-settings-card-heading span{color:var(--dsw-alias-label-tertiary,#6b7280);font-size:11px;line-height:1.4}',
    '.dsc-settings-unsaved{flex:none;color:var(--dsw-alias-state-warn-label,#8a4b00);font-size:10px}',
    '.dsc-settings-chevron{flex:none;color:var(--dsw-alias-label-tertiary,#6b7280);font-size:14px}',
    '.dsc-settings-card-body{display:grid;gap:9px;padding:0 12px 12px;border-top:1px solid var(--dsw-alias-border-l2,#eceef1)}',
    '.dsc-settings-hint{margin:0;color:var(--dsw-alias-label-tertiary,#6b7280);font-size:11px}',
    '.dsc-settings-status{margin:0;color:var(--dsw-alias-label-tertiary,#6b7280);font-size:11px}',
    '.dsc-settings-status-error{color:var(--dsw-alias-state-error-primary,#c5221f)}',
    '.dsc-settings-fieldset{display:grid;gap:8px;margin:0;padding:8px;border:1px solid var(--dsw-alias-border-l2,#eceef1);border-radius:8px}',
    '.dsc-settings-fieldset legend{padding:0 4px;color:var(--dsw-alias-label-tertiary,#6b7280);font-size:11px}',
    '.dsc-settings-actions{display:flex;justify-content:flex-end;gap:6px;flex-wrap:wrap}',
    '.dsc-settings-save{display:inline-flex;align-items:center;justify-content:center;min-height:28px;padding:4px 10px;border:0;border-radius:8px;background:var(--dsw-alias-label-primary,#202124);color:var(--dsw-alias-bg-primary,#fff);font:inherit;font-size:11px;cursor:pointer}',
    '.dsc-settings-save:disabled{cursor:default;opacity:.45}',
    '.dsc-field{display:grid;gap:4px;color:var(--dsw-alias-label-tertiary,#6b7280);font-size:11px}',
    '.dsc-field-row{display:grid;grid-template-columns:1fr 1fr;gap:8px}',
    '.dsc-field input,.dsc-field select{width:100%;box-sizing:border-box;min-height:28px;padding:4px 6px;border:1px solid var(--dsw-alias-border-l2,#d9dce1);border-radius:7px;background:transparent;color:var(--dsw-alias-label-primary,#202124);font:inherit}',
    '.dsc-check{display:flex;align-items:center;gap:6px;color:var(--dsw-alias-label-secondary,#4b5563);font-size:11px}',
    '.dsc-check input{width:auto}',
    '.dsc-resize-width{position:absolute;top:58px;right:-7px;bottom:48px;width:14px;cursor:ew-resize;touch-action:none}',
    '.dsc-resize-height{position:absolute;right:48px;bottom:-7px;left:48px;height:14px;cursor:ns-resize;touch-action:none}',
    '.dsc-resize-width:focus-visible,.dsc-resize-height:focus-visible{outline:2px solid var(--dsw-alias-state-business-primary,#4b7bec);outline-offset:1px;border-radius:5px}',
    '@media (max-width:720px){.dsc-panel{right:8px;bottom:8px;width:min(var(--dsc-width),calc(100vw - 16px));height:min(var(--dsc-height),calc(100dvh - 16px))}.dsc-toolbar{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);align-items:center}.dsc-status{grid-column:1/-1;width:100%;flex:none}.dsc-toolbar-button{width:100%;min-width:0}.dsc-field-row{grid-template-columns:1fr}}',
    '@media (max-width:360px){.dsc-panel{right:4px;bottom:4px;width:calc(100vw - 8px);height:calc(100dvh - 8px);min-width:0;min-height:0;border-radius:10px}.dsc-body{padding-right:8px;padding-left:8px}.dsc-toolbar{padding-right:8px;padding-left:8px}.dsc-header{padding-right:8px;padding-left:8px}}',
    '@media (prefers-reduced-motion:reduce){.dsc-panel,.dsc-trigger{transition:none}}',
  ].join('\n')
  document.head.append(style)
  return () => { style.remove() }
}

function mark(): ReactNode {
  return createElement('span', { className: 'dsc-mark', 'aria-hidden': true },
    createElement('svg', { viewBox: '0 0 24 24', focusable: 'false' },
      createElement('path', { d: 'M13.2 2.2 4.5 13.3h5.9l-.7 8.5 8.8-11.2h-5.9l.6-8.4Z' }),
    ),
  )
}

function useController(controller: Controller): ControllerState {
  const [state, setState] = useState(controller.getState)
  useEffect(() => controller.subscribe(() => { setState(controller.getState()) }), [controller])
  return state
}

function reasonText(item: ClientItem, t: Translate): string {
  const key = item.messageKey !== undefined && item.messageKey in zh
    ? item.messageKey as LocaleKey
    : reasonKeys[item.reasonCode]
  return key === undefined
    ? translate(t, 'item.unknownReason', { code: item.reasonCode })
    : translate(t, key, item.messageParams)
}

function suggestionText(item: ClientItem, t: Translate): string {
  const key = item.suggestionKey !== undefined && item.suggestionKey in zh
    ? item.suggestionKey as LocaleKey
    : suggestionKeys[item.reasonCode] ?? 'item.suggestion.unknown'
  return translate(t, key, item.messageParams)
}

function formatTime(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat(chineseLocale() ? 'zh-CN' : 'en-US', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

function notify(snapshot: ClientSnapshot, t: Translate, controller: Controller): void {
  if (snapshot.settings.openOnCritical && !controller.getState().open) {
    let opened = new Set<string>()
    try {
      opened = new Set(JSON.parse(window.localStorage.getItem(AUTO_OPEN_KEY) ?? '[]') as string[])
    } catch {
      opened = new Set()
    }
    const critical = snapshot.inbox.find(item => item.level === 'C3'
      && AUTO_OPEN_REASONS.has(item.reasonCode)
      && !opened.has(item.id))
    if (critical !== undefined) {
      opened.add(critical.id)
      try {
        window.localStorage.setItem(AUTO_OPEN_KEY, JSON.stringify([...opened].slice(-100)))
      } catch {
        // Auto-open deduplication is best effort; the panel remains usable.
      }
      controller.open(critical.id)
    }
  }
  if (!('Notification' in globalThis) || Notification.permission !== 'granted') return
  let seen = new Set<string>()
  try {
    seen = new Set(JSON.parse(window.localStorage.getItem(SEEN_KEY) ?? '[]') as string[])
  } catch {
    seen = new Set()
  }
  for (const item of snapshot.inbox
    .filter(value => (value.level === 'C2' || value.level === 'C3') && !seen.has(value.id))
    .slice(0, 3)) {
    const notification = new Notification('DeepCanary · ' + item.level, {
      body: reasonText(item, t),
      tag: item.id,
    })
    notification.onclick = () => {
      handleNotificationClick(notification, item.id, controller.open, () => { window.focus() })
    }
    seen.add(item.id)
  }
  try {
    window.localStorage.setItem(SEEN_KEY, JSON.stringify([...seen].slice(-100)))
  } catch {
    // Notification deduplication is best effort.
  }
}

function ResizeHandle(props: {
  axis: 'width' | 'height'
  value: number
  min: number
  max: number
  label: string
  onResize: (value: number) => void
}): ReactNode {
  const origin = useRef<{ x: number; y: number; value: number } | undefined>(undefined)
  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>): void => {
    event.preventDefault()
    event.currentTarget.setPointerCapture(event.pointerId)
    origin.current = { x: event.clientX, y: event.clientY, value: props.value }
  }
  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>): void => {
    if (origin.current === undefined || !event.currentTarget.hasPointerCapture(event.pointerId)) return
    const delta = props.axis === 'width'
      ? event.clientX - origin.current.x
      : event.clientY - origin.current.y
    props.onResize(clamp(origin.current.value - delta, props.min, props.max))
  }
  const onPointerUp = (event: ReactPointerEvent<HTMLDivElement>): void => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
    origin.current = undefined
  }
  const onPointerCancel = (event: ReactPointerEvent<HTMLDivElement>): void => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
    origin.current = undefined
  }
  const onKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>): void => {
    const positive = props.axis === 'width' ? event.key === 'ArrowLeft' : event.key === 'ArrowUp'
    const negative = props.axis === 'width' ? event.key === 'ArrowRight' : event.key === 'ArrowDown'
    const step = event.shiftKey ? 48 : 12
    if (event.key === 'Home') props.onResize(props.min)
    else if (event.key === 'End') props.onResize(props.max)
    else if (positive) props.onResize(clamp(props.value + step, props.min, props.max))
    else if (negative) props.onResize(clamp(props.value - step, props.min, props.max))
    else return
    event.preventDefault()
  }
  return createElement('div', {
    className: props.axis === 'width' ? 'dsc-resize-width' : 'dsc-resize-height',
    role: 'separator',
    'aria-orientation': props.axis === 'width' ? 'vertical' : 'horizontal',
    'aria-label': props.label,
    'aria-valuemin': props.min,
    'aria-valuemax': props.max,
    'aria-valuenow': props.value,
    tabIndex: 0,
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onPointerCancel,
    onKeyDown,
  })
}

function field(label: string, control: ReactNode): ReactNode {
  return createElement('label', { className: 'dsc-field' }, createElement('span', null, label), control)
}

const SETTINGS_KEYS: Array<keyof ClientSettings> = [
  'notificationLevel',
  'openOnCritical',
  'maxInterruptsPerHour',
  'dedupeWindowMinutes',
  'bundleWindowSeconds',
  'longRunThresholdMinutes',
  'subagentPressure',
  'quietHours',
  'privacySafeSummary',
  'healthPollSeconds',
  'maxInboxItems',
]

const DEFAULT_SETTINGS: ClientSettings = {
  notificationLevel: 'C2',
  openOnCritical: false,
  maxInterruptsPerHour: 3,
  dedupeWindowMinutes: 10,
  bundleWindowSeconds: 60,
  longRunThresholdMinutes: 5,
  subagentPressure: 'standard',
  quietHours: { enabled: false, start: '22:00', end: '08:00' },
  privacySafeSummary: true,
  healthPollSeconds: 15,
  maxInboxItems: 500,
}

function settingsValue(value: unknown): ClientSettings | undefined {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return undefined
  const input = value as Partial<ClientSettings> & { quietHours?: Partial<ClientSettings['quietHours']> }
  return {
    ...DEFAULT_SETTINGS,
    ...input,
    quietHours: { ...DEFAULT_SETTINGS.quietHours, ...input.quietHours },
  }
}

type SettingsCardProps = SettingsPluginItemOwnerProps & {
  t: Translate
  settingsScope?: SettingsScope<ClientSettings>
}

type SettingsOperations = Parameters<SettingsScope<ClientSettings>['mutate']>[0]

function DeepCanarySettingsCard(props: SettingsCardProps): ReactNode {
  const scope = props.settingsScope
  if (scope === undefined) return null
  const [remote, setRemote] = useState<SettingsScopeSnapshot<ClientSettings>>(() => scope.getSnapshot())
  const [draft, setDraft] = useState<ClientSettings | undefined>(() => settingsValue(scope.getSnapshot().value))
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [failed, setFailed] = useState(false)
  const [open, setOpen] = useState(false)
  const [resetFields, setResetFields] = useState<ReadonlySet<keyof ClientSettings>>(new Set())

  useEffect(() => {
    const update = (): void => { setRemote(scope.getSnapshot()) }
    update()
    return scope.subscribe(update)
  }, [scope])
  useEffect(() => {
    if (!dirty && remote.value !== undefined) {
      setDraft(settingsValue(remote.value))
      setResetFields(new Set())
    }
  }, [dirty, remote.value])

  if (remote.value === undefined || remote.status === 'loading' || remote.status === 'unavailable') return null
  const current = draft ?? settingsValue(remote.value) ?? DEFAULT_SETTINGS
  const base = settingsValue(remote.base) ?? DEFAULT_SETTINGS
  const disabled = !remote.writable || saving
  const edit = <K extends keyof ClientSettings>(key: K, value: ClientSettings[K]): void => {
    setDraft(previous => ({ ...(previous ?? current), [key]: value }))
    setDirty(true)
    setFailed(false)
    setResetFields(previous => {
      const next = new Set(previous)
      next.delete(key)
      return next
    })
  }
  const discard = (): void => {
    setDraft(settingsValue(remote.value))
    setDirty(false)
    setFailed(false)
    setResetFields(new Set())
  }
  const reset = (): void => {
    setDraft(base)
    setDirty(true)
    setFailed(false)
    setResetFields(new Set(SETTINGS_KEYS))
  }
  const save = (): void => {
    if (!dirty || disabled || remote.revision === undefined) return
    const operations = SETTINGS_KEYS.map(key => resetFields.has(key)
      ? { op: 'unset' as const, path: [key] }
      : { op: 'set' as const, path: [key], value: current[key] }) as SettingsOperations
    setSaving(true)
    setFailed(false)
    void scope.mutate(operations, remote.revision).then(() => {
      setDirty(false)
      setResetFields(new Set())
    }).catch(() => {
      setFailed(true)
    }).finally(() => {
      setSaving(false)
    })
  }
  const t = props.t
  return createElement('li', { className: 'dsc-settings-card', 'data-deepcanary-settings-card': true },
    createElement('button', {
      type: 'button',
      className: 'dsc-settings-card-header',
      'aria-expanded': open,
      onClick: () => { setOpen(value => !value) },
    },
      createElement('span', { className: 'dsc-settings-card-heading' },
        createElement('strong', null, translate(t, 'settings.title')),
        createElement('span', null, translate(t, 'settings.description'))),
      dirty && createElement('span', { className: 'dsc-settings-unsaved' }, translate(t, 'settings.unsaved')),
      createElement('span', { className: 'dsc-settings-chevron', 'aria-hidden': true }, open ? '▴' : '▾')),
    open && createElement('div', { className: 'dsc-settings-card-body' },
      createElement('p', { className: 'dsc-settings-hint' }, translate(t, 'settings.hint')),
      !remote.writable && createElement('p', { className: 'dsc-settings-status', role: 'status' }, translate(t, 'settings.readOnly')),
      field(translate(t, 'settings.level'),
        createElement('select', {
          value: current.notificationLevel,
          disabled,
          onChange: (event: { target: { value: string } }) => { edit('notificationLevel', event.target.value as ClientSettings['notificationLevel']) },
        }, ...(['C1', 'C2', 'C3'] as const).map(value => createElement('option', { key: value, value }, value)))),
      createElement('label', { className: 'dsc-check' },
        createElement('input', {
          type: 'checkbox',
          checked: current.openOnCritical,
          disabled,
          onChange: (event: { target: { checked: boolean } }) => { edit('openOnCritical', event.target.checked) },
        }),
        translate(t, 'settings.openOnCritical')),
      createElement('div', { className: 'dsc-field-row' },
        field(translate(t, 'settings.maxInterrupts'), createElement('input', { type: 'number', min: 0, max: 10, step: 1, value: current.maxInterruptsPerHour, disabled, onChange: (event: { target: { value: string } }) => { edit('maxInterruptsPerHour', Number(event.target.value)) } })),
        field(translate(t, 'settings.dedupe'), createElement('input', { type: 'number', min: 0, max: 120, step: 1, value: current.dedupeWindowMinutes, disabled, onChange: (event: { target: { value: string } }) => { edit('dedupeWindowMinutes', Number(event.target.value)) } })),
      ),
      createElement('div', { className: 'dsc-field-row' },
        field(translate(t, 'settings.bundle'), createElement('input', { type: 'number', min: 0, max: 900, step: 1, value: current.bundleWindowSeconds, disabled, onChange: (event: { target: { value: string } }) => { edit('bundleWindowSeconds', Number(event.target.value)) } })),
        field(translate(t, 'settings.longRun'), createElement('input', { type: 'number', min: 1, max: 120, step: 1, value: current.longRunThresholdMinutes, disabled, onChange: (event: { target: { value: string } }) => { edit('longRunThresholdMinutes', Number(event.target.value)) } })),
      ),
      field(translate(t, 'settings.subagent'),
        createElement('select', { value: current.subagentPressure, disabled, onChange: (event: { target: { value: string } }) => { edit('subagentPressure', event.target.value as ClientSettings['subagentPressure']) } },
          ...(['relaxed', 'standard', 'strict'] as const).map(value => createElement('option', { key: value, value }, translate(t, ('settings.subagent.' + value) as LocaleKey))))),
      createElement('fieldset', { className: 'dsc-settings-fieldset' },
        createElement('legend', null, translate(t, 'settings.quiet')),
        createElement('label', { className: 'dsc-check' },
          createElement('input', { type: 'checkbox', checked: current.quietHours.enabled, disabled, onChange: (event: { target: { checked: boolean } }) => { edit('quietHours', { ...current.quietHours, enabled: event.target.checked }) } }),
          translate(t, 'settings.quietEnable')),
        createElement('div', { className: 'dsc-field-row' },
          field(translate(t, 'settings.quietStart'), createElement('input', { type: 'time', value: current.quietHours.start, disabled, onChange: (event: { target: { value: string } }) => { edit('quietHours', { ...current.quietHours, start: event.target.value }) } })),
          field(translate(t, 'settings.quietEnd'), createElement('input', { type: 'time', value: current.quietHours.end, disabled, onChange: (event: { target: { value: string } }) => { edit('quietHours', { ...current.quietHours, end: event.target.value }) } })),
        ),
      ),
      createElement('label', { className: 'dsc-check' },
        createElement('input', { type: 'checkbox', checked: current.privacySafeSummary, disabled, onChange: (event: { target: { checked: boolean } }) => { edit('privacySafeSummary', event.target.checked) } }),
        translate(t, 'settings.privacy')),
      createElement('div', { className: 'dsc-field-row' },
        field(translate(t, 'settings.healthPoll'), createElement('input', { type: 'number', min: 5, max: 300, step: 1, value: current.healthPollSeconds, disabled, onChange: (event: { target: { value: string } }) => { edit('healthPollSeconds', Number(event.target.value)) } })),
        field(translate(t, 'settings.maxInbox'), createElement('input', { type: 'number', min: 50, max: 5000, step: 50, value: current.maxInboxItems, disabled, onChange: (event: { target: { value: string } }) => { edit('maxInboxItems', Number(event.target.value)) } })),
      ),
      failed && createElement('p', { className: 'dsc-settings-status dsc-settings-status-error', role: 'status' }, translate(t, remote.revision === undefined ? 'settings.saveFailed' : 'settings.conflict')),
      createElement('div', { className: 'dsc-settings-actions' },
        createElement('button', { type: 'button', className: 'dsc-toolbar-button', disabled: !dirty || saving, onClick: discard }, translate(t, 'settings.discard')),
        createElement('button', { type: 'button', className: 'dsc-toolbar-button', disabled: disabled, onClick: reset }, translate(t, 'settings.reset')),
        createElement('button', { type: 'button', className: 'dsc-settings-save', disabled: !dirty || disabled || remote.revision === undefined, onClick: save }, translate(t, saving ? 'settings.saving' : 'settings.save')),
      ),
    ),
  )
}

function DeepCanaryTrigger(props: { wide: boolean; t: Translate; controller: Controller }): ReactNode {
  const state = useController(props.controller)
  const ref = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    props.controller.setTrigger(ref.current)
    return () => { props.controller.setTrigger(null) }
  }, [props.controller])
  const count = state.snapshot?.status.openInbox ?? 0
  const label = translate(props.t, state.open ? 'trigger.close' : 'trigger.open')
  return createElement('div', {
    className: 'dsc-trigger-layer',
    'data-rail': !props.wide,
    'data-deepcanary-trigger-layer': true,
  },
  createElement('button', {
    ref,
    type: 'button',
    className: 'dsc-trigger',
    'data-deepcanary-trigger': true,
    'data-active': state.open || count > 0,
    'aria-expanded': state.open,
    'aria-label': count > 0 ? translate(props.t, 'trigger.count', { count }) : label,
    title: label,
    onClick: () => { props.controller.toggle() },
  },
    mark(),
    props.wide && createElement('span', { className: 'dsc-trigger-label' }, translate(props.t, 'panel.title')),
    props.wide && createElement('span', { className: 'dsc-trigger-count' }, String(count)),
  ))
}

function evidenceType(value: string, t: Translate): string {
  const key: LocaleKey | undefined = value === 'session-event'
    ? 'item.evidence.session'
    : value === 'runtime-probe'
      ? 'item.evidence.runtime'
      : value === 'tool-history'
        ? 'item.evidence.tool'
        : value === 'subagent-state'
          ? 'item.evidence.subagent'
          : value === 'http-probe'
            ? 'item.evidence.http'
            : undefined
  return key === undefined ? value : translate(t, key)
}

function authorityText(value: string, t: Translate): string {
  const key: LocaleKey | undefined = value === 'host'
    ? 'item.authority.host'
    : value === 'runtime'
      ? 'item.authority.runtime'
      : value === 'derived'
        ? 'item.authority.derived'
        : value === 'heuristic'
          ? 'item.authority.heuristic'
          : undefined
  return key === undefined ? value : translate(t, key)
}

function actionButton(label: string, onClick: () => void, disabled: boolean, primary = false): ReactNode {
  return createElement('button', {
    type: 'button',
    className: 'dsc-card-action',
    'data-primary': primary,
    disabled,
    onClick,
  }, label)
}

function decisionTraceDetails(item: ClientItem, t: Translate): ReactNode | undefined {
  const trace = item.decisionTrace
  if (trace === undefined) return undefined
  const authority = Object.entries(trace.authoritySummary.counts)
    .filter(([, count]) => count > 0)
    .map(([name, count]) => `${authorityText(name, t)} ${count}`)
    .join(' · ')
  const traceRows: ReactNode[] = [
    createElement('p', { key: 'version' }, translate(t, 'item.policyVersion', { version: trace.policyVersion })),
    createElement('p', { key: 'rules' }, translate(t, 'item.matchedRules', { rules: trace.matchedRules.join(', ') || translate(t, 'item.none') })),
    createElement('p', { key: 'scopes' }, translate(t, 'item.appliedScopes', { scopes: trace.appliedScopes.join(', ') || translate(t, 'item.none') })),
    createElement('p', { key: 'suppressed' }, translate(t, 'item.suppressedBy', { values: trace.suppressedBy.join(', ') || translate(t, 'item.none') })),
    createElement('p', { key: 'authority' }, translate(t, 'item.authoritySummary', { text: authority || translate(t, 'item.none') })),
    createElement('p', { key: 'final' }, translate(t, 'item.finalDecision', { level: trace.finalLevel, action: trace.finalAction })),
  ]
  if (trace.bundledWith !== undefined) traceRows.push(createElement('p', { key: 'bundle' }, translate(t, 'item.bundled', { count: trace.bundledWith.eventCount })))
  if (trace.recoveryRule !== undefined) traceRows.push(createElement('p', { key: 'recovery' }, translate(t, 'item.recoveryRule', { rule: trace.recoveryRule })))
  return createElement('details', { className: 'dsc-evidence', key: 'decision-trace' },
    createElement('summary', null, translate(t, 'item.policyTrace')),
    ...traceRows,
  )
}

function itemCard(item: ClientItem, state: ControllerState, t: Translate, controller: Controller, selected: boolean): ReactNode {
  const busy = state.pending.has(item.id)
  const reason = reasonText(item, t)
  const evidence = item.evidence.map(value => translate(t, 'item.evidenceLine', {
    type: evidenceType(value.type, t),
    authority: authorityText(value.authority, t),
  })).join(' · ')
  const children: ReactNode[] = [
    createElement('div', { className: 'dsc-card-head', key: 'head' },
      createElement('span', {
        className: 'dsc-level',
        'data-level': item.level,
        title: translate(t, 'item.level', { level: item.level }),
      }, item.level),
      createElement('span', { className: 'dsc-card-reason' }, reason),
      createElement('time', { className: 'dsc-card-time', dateTime: item.occurredAt }, formatTime(item.occurredAt)),
    ),
    createElement('p', { className: 'dsc-card-copy', key: 'copy' }, reason),
    createElement('p', { className: 'dsc-card-suggestion', key: 'suggestion' },
      translate(t, 'item.suggestion', { text: suggestionText(item, t) })),
  ]
  if (item.bundleCount > 1) {
    children.push(createElement('small', { className: 'dsc-card-suggestion', key: 'events' },
      translate(t, 'item.events', { count: item.bundleCount })))
  }
  children.push(createElement('details', { className: 'dsc-evidence', key: 'evidence' },
    createElement('summary', null, translate(t, 'item.evidence') + (evidence ? ' · ' + evidence : '')),
    createElement('p', null, translate(t, 'item.technicalDetail', { text: reason })),
  ))
  const traceDetails = decisionTraceDetails(item, t)
  if (traceDetails !== undefined) children.push(traceDetails)
  const actions: ReactNode[] = [
    actionButton(translate(t, 'item.acknowledge'), () => {
      void controller.action(item.id, { action: 'acknowledge' })
    }, busy, true),
    actionButton(translate(t, 'item.snooze'), () => {
      void controller.action(item.id, { action: 'snooze', minutes: 30 })
    }, busy),
    actionButton(translate(t, 'item.mute'), () => {
      void controller.action(item.id, { action: 'mute' })
    }, busy),
    actionButton(translate(t, 'item.useful'), () => {
      void controller.action(item.id, { action: 'feedback', useful: true })
    }, busy),
    actionButton(translate(t, 'item.irrelevant'), () => {
      void controller.action(item.id, { action: 'feedback', useful: false })
    }, busy),
  ]
  if (item.sessionId) {
    actions.push(actionButton(translate(t, 'item.jump'), () => {
      void controller.jump(item.id)
    }, busy))
  }
  children.push(createElement('div', { className: 'dsc-card-actions', key: 'actions' }, ...actions))
  return createElement('article', {
    className: 'dsc-card',
    key: item.id,
    'data-deepcanary-item': item.id,
    'data-selected': selected,
  }, ...children)
}

function DeepCanaryOverlay(props: { t: Translate; controller: Controller }): ReactNode {
  const state = useController(props.controller)
  const panelRef = useRef<HTMLElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)
  const positionedId = useRef<string | undefined>(undefined)
  useLayoutEffect(() => {
    if (state.open) closeRef.current?.focus()
  }, [state.open])
  useEffect(() => {
    if (!state.open || state.selectedId === undefined) {
      positionedId.current = undefined
      return
    }
    if (positionedId.current === state.selectedId) return
    const elements = panelRef.current?.querySelectorAll<HTMLElement>('[data-deepcanary-item]') ?? []
    if (positionSelectedAttention(elements, state.selectedId)) positionedId.current = state.selectedId
  }, [state.open, state.selectedId, state.snapshot])
  useEffect(() => {
    if (!state.open) return
    const onKeyDown = (event: globalThis.KeyboardEvent): void => {
      if (event.key === 'Escape') {
        event.preventDefault()
        props.controller.close()
      }
    }
    const onPointerDown = (event: globalThis.PointerEvent): void => {
      const target = event.target
      if (!(target instanceof Node)) return
      if (panelRef.current?.contains(target)) return
      if (target instanceof Element && target.closest('[data-deepcanary-trigger]') !== null) return
      props.controller.close()
    }
    document.addEventListener('keydown', onKeyDown)
    document.addEventListener('pointerdown', onPointerDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.removeEventListener('pointerdown', onPointerDown)
    }
  }, [props.controller, state.open])
  useEffect(() => {
    if (state.snapshot !== undefined) notify(state.snapshot, props.t, props.controller)
  }, [props.controller, props.t, state.snapshot])
  if (!state.open) return null

  const snapshot = state.snapshot
  const statusState = state.failed || state.protocolUnsupported ? 'offline' : state.loading ? 'loading' : 'ready'
  const statusText = state.failed
    ? translate(props.t, 'panel.status.offline')
    : state.protocolUnsupported
      ? translate(props.t, 'panel.updateRequired')
    : state.loading
      ? translate(props.t, 'panel.status.loading')
      : translate(props.t, 'panel.status.ready')
  const items = snapshot?.inbox ?? []
  const panelStyle = {
    '--dsc-width': state.width + 'px',
    '--dsc-height': state.height + 'px',
  } as CSSProperties
  const body: ReactNode[] = []
  if (snapshot !== undefined) {
    body.push(createElement('p', { className: 'dsc-settings-hint', key: 'settings-location' }, translate(props.t, 'panel.settingsLocation')))
    if (state.protocolUnsupported) body.push(createElement('p', { className: 'dsc-note', key: 'protocol' }, translate(props.t, 'panel.updateRequired')))
  }
  if (state.failed && snapshot === undefined) {
    body.push(createElement('div', { className: 'dsc-note', key: 'failed' },
      createElement('strong', null, translate(props.t, 'state.failed')),
      createElement('button', {
        className: 'dsc-toolbar-button',
        type: 'button',
        onClick: () => { void props.controller.refresh() },
      }, translate(props.t, 'state.retry'))))
  } else if (state.loading && snapshot === undefined) {
    body.push(createElement('p', { className: 'dsc-note', key: 'loading' },
      translate(props.t, 'panel.status.loading')))
  } else if (items.length === 0) {
    body.push(createElement('div', { className: 'dsc-note', key: 'empty' },
      createElement('strong', null, translate(props.t, 'panel.empty')),
      createElement('span', null, translate(props.t, 'panel.emptyHint'))))
  } else {
    body.push(createElement('h3', { className: 'dsc-group-title', key: 'group' },
      translate(props.t, 'panel.title')))
    for (const item of items.slice(0, 50)) {
      body.push(itemCard(item, state, props.t, props.controller, state.selectedId === item.id))
    }
  }
  const notificationSupported = 'Notification' in globalThis
  return createElement('div', { className: 'dsc-overlay-root', 'data-deepcanary-overlay': true },
    createElement('section', {
      ref: panelRef,
      className: 'dsc-panel',
      style: panelStyle,
      role: 'dialog',
      'aria-modal': false,
      'aria-labelledby': 'dsc-panel-title',
      'data-deepcanary-panel': true,
      'data-open': true,
    },
      createElement('header', { className: 'dsc-header' },
        createElement('span', { className: 'dsc-heading' },
          createElement('span', { className: 'dsc-title', id: 'dsc-panel-title' },
            translate(props.t, 'panel.title')),
          createElement('span', { className: 'dsc-subtitle' },
            translate(props.t, 'panel.subtitle'))),
        createElement('span', { className: 'dsc-header-count' }, String(snapshot?.status.openInbox ?? 0)),
        createElement('button', {
          ref: closeRef,
          className: 'dsc-icon-button dsc-close',
          type: 'button',
          'data-deepcanary-close': true,
          'aria-label': translate(props.t, 'panel.close'),
          title: translate(props.t, 'panel.close'),
          onClick: () => { props.controller.close() },
        }, '×')),
      createElement('div', { className: 'dsc-toolbar' },
        createElement('span', { className: 'dsc-status', role: 'status', 'aria-live': 'polite', 'aria-atomic': true },
          createElement('span', { className: 'dsc-status-dot', 'data-state': statusState, 'aria-hidden': true }),
          statusText,
          snapshot !== undefined && ' · ' + translate(props.t, 'panel.sessions', { count: snapshot.status.sessions }),
          state.lastSyncedAt !== undefined && ' · ' + translate(props.t, 'panel.lastSynced', { time: formatTime(state.lastSyncedAt) })),
        createElement('button', {
          className: 'dsc-toolbar-button',
          type: 'button',
          disabled: state.loading,
          'aria-label': translate(props.t, 'panel.refresh'),
          onClick: () => { void props.controller.refresh() },
        }, state.loading ? translate(props.t, 'panel.refreshing') : translate(props.t, 'panel.refresh')),
        createElement('button', {
          className: 'dsc-toolbar-button',
          type: 'button',
          disabled: !notificationSupported,
          onClick: () => {
            if (notificationSupported) {
              void Notification.requestPermission().then(() => { void props.controller.refresh() })
            }
          },
        }, !notificationSupported
          ? translate(props.t, 'panel.notification.unavailable')
          : Notification.permission === 'granted'
            ? translate(props.t, 'panel.notification.enabled')
            : translate(props.t, 'panel.notification.enable'))),
      createElement('div', {
        className: 'dsc-body',
        role: 'region',
        'aria-label': translate(props.t, 'panel.bodyLabel'),
      }, ...body),
      (() => {
        const bounds = viewportBounds()
        return createElement(ResizeHandle, {
          axis: 'width',
          value: state.width,
          min: bounds.minWidth,
          max: bounds.maxWidth,
          label: translate(props.t, 'panel.resize.width'),
          onResize: width => { props.controller.setSize(width, state.height) },
        })
      })(),
      createElement(ResizeHandle, {
        axis: 'height',
        value: state.height,
        min: viewportBounds().minHeight,
        max: viewportBounds().maxHeight,
        label: translate(props.t, 'panel.resize.height'),
        onResize: height => { props.controller.setSize(state.width, height) },
      }),
    ),
  )
}

export const inject = ['slots', 'locale', 'settingsScope']

export function apply(ctx: ClientContext): void {
  const controller = createController()
  ctx.effect(() => injectStyles(), 'deepcanary: client styles')
  ctx.effect(() => {
    controller.start()
    return () => { controller.dispose() }
  }, 'deepcanary: client controller')
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'deepcanary: dictionaries')

  ctx.slots.inject('sidebar.footer.action', () => ctx.slots.register({
    name: 'sidebar.footer.action',
    id: 'deepcanary-trigger',
    locale: NS,
    inject: () => ({ controller }),
  }, DeepCanaryTrigger))

  ctx.slots.inject('shell.overlay', () => ctx.slots.register({
    name: 'shell.overlay',
    id: 'deepcanary-overlay',
    locale: NS,
    inject: () => ({ controller }),
  }, DeepCanaryOverlay))

  const settingsScope = ctx.settingsScope?.bind<ClientSettings>({
    namespace: SETTINGS_NS,
    decode: value => settingsValue(value),
  })
  if (settingsScope !== undefined) {
    ctx.slots.inject('settings.plugin.item', () => ctx.slots.register({
      name: 'settings.plugin.item',
      key: SETTINGS_NS,
      locale: NS,
      inject: () => ({ settingsScope }),
    }, DeepCanarySettingsCard))
  }
}
