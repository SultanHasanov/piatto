import type { Order, OrderItem } from '../types'

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
