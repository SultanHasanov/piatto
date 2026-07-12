import { describe, expect, it } from 'vitest'
import { applyNumericKey, normalizeNumeric, numericValue } from './numericKeypadLogic'

describe('numeric keypad logic', () => {
  it('limits PIN and strips non-digits', () => expect(normalizeNumeric('12a345', {mode:'pin',maxLength:4})).toBe('1234'))
  it('normalizes leading zeroes', () => expect(normalizeNumeric('00042', {mode:'integer'})).toBe('42'))
  it('keeps at most two decimal places', () => expect(normalizeNumeric('12,345', {mode:'money'})).toBe('12.34'))
  it('supports signed values only in signed mode', () => expect(normalizeNumeric('-25', {mode:'signed'})).toBe('-25'))
  it('handles backspace and clear', () => { expect(applyNumericKey('123','backspace',{mode:'integer'})).toBe('12'); expect(applyNumericKey('123','clear',{mode:'integer'})).toBe('') })
  it('converts display value to a number', () => expect(numericValue('12.50')).toBe(12.5))
  it('rejects digits that would exceed max', () => {
    expect(applyNumericKey('10','0',{mode:'money',max:100})).toBe('100')
    expect(applyNumericKey('100','0',{mode:'money',max:100})).toBe('100')
    expect(applyNumericKey('15','0',{mode:'money',max:100})).toBe('15')
    expect(applyNumericKey('9','9',{mode:'money',max:100})).toBe('99')
  })
  it('allows leading minus on empty value in signed mode', () => {
    expect(applyNumericKey('','sign',{mode:'signed'})).toBe('-')
    expect(applyNumericKey('-','5',{mode:'signed'})).toBe('-5')
    expect(applyNumericKey('','sign',{mode:'money'})).toBe('')
  })
})
