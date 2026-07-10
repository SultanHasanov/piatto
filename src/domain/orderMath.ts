import type { CashMovement, Order, OrderItem, ShiftPaymentBreakdown, ShiftSummary } from '../types'

export function calculateOrderTotal(items: OrderItem[], surcharge = 0): number {
  return items.reduce((sum, item) => sum + item.total, 0) + surcharge
}

export function calculateRevenueStats(orders: Order[]) {
  const paidOrders = orders.filter((order) => order.status === 'paid')
  const revenue = paidOrders.reduce((sum, order) => sum + order.total, 0)
  return {
    paidOrders,
    revenue,
    averageCheck: paidOrders.length ? revenue / paidOrders.length : 0,
  }
}

function isCashMethod(method: string): boolean {
  return method.toLocaleLowerCase('ru-RU').includes('налич')
}

/**
 * Считает X/Z-сводку смены по заказам, оформленным в её окне [from, to).
 * Возвраты учитываются по времени самого возврата (order.refundedAt / refunds[].ts),
 * а не по времени исходного заказа — так возврат вчерашнего заказа попадает в смену,
 * в которую его фактически оформили.
 */
export function calculateShiftSummary(
  orders: Order[],
  openingCash: number,
  cashMovements: CashMovement[],
  from: string,
  to?: string,
): ShiftSummary {
  const fromTime = new Date(from).getTime()
  const toTime = to ? new Date(to).getTime() : Infinity

  const inWindow = (ts: string) => {
    const t = new Date(ts).getTime()
    return t >= fromTime && t < toTime
  }

  // Заказ, который позже полностью вернули, не должен считаться продажей смены —
  // сама сумма возврата учитывается отдельно ниже, по времени возврата.
  const ordersInShift = orders.filter((order) => order.status === 'paid' && inWindow(order.ts))

  const byPaymentMap = new Map<string, ShiftPaymentBreakdown>()
  let revenue = 0
  let itemsSold = 0
  ordersInShift.forEach((order) => {
    revenue += order.total
    itemsSold += order.items.reduce((sum, item) => sum + item.qty, 0)
    const current = byPaymentMap.get(order.payment) ?? { payment: order.payment, orders: 0, total: 0 }
    current.orders += 1
    current.total += order.total
    byPaymentMap.set(order.payment, current)
  })

  let cashSalesTotal = 0
  ordersInShift.forEach((order) => {
    if (isCashMethod(order.payment)) cashSalesTotal += order.total
  })

  let refundsTotal = 0
  let refundsCount = 0
  let cashRefundsTotal = 0
  orders.forEach((order) => {
    const refundEvents: { ts: string; amount: number }[] = []
    if (order.status === 'refunded' && order.refundedAt && (!order.refunds || order.refunds.length === 0)) {
      // Полный возврат без частичной истории — сумма исходного заказа (total не меняется при полном возврате).
      refundEvents.push({ ts: order.refundedAt, amount: order.total })
    }
    order.refunds?.forEach((refund) => refundEvents.push({ ts: refund.ts, amount: refund.amount }))
    refundEvents.forEach((event) => {
      if (!inWindow(event.ts)) return
      refundsTotal += event.amount
      refundsCount += 1
      if (isCashMethod(order.payment)) cashRefundsTotal += event.amount
    })
  })

  const movementsInShift = cashMovements.filter((movement) => inWindow(movement.ts))
  const cashIn = movementsInShift.filter((m) => m.kind === 'in').reduce((sum, m) => sum + m.amount, 0)
  const cashOut = movementsInShift.filter((m) => m.kind === 'out').reduce((sum, m) => sum + m.amount, 0)

  const expectedCash = openingCash + cashSalesTotal - cashRefundsTotal + cashIn - cashOut

  return {
    revenue,
    ordersCount: ordersInShift.length,
    itemsSold,
    byPayment: Array.from(byPaymentMap.values()).sort((a, b) => b.total - a.total),
    refundsTotal,
    refundsCount,
    cashSalesTotal,
    cashRefundsTotal,
    cashIn,
    cashOut,
    expectedCash,
  }
}
