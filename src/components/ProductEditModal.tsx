import { useEffect, useState } from 'react'
import { Modal, Form, Input, InputNumber, Select, Switch, Button, Popconfirm, Space, Upload, message, Alert, Image } from 'antd'
import { Trash2, Upload as UploadIcon } from 'lucide-react'
import { useStore } from '../stores/context'
import type { Product } from '../types'
import { api } from '../api/client'
import { cacheImage } from '../utils/imageCache'
import { useOnlineStatus } from '../utils/useOnlineStatus'

interface Props {
  product: Product | null
  open: boolean
  onClose: () => void
  defaultCategoryId?: string | null
}

export function ProductEditModal({ product, open, onClose, defaultCategoryId }: Props) {
  const { data } = useStore()
  const [form] = Form.useForm()
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imageError, setImageError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const online = useOnlineStatus()
  const trackStock = Form.useWatch('trackStock', form)

  useEffect(() => {
    if (!open) return
    // всегда сбрасываем форму: setFieldsValue не очищает поля,
    // отсутствующие в объекте (image, disabled), и значения
    // предыдущего товара могли бы «переехать» на текущий
    form.resetFields()
    setImageFile(null)
    setImageError(null)
    if (product) {
      form.setFieldsValue({
        name: product.name,
        categoryId: product.categoryId,
        price: product.price,
        trackStock: product.stock !== null,
        stock: product.stock ?? 0,
        modifierGroupIds: product.modifierGroupIds,
        image: product.image,
        disabled: product.disabled ?? false,
      })
    } else {
      form.setFieldsValue({
        categoryId: defaultCategoryId ?? undefined,
        trackStock: false,
        stock: 0,
        disabled: false,
      })
    }
  }, [open, product, form, defaultCategoryId])

  async function handleSubmit() {
    try {
      setSaving(true)
      const values = await form.validateFields()
      if (imageFile && online) {
        values.image = await api.uploadProductImage(imageFile)
        void cacheImage(values.image).catch(() => false)
      } else if (imageFile) {
        if (!product) values.image = undefined
        message.warning(product ? 'Изменения сохранены, но новое изображение не загружено' : 'Товар создан, изображение не загружено')
      }
      const { trackStock, ...rest } = values
      const payload = {
        ...rest,
        stock: trackStock ? (values.stock ?? 0) : null,
        modifierGroupIds: values.modifierGroupIds ?? [],
      }
      if (product) {
        data.updateProduct(product.clientId, payload)
      } else {
        data.addProduct(payload)
      }
      onClose()
    } catch (error) {
      if (error instanceof Error) message.error(error.message)
    } finally {
      setSaving(false)
    }
  }

  function handleDelete() {
    if (!product) return
    data.removeProduct(product.clientId)
    onClose()
  }

  return (
    <Modal
      title={product ? 'Редактировать товар' : 'Новый товар'}
      open={open}
      onCancel={onClose}
      width={640}
      centered
      footer={[
        product && (
          <Popconfirm key="delete" title="Удалить товар?" onConfirm={handleDelete}>
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
        <Form.Item name="categoryId" label="Категория" rules={[{ required: true }]}>
          <Select options={data.categories.map((c) => ({ value: c.clientId, label: c.name }))} />
        </Form.Item>
        <Form.Item name="price" label="Цена" rules={[{ required: true }]}>
          <InputNumber min={0} style={{ width: '100%' }} addonAfter="₽" />
        </Form.Item>
        <Space size="large" style={{ display: 'flex' }}>
          <Form.Item name="trackStock" label="Учитывать остаток" valuePropName="checked">
            <Switch />
          </Form.Item>
          <Form.Item name="disabled" label="Отключён (нет в наличии)" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Space>
        {trackStock && (
          <Form.Item name="stock" label="Остаток">
            <InputNumber min={0} style={{ width: '100%' }} />
          </Form.Item>
        )}
        <Form.Item name="modifierGroupIds" label="Группы модификаторов">
          <Select mode="multiple" options={data.modifierGroups.map((g) => ({ value: g.clientId, label: g.name }))} />
        </Form.Item>
        {product?.image && !imageFile && <Image src={product.image} alt={product.name} width={160} style={{ marginBottom: 12, borderRadius: 8 }} />}
        {!online && <Alert type="info" showIcon message="Сейчас нет интернета. Создайте товар без картинки и добавьте её позже" style={{ marginBottom: 16 }} />}
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
