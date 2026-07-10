import { describe, expect, it } from 'vitest'
import { calculateOrderTotal, calculateRevenueStats } from './orderMath'
import type { Order, OrderItem } from '../types'

const item = (total: number): OrderItem => ({
  productClientId: crypto.randomUUID(),
  name: 'Товар',
  qty: 1,
  basePrice: total,
  mods: [],
  total,
})

const order = (status: Order['status'], total: number): Order => ({
  clientId: crypto.randomUUID(),
  type: 'order',
  updatedAt: new Date().toISOString(),
  number: 1,
  ts: new Date().toISOString(),
  items: [item(total)],
  total,
  payment: 'Карта',
  orderType: 'dine-in',
  orderTypeName: 'Зал',
  orderTypeSurcharge: 0,
  status,
})

describe('order totals', () => {
  it('adds the order type surcharge exactly once', () => {
    expect(calculateOrderTotal([item(100), item(250)], 120)).toBe(470)
  })

  it('excludes refunded orders from revenue, count and average check', () => {
    const result = calculateRevenueStats([
      order('paid', 100),
      order('paid', 300),
      order('refunded', 900),
    ])
    expect(result.paidOrders).toHaveLength(2)
    expect(result.revenue).toBe(400)
    expect(result.averageCheck).toBe(200)
  })

  it('returns a zero average when there are no paid orders', () => {
    expect(calculateRevenueStats([order('refunded', 500)]).averageCheck).toBe(0)
  })
})
