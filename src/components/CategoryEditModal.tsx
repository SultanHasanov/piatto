import { useEffect } from 'react'
import { Modal, Form, Input, InputNumber, ColorPicker, Button, Popconfirm } from 'antd'
import { Trash2 } from 'lucide-react'
import { useStore } from '../stores/context'
import type { Category } from '../types'
import { CATEGORY_PALETTE } from '../constants'

interface Props {
  category: Category | null
  open: boolean
  onClose: () => void
}

export function CategoryEditModal({ category, open, onClose }: Props) {
  const { data } = useStore()
  const [form] = Form.useForm()

  useEffect(() => {
    if (!open) return
    // всегда сбрасываем форму: setFieldsValue не очищает поля,
    // отсутствующие в объекте (image), и значение предыдущей
    // категории могло бы «переехать» на текущую
    form.resetFields()
    if (category) {
      form.setFieldsValue({
        name: category.name,
        sort: category.sort,
        color: category.color,
        image: category.image,
      })
    } else {
      form.setFieldsValue({ color: CATEGORY_PALETTE[data.categories.length % CATEGORY_PALETTE.length], sort: data.categories.length })
    }
  }, [open, category, form, data.categories.length])

  function handleSubmit() {
    form.validateFields().then((values) => {
      const color = typeof values.color === 'string' ? values.color : values.color?.toHexString?.() ?? CATEGORY_PALETTE[0]
      if (category) {
        data.updateCategory(category.clientId, { ...values, color })
      } else {
        data.addCategory({ ...values, color })
      }
      onClose()
    })
  }

  function handleDelete() {
    if (!category) return
    data.removeCategory(category.clientId)
    onClose()
  }

  return (
    <Modal
      title={category ? 'Редактировать категорию' : 'Новая категория'}
      open={open}
      onCancel={onClose}
      footer={[
        category && (
          <Popconfirm key="delete" title="Удалить категорию?" onConfirm={handleDelete}>
            <Button danger icon={<Trash2 size={14} />} style={{ float: 'left' }}>
              Удалить
            </Button>
          </Popconfirm>
        ),
        <Button key="cancel" onClick={onClose}>
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
        <Form.Item name="sort" label="Порядок" rules={[{ required: true }]}>
          <InputNumber min={0} style={{ width: '100%' }} />
        </Form.Item>
        <Form.Item name="color" label="Цвет">
          <ColorPicker presets={[{ label: 'Палитра', colors: CATEGORY_PALETTE }]} />
        </Form.Item>
        <Form.Item name="image" label="Картинка (ссылка)">
          <Input placeholder="https://..." />
        </Form.Item>
      </Form>
    </Modal>
  )
}
