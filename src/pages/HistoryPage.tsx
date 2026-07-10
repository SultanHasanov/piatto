import { useState } from 'react'
import { observer } from 'mobx-react-lite'
import { DatePicker, Empty, Segmented, Tag, Typography } from 'antd'
import { ChevronRight } from 'lucide-react'
import dayjs, { Dayjs } from 'dayjs'
import { useStore } from '../stores/context'
import { formatMoney, formatTime } from '../utils/format'
import type { Order, OrderType } from '../types'
import { OrderDetailModal } from '../components/OrderDetailModal'

export const HistoryPage = observer(function HistoryPage() {
  const { data } = useStore()
  const [day, setDay] = useState<Dayjs>(dayjs())
  const [typeFilter, setTypeFilter] = useState<OrderType | 'all'>('all')
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null)

  const orders = [...data.orders]
    .filter((order) => dayjs(order.ts).isSame(day, 'day'))
    .filter((order) => typeFilter === 'all' || order.orderType === typeFilter)
    .sort((a, b) => (a.ts < b.ts ? 1 : -1))

  const paidOrders = orders.filter((order) => order.status === 'paid')
  const revenue = paidOrders.reduce((sum, order) => sum + order.total, 0)
  const orderTypeOptions = Array.from(
    new Map([
      ...data.settings.orderTypes.filter((orderType) => orderType.enabled).map((orderType) => [orderType.id, orderType.name] as const),
      ...data.orders.map((order) => [order.orderType, order.orderTypeName] as const),
    ]),
  ).map(([value, label]) => ({ value, label }))

  return (
    <div className="page-container">
      <div className="page-header history-header">
        <Typography.Title level={3} style={{ margin: 0 }}>История заказов</Typography.Title>
        <div className="history-filters">
          <Segmented
            value={typeFilter}
            onChange={(value) => setTypeFilter(value as OrderType | 'all')}
            options={[{ label: 'Все', value: 'all' }, ...orderTypeOptions]}
          />
          <DatePicker value={day} onChange={(value) => value && setDay(value)} allowClear={false} />
        </div>
      </div>

      <div className="history-summary">
        {paidOrders.length} заказов · выручка {formatMoney(revenue)}
      </div>

      {orders.length === 0 ? (
        <Empty description="Заказов за этот день нет" style={{ marginTop: 48 }} />
      ) : (
        <div className="order-row-list">
          {orders.map((order) => (
            <button
              type="button"
              className={`order-row ${order.status === 'refunded' ? 'order-row--refunded' : ''}`}
              key={order.clientId}
              onClick={() => setSelectedOrder(order)}
            >
              <div className="order-row-main">
                <div className="order-row-heading">
                  <strong>Заказ №{order.number}</strong>
                  <span>{formatTime(order.ts)}</span>
                  <div className="order-row-tags">
                    <Tag color="blue">{order.payment}</Tag>
                    <Tag color={order.orderType === 'delivery' ? 'orange' : order.orderType === 'vip' ? 'purple' : 'default'}>
                      {order.orderTypeName}
                    </Tag>
                    <Tag color={order.status === 'paid' ? 'green' : 'red'}>
                      {order.status === 'paid' ? 'Оплачен' : 'Возвращён'}
                    </Tag>
                  </div>
                </div>
                <div className="order-row-items">
                  {order.items.map((item) => `${item.name} × ${item.qty}`).join(', ')}
                </div>
              </div>
              <div className="order-row-total">{formatMoney(order.total)}</div>
              <ChevronRight className="order-row-chevron" size={22} />
            </button>
          ))}
        </div>
      )}

      <OrderDetailModal
        order={selectedOrder}
        open={!!selectedOrder}
        onClose={() => setSelectedOrder(null)}
      />
    </div>
  )
})
