export type NumericMode = 'pin' | 'code' | 'money' | 'integer' | 'signed'

export interface NumericRules {
  mode: NumericMode
  maxLength?: number
  /** Верхняя граница значения — цифра, превышающая её, просто не вводится. */
  max?: number
}

export function normalizeNumeric(value: string, rules: NumericRules): string {
  const { mode } = rules
  if (mode === 'pin' || mode === 'code') {
    return value.replace(/\D/g, '').slice(0, rules.maxLength)
  }
  if (mode === 'integer') {
    const digits = value.replace(/\D/g, '').slice(0, rules.maxLength)
    return digits.replace(/^0+(?=\d)/, '')
  }

  if (mode === 'signed' && value === '-') return '-'
  let next = value.replace(',', '.').replace(/[^\d.-]/g, '')
  const negative = mode === 'signed' && next.includes('-')
  next = next.replace(/-/g, '')
  const [wholeRaw = '', ...fractionParts] = next.split('.')
  const whole = wholeRaw.replace(/^0+(?=\d)/, '') || '0'
  const fraction = fractionParts.join('').slice(0, 2)
  const hasSeparator = next.includes('.')
  return `${negative ? '-' : ''}${whole}${hasSeparator ? `.${fraction}` : ''}`
}

export function applyNumericKey(value: string, key: string, rules: NumericRules): string {
  if (key === 'clear') return ''
  if (key === 'backspace') return value.slice(0, -1)
  if (key === 'sign') {
    if (rules.mode !== 'signed') return value
    if (!value) return '-'
    return value.startsWith('-') ? value.slice(1) : `-${value}`
  }
  if (key === 'decimal') {
    if (!['money', 'signed'].includes(rules.mode) || value.includes('.')) return value
    return normalizeNumeric(`${value || '0'}.`, rules)
  }
  if (!/^\d{1,2}$/.test(key)) return value
  const next = normalizeNumeric(`${value}${key}`, rules)
  if (rules.max !== undefined) {
    const parsed = numericValue(next.endsWith('.') ? next.slice(0, -1) : next)
    if (parsed !== null && parsed > rules.max) return value
  }
  return next
}

export function numericValue(value: string): number | null {
  if (!value || value === '-' || value.endsWith('.')) return value.endsWith('.') ? Number(value.slice(0, -1)) : null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}
