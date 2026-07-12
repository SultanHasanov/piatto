import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Check, ChevronUp, Delete } from 'lucide-react'
import { applyNumericKey, normalizeNumeric, numericValue, type NumericMode, type NumericRules } from './numericKeypadLogic'

interface KeypadProps {
  value: string
  rules: NumericRules
  onChange: (value: string) => void
  onClose?: () => void
}

export function NumericKeypad({ value, rules, onChange, onClose }: KeypadProps) {
  const { mode } = rules
  // «00» в PIN/коде опасен: лишняя цифра молча отбрасывается по maxLength
  const keys = ['7', '8', '9', '4', '5', '6', '1', '2', '3', ...(mode === 'signed' ? ['sign', 'decimal'] : mode === 'money' ? ['decimal'] : mode === 'pin' || mode === 'code' ? ['spacer'] : ['00']), '0', 'backspace']
  const clearTimer = useRef<number | null>(null)
  const clearedByHold = useRef(false)
  const stopHold = () => { if (clearTimer.current !== null) { window.clearTimeout(clearTimer.current); clearTimer.current = null } }
  useEffect(() => stopHold, [])
  return <div className="numeric-keypad" aria-label="Цифровая клавиатура">
    {keys.map((key) => key === 'spacer'
      ? <span key={key} className="numeric-key-spacer"/>
      : key === 'backspace'
      ? <button key={key} type="button" className="numeric-key numeric-key--backspace" title="Удерживайте, чтобы очистить"
          onPointerDown={() => { clearedByHold.current = false; clearTimer.current = window.setTimeout(() => { clearedByHold.current = true; onChange(applyNumericKey(value, 'clear', rules)) }, 600) }}
          onPointerUp={stopHold} onPointerLeave={stopHold} onPointerCancel={stopHold}
          onClick={() => { if (clearedByHold.current) { clearedByHold.current = false; return } onChange(applyNumericKey(value, key, rules)) }}>
          <Delete size={24}/>
        </button>
      : <button key={key} type="button" className={`numeric-key numeric-key--${key}`} onClick={() => onChange(applyNumericKey(value, key, rules))}>
          {key === 'decimal' ? ',' : key === 'sign' ? '±' : key}
        </button>)}
    {onClose&&<button type="button" className="numeric-key numeric-key--close" onClick={onClose}><ChevronUp size={20}/> Свернуть</button>}
  </div>
}

interface InputProps {
  value?: string | number | null
  onChange?: (value: string | number | null) => void
  mode?: NumericMode
  maxLength?: number
  max?: number
  masked?: boolean
  alwaysOpen?: boolean
  autoFocus?: boolean
  addonAfter?: string
  placeholder?: string
  label?: string
  className?: string
  onComplete?: (value: string) => void
}

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(() => window.matchMedia('(max-width: 600px)').matches)
  useEffect(() => {
    const query = window.matchMedia('(max-width: 600px)')
    const listener = (event: MediaQueryListEvent) => setIsMobile(event.matches)
    query.addEventListener('change', listener)
    return () => query.removeEventListener('change', listener)
  }, [])
  return isMobile
}

// одновременно может быть открыт только один всплывающий кейпад
let closeCurrentKeypad: (() => void) | null = null

export function TerminalNumericInput({ value, onChange, mode = 'integer', maxLength, max, masked, alwaysOpen, autoFocus, addonAfter, placeholder, label, className, onComplete }: InputProps) {
  const id = useId()
  const isMobile = useIsMobile()
  const rootRef = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(Boolean(alwaysOpen || autoFocus))
  const externalValue = value === null || value === undefined ? '' : String(value)
  const [draft, setDraft] = useState(externalValue)
  const stringValue = draft
  const rules = useMemo(() => ({ mode, maxLength, max }), [mode, maxLength, max])

  const commit = useCallback((nextRaw: string) => {
    const next = normalizeNumeric(nextRaw, rules)
    setDraft(next)
    onChange?.(mode === 'pin' || mode === 'code' ? next : numericValue(next))
    if (maxLength && next.length === maxLength) onComplete?.(next)
  }, [rules, onChange, mode, maxLength, onComplete])

  useEffect(() => {
    if (!draft.endsWith('.') && draft !== '-' && externalValue !== draft) setDraft(externalValue)
  }, [externalValue, draft])

  const openKeypad = useCallback(() => {
    if (closeCurrentKeypad) closeCurrentKeypad()
    setOpen(true)
  }, [])

  useEffect(() => {
    if (!open || alwaysOpen) return
    const close = () => setOpen(false)
    closeCurrentKeypad = close
    return () => { if (closeCurrentKeypad === close) closeCurrentKeypad = null }
  }, [open, alwaysOpen])

  useEffect(() => {
    if (!open && !alwaysOpen) return
    function keydown(event: KeyboardEvent) {
      if (/^\d$/.test(event.key)) { event.preventDefault(); commit(applyNumericKey(stringValue, event.key, rules)) }
      else if (event.key === 'Backspace' || event.key === 'Delete') { event.preventDefault(); commit(applyNumericKey(stringValue, 'backspace', rules)) }
      else if (event.key === '.' || event.key === ',') { event.preventDefault(); commit(applyNumericKey(stringValue, 'decimal', rules)) }
      else if (event.key === '-') { event.preventDefault(); commit(applyNumericKey(stringValue, 'sign', rules)) }
      else if ((event.key === 'Escape' || event.key === 'Enter') && !alwaysOpen) { event.preventDefault(); setOpen(false) }
    }
    window.addEventListener('keydown', keydown)
    return () => window.removeEventListener('keydown', keydown)
  }, [open, alwaysOpen, stringValue, rules, commit])

  const popoverRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open || alwaysOpen) return
    function outside(event: PointerEvent) {
      if (event.target instanceof Node && !rootRef.current?.contains(event.target) && !popoverRef.current?.contains(event.target)) setOpen(false)
    }
    document.addEventListener('pointerdown', outside, true)
    return () => document.removeEventListener('pointerdown', outside, true)
  }, [open, alwaysOpen])

  return <div ref={rootRef} className={`terminal-number ${open || alwaysOpen ? 'terminal-number--open' : ''} ${className ?? ''}`}>
    <div className="terminal-number-field">
      {label && <div className="terminal-number-label">{label}</div>}
      <button id={id} type="button" className="terminal-number-display" onClick={openKeypad} aria-label={label ?? placeholder ?? 'Числовое значение'}>
        {masked || mode === 'pin' || mode === 'code' ? <span className="terminal-number-slots" style={{gridTemplateColumns:`repeat(${maxLength ?? 4}, minmax(34px, 1fr))`}}>{Array.from({length:maxLength ?? 4},(_,index)=><span key={index} className={index<stringValue.length?'filled':''}>{index<stringValue.length ? '•' : ''}</span>)}</span> : <span className={!stringValue?'terminal-number-placeholder':''}>{stringValue.replace('.', ',') || placeholder || '0'}</span>}
        {addonAfter && <span className="terminal-number-addon">{addonAfter}</span>}
      </button>
    </div>
    {alwaysOpen && <NumericKeypad value={stringValue} rules={rules} onChange={commit}/>}
    {open && !alwaysOpen && createPortal(
      isMobile
        ? <div className="numeric-keypad-overlay">
            <div ref={popoverRef} className="numeric-keypad-dialog">
              <div className="terminal-number-display numeric-keypad-dialog-value">
                {masked || mode === 'pin' || mode === 'code' ? <span className="terminal-number-slots" style={{gridTemplateColumns:`repeat(${maxLength ?? 4}, minmax(34px, 1fr))`}}>{Array.from({length:maxLength ?? 4},(_,index)=><span key={index} className={index<stringValue.length?'filled':''}>{index<stringValue.length ? '•' : ''}</span>)}</span> : <span className={!stringValue ? 'terminal-number-placeholder' : ''}>{stringValue.replace('.', ',') || placeholder || '0'}</span>}
                {addonAfter && <span className="terminal-number-addon">{addonAfter}</span>}
              </div>
              <NumericKeypad value={stringValue} rules={rules} onChange={commit}/>
              <button type="button" className="numeric-keypad-confirm" onClick={() => setOpen(false)}><Check size={22}/> Готово</button>
            </div>
          </div>
        : <div ref={popoverRef} className="numeric-keypad-popover">
            <NumericKeypad value={stringValue} rules={rules} onChange={commit} onClose={() => setOpen(false)}/>
          </div>,
      document.body,
    )}
  </div>
}
