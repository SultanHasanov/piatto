import type { Order } from '../types'
import { formatDateTime, formatMoney } from '../utils/format'

interface Props {
  order: Order
  shopName: string
}

export function PrintableReceipt({ order, shopName }: Props) {
  const returnedQty = new Map<string, number>()
  order.refunds?.forEach((refund) => {
    refund.items.forEach((item) => {
      returnedQty.set(item.name, (returnedQty.get(item.name) ?? 0) + item.qty)
    })
  })

  return (
    <div className="receipt-print">
      <div className="receipt-print-center">
        <strong>{shopName}</strong>
        <div>Заказ №{order.number}</div>
        <div>{formatDateTime(order.ts)}</div>
        <div>{order.orderTypeName}</div>
      </div>
      <div className="receipt-print-divider" />
      {order.items.map((item, index) => {
        const unitPrice = item.basePrice + item.mods.reduce((s, m) => s + m.priceDelta, 0)
        return (
          <div className="receipt-print-item" key={index}>
            <div className="receipt-print-item-name">{item.name}</div>
            {item.mods.length > 0 && (
              <div className="receipt-print-item-mods">{item.mods.map((m) => m.name).join(', ')}</div>
            )}
            <div className="receipt-print-item-row">
              <span>{item.qty} × {formatMoney(unitPrice)}</span>
              <span>{formatMoney(item.total)}</span>
            </div>
          </div>
        )
      })}
      <div className="receipt-print-divider" />
      {order.orderTypeSurcharge > 0 && (
        <div className="receipt-print-row">
          <span>Доплата «{order.orderTypeName}»</span>
          <span>+{formatMoney(order.orderTypeSurcharge)}</span>
        </div>
      )}
      <div className="receipt-print-total">
        <span>ИТОГО</span>
        <span>{formatMoney(order.total)}</span>
      </div>
      <div className="receipt-print-row">
        <span>Оплата</span>
        <span>{order.payment}</span>
      </div>
      {order.refunds && order.refunds.length > 0 && (
        <>
          <div className="receipt-print-divider" />
          <div className="receipt-print-center">ВОЗВРАТ</div>
          {order.refunds.map((refund, index) => (
            <div className="receipt-print-row" key={index}>
              <span>{formatDateTime(refund.ts)}</span>
              <span>-{formatMoney(refund.amount)}</span>
            </div>
          ))}
        </>
      )}
      <div className="receipt-print-divider" />
      <div className="receipt-print-center receipt-print-thanks">Спасибо за покупку!</div>
    </div>
  )
}
