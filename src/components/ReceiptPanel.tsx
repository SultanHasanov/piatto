import { useEffect, useState } from 'react'
import { observer } from 'mobx-react-lite'
import { Button, Empty, Alert } from 'antd'
import { Trash2, Plus, Minus } from 'lucide-react'
import { useStore } from '../stores/context'
import { formatMoney } from '../utils/format'
import type { CartLine } from '../types'

interface Props {
  onPay: () => void
}

export const ReceiptPanel = observer(function ReceiptPanel({ onPay }: Props) {
  const { cart } = useStore()
  const [removed, setRemoved] = useState<{ line: CartLine; index: number } | null>(null)

  function handleRemove(index: number) {
    setRemoved(cart.removeAt(index))
  }

  function handleUndo() {
    if (removed) {
      cart.restoreAt(removed.index, removed.line)
      setRemoved(null)
    }
  }

  // чек мог быть очищен целиком кнопкой в шапке — плашка отмены единичного удаления в этом случае неактуальна
  useEffect(() => {
    if (cart.lines.length === 0) setRemoved(null)
  }, [cart.lines.length])

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
            <div className="receipt-line" key={idx}>
              <div className="receipt-line-main">
                <div className="receipt-line-name">{line.name}</div>
                {line.mods.length > 0 && (
                  <div className="receipt-line-mods">{line.mods.map((m) => m.name).join(', ')}</div>
                )}
                <div className="receipt-line-price">
                  {formatMoney(line.basePrice + line.mods.reduce((s, m) => s + m.priceDelta, 0))} / шт
                </div>
              </div>
              <div className="receipt-line-actions">
                <Button
                  className="receipt-qty-btn"
                  icon={<Minus size={18} />}
                  disabled={line.qty <= 1}
                  onClick={() => cart.decrement(idx)}
                />
                <span className="receipt-line-qty">{line.qty}</span>
                <Button
                  className="receipt-qty-btn"
                  icon={<Plus size={18} />}
                  onClick={() => cart.increment(idx)}
                />
                <Button
                  className="receipt-del-btn"
                  type="text"
                  danger
                  icon={<Trash2 size={18} />}
                  onClick={() => handleRemove(idx)}
                />
              </div>
              <div className="receipt-line-total">{formatMoney(cart.lineTotal(line))}</div>
            </div>
          ))
        )}
      </div>
      <Button
        type="primary"
        size="large"
        block
        disabled={cart.lines.length === 0}
        onClick={onPay}
        className="pay-button"
      >
        <span>К оплате</span>
        <span>{formatMoney(cart.total)}</span>
      </Button>
    </div>
  )
})
