import { useEffect, useRef, useState } from 'react'
import { observer } from 'mobx-react-lite'
import { Button, Empty, Alert, Input, Modal } from 'antd'
import { Trash2, Plus, Minus, Percent, Users } from 'lucide-react'
import { useStore } from '../stores/context'
import { formatMoney } from '../utils/format'
import type { CartLine } from '../types'
import { TerminalNumericInput } from './NumericKeypad'

interface Props {
  onPay: () => void
}

export const ReceiptPanel = observer(function ReceiptPanel({ onPay }: Props) {
  const { cart,data } = useStore()
  const [removed, setRemoved] = useState<{ line: CartLine; index: number } | null>(null)
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null)
  const [discountOpen,setDiscountOpen]=useState(false),[tableOpen,setTableOpen]=useState(false)
  const [discount,setDiscount]=useState<number|null>(0),[table,setTable]=useState(''),[guests,setGuests]=useState<number|null>(1)
  const expandedLineRef = useRef<HTMLDivElement | null>(null)

  function toggleExpanded(index: number) {
    setExpandedIndex((current) => (current === index ? null : index))
  }

  function handleRemove(index: number) {
    setRemoved(cart.removeAt(index))
    setExpandedIndex(null)
  }

  function handleUndo() {
    if (removed) {
      cart.restoreAt(removed.index, removed.line)
      setRemoved(null)
    }
  }

  // чек мог быть очищен целиком кнопкой в шапке — плашка отмены единичного удаления в этом случае неактуальна
  useEffect(() => {
    if (cart.lines.length === 0) {
      setRemoved(null)
      setExpandedIndex(null)
    }
  }, [cart.lines.length])

  useEffect(() => {
    if (expandedIndex === null) return

    function handlePointerDown(event: PointerEvent) {
      const target = event.target
      if (target instanceof Node && !expandedLineRef.current?.contains(target)) {
        setExpandedIndex(null)
      }
    }

    document.addEventListener('pointerdown', handlePointerDown, true)
    return () => document.removeEventListener('pointerdown', handlePointerDown, true)
  }, [expandedIndex])

  return (
    <div className="receipt-panel">
      {removed && (
        <Alert
          type="info"
          banner
          closable
          onClose={() => setRemoved(null)}
          message={`Товар «${removed.line.name}» удалён`}
          action={
            <Button size="small" type="link" onClick={handleUndo}>
              Вернуть
            </Button>
          }
        />
      )}
      <div className="receipt-lines">
        {cart.lines.length === 0 ? (
          <Empty description="Чек пуст" style={{ marginTop: 48 }} />
        ) : (
          cart.lines.map((line, idx) => (
            <div
              className="receipt-line-wrap"
              key={idx}
              ref={expandedIndex === idx ? expandedLineRef : undefined}
            >
              <button
                type="button"
                className="receipt-line"
                onClick={() => toggleExpanded(idx)}
              >
                <div className="receipt-line-main">
                  <div className="receipt-line-name" title={line.name}>{line.name}</div>
                  {line.mods.length > 0 && (
                    <div className="receipt-line-mods" title={line.mods.map((m) => m.name).join(', ')}>
                      {line.mods.map((m) => m.name).join(', ')}
                    </div>
                  )}
                  <div className="receipt-line-price">
                    {formatMoney(line.basePrice + line.mods.reduce((s, m) => s + m.priceDelta, 0))} / шт
                  </div>
                </div>
                <span className="receipt-line-qty-plain">×{line.qty}</span>
                <span className="receipt-line-total" title={formatMoney(cart.lineTotal(line))}>
                  {formatMoney(cart.lineTotal(line))}
                </span>
              </button>

              {expandedIndex === idx && (
                <div className="receipt-line-controls">
                  <Button
                    className="receipt-qty-btn"
                    icon={<Minus size={20} />}
                    disabled={line.qty <= 1}
                    onClick={() => cart.decrement(idx)}
                  />
                  <span className="receipt-line-controls-qty">{line.qty}</span>
                  <Button
                    className="receipt-qty-btn"
                    icon={<Plus size={20} />}
                    onClick={() => cart.increment(idx)}
                  />
                  <Button
                    className="receipt-qty-btn receipt-del-btn"
                    danger
                    icon={<Trash2 size={20} />}
                    onClick={() => handleRemove(idx)}
                  />
                </div>
              )}
            </div>
          ))
        )}
      </div>
      {cart.lines.length>0&&<div className="receipt-tools"><Button icon={<Percent size={17}/>} onClick={()=>{setDiscount(cart.discountPercent);setDiscountOpen(true)}}>{cart.discountPercent?`Скидка ${cart.discountPercent}%`:'Скидка'}</Button><Button icon={<Users size={17}/>} onClick={()=>{setTable(cart.tableName);setGuests(cart.guestCount);setTableOpen(true)}}>{cart.tableName||'Стол / гости'}</Button></div>}
      {cart.discountAmount>0&&<div className="receipt-discount"><span>Скидка {cart.discountPercent}%</span><strong>−{formatMoney(cart.discountAmount)}</strong></div>}
      <Button
        type="primary"
        size="large"
        block
        disabled={cart.lines.length === 0||!data.activeShift}
        onClick={onPay}
        className="pay-button"
      >
        <span>К оплате</span>
        <span>{formatMoney(cart.total)}</span>
      </Button>
      {!data.activeShift&&cart.lines.length>0&&<Alert type="warning" banner message="Для оплаты откройте смену"/>}
      <Modal title="Скидка на чек" open={discountOpen} onCancel={()=>setDiscountOpen(false)} onOk={()=>{cart.setDiscount(discount??0);setDiscountOpen(false)}} okText="Применить" centered><TerminalNumericInput mode="money" max={100} addonAfter="%" value={discount} onChange={v=>setDiscount(v===null?null:Number(v))} autoFocus/></Modal>
      <Modal title="Стол и гости" open={tableOpen} onCancel={()=>setTableOpen(false)} onOk={()=>{cart.setTable(table,guests??1);setTableOpen(false)}} okText="Сохранить" centered><label className="order-edit-field"><span>Название или номер стола</span><Input value={table} onChange={e=>setTable(e.target.value)} placeholder="Например, Стол 5"/></label><label className="order-edit-field"><span>Количество гостей</span><TerminalNumericInput mode="integer" value={guests} onChange={v=>setGuests(v===null?null:Number(v))}/></label></Modal>
    </div>
  )
})
