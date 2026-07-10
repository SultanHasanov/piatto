import { useState } from 'react'
import { observer } from 'mobx-react-lite'
import { Statistic, Row, Col, Table, Typography, DatePicker } from 'antd'
import dayjs, { Dayjs } from 'dayjs'
import { useStore } from '../stores/context'
import { formatMoney } from '../utils/format'
import { calculateRevenueStats } from '../domain/orderMath'

const { RangePicker } = DatePicker

export const ReportsPage = observer(function ReportsPage() {
  const { data } = useStore()
  const [range, setRange] = useState<[Dayjs, Dayjs]>([dayjs().startOf('day'), dayjs().endOf('day')])

  const paidOrders = data.orders.filter((order) => {
    const timestamp = dayjs(order.ts)
    return order.status === 'paid' && !timestamp.isBefore(range[0]) && !timestamp.isAfter(range[1])
  })

  const { revenue, averageCheck: avgCheck } = calculateRevenueStats(paidOrders)

  const byOrderType = (() => {
    const map = new Map<string, { name: string; count: number; total: number }>()
    paidOrders.forEach((order) => {
      const current = map.get(order.orderType) ?? { name: order.orderTypeName, count: 0, total: 0 }
      current.count += 1
      current.total += order.total
      map.set(order.orderType, current)
    })
    return Array.from(map.entries()).map(([id, values]) => ({ id, ...values }))
  })()

  const byPayment = (() => {
    const map = new Map<string, number>()
    paidOrders.forEach((o) => map.set(o.payment, (map.get(o.payment) ?? 0) + o.total))
    return Array.from(map.entries()).map(([payment, total]) => ({ payment, total }))
  })()

  const topItems = (() => {
    const map = new Map<string, { productClientId: string; name: string; qty: number; total: number }>()
    paidOrders.forEach((o) =>
      o.items.forEach((i) => {
        const cur = map.get(i.productClientId) ?? {
          productClientId: i.productClientId,
          name: data.products.find((product) => product.clientId === i.productClientId)?.name ?? i.name,
          qty: 0,
          total: 0,
        }
        cur.qty += i.qty
        cur.total += i.total
        map.set(i.productClientId, cur)
      })
    )
    return Array.from(map.values()).sort((a, b) => b.qty - a.qty).slice(0, 10)
  })()

  return (
    <div className="page-container">
      <div className="page-header">
        <Typography.Title level={3} style={{ margin: 0 }}>Отчёты</Typography.Title>
        <RangePicker
          value={range}
          onChange={(v) => {
            if (v && v[0] && v[1]) setRange([v[0].startOf('day'), v[1].endOf('day')])
          }}
          allowClear={false}
        />
      </div>

      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={8}>
          <Statistic title="Выручка" value={revenue} precision={2} suffix="₽" />
        </Col>
        <Col span={8}>
          <Statistic title="Заказов" value={paidOrders.length} />
        </Col>
        <Col span={8}>
          <Statistic title="Средний чек" value={avgCheck} precision={2} suffix="₽" />
        </Col>
      </Row>

      <Typography.Title level={5}>По типам заказа</Typography.Title>
      <Table
        size="small"
        pagination={false}
        rowKey="id"
        dataSource={byOrderType}
        columns={[
          { title: 'Тип заказа', dataIndex: 'name' },
          { title: 'Заказов', dataIndex: 'count' },
          { title: 'Выручка', dataIndex: 'total', render: (value) => formatMoney(value) },
        ]}
        style={{ marginBottom: 24 }}
      />

      <Typography.Title level={5}>По способам оплаты</Typography.Title>
      <Table
        size="small"
        pagination={false}
        rowKey="payment"
        dataSource={byPayment}
        columns={[
          { title: 'Способ', dataIndex: 'payment' },
          { title: 'Сумма', dataIndex: 'total', render: (v) => formatMoney(v) },
        ]}
        style={{ marginBottom: 24 }}
      />

      <Typography.Title level={5}>Топ позиций</Typography.Title>
      <Table
        size="small"
        pagination={false}
        rowKey="productClientId"
        dataSource={topItems}
        columns={[
          { title: 'Товар', dataIndex: 'name' },
          { title: 'Кол-во', dataIndex: 'qty' },
          { title: 'Сумма', dataIndex: 'total', render: (v) => formatMoney(v) },
        ]}
      />
    </div>
  )
})
