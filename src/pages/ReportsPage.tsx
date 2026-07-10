import { useMemo, useState } from 'react'
import { observer } from 'mobx-react-lite'
import { Button, DatePicker, Empty, Segmented, Table, Typography } from 'antd'
import { FileDown } from 'lucide-react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import dayjs, { Dayjs } from 'dayjs'
import { useStore } from '../stores/context'
import { formatMoney } from '../utils/format'
import { calculateRevenueStats } from '../domain/orderMath'
import type { OrderType } from '../types'

const { RangePicker } = DatePicker

// Validated categorical palette (dataviz skill, light surface) — fixed order.
const SERIES = {
  revenue: '#2a78d6',
  orders: '#1baf7a',
}
const CATEGORICAL = ['#2a78d6', '#1baf7a', '#eda100', '#008300', '#4a3aa7', '#e34948', '#e87ba4', '#eb6834']

const INK = { primary: '#0b0b0b', muted: '#898781', grid: '#e1e0d9' }

function shortMoney(value: number): string {
  if (Math.abs(value) >= 1000) return `${(value / 1000).toFixed(value % 1000 === 0 ? 0 : 1)}к`
  return String(Math.round(value))
}

function eachDay(from: Dayjs, to: Dayjs): Dayjs[] {
  const days: Dayjs[] = []
  let cursor = from.startOf('day')
  const end = to.startOf('day')
  while (!cursor.isAfter(end)) {
    days.push(cursor)
    cursor = cursor.add(1, 'day')
  }
  return days
}

export const ReportsPage = observer(function ReportsPage() {
  const { data } = useStore()
  const [range, setRange] = useState<[Dayjs, Dayjs]>([dayjs().subtract(6, 'day').startOf('day'), dayjs().endOf('day')])
  const [typeFilter, setTypeFilter] = useState<OrderType | 'all'>('all')
  const [paymentFilter, setPaymentFilter] = useState<string>('all')

  const orderTypeOptions = useMemo(
    () =>
      Array.from(
        new Map([
          ...data.settings.orderTypes
            .filter((orderType) => orderType.enabled)
            .map((orderType) => [orderType.id, orderType.name] as const),
          ...data.orders.map((order) => [order.orderType, order.orderTypeName] as const),
        ]),
      ).map(([value, label]) => ({ value, label })),
    [data.settings.orderTypes, data.orders],
  )
  const paymentOptions = useMemo(
    () =>
      Array.from(new Set([...data.settings.paymentMethods, ...data.orders.map((order) => order.payment)])).map(
        (name) => ({ value: name, label: name }),
      ),
    [data.settings.paymentMethods, data.orders],
  )

  const paidOrders = useMemo(
    () =>
      data.orders.filter((order) => {
        const timestamp = dayjs(order.ts)
        return (
          order.status === 'paid' &&
          !timestamp.isBefore(range[0]) &&
          !timestamp.isAfter(range[1]) &&
          (typeFilter === 'all' || order.orderType === typeFilter) &&
          (paymentFilter === 'all' || order.payment === paymentFilter)
        )
      }),
    [data.orders, range, typeFilter, paymentFilter],
  )

  const { revenue, averageCheck: avgCheck } = calculateRevenueStats(paidOrders)
  const itemsSold = useMemo(
    () => paidOrders.reduce((sum, order) => sum + order.items.reduce((s, item) => s + item.qty, 0), 0),
    [paidOrders],
  )

  const days = useMemo(() => eachDay(range[0], range[1]), [range])

  const byDay = useMemo(() => {
    const map = new Map<string, { revenue: number; orders: number }>()
    days.forEach((day) => map.set(day.format('YYYY-MM-DD'), { revenue: 0, orders: 0 }))
    paidOrders.forEach((order) => {
      const key = dayjs(order.ts).format('YYYY-MM-DD')
      const cur = map.get(key)
      if (cur) {
        cur.revenue += order.total
        cur.orders += 1
      }
    })
    return days.map((day) => {
      const key = day.format('YYYY-MM-DD')
      const cur = map.get(key)!
      return { key, label: day.format('DD.MM'), revenue: cur.revenue, orders: cur.orders }
    })
  }, [days, paidOrders])

  const byOrderType = useMemo(() => {
    const map = new Map<string, { name: string; count: number; total: number }>()
    paidOrders.forEach((order) => {
      const cur = map.get(order.orderType) ?? { name: order.orderTypeName, count: 0, total: 0 }
      cur.count += 1
      cur.total += order.total
      map.set(order.orderType, cur)
    })
    return Array.from(map.entries()).map(([id, values]) => ({ id, ...values }))
  }, [paidOrders])

  const byPayment = useMemo(() => {
    const map = new Map<string, number>()
    paidOrders.forEach((order) => map.set(order.payment, (map.get(order.payment) ?? 0) + order.total))
    return Array.from(map.entries())
      .map(([payment, total]) => ({ payment, total }))
      .sort((a, b) => b.total - a.total)
  }, [paidOrders])

  const topItems = useMemo(() => {
    const map = new Map<string, { productClientId: string; name: string; qty: number; total: number }>()
    paidOrders.forEach((order) =>
      order.items.forEach((item) => {
        const cur = map.get(item.productClientId) ?? {
          productClientId: item.productClientId,
          name: data.products.find((product) => product.clientId === item.productClientId)?.name ?? item.name,
          qty: 0,
          total: 0,
        }
        cur.qty += item.qty
        cur.total += item.total
        map.set(item.productClientId, cur)
      }),
    )
    return Array.from(map.values()).sort((a, b) => b.qty - a.qty)
  }, [paidOrders, data.products])

  // Матрица «товар × день» — только для обозримого периода.
  const matrixTooLong = days.length > 31
  const productMatrix = useMemo(() => {
    if (matrixTooLong) return []
    const map = new Map<string, { name: string; perDay: Record<string, number>; qty: number; total: number }>()
    paidOrders.forEach((order) => {
      const dayKey = dayjs(order.ts).format('YYYY-MM-DD')
      order.items.forEach((item) => {
        const row = map.get(item.productClientId) ?? {
          name: data.products.find((product) => product.clientId === item.productClientId)?.name ?? item.name,
          perDay: {},
          qty: 0,
          total: 0,
        }
        row.perDay[dayKey] = (row.perDay[dayKey] ?? 0) + item.qty
        row.qty += item.qty
        row.total += item.total
        map.set(item.productClientId, row)
      })
    })
    return Array.from(map.entries())
      .map(([productClientId, row]) => ({ productClientId, ...row }))
      .sort((a, b) => b.qty - a.qty)
  }, [matrixTooLong, paidOrders, data.products])

  const periodLabel = `${range[0].format('DD.MM.YYYY')} — ${range[1].format('DD.MM.YYYY')}`

  const rangePresets = [
    { label: 'Сегодня', value: [dayjs().startOf('day'), dayjs().endOf('day')] as [Dayjs, Dayjs] },
    { label: 'Вчера', value: [dayjs().subtract(1, 'day').startOf('day'), dayjs().subtract(1, 'day').endOf('day')] as [Dayjs, Dayjs] },
    { label: '7 дней', value: [dayjs().subtract(6, 'day').startOf('day'), dayjs().endOf('day')] as [Dayjs, Dayjs] },
    { label: '30 дней', value: [dayjs().subtract(29, 'day').startOf('day'), dayjs().endOf('day')] as [Dayjs, Dayjs] },
    { label: 'Этот месяц', value: [dayjs().startOf('month'), dayjs().endOf('day')] as [Dayjs, Dayjs] },
  ]

  return (
    <div className="page-container">
      <div className="report-toolbar">
        <Typography.Title level={3} style={{ margin: 0 }}>Отчёты</Typography.Title>
        <Button type="primary" icon={<FileDown size={18} />} onClick={() => window.print()} className="report-export-btn">
          Экспорт в PDF
        </Button>
      </div>

      <div className="report-filters">
        <RangePicker
          value={range}
          presets={rangePresets}
          onChange={(v) => {
            if (v && v[0] && v[1]) setRange([v[0].startOf('day'), v[1].endOf('day')])
          }}
          allowClear={false}
        />
        <Segmented
          value={typeFilter}
          onChange={(value) => setTypeFilter(value as OrderType | 'all')}
          options={[{ label: 'Все типы', value: 'all' }, ...orderTypeOptions]}
        />
        <Segmented
          value={paymentFilter}
          onChange={(value) => setPaymentFilter(value as string)}
          options={[{ label: 'Вся оплата', value: 'all' }, ...paymentOptions]}
        />
      </div>

      <div id="report-print-area">
        <div className="report-print-header">
          <strong>{data.settings.shopName}</strong>
          <span>Отчёт за период {periodLabel}</span>
          <span>Сформирован {dayjs().format('DD.MM.YYYY HH:mm')}</span>
        </div>

        <div className="report-kpis">
          <div className="report-kpi">
            <span className="report-kpi-label">Выручка</span>
            <span className="report-kpi-value">{formatMoney(revenue)}</span>
          </div>
          <div className="report-kpi">
            <span className="report-kpi-label">Заказов</span>
            <span className="report-kpi-value">{paidOrders.length}</span>
          </div>
          <div className="report-kpi">
            <span className="report-kpi-label">Средний чек</span>
            <span className="report-kpi-value">{formatMoney(avgCheck)}</span>
          </div>
          <div className="report-kpi">
            <span className="report-kpi-label">Продано позиций</span>
            <span className="report-kpi-value">{itemsSold} шт</span>
          </div>
        </div>

        <div className="report-charts">
          <div className="report-card report-card--wide">
            <div className="report-card-title">Выручка по дням</div>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={byDay} margin={{ top: 8, right: 8, bottom: 0, left: 8 }}>
                <CartesianGrid stroke={INK.grid} vertical={false} />
                <XAxis dataKey="label" tick={{ fill: INK.muted, fontSize: 12 }} tickLine={false} axisLine={{ stroke: INK.grid }} minTickGap={12} />
                <YAxis tick={{ fill: INK.muted, fontSize: 12 }} tickLine={false} axisLine={false} width={44} tickFormatter={shortMoney} />
                <Tooltip
                  cursor={{ fill: 'rgba(42,120,214,0.08)' }}
                  formatter={(value) => [formatMoney(Number(value)), 'Выручка']}
                  labelFormatter={(label) => `День ${label}`}
                />
                <Bar dataKey="revenue" fill={SERIES.revenue} radius={[4, 4, 0, 0]} maxBarSize={48} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="report-card report-card--wide">
            <div className="report-card-title">Заказы по дням</div>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={byDay} margin={{ top: 8, right: 8, bottom: 0, left: 8 }}>
                <CartesianGrid stroke={INK.grid} vertical={false} />
                <XAxis dataKey="label" tick={{ fill: INK.muted, fontSize: 12 }} tickLine={false} axisLine={{ stroke: INK.grid }} minTickGap={12} />
                <YAxis tick={{ fill: INK.muted, fontSize: 12 }} tickLine={false} axisLine={false} width={32} allowDecimals={false} />
                <Tooltip
                  cursor={{ fill: 'rgba(27,175,122,0.08)' }}
                  formatter={(value) => [Number(value), 'Заказов']}
                  labelFormatter={(label) => `День ${label}`}
                />
                <Bar dataKey="orders" fill={SERIES.orders} radius={[4, 4, 0, 0]} maxBarSize={48} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="report-card">
            <div className="report-card-title">Оплата</div>
            {byPayment.length === 0 ? (
              <Empty description="Нет данных" image={Empty.PRESENTED_IMAGE_SIMPLE} />
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <PieChart>
                  <Pie data={byPayment} dataKey="total" nameKey="payment" innerRadius={55} outerRadius={90} paddingAngle={2}>
                    {byPayment.map((entry, index) => (
                      <Cell key={entry.payment} fill={CATEGORICAL[index % CATEGORICAL.length]} stroke="#fff" strokeWidth={2} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value, name) => [formatMoney(Number(value)), name as string]} />
                  <Legend verticalAlign="bottom" height={36} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>

          <div className="report-card">
            <div className="report-card-title">Топ-10 товаров</div>
            {topItems.length === 0 ? (
              <Empty description="Нет данных" image={Empty.PRESENTED_IMAGE_SIMPLE} />
            ) : (
              <ResponsiveContainer width="100%" height={Math.max(240, topItems.slice(0, 10).length * 34)}>
                <BarChart
                  layout="vertical"
                  data={topItems.slice(0, 10)}
                  margin={{ top: 4, right: 16, bottom: 4, left: 8 }}
                >
                  <CartesianGrid stroke={INK.grid} horizontal={false} />
                  <XAxis type="number" tick={{ fill: INK.muted, fontSize: 12 }} tickLine={false} axisLine={false} allowDecimals={false} />
                  <YAxis type="category" dataKey="name" tick={{ fill: INK.primary, fontSize: 12 }} tickLine={false} axisLine={false} width={120} />
                  <Tooltip
                    cursor={{ fill: 'rgba(42,120,214,0.08)' }}
                    formatter={(value, _name, item) => [
                      `${Number(value)} шт · ${formatMoney(item?.payload?.total ?? 0)}`,
                      item?.payload?.name,
                    ]}
                  />
                  <Bar dataKey="qty" fill={SERIES.revenue} radius={[0, 4, 4, 0]} maxBarSize={24} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="report-card report-card--table">
          <div className="report-card-title">Продажи товаров по дням</div>
          {matrixTooLong ? (
            <Typography.Text type="secondary">
              Для помесячной детализации по дням выберите период до 31 дня.
            </Typography.Text>
          ) : productMatrix.length === 0 ? (
            <Empty description="Нет продаж за период" image={Empty.PRESENTED_IMAGE_SIMPLE} />
          ) : (
            <Table
              size="middle"
              pagination={false}
              rowKey="productClientId"
              scroll={{ x: 'max-content' }}
              dataSource={productMatrix}
              columns={[
                { title: 'Товар', dataIndex: 'name', fixed: 'left', width: 180 },
                ...days.map((day) => ({
                  title: day.format('DD.MM'),
                  key: day.format('YYYY-MM-DD'),
                  align: 'center' as const,
                  render: (_: unknown, row: (typeof productMatrix)[number]) => row.perDay[day.format('YYYY-MM-DD')] || '',
                })),
                {
                  title: 'Итого, шт',
                  dataIndex: 'qty',
                  align: 'right' as const,
                  render: (value: number) => <strong>{value}</strong>,
                },
                {
                  title: 'Выручка',
                  dataIndex: 'total',
                  align: 'right' as const,
                  render: (value: number) => formatMoney(value),
                },
              ]}
              summary={() => (
                <Table.Summary fixed>
                  <Table.Summary.Row>
                    <Table.Summary.Cell index={0}>
                      <strong>Выручка по дням</strong>
                    </Table.Summary.Cell>
                    {days.map((day, dayIndex) => {
                      const dayData = byDay.find((entry) => entry.key === day.format('YYYY-MM-DD'))
                      return (
                        <Table.Summary.Cell key={day.format('YYYY-MM-DD')} index={dayIndex + 1} align="center">
                          {dayData && dayData.revenue > 0 ? shortMoney(dayData.revenue) : ''}
                        </Table.Summary.Cell>
                      )
                    })}
                    <Table.Summary.Cell index={days.length + 1} align="right">
                      <strong>{itemsSold}</strong>
                    </Table.Summary.Cell>
                    <Table.Summary.Cell index={days.length + 2} align="right">
                      <strong>{formatMoney(revenue)}</strong>
                    </Table.Summary.Cell>
                  </Table.Summary.Row>
                </Table.Summary>
              )}
            />
          )}
        </div>

        <div className="report-charts report-charts--tables">
          <div className="report-card">
            <div className="report-card-title">По типам заказа</div>
            <Table
              size="middle"
              pagination={false}
              rowKey="id"
              scroll={{ x: true }}
              dataSource={byOrderType}
              columns={[
                { title: 'Тип заказа', dataIndex: 'name' },
                { title: 'Заказов', dataIndex: 'count', align: 'right' },
                { title: 'Выручка', dataIndex: 'total', align: 'right', render: (value) => formatMoney(value) },
              ]}
            />
          </div>

          <div className="report-card">
            <div className="report-card-title">По способам оплаты</div>
            <Table
              size="middle"
              pagination={false}
              rowKey="payment"
              scroll={{ x: true }}
              dataSource={byPayment}
              columns={[
                { title: 'Способ', dataIndex: 'payment' },
                { title: 'Сумма', dataIndex: 'total', align: 'right', render: (v) => formatMoney(v) },
              ]}
            />
          </div>
        </div>
      </div>
    </div>
  )
})
