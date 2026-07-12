import { useEffect, useState } from 'react'
import { Modal, Form, Input, ColorPicker, Button, Popconfirm, Upload, message, Alert, Image } from 'antd'
import { Trash2, Upload as UploadIcon } from 'lucide-react'
import { useStore } from '../stores/context'
import type { Category } from '../types'
import { CATEGORY_PALETTE } from '../constants'
import { api } from '../api/client'
import { cacheImage } from '../utils/imageCache'
import { useOnlineStatus } from '../utils/useOnlineStatus'
import { TerminalNumericInput } from './NumericKeypad'

interface Props {
  category: Category | null
  open: boolean
  onClose: () => void
}

export function CategoryEditModal({ category, open, onClose }: Props) {
  const { data } = useStore()
  const [form] = Form.useForm()
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imageError, setImageError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const online = useOnlineStatus()

  useEffect(() => {
    if (!open) return
    // всегда сбрасываем форму: setFieldsValue не очищает поля,
    // отсутствующие в объекте (image), и значение предыдущей
    // категории могло бы «переехать» на текущую
    form.resetFields()
    setImageFile(null)
    setImageError(null)
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
      if (imageFile && online) {
        values.image = await api.uploadImage(imageFile, 'categories')
        void cacheImage(values.image).catch(() => false)
      } else if (imageFile) {
        if (!category) values.image = undefined
        message.warning(category ? 'Изменения сохранены, но новое изображение не загружено' : 'Категория создана, изображение не загружено')
      }
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
          <Popconfirm
            key="delete"
            title="Удалить категорию?"
            description={(() => {
              const count = data.products.filter((p) => p.categoryId === category.clientId).length
              return count > 0 ? `В категории ${count} товар(ов) — они останутся без категории и будут видны в «Все»` : undefined
            })()}
            onConfirm={handleDelete}
          >
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
          <TerminalNumericInput mode="integer" />
        </Form.Item>
        <Form.Item name="color" label="Цвет">
          <ColorPicker presets={[{ label: 'Палитра', colors: CATEGORY_PALETTE }]} />
        </Form.Item>
        {category?.image && !imageFile && <Image src={category.image} alt={category.name} width={160} style={{ marginBottom: 12, borderRadius: 8 }} />}
        {!online && <Alert type="info" showIcon message="Сейчас нет интернета. Создайте категорию без картинки и добавьте её позже" style={{ marginBottom: 16 }} />}
        <Form.Item label="Изображение (JPEG, PNG или WebP, до 5 МБ)">
          <Upload
            listType="picture"
            accept="image/jpeg,image/png,image/webp"
            maxCount={1}
            beforeUpload={(file) => {
              if (file.size > 5 * 1024 * 1024) {
                setImageError('Изображение не должно превышать 5 МБ')
                return Upload.LIST_IGNORE
              }
              setImageError(null)
              setImageFile(file)
              return false
            }}
            onRemove={() => {
              setImageFile(null)
              setImageError(null)
            }}
          >
            <Button icon={<UploadIcon size={16} />} disabled={!online}>Выбрать файл</Button>
          </Upload>
          {imageError && <Alert type="error" showIcon message={imageError} style={{ marginTop: 12 }} />}
        </Form.Item>
      </Form>
    </Modal>
  )
}
