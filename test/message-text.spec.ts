import { describe, expect, it } from 'vitest'
import { formatReasonMessage } from '../src/client/message-text.js'

describe('reminder copy with historical metadata', () => {
  it('uses an accurate summary when the historical duration is missing', () => {
    expect(formatReasonMessage('已连续 {idleMinutes} 分钟未观察到会话活动。', '暂未观察到会话活动。'))
      .toBe('暂未观察到会话活动。')
    expect(formatReasonMessage('No activity for {idleMinutes} minutes.', 'No recent session activity.'))
      .toBe('No recent session activity.')
  })
  it('summarizes partial metadata without inventing a count or leaving punctuation gaps', () => {
    expect(formatReasonMessage('Tool “{toolName}” failed {failureCount} times.', 'Tool failures are repeating.', { toolName: 'tool' }))
      .toBe('Tool failures are repeating.')
    expect(formatReasonMessage('{count} jobs', 'Background work continues.', { count: Number.NaN }))
      .toBe('Background work continues.')
  })
  it('preserves known zero values and literal replacement text', () => {
    expect(formatReasonMessage('{count}: {name}', 'Summary', { count: 0, name: '$& {count}' })).toBe('0: $& {count}')
  })
  it('keeps reasons without parameters intact', () => {
    expect(formatReasonMessage('DSH is waiting for your answer.', 'Summary')).toBe('DSH is waiting for your answer.')
  })
})
