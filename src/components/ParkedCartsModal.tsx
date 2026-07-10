import { observer } from 'mobx-react-lite'
import { Modal, Button, Empty, Popconfirm } from 'antd'
import { Trash2 } from 'lucide-react'
import { useStore } from '../stores/context'
import { formatMoney, formatTime } from '../utils/format'

interface Props {
  open: boolean
  onClose: () => void
}

export const ParkedCartsModal = observer(function ParkedCartsModal({ open, onClose }: Props) {
  const { cart } = useStore()

  function handleResume(id: string) {
    cart.resume(id)
    onClose()
  }

  return (
    <Modal title="Отложенные чеки" open={open} onCancel={onClose} footer={null} width={640} centered>
      {cart.parked.length === 0 ? (
        <Empty description="Нет отложенных чеков" />
      ) : (
        <div className="parked-list">
          {cart.parked.map((parked) => (
            <div className="parked-row" key={parked.id}>
              <div className="parked-row-main">
                <div className="parked-row-heading">
                  <strong>{formatTime(parked.ts)}</strong>
                  <span>{formatMoney(cart.parkedTotal(parked))}</span>
                </div>
                <div className="parked-row-items">
                  {parked.lines.map((line) => `${line.name} × ${line.qty}`).join(', ')}
                </div>
              </div>
              <div className="parked-row-actions">
                <Button type="primary" onClick={() => handleResume(parked.id)}>
                  Вернуть
                </Button>
                <Popconfirm
                  title="Удалить отложенный чек?"
                  okText="Удалить"
                  cancelText="Отмена"
                  okButtonProps={{ danger: true }}
                  onConfirm={() => cart.discardParked(parked.id)}
                >
                  <Button danger type="text" icon={<Trash2 size={18} />} />
                </Popconfirm>
              </div>
            </div>
          ))}
        </div>
      )}
    </Modal>
  )
})
