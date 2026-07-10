import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import type { Order, Shift } from '../types'
import { useStore } from '../stores/context'
import { PrintableReceipt } from '../components/PrintableReceipt'
import { PrintableShiftReport } from '../components/PrintableShiftReport'

type PrintJob = { kind: 'receipt'; order: Order } | { kind: 'shift'; shift: Shift; mode: 'x' | 'z' }

interface PrintContextValue {
  printReceipt: (order: Order) => void
  printShift: (shift: Shift, mode: 'x' | 'z') => void
}

const PrintContext = createContext<PrintContextValue | null>(null)

export function usePrint() {
  const ctx = useContext(PrintContext)
  if (!ctx) throw new Error('PrintProvider не настроен')
  return ctx
}

export function PrintProvider({ children }: { children: ReactNode }) {
  const { data } = useStore()
  const [job, setJob] = useState<PrintJob | null>(null)
  const printTimer = useRef<number | undefined>(undefined)

  const printReceipt = useCallback((order: Order) => setJob({ kind: 'receipt', order }), [])
  const printShift = useCallback((shift: Shift, mode: 'x' | 'z') => setJob({ kind: 'shift', shift, mode }), [])

  useEffect(() => {
    if (!job) return
    document.body.classList.add('print-job')

    function clear() {
      document.body.classList.remove('print-job')
      setJob(null)
      window.removeEventListener('afterprint', clear)
    }
    window.addEventListener('afterprint', clear)

    // Печать после рендера, чтобы контент успел появиться в DOM.
    printTimer.current = window.setTimeout(() => window.print(), 50)

    return () => {
      window.clearTimeout(printTimer.current)
      window.removeEventListener('afterprint', clear)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [job])

  return (
    <PrintContext.Provider value={{ printReceipt, printShift }}>
      {children}
      <div id="print-job-root">
        {job?.kind === 'receipt' && <PrintableReceipt order={job.order} shopName={data.settings.shopName} />}
        {job?.kind === 'shift' && <PrintableShiftReport shift={job.shift} mode={job.mode} shopName={data.settings.shopName} />}
      </div>
    </PrintContext.Provider>
  )
}
