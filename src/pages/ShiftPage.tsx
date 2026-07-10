import { useState } from 'react'
import { observer } from 'mobx-react-lite'
import { Button, Empty, Input, InputNumber, Modal, Table, Typography, message } from 'antd'
import { ArrowDownCircle, ArrowUpCircle, Printer } from 'lucide-react'
import dayjs from 'dayjs'
import { useStore } from '../stores/context'
import { usePrint } from '../print/PrintContext'
import { formatDateTime, formatMoney } from '../utils/format'
import type { Shift } from '../types'

export const ShiftPage = observer(function ShiftPage() {
  const { data } = useStore()
  const { printShift } = usePrint()
  const [openingCashInput, setOpeningCashInput] = useState<number | null>(0)
  const [movementModal, setMovementModal] = useState<'in' | 'out' | null>(null)
  const [movementAmount, setMovementAmount] = useState<number | null>(null)
  const [movementNote, setMovementNote] = useState('')
  const [closeModalOpen, setCloseModalOpen] = useState(false)
  const [actualCashInput, setActualCashInput] = useState<number | null>(0)

  const shift = data.activeShift
  const summary = shift ? data.shiftSummary(shift) : null

  // Не useMemo: MobX мутирует смены на месте (shift.closedAt = ...), ссылка на data.shifts
  // не меняется, поэтому зависимость useMemo не сработает — пересчитываем на каждый рендер.
  const closedShifts = [...data.shifts]
    .filter((s) => s.closedAt)
    .sort((a, b) => (a.closedAt! < b.closedAt! ? 1 : -1))

  function handleOpenShift() {
    data.openShift(openingCashInput ?? 0)
    setOpeningCashInput(0)
  }

  function handleAddMovement() {
    if (!movementModal || !movementAmount || movementAmount <= 0) return
    data.addCashMovement(movementModal, movementAmount, movementNote || undefined)
    setMovementModal(null)
    setMovementAmount(null)
    setMovementNote('')
  }

  function handleCloseShift() {
    if (!shift) return
    data.closeShift(actualCashInput ?? 0)
    setCloseModalOpen(false)
    message.success('Смена закрыта')
  }

  if (!shift) {
    return (
      <div className="page-container">
        <Typography.Title level={3}>Смена</Typography.Title>
        <div className="shift-open-card">
          <Typography.Text strong>Открыть смену</Typography.Text>
          <label className="order-edit-field">
            <span>Наличные в кассе на старте</span>
            <InputNumber
              min={0}
              value={openingCashInput}
              addonAfter="₽"
              onFocus={(event) => event.target.select()}
              onChange={setOpeningCashInput}
              style={{ width: '100%' }}
            />
          </label>
          <Button type="primary" size="large" onClick={handleOpenShift}>Открыть смену</Button>
        </div>

        {closedShifts.length > 0 && <ShiftHistory shifts={closedShifts} onPrint={(s) => printShift(s, 'z')} />}
      </div>
    )
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <Typography.Title level={3} style={{ margin: 0 }}>Смена</Typography.Title>
        <Button icon={<Printer size={18} />} onClick={() => printShift(shift, 'x')}>Печать X-отчёта</Button>
      </div>

      <Typography.Text type="secondary">
        Открыта {formatDateTime(shift.openedAt)} · длительность {dayjs().diff(dayjs(shift.openedAt), 'hour')} ч {dayjs().diff(dayjs(shift.openedAt), 'minute') % 60} мин
      </Typography.Text>

      <div className="report-kpis" style={{ marginTop: 16 }}>
        <div className="report-kpi">
          <span className="report-kpi-label">Выручка</span>
          <span className="report-kpi-value">{formatMoney(summary!.revenue)}</span>
        </div>
        <div className="report-kpi">
          <span className="report-kpi-label">Заказов</span>
          <span className="report-kpi-value">{summary!.ordersCount}</span>
        </div>
        <div className="report-kpi">
          <span className="report-kpi-label">Возвратов</span>
          <span className="report-kpi-value">{formatMoney(summary!.refundsTotal)}</span>
        </div>
        <div className="report-kpi">
          <span className="report-kpi-label">Ожидается в кассе</span>
          <span className="report-kpi-value">{formatMoney(summary!.expectedCash)}</span>
        </div>
      </div>

      <div className="report-card" style={{ marginTop: 20 }}>
        <div className="report-card-title">По способам оплаты</div>
        <Table
          size="middle"
          pagination={false}
          rowKey="payment"
          dataSource={summary!.byPayment}
          columns={[
            { title: 'Способ', dataIndex: 'payment' },
            { title: 'Заказов', dataIndex: 'orders', align: 'right' },
            { title: 'Сумма', dataIndex: 'total', align: 'right', render: (v) => formatMoney(v) },
          ]}
        />
      </div>

      <div className="report-card" style={{ marginTop: 16 }}>
        <div className="report-card-title">Наличные</div>
        <div className="shift-cash-actions">
          <Button icon={<ArrowDownCircle size={18} />} onClick={() => setMovementModal('in')}>Внести</Button>
          <Button icon={<ArrowUpCircle size={18} />} onClick={() => setMovementModal('out')}>Изъять</Button>
        </div>
        {shift.cashMovements.length === 0 ? (
          <Typography.Text type="secondary">Движений наличных не было</Typography.Text>
        ) : (
          <div className="shift-movements">
            {shift.cashMovements.map((movement) => (
              <div className="shift-movement-row" key={movement.id}>
                <span>{formatDateTime(movement.ts)} · {movement.kind === 'in' ? 'Внесение' : 'Изъятие'}{movement.note ? ` (${movement.note})` : ''}</span>
                <strong>{movement.kind === 'in' ? '+' : '-'}{formatMoney(movement.amount)}</strong>
              </div>
            ))}
          </div>
        )}
      </div>

      <Button danger size="large" style={{ marginTop: 20 }} onClick={() => { setActualCashInput(summary!.expectedCash); setCloseModalOpen(true) }}>
        Закрыть смену
      </Button>

      {closedShifts.length > 0 && <div style={{ marginTop: 24 }}><ShiftHistory shifts={closedShifts} onPrint={(s) => printShift(s, 'z')} /></div>}

      <Modal
        title={movementModal === 'in' ? 'Внести наличные' : 'Изъять наличные'}
        open={!!movementModal}
        onCancel={() => setMovementModal(null)}
        onOk={handleAddMovement}
        okText={movementModal === 'in' ? 'Внести' : 'Изъять'}
        okButtonProps={{ disabled: !movementAmount || movementAmount <= 0 }}
        centered
      >
        <label className="order-edit-field" style={{ marginBottom: 12 }}>
          <span>Сумма</span>
          <InputNumber
            min={0}
            autoFocus
            value={movementAmount}
            addonAfter="₽"
            onFocus={(event) => event.target.select()}
            onChange={setMovementAmount}
            style={{ width: '100%' }}
          />
        </label>
        <label className="order-edit-field">
          <span>Комментарий (необязательно)</span>
          <Input
            value={movementNote}
            onChange={(event) => setMovementNote(event.target.value)}
          />
        </label>
      </Modal>

      <Modal
        title="Закрыть смену"
        open={closeModalOpen}
        onCancel={() => setCloseModalOpen(false)}
        onOk={handleCloseShift}
        okText="Закрыть смену"
        okButtonProps={{ danger: true }}
        centered
      >
        <Typography.Paragraph>Ожидается в кассе: <strong>{formatMoney(summary!.expectedCash)}</strong></Typography.Paragraph>
        <label className="order-edit-field">
          <span>Фактически наличных в кассе</span>
          <InputNumber
            min={0}
            autoFocus
            value={actualCashInput}
            addonAfter="₽"
            onFocus={(event) => event.target.select()}
            onChange={setActualCashInput}
            style={{ width: '100%' }}
          />
        </label>
        {actualCashInput !== null && actualCashInput !== summary!.expectedCash && (
          <Typography.Text type="danger" style={{ display: 'block', marginTop: 8 }}>
            Расхождение: {formatMoney(actualCashInput - summary!.expectedCash)}
          </Typography.Text>
        )}
      </Modal>
    </div>
  )
})

function ShiftHistory({ shifts, onPrint }: { shifts: Shift[]; onPrint: (shift: Shift) => void }) {
  if (shifts.length === 0) return <Empty description="Смен ещё не было" />
  return (
    <div className="report-card">
      <div className="report-card-title">История смен</div>
      <div className="shift-history-list">
        {shifts.map((shift) => (
          <div className="shift-history-row" key={shift.clientId}>
            <div className="shift-history-main">
              <strong>{formatDateTime(shift.openedAt)} — {shift.closedAt ? formatDateTime(shift.closedAt) : ''}</strong>
              <span>
                Выручка {formatMoney(shift.closing?.summary.revenue ?? 0)} · расхождение{' '}
                {formatMoney((shift.closing?.actualCash ?? 0) - (shift.closing?.expectedCash ?? 0))}
              </span>
            </div>
            <Button icon={<Printer size={18} />} onClick={() => onPrint(shift)} />
          </div>
        ))}
      </div>
    </div>
  )
}
