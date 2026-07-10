import { useEffect, useMemo, useState } from 'react'
import { observer } from 'mobx-react-lite'
import { Button, Modal, Popconfirm, Select, Space, Tag, Typography } from 'antd'
import { Minus, Plus, Printer, Trash2 } from 'lucide-react'
import { useStore } from '../stores/context'
import { usePrint } from '../print/PrintContext'
import { formatDateTime, formatMoney, formatTime } from '../utils/format'
import type { Order, OrderItem, OrderItemMod, Product } from '../types'
import { ModifierModal } from './ModifierModal'

interface Props {
  order: Order | null
  open: boolean
  onClose: () => void
}

function cloneItems(items: OrderItem[]): OrderItem[] {
  return items.map((item) => ({ ...item, mods: item.mods.map((mod) => ({ ...mod })) }))
}

function itemTotal(item: Pick<OrderItem, 'basePrice' | 'mods' | 'qty'>) {
  return (item.basePrice + item.mods.reduce((sum, mod) => sum + mod.priceDelta, 0)) * item.qty
}

function unitPrice(item: Pick<OrderItem, 'basePrice' | 'mods'>) {
  return item.basePrice + item.mods.reduce((sum, mod) => sum + mod.priceDelta, 0)
}

function modsKey(mods: OrderItemMod[]) {
  return JSON.stringify(
    [...mods]
      .sort((a, b) => a.name.localeCompare(b.name) || a.priceDelta - b.priceDelta)
      .map(({ name, priceDelta }) => [name, priceDelta]),
  )
}

export const OrderDetailModal = observer(function OrderDetailModal({ order, open, onClose }: Props) {
  const { data } = useStore()
  const { printReceipt } = usePrint()
  const [isEditing, setIsEditing] = useState(false)
  const [isRefunding, setIsRefunding] = useState(false)
  const [refundQty, setRefundQty] = useState<Record<number, number>>({})
  const [items, setItems] = useState<OrderItem[]>([])
  const [modifierProduct, setModifierProduct] = useState<Product | null>(null)
  const [selectedProductId, setSelectedProductId] = useState<string>()
  const [payment, setPayment] = useState<string>('')
  const [orderTypeId, setOrderTypeId] = useState<string>('')

  useEffect(() => {
    if (!open || !order) return
    setItems(cloneItems(order.items))
    setIsEditing(false)
    setIsRefunding(false)
    setRefundQty({})
    setModifierProduct(null)
    setSelectedProductId(undefined)
    setPayment(order.payment)
    setOrderTypeId(order.orderType)
  }, [open, order])

  const paymentOptions = useMemo(() => {
    const names = new Set<string>(data.settings.paymentMethods)
    if (order?.payment) names.add(order.payment)
    return Array.from(names).map((name) => ({ label: name, value: name }))
  }, [data.settings.paymentMethods, order?.payment])

  const orderTypeOptions = useMemo(() => {
    const map = new Map<string, string>()
    data.settings.orderTypes
      .filter((orderType) => orderType.enabled)
      .forEach((orderType) => map.set(orderType.id, orderType.name))
    if (order && !map.has(order.orderType)) map.set(order.orderType, order.orderTypeName)
    return Array.from(map).map(([value, label]) => ({ label, value }))
  }, [data.settings.orderTypes, order])

  const selectedOrderTypeConfig = data.settings.orderTypes.find((orderType) => orderType.id === orderTypeId)
  const editSurcharge = selectedOrderTypeConfig
    ? selectedOrderTypeConfig.surcharge
    : orderTypeId === order?.orderType
      ? order?.orderTypeSurcharge ?? 0
      : 0

  const editTotal = useMemo(
    () => items.reduce((sum, item) => sum + item.total, 0) + editSurcharge,
    [items, editSurcharge],
  )

  const refundTotal = useMemo(() => {
    if (!order) return 0
    return order.items.reduce((sum, item, index) => sum + unitPrice(item) * (refundQty[index] ?? 0), 0)
  }, [order, refundQty])

  const refundQtySum = useMemo(
    () => Object.values(refundQty).reduce((sum, qty) => sum + qty, 0),
    [refundQty],
  )

  const availableProducts = data.products.filter((product) => !product.disabled)
  const modifierGroups = modifierProduct
    ? data.modifierGroups.filter((group) => modifierProduct.modifierGroupIds.includes(group.clientId))
    : []

  function resetEditing() {
    if (order) {
      setItems(cloneItems(order.items))
      setPayment(order.payment)
      setOrderTypeId(order.orderType)
    }
    setIsEditing(false)
    setModifierProduct(null)
    setSelectedProductId(undefined)
  }

  function changeQty(index: number, delta: number) {
    setItems((current) => current.map((item, itemIndex) => {
      if (itemIndex !== index) return item
      const qty = Math.max(1, item.qty + delta)
      const next = { ...item, qty }
      return { ...next, total: itemTotal(next) }
    }))
  }

  function removeItem(index: number) {
    setItems((current) => current.filter((_, itemIndex) => itemIndex !== index))
  }

  function addProduct(product: Product, mods: OrderItemMod[] = []) {
    setItems((current) => {
      const existingIndex = current.findIndex(
        (item) => item.productClientId === product.clientId && modsKey(item.mods) === modsKey(mods),
      )
      if (existingIndex === -1) {
        return [
          ...current,
          {
            productClientId: product.clientId,
            name: product.name,
            qty: 1,
            basePrice: product.price,
            mods,
            total: itemTotal({ basePrice: product.price, mods, qty: 1 }),
          },
        ]
      }

      return current.map((item, index) => {
        if (index !== existingIndex) return item
        const next = { ...item, qty: item.qty + 1 }
        return { ...next, total: itemTotal(next) }
      })
    })
  }

  function handleProductSelect(productClientId: string) {
    setSelectedProductId(productClientId)
    const product = data.products.find((item) => item.clientId === productClientId)
    if (!product || product.disabled) {
      setSelectedProductId(undefined)
      return
    }

    const groups = data.modifierGroups.filter((group) => product.modifierGroupIds.includes(group.clientId))
    if (groups.length > 0) {
      setModifierProduct(product)
      return
    }

    addProduct(product)
    setSelectedProductId(undefined)
  }

  function handleModifierConfirm(mods: OrderItemMod[]) {
    if (modifierProduct) addProduct(modifierProduct, mods)
    setModifierProduct(null)
    setSelectedProductId(undefined)
  }

  function handleSave() {
    if (!order || items.length === 0) return
    const orderTypeName = selectedOrderTypeConfig?.name
      ?? (orderTypeId === order.orderType ? order.orderTypeName : orderTypeId)
    data.updateOrderItems(order.clientId, cloneItems(items), {
      payment,
      orderType: orderTypeId,
      orderTypeName,
      orderTypeSurcharge: editSurcharge,
    })
    setIsEditing(false)
  }

  function startRefund() {
    if (!order) return
    const initial: Record<number, number> = {}
    order.items.forEach((_, index) => { initial[index] = 0 })
    setRefundQty(initial)
    setIsRefunding(true)
  }

  function cancelRefund() {
    setIsRefunding(false)
    setRefundQty({})
  }

  function setRefundAll() {
    if (!order) return
    const all: Record<number, number> = {}
    order.items.forEach((item, index) => { all[index] = item.qty })
    setRefundQty(all)
  }

  function changeRefundQty(index: number, delta: number) {
    if (!order) return
    setRefundQty((current) => {
      const max = order.items[index].qty
      const next = Math.max(0, Math.min(max, (current[index] ?? 0) + delta))
      return { ...current, [index]: next }
    })
  }

  function confirmRefund() {
    if (!order) return
    const map = new Map(Object.entries(refundQty).map(([key, qty]) => [Number(key), qty]))
    data.refundOrderItems(order.clientId, map)
    setIsRefunding(false)
    setRefundQty({})
  }

  if (!order) return null

  const isFullRefundSelected = refundQtySum > 0 && order.items.every((item, index) => (refundQty[index] ?? 0) === item.qty)

  return (
    <>
      <Modal
        title={`Заказ №${order.number}`}
        open={open}
        onCancel={onClose}
        width={720}
        footer={null}
      >
        <div className="order-detail-meta">
          <Typography.Text type="secondary">{formatTime(order.ts)}</Typography.Text>
          <Space size={[4, 4]} wrap>
            <Tag color="blue">{order.payment}</Tag>
            <Tag color={order.orderType === 'delivery' ? 'orange' : order.orderType === 'vip' ? 'purple' : 'default'}>
              {order.orderTypeName}
            </Tag>
            <Tag color={order.status === 'paid' ? 'green' : 'red'}>
              {order.status === 'paid' ? 'Оплачен' : 'Возвращён'}
            </Tag>
            {order.refunds && order.refunds.length > 0 && order.status === 'paid' && (
              <Tag color="orange">Возврат части</Tag>
            )}
          </Space>
        </div>

        {isEditing && (
          <div className="order-edit-meta">
            <label className="order-edit-field">
              <Typography.Text strong>Тип заказа</Typography.Text>
              <Select value={orderTypeId} options={orderTypeOptions} onChange={setOrderTypeId} />
            </label>
            <label className="order-edit-field">
              <Typography.Text strong>Оплата</Typography.Text>
              <Select value={payment} options={paymentOptions} onChange={setPayment} />
            </label>
          </div>
        )}

        <div className="order-detail-lines">
          {(isEditing ? items : order.items).map((item, index) => (
            <div className={`order-detail-line ${isEditing || isRefunding ? 'order-detail-line--editing' : ''}`} key={`${item.productClientId}-${modsKey(item.mods)}-${index}`}>
              <div className="order-detail-name">
                <Typography.Text strong>{item.name}</Typography.Text>
                {item.mods.length > 0 && (
                  <div className="order-detail-mods">{item.mods.map((mod) => mod.name).join(', ')}</div>
                )}
              </div>
              {isEditing ? (
                <div className="order-edit-qty">
                  <Button aria-label="Уменьшить количество" icon={<Minus size={16} />} onClick={() => changeQty(index, -1)} />
                  <span>{item.qty}</span>
                  <Button aria-label="Увеличить количество" icon={<Plus size={16} />} onClick={() => changeQty(index, 1)} />
                </div>
              ) : isRefunding ? (
                <div className="order-edit-qty">
                  <Button
                    aria-label="Меньше к возврату"
                    icon={<Minus size={16} />}
                    disabled={(refundQty[index] ?? 0) <= 0}
                    onClick={() => changeRefundQty(index, -1)}
                  />
                  <span>{refundQty[index] ?? 0} / {item.qty}</span>
                  <Button
                    aria-label="Больше к возврату"
                    icon={<Plus size={16} />}
                    disabled={(refundQty[index] ?? 0) >= item.qty}
                    onClick={() => changeRefundQty(index, 1)}
                  />
                </div>
              ) : (
                <div className="order-detail-qty">{item.qty} × {formatMoney(unitPrice(item))}</div>
              )}
              <div className="order-detail-price">{formatMoney(item.total)}</div>
              {isEditing && (
                <Button danger type="text" aria-label="Удалить позицию" icon={<Trash2 size={18} />} onClick={() => removeItem(index)} />
              )}
            </div>
          ))}
        </div>

        {(isEditing ? editSurcharge : order.orderTypeSurcharge) > 0 && (
          <div className="order-detail-surcharge">
            <span>Доплата «{isEditing ? (selectedOrderTypeConfig?.name ?? order.orderTypeName) : order.orderTypeName}»</span>
            <strong>+{formatMoney(isEditing ? editSurcharge : order.orderTypeSurcharge)}</strong>
          </div>
        )}

        {isEditing && (
          <div className="order-edit-add">
            <Typography.Text strong>Добавить товар</Typography.Text>
            <Select
              showSearch
              allowClear
              value={selectedProductId}
              placeholder="Найдите товар"
              optionFilterProp="label"
              options={availableProducts.map((product) => ({ label: product.name, value: product.clientId }))}
              onChange={(value) => value && handleProductSelect(value)}
              onClear={() => setSelectedProductId(undefined)}
            />
          </div>
        )}

        {!isEditing && !isRefunding && order.refunds && order.refunds.length > 0 && (
          <div className="order-refunds-history">
            <Typography.Text strong>Возвраты</Typography.Text>
            {order.refunds.map((refund, index) => (
              <div className="order-refund-row" key={index}>
                <span>{formatDateTime(refund.ts)} · {refund.items.map((item) => `${item.name} ×${item.qty}`).join(', ')}</span>
                <strong>-{formatMoney(refund.amount)}</strong>
              </div>
            ))}
          </div>
        )}

        <div className="order-detail-total">
          <span>{isRefunding ? 'К возврату' : 'Итого'}</span>
          <span>{isRefunding ? formatMoney(refundTotal) : formatMoney(isEditing ? editTotal : order.total)}</span>
        </div>

        {order.status === 'refunded' ? (
          <div className="order-detail-footer">
            <div className="order-refunded-notice">Возврат оформлен</div>
            <Button icon={<Printer size={18} />} onClick={() => printReceipt(order)}>Печать чека</Button>
          </div>
        ) : (
          <div className="order-detail-footer">
            {isEditing ? (
              <>
                <Button onClick={resetEditing}>Отмена</Button>
                <Button type="primary" disabled={items.length === 0} onClick={handleSave}>Сохранить</Button>
              </>
            ) : isRefunding ? (
              <>
                <Button onClick={cancelRefund}>Отмена</Button>
                <Button onClick={setRefundAll}>Вернуть всё</Button>
                <Popconfirm
                  title={isFullRefundSelected ? 'Оформить полный возврат?' : 'Оформить возврат части заказа?'}
                  description="Стоки вернутся на склад. Продолжить?"
                  okText="Оформить возврат"
                  cancelText="Отмена"
                  okButtonProps={{ danger: true, disabled: refundQtySum === 0 }}
                  onConfirm={confirmRefund}
                >
                  <Button danger disabled={refundQtySum === 0}>Вернуть · {formatMoney(refundTotal)}</Button>
                </Popconfirm>
              </>
            ) : (
              <>
                <Button icon={<Printer size={18} />} onClick={() => printReceipt(order)}>Печать чека</Button>
                <Button danger onClick={startRefund}>Возврат</Button>
                <div className="order-detail-footer-main">
                  <Button onClick={onClose}>Закрыть</Button>
                  <Button type="primary" onClick={() => setIsEditing(true)}>Изменить заказ</Button>
                </div>
              </>
            )}
          </div>
        )}
      </Modal>

      {modifierProduct && (
        <ModifierModal
          product={modifierProduct}
          groups={modifierGroups}
          open={!!modifierProduct}
          onCancel={() => {
            setModifierProduct(null)
            setSelectedProductId(undefined)
          }}
          onConfirm={handleModifierConfirm}
        />
      )}
    </>
  )
})
