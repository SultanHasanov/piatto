import { useMemo, useState } from 'react'
import { Modal, Button, Typography } from 'antd'
import type { ModifierGroup, OrderItemMod, Product } from '../types'
import { formatMoney } from '../utils/format'

interface Props {
  product: Product
  groups: ModifierGroup[]
  open: boolean
  onCancel: () => void
  onConfirm: (mods: OrderItemMod[]) => void
}

export function ModifierModal({ product, groups, open, onCancel, onConfirm }: Props) {
  const [selection, setSelection] = useState<Record<string, string[]>>({})

  const missingRequired = groups.filter((g) => g.required && !(selection[g.clientId]?.length))

  const totalDelta = useMemo(() => {
    let sum = 0
    for (const g of groups) {
      const chosen = selection[g.clientId] ?? []
      for (const optName of chosen) {
        const opt = g.options.find((o) => o.name === optName)
        if (opt) sum += opt.priceDelta
      }
    }
    return sum
  }, [selection, groups])

  function toggleSingle(group: ModifierGroup, optName: string) {
    setSelection((s) => ({ ...s, [group.clientId]: [optName] }))
  }

  function toggleMulti(group: ModifierGroup, optName: string, checked: boolean) {
    setSelection((s) => {
      const current = s[group.clientId] ?? []
      const next = checked ? [...current, optName] : current.filter((n) => n !== optName)
      return { ...s, [group.clientId]: next }
    })
  }

  function handleConfirm() {
    const mods: OrderItemMod[] = []
    for (const g of groups) {
      const chosen = selection[g.clientId] ?? []
      for (const optName of chosen) {
        const opt = g.options.find((o) => o.name === optName)
        if (opt) mods.push({ name: opt.name, priceDelta: opt.priceDelta })
      }
    }
    onConfirm(mods)
    setSelection({})
  }

  return (
    <Modal
      title={product.name}
      open={open}
      onCancel={onCancel}
      width={640}
      centered
      footer={[
        <Button key="cancel" size="large" onClick={onCancel}>Отмена</Button>,
        <Button key="ok" type="primary" size="large" disabled={missingRequired.length > 0} onClick={handleConfirm}>
          Добавить · {formatMoney(product.price + totalDelta)}
        </Button>,
      ]}
    >
      <div>
        {groups.map((g) => {
          const chosen = selection[g.clientId] ?? []
          return (
            <div className="mod-group" key={g.clientId}>
              <div className="mod-group-title">
                {g.name} {g.required && <Typography.Text type="danger">*</Typography.Text>}
              </div>
              <div className="mod-options">
                {g.options.map((opt) => {
                  const active = chosen.includes(opt.name)
                  return (
                    <button
                      type="button"
                      key={opt.name}
                      className={`mod-option ${active ? 'mod-option--active' : ''}`}
                      onClick={() =>
                        g.multi
                          ? toggleMulti(g, opt.name, !active)
                          : toggleSingle(g, opt.name)
                      }
                    >
                      <span>{opt.name}</span>
                      {opt.priceDelta > 0 && (
                        <span className="mod-option-delta">+{formatMoney(opt.priceDelta)}</span>
                      )}
                    </button>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
    </Modal>
  )
}
