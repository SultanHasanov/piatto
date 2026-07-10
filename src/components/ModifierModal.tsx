import { useMemo, useState } from 'react'
import { Modal, Radio, Checkbox, Button, Space, Typography } from 'antd'
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
      footer={[
        <Button key="cancel" onClick={onCancel}>Отмена</Button>,
        <Button key="ok" type="primary" disabled={missingRequired.length > 0} onClick={handleConfirm}>
          Добавить · {formatMoney(product.price + totalDelta)}
        </Button>,
      ]}
    >
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        {groups.map((g) => (
          <div key={g.clientId}>
            <Typography.Text strong>
              {g.name} {g.required && <Typography.Text type="danger">*</Typography.Text>}
            </Typography.Text>
            <div style={{ marginTop: 8 }}>
              {g.multi ? (
                <Space direction="vertical">
                  {g.options.map((opt) => (
                    <Checkbox
                      key={opt.name}
                      checked={(selection[g.clientId] ?? []).includes(opt.name)}
                      onChange={(e) => toggleMulti(g, opt.name, e.target.checked)}
                    >
                      {opt.name} {opt.priceDelta > 0 && `(+${formatMoney(opt.priceDelta)})`}
                    </Checkbox>
                  ))}
                </Space>
              ) : (
                <Radio.Group
                  value={selection[g.clientId]?.[0]}
                  onChange={(e) => toggleSingle(g, e.target.value)}
                >
                  <Space direction="vertical">
                    {g.options.map((opt) => (
                      <Radio key={opt.name} value={opt.name}>
                        {opt.name} {opt.priceDelta > 0 && `(+${formatMoney(opt.priceDelta)})`}
                      </Radio>
                    ))}
                  </Space>
                </Radio.Group>
              )}
            </div>
          </div>
        ))}
      </Space>
    </Modal>
  )
}
