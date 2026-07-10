import { useEffect, useMemo, useState } from 'react'
import { observer } from 'mobx-react-lite'
import { Button, Modal, Popconfirm, Select, Space, Tag, Typography } from 'antd'
import { Minus, Plus, Trash2 } from 'lucide-react'
import { useStore } from '../stores/context'
import { formatMoney, formatTime } from '../utils/format'
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

function modsKey(mods: OrderItemMod[]) {
  return JSON.stringify(
    [...mods]
      .sort((a, b) => a.name.localeCompare(b.name) || a.priceDelta - b.priceDelta)
      .map(({ name, priceDelta }) => [name, priceDelta]),
  )
}

export const OrderDetailModal = observer(function OrderDetailModal({ order, open, onClose }: Props) {
  const { data } = useStore()
  const [isEditing, setIsEditing] = useState(false)
  const [items, setItems] = useState<OrderItem[]>([])
  const [modifierProduct, setModifierProduct] = useState<Product | null>(null)
  const [selectedProductId, setSelectedProductId] = useState<string>()

  useEffect(() => {
    if (!open || !order) return
    setItems(cloneItems(order.items))
    setIsEditing(false)
    setModifierProduct(null)
    setSelectedProductId(undefined)
  }, [open, order])

  const editTotal = useMemo(
    () => items.reduce((sum, item) => sum + item.total, 0) + (order?.orderTypeSurcharge ?? 0),
    [items, order?.orderTypeSurcharge],
  )

  const availableProducts = data.products.filter((product) => !product.disabled)
  const modifierGroups = modifierProduct
    ? data.modifierGroups.filter((group) => modifierProduct.modifierGroupIds.includes(group.clientId))
    : []

  function resetEditing() {
    if (order) setItems(cloneItems(order.items))
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
    data.updateOrderItems(order.clientId, cloneItems(items))
    setIsEditing(false)
  }

  function handleRefund() {
    if (!order) return
    data.refundOrder(order.clientId)
    setIsEditing(false)
  }

  if (!order) return null

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
          </Space>
        </div>

        <div className="order-detail-lines">
          {(isEditing ? items : order.items).map((item, index) => (
            <div className={`order-detail-line ${isEditing ? 'order-detail-line--editing' : ''}`} key={`${item.productClientId}-${modsKey(item.mods)}-${index}`}>
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
              ) : (
                <div className="order-detail-qty">{item.qty} × {formatMoney(item.basePrice + item.mods.reduce((sum, mod) => sum + mod.priceDelta, 0))}</div>
              )}
              <div className="order-detail-price">{formatMoney(item.total)}</div>
              {isEditing && (
                <Button danger type="text" aria-label="Удалить позицию" icon={<Trash2 size={18} />} onClick={() => removeItem(index)} />
              )}
            </div>
          ))}
        </div>

        {order.orderTypeSurcharge > 0 && (
          <div className="order-detail-surcharge">
            <span>Доплата «{order.orderTypeName}»</span>
            <strong>+{formatMoney(order.orderTypeSurcharge)}</strong>
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

        <div className="order-detail-total">
          <span>Итого</span>
          <span>{formatMoney(isEditing ? editTotal : order.total)}</span>
        </div>

        {order.status === 'refunded' ? (
          <div className="order-refunded-notice">Возврат оформлен</div>
        ) : (
          <div className="order-detail-footer">
            {isEditing ? (
              <>
                <Button onClick={resetEditing}>Отмена</Button>
                <Button type="primary" disabled={items.length === 0} onClick={handleSave}>Сохранить</Button>
              </>
            ) : (
              <>
                <Popconfirm
                  title="Оформить возврат?"
                  description="Заказ будет помечен как возвращённый, товары вернутся на склад. Продолжить?"
                  okText="Оформить возврат"
                  cancelText="Отмена"
                  okButtonProps={{ danger: true }}
                  onConfirm={handleRefund}
                >
                  <Button danger>Оформить возврат</Button>
                </Popconfirm>
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
