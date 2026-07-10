import { observer } from 'mobx-react-lite'
import type { Shift } from '../types'
import { useStore } from '../stores/context'
import { formatDateTime, formatMoney } from '../utils/format'

interface Props {
  shift: Shift
  mode: 'x' | 'z'
  shopName: string
}

export const PrintableShiftReport = observer(function PrintableShiftReport({ shift, mode, shopName }: Props) {
  const { data } = useStore()
  const summary = mode === 'z' && shift.closing ? shift.closing.summary : data.shiftSummary(shift)

  return (
    <div className="receipt-print">
      <div className="receipt-print-center">
        <strong>{shopName}</strong>
        <div>{mode === 'x' ? 'X-ОТЧЁТ (текущая смена)' : 'Z-ОТЧЁТ (закрытие смены)'}</div>
        <div>Открыта: {formatDateTime(shift.openedAt)}</div>
        {shift.closedAt && <div>Закрыта: {formatDateTime(shift.closedAt)}</div>}
        <div>Сформирован: {formatDateTime(new Date().toISOString())}</div>
      </div>
      <div className="receipt-print-divider" />

      <div className="receipt-print-row"><span>Заказов</span><span>{summary.ordersCount}</span></div>
      <div className="receipt-print-row"><span>Продано, шт</span><span>{summary.itemsSold}</span></div>
      <div className="receipt-print-row"><span>Выручка</span><span>{formatMoney(summary.revenue)}</span></div>

      <div className="receipt-print-divider" />
      <div className="receipt-print-center">По способам оплаты</div>
      {summary.byPayment.map((row) => (
        <div className="receipt-print-row" key={row.payment}>
          <span>{row.payment} ({row.orders})</span>
          <span>{formatMoney(row.total)}</span>
        </div>
      ))}

      <div className="receipt-print-divider" />
      <div className="receipt-print-row"><span>Возвратов</span><span>{summary.refundsCount}</span></div>
      <div className="receipt-print-row"><span>Сумма возвратов</span><span>{formatMoney(summary.refundsTotal)}</span></div>

      <div className="receipt-print-divider" />
      <div className="receipt-print-center">Наличные</div>
      <div className="receipt-print-row"><span>На начало смены</span><span>{formatMoney(shift.openingCash)}</span></div>
      <div className="receipt-print-row"><span>Продажи наличными</span><span>{formatMoney(summary.cashSalesTotal)}</span></div>
      <div className="receipt-print-row"><span>Возвраты наличными</span><span>-{formatMoney(summary.cashRefundsTotal)}</span></div>
      <div className="receipt-print-row"><span>Внесено</span><span>+{formatMoney(summary.cashIn)}</span></div>
      <div className="receipt-print-row"><span>Изъято</span><span>-{formatMoney(summary.cashOut)}</span></div>
      <div className="receipt-print-total"><span>Ожидается в кассе</span><span>{formatMoney(summary.expectedCash)}</span></div>
      {mode === 'z' && shift.closing && (
        <>
          <div className="receipt-print-row"><span>Фактически</span><span>{formatMoney(shift.closing.actualCash)}</span></div>
          <div className="receipt-print-row">
            <span>Расхождение</span>
            <span>{formatMoney(shift.closing.actualCash - shift.closing.expectedCash)}</span>
          </div>
        </>
      )}

      <div className="receipt-print-divider" />
      <div className="receipt-print-center receipt-print-thanks">
        {mode === 'z' ? 'Смена закрыта' : 'Смена продолжается'}
      </div>
    </div>
  )
})
