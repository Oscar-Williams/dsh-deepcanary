/** Use factual summary copy when older metadata lacks a template parameter. */
export function formatReasonMessage(template: string, fallback: string, params?: Record<string, unknown>): string {
  const keys = [...template.matchAll(/\{(\w+)\}/g)].map(match => match[1]!)
  if (keys.some(key => {
    const value = params?.[key]
    return !['string', 'number', 'boolean'].includes(typeof value) || value === ''
      || (typeof value === 'number' && !Number.isFinite(value))
  })) return fallback
  return template.replace(/\{(\w+)\}/g, (_match, key: string) => String(params![key]))
}
