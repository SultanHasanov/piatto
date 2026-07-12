import { useState } from 'react'
import { observer } from 'mobx-react-lite'
import { Segmented, Button, Modal, Form, Input, Switch, Space, Popconfirm, Typography } from 'antd'
import { Plus, Trash2 } from 'lucide-react'
import { useStore } from '../stores/context'
import { CategoryEditModal } from '../components/CategoryEditModal'
import { ProductEditModal } from '../components/ProductEditModal'
import { TerminalNumericInput } from '../components/NumericKeypad'
import type { Category, ModifierGroup, ModifierOption, Product } from '../types'
import { formatMoney } from '../utils/format'
import { ReliableImage } from '../components/ReliableImage'

const CategoriesTab = observer(function CategoriesTab() {
  const { data } = useStore()
  const [editing, setEditing] = useState<Category | null>(null)
  const [open, setOpen] = useState(false)

  function openNew() {
    setEditing(null)
    setOpen(true)
  }

  function openEdit(cat: Category) {
    setEditing(cat)
    setOpen(true)
  }

  const categories = [...data.categories].sort((a, b) => a.sort - b.sort)

  return (
    <div>
      <div className="admin-card-grid">
        {categories.map((cat) => {
          const style = { background: cat.color }
          const count = data.products.filter((p) => p.categoryId === cat.clientId).length
          return (
            <button key={cat.clientId} className="admin-card admin-card--category" style={style} onClick={() => openEdit(cat)}>
              {cat.image && <ReliableImage src={cat.image} alt="" className="category-tile-cover" />}
              {cat.image && <span className="category-tile-shade" />}
              <span className="tile-name">{cat.name}</span>
              <span className="tile-sub">{count} товара</span>
            </button>
          )
        })}
        <button className="admin-card admin-card--add" onClick={openNew}>
          <Plus size={28} />
          <span>Добавить категорию</span>
        </button>
      </div>
      <CategoryEditModal category={editing} open={open} onClose={() => setOpen(false)} />
    </div>
  )
})

const ProductsTab = observer(function ProductsTab() {
  const { data } = useStore()
  const [editing, setEditing] = useState<Product | null>(null)
  const [open, setOpen] = useState(false)
  const [filterCategory, setFilterCategory] = useState<string | null>(null)

  function openNew() {
    setEditing(null)
    setOpen(true)
  }

  function openEdit(p: Product) {
    setEditing(p)
    setOpen(true)
  }

  const categories = [...data.categories].sort((a, b) => a.sort - b.sort)
  const visibleProducts = filterCategory ? data.products.filter((p) => p.categoryId === filterCategory) : data.products

  return (
    <div>
      <div className="admin-chips">
        <button className={`admin-chip ${filterCategory === null ? 'admin-chip--active' : ''}`} onClick={() => setFilterCategory(null)}>
          Все
        </button>
        {categories.map((c) => (
          <button
            key={c.clientId}
            className={`admin-chip ${filterCategory === c.clientId ? 'admin-chip--active' : ''}`}
            onClick={() => setFilterCategory(c.clientId)}
          >
            {c.name}
          </button>
        ))}
      </div>
      <div className="admin-card-grid">
        {visibleProducts.map((p) => {
          const low = p.stock !== null && p.stock <= 0
          return (
            <button key={p.clientId} className={`admin-card admin-card--product ${p.disabled ? 'tile--disabled' : ''}`} onClick={() => openEdit(p)}>
              {p.disabled && <span className="tile-badge-stop">нет</span>}
              {p.image ? (
                <ReliableImage
                  src={p.image}
                  alt={p.name}
                  className="product-tile-img"
                  fallback={<div className="product-tile-img product-tile-img--placeholder">{p.name.slice(0, 1)}</div>}
                />
              ) : (
                <div className="product-tile-img product-tile-img--placeholder">{p.name.slice(0, 1)}</div>
              )}
              <span className="tile-name">{p.name}</span>
              <span className={`tile-sub ${low ? 'tile-sub--warn' : ''}`}>
                {p.stock !== null ? `Остаток: ${p.stock} шт` : ' '}
              </span>
              <span className="tile-price">{formatMoney(p.price)}</span>
            </button>
          )
        })}
        {data.categories.length > 0 ? (
          <button className="admin-card admin-card--add" onClick={openNew}>
            <Plus size={28} />
            <span>Добавить товар</span>
          </button>
        ) : (
          <div className="admin-card admin-card--hint">Сначала создайте категорию</div>
        )}
      </div>
      <ProductEditModal product={editing} open={open} defaultCategoryId={filterCategory} onClose={() => setOpen(false)} />
    </div>
  )
})

const ModifiersTab = observer(function ModifiersTab() {
  const { data } = useStore()
  const [form] = Form.useForm()
  const [editing, setEditing] = useState<ModifierGroup | null>(null)
  const [open, setOpen] = useState(false)

  function openNew() {
    setEditing(null)
    form.resetFields()
    form.setFieldsValue({ options: [{ name: '', priceDelta: 0 }] })
    setOpen(true)
  }

  function openEdit(g: ModifierGroup) {
    setEditing(g)
    form.setFieldsValue(g)
    setOpen(true)
  }

  function handleSubmit() {
    form.validateFields().then((values) => {
      const options: ModifierOption[] = (values.options ?? []).filter((o: ModifierOption) => o?.name)
      const payload = { ...values, options }
      if (editing) {
        data.updateModifierGroup(editing.clientId, payload)
      } else {
        data.addModifierGroup(payload)
      }
      setOpen(false)
    })
  }

  function handleDelete() {
    if (!editing) return
    data.removeModifierGroup(editing.clientId)
    setOpen(false)
  }

  return (
    <div>
      <div className="admin-row-list">
        {data.modifierGroups.map((g) => (
          <button key={g.clientId} className="admin-row-card" onClick={() => openEdit(g)}>
            <span className="tile-name">{g.name}</span>
            <span className="tile-sub">
              {g.required ? 'Обязательна' : 'Необязательна'} · {g.multi ? 'Множественный выбор' : 'Один вариант'}
            </span>
            <span className="tile-sub">{g.options.map((o) => o.name).join(', ')}</span>
          </button>
        ))}
        <button className="admin-row-card admin-row-card--add" onClick={openNew}>
          <Plus size={20} />
          <span>Добавить группу модификаторов</span>
        </button>
      </div>
      <Modal
        title={editing ? 'Редактировать группу' : 'Новая группа модификаторов'}
        open={open}
        onCancel={() => setOpen(false)}
        width={560}
        footer={[
          editing && (
            <Popconfirm key="delete" title="Удалить группу?" onConfirm={handleDelete}>
              <Button danger icon={<Trash2 size={14} />} style={{ float: 'left' }}>
                Удалить
              </Button>
            </Popconfirm>
          ),
          <Button key="cancel" onClick={() => setOpen(false)}>
            Отмена
          </Button>,
          <Button key="save" type="primary" onClick={handleSubmit}>
            Сохранить
          </Button>,
        ]}
      >
        <Form form={form} layout="vertical" size="large">
          <Form.Item name="name" label="Название" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Space size="large">
            <Form.Item name="required" label="Обязательна" valuePropName="checked">
              <Switch />
            </Form.Item>
            <Form.Item name="multi" label="Множественный выбор" valuePropName="checked">
              <Switch />
            </Form.Item>
          </Space>
          <Typography.Text strong>Опции</Typography.Text>
          <Form.List name="options">
            {(fields, { add, remove }) => (
              <div style={{ marginTop: 8 }}>
                {fields.map((field) => (
                  <Space key={field.key} style={{ display: 'flex', marginBottom: 8 }} align="baseline">
                    <Form.Item name={[field.name, 'name']} rules={[{ required: true, message: 'Название' }]} noStyle>
                      <Input placeholder="Название опции" />
                    </Form.Item>
                    <Form.Item name={[field.name, 'priceDelta']} noStyle>
                      <TerminalNumericInput mode="signed" placeholder="Доплата" addonAfter="₽" />
                    </Form.Item>
                    <Button danger icon={<Trash2 size={14} />} onClick={() => remove(field.name)} />
                  </Space>
                ))}
                <Button icon={<Plus size={16} />} onClick={() => add({ name: '', priceDelta: 0 })}>
                  Добавить опцию
                </Button>
              </div>
            )}
          </Form.List>
        </Form>
      </Modal>
    </div>
  )
})

type AdminTab = 'categories' | 'products' | 'modifiers'

export function MenuAdminPage() {
  const [tab, setTab] = useState<AdminTab>('categories')
  return (
    <div className="page-container">
      <Typography.Title level={3}>Меню</Typography.Title>
      <Segmented
        className="admin-tabs"
        size="large"
        value={tab}
        onChange={(v) => setTab(v as AdminTab)}
        options={[
          { value: 'categories', label: 'Категории' },
          { value: 'products', label: 'Товары' },
          { value: 'modifiers', label: 'Модификаторы' },
        ]}
      />
      {tab === 'categories' && <CategoriesTab />}
      {tab === 'products' && <ProductsTab />}
      {tab === 'modifiers' && <ModifiersTab />}
    </div>
  )
}
