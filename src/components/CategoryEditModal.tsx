import { useEffect, useState } from 'react'
import { Modal, Form, Input, InputNumber, ColorPicker, Button, Popconfirm, Space, Upload, message } from 'antd'
import { Trash2, Upload as UploadIcon, X, ClipboardPaste } from 'lucide-react'
import { useStore } from '../stores/context'
import type { Category } from '../types'
import { CATEGORY_PALETTE } from '../constants'
import { api } from '../api/client'

interface Props {
  category: Category | null
  open: boolean
  onClose: () => void
}

export function CategoryEditModal({ category, open, onClose }: Props) {
  const { data } = useStore()
  const [form] = Form.useForm()
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    // всегда сбрасываем форму: setFieldsValue не очищает поля,
    // отсутствующие в объекте (image), и значение предыдущей
    // категории могло бы «переехать» на текущую
    form.resetFields()
    setImageFile(null)
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

  async function handleSubmit() {
    try {
      setSaving(true)
      const values = await form.validateFields()
      if (imageFile) values.image = await api.uploadImage(imageFile, 'categories')
      const color = typeof values.color === 'string' ? values.color : values.color?.toHexString?.() ?? CATEGORY_PALETTE[0]
      if (category) {
        data.updateCategory(category.clientId, { ...values, color })
      } else {
        data.addCategory({ ...values, color })
      }
      onClose()
    } catch (error) {
      if (error instanceof Error) message.error(error.message)
    } finally {
      setSaving(false)
    }
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
      width={640}
      centered
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
        <Button key="save" type="primary" loading={saving} onClick={handleSubmit}>
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
        <Space style={{ marginTop: -16, marginBottom: 16, width: '100%', justifyContent: 'space-between' }}>
          <Button
            color="primary"
            variant="outlined"
            icon={<ClipboardPaste size={14} />}
            onClick={async () => {
              try {
                const text = await navigator.clipboard.readText()
                if (text) form.setFieldValue('image', text)
              } catch {
                message.error('Не удалось прочитать буфер обмена')
              }
            }}
          >
            Вставить из буфера
          </Button>
          <Button
            danger
            icon={<X size={14} />}
            onClick={() => form.setFieldValue('image', undefined)}
          >
            Очистить
          </Button>
        </Space>
        <Form.Item label="Загрузить изображение в Supabase">
          <Upload
            listType="picture"
            accept="image/jpeg,image/png,image/webp"
            maxCount={1}
            beforeUpload={(file) => {
              setImageFile(file)
              return false
            }}
            onRemove={() => setImageFile(null)}
          >
            <Button icon={<UploadIcon size={16} />}>Выбрать файл</Button>
          </Upload>
        </Form.Item>
      </Form>
    </Modal>
  )
}
