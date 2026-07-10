import { useEffect, useMemo, useState } from 'react'
import { Modal } from 'antd'
import { Banknote, Bike, Crown, CreditCard, Send, Store, Utensils, Wallet } from 'lucide-react'
import { formatMoney } from '../utils/format'
import type { OrderTypeConfig } from '../types'

interface Props {
  open: boolean
  total: number
  methods: string[]
  orderTypes: OrderTypeConfig[]
  onCancel: () => void
  onSelect: (method: string, orderType: OrderTypeConfig) => void
}

function methodIcon(name: string) {
  const normalized = name.toLocaleLowerCase('ru-RU')
  if (normalized.includes('налич')) return <Banknote size={22} />
  if (normalized.includes('карт')) return <CreditCard size={22} />
  if (normalized.includes('перевод')) return <Send size={22} />
  return <Wallet size={22} />
}

function orderTypeIcon(orderType: OrderTypeConfig) {
  if (orderType.id === 'dine-in') return <Utensils size={22} />
  if (orderType.id === 'delivery') return <Bike size={22} />
  if (orderType.id === 'vip' || orderType.name.toLocaleLowerCase('ru-RU').includes('vip')) return <Crown size={22} />
  return <Store size={22} />
}

export function PaymentModal({ open, total, methods, orderTypes, onCancel, onSelect }: Props) {
  const enabledOrderTypes = useMemo(() => orderTypes.filter((orderType) => orderType.enabled), [orderTypes])
  const firstOrderTypeId = enabledOrderTypes[0]?.id ?? null
  const [orderTypeId, setOrderTypeId] = useState<string | null>(firstOrderTypeId)
  const [selectedMethod, setSelectedMethod] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      setOrderTypeId(firstOrderTypeId)
      setSelectedMethod(null)
    }
  }, [open, firstOrderTypeId])

  const selectedOrderType = enabledOrderTypes.find((orderType) => orderType.id === orderTypeId) ?? null
  const surcharge = selectedOrderType?.surcharge ?? 0
  const finalTotal = total + surcharge

  function handleConfirm() {
    if (!selectedMethod || !selectedOrderType) return
    onSelect(selectedMethod, selectedOrderType)
  }

  return (
    <Modal title="Оплата заказа" open={open} onCancel={onCancel} footer={null}>
      <div className="pay-total-label">К оплате</div>
      <div className="pay-total">{formatMoney(finalTotal)}</div>

      <div className="pay-section-label">Тип заказа</div>
      <div className="pay-options">
        {enabledOrderTypes.map((orderType) => (
          <button
            type="button"
            key={orderType.id}
            className={`pay-option ${orderTypeId === orderType.id ? 'pay-option--active' : ''}`}
            onClick={() => setOrderTypeId(orderType.id)}
          >
            {orderTypeIcon(orderType)}
            <span>{orderType.name}</span>
            {orderType.surcharge > 0 && <small>+{formatMoney(orderType.surcharge)}</small>}
          </button>
        ))}
      </div>

      {surcharge > 0 && (
        <div className="pay-surcharge-row">
          <span>Доплата «{selectedOrderType?.name}»</span>
          <strong>+{formatMoney(surcharge)}</strong>
        </div>
      )}

      <div className="pay-section-label pay-method-label">Способ оплаты</div>
      <div className="pay-options">
        {methods.map((method) => (
          <button
            type="button"
            key={method}
            className={`pay-option ${selectedMethod === method ? 'pay-option--active' : ''}`}
            onClick={() => setSelectedMethod(method)}
          >
            {methodIcon(method)}
            <span>{method}</span>
          </button>
        ))}
      </div>

      <button className="pay-confirm" disabled={!selectedMethod || !selectedOrderType} onClick={handleConfirm}>
        Оплатить {formatMoney(finalTotal)}
      </button>
    </Modal>
  )
}
