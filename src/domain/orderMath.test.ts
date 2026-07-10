import { describe, expect, it } from 'vitest'
import { calculateOrderTotal, calculateRevenueStats, calculateShiftSummary } from './orderMath'
import type { Order, OrderItem } from '../types'

const item = (total: number): OrderItem => ({
  productClientId: crypto.randomUUID(),
  name: 'Товар',
  qty: 1,
  basePrice: total,
  mods: [],
  total,
})

const order = (status: Order['status'], total: number, overrides: Partial<Order> = {}): Order => ({
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
  ...overrides,
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

describe('shift summary', () => {
  const shiftStart = '2026-07-11T08:00:00.000Z'
  const shiftEnd = '2026-07-11T20:00:00.000Z'
  const inShift = (offsetHours: number) => new Date(new Date(shiftStart).getTime() + offsetHours * 3600_000).toISOString()

  it('computes expected cash from opening balance, cash sales, refunds and movements', () => {
    const orders = [
      order('paid', 500, { payment: 'Наличные', ts: inShift(1) }),
      order('paid', 300, { payment: 'Карта', ts: inShift(2) }),
      order('refunded', 200, { payment: 'Наличные', ts: inShift(3), refundedAt: inShift(4) }),
    ]
    const movements = [
      { id: '1', ts: inShift(5), kind: 'in' as const, amount: 1000 },
      { id: '2', ts: inShift(6), kind: 'out' as const, amount: 400 },
    ]

    const summary = calculateShiftSummary(orders, 2000, movements, shiftStart, shiftEnd)

    expect(summary.ordersCount).toBe(2) // только заказы со status='paid' попадают в ordersCount/revenue
    expect(summary.revenue).toBe(800)
    expect(summary.cashSalesTotal).toBe(500)
    expect(summary.refundsTotal).toBe(200)
    expect(summary.cashRefundsTotal).toBe(200)
    expect(summary.cashIn).toBe(1000)
    expect(summary.cashOut).toBe(400)
    // 2000 + 500 (нал. продажи) - 200 (нал. возврат) + 1000 (внесение) - 400 (изъятие)
    expect(summary.expectedCash).toBe(2900)
  })

  it('excludes orders and movements outside the shift window', () => {
    const orders = [
      order('paid', 500, { payment: 'Наличные', ts: '2026-07-10T10:00:00.000Z' }),
      order('paid', 500, { payment: 'Наличные', ts: inShift(1) }),
    ]
    const summary = calculateShiftSummary(orders, 0, [], shiftStart, shiftEnd)
    expect(summary.ordersCount).toBe(1)
    expect(summary.revenue).toBe(500)
  })
})
