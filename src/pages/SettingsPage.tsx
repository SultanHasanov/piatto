import { useEffect, useRef, useState } from 'react'
import { observer } from 'mobx-react-lite'
import { Alert, Typography, Form, Input, InputNumber, Button, Popconfirm, Progress, QRCode, Space, Switch, Tag, message } from 'antd'
import { Download, RefreshCw, Upload } from 'lucide-react'
import dayjs from 'dayjs'
import { useStore } from '../stores/context'
import type { SyncStatus } from '../types'
import { api } from '../api/client'
import { formatBytes } from '../utils/format'

const SITE_URL = 'https://piatto-three.vercel.app/'
const STORAGE_LIMIT_BYTES = 1 * 1024 ** 3
const DB_LIMIT_BYTES = 500 * 1024 ** 2

const syncStatusLabels: Record<SyncStatus, string> = {
  idle: 'Готово',
  syncing: 'Синхронизация',
  offline: 'Нет сети',
  error: 'Ошибка',
  local: 'Локальный режим',
}

export const SettingsPage = observer(function SettingsPage() {
  const { data, sync, cart, auth } = useStore()
  const fileRef = useRef<HTMLInputElement>(null)
  const paymentMethodOptions = Array.from(new Set(['Наличные', 'Карта', 'Перевод', ...data.settings.paymentMethods]))
  const [usage, setUsage] = useState<{ storageBytes: number; dbBytes: number } | null>(null)
  const [usageLoading, setUsageLoading] = useState(false)
  const [usageError, setUsageError] = useState<string | null>(null)

  async function loadUsage() {
    setUsageLoading(true)
    setUsageError(null)
    try {
      const result = await api.getUsage()
      setUsage(result)
    } catch (error) {
      setUsageError(error instanceof Error ? error.message : 'Не удалось получить данные')
    } finally {
      setUsageLoading(false)
    }
  }

  useEffect(() => {
    if (auth.configured) void loadUsage()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth.configured])

  function saveShopName(shopName: string) {
    data.updateSettings({ shopName })
  }

  function togglePaymentMethod(method: string, enabled: boolean) {
    const next = enabled
      ? [...data.settings.paymentMethods, method]
      : data.settings.paymentMethods.filter((item) => item !== method)
    if (next.length === 0) {
      message.warning('Должен остаться хотя бы один способ оплаты')
      return
    }
    data.updateSettings({ paymentMethods: Array.from(new Set(next)) })
  }

  function updateOrderType(index: number, patch: { enabled?: boolean; surcharge?: number }) {
    const orderTypes = data.settings.orderTypes.map((orderType, itemIndex) => (
      itemIndex === index ? { ...orderType, ...patch } : orderType
    ))
    if (!orderTypes.some((orderType) => orderType.enabled)) {
      message.warning('Должен остаться хотя бы один тип заказа')
      return
    }
    data.updateSettings({ orderTypes })
  }

  function downloadJson(value: unknown, filename: string) {
    const blob = new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
  }

  function exportBackup() {
    downloadJson({
      categories: data.categories,
      modifierGroups: data.modifierGroups,
      products: data.products,
      orders: data.orders,
      settings: data.settings,
    }, `piatto-backup-${dayjs().format('YYYY-MM-DD-HHmm')}.json`)
  }

  function importBackup(file: File) {
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result))
        const all = [
          ...(parsed.categories ?? []),
          ...(parsed.modifierGroups ?? []),
          ...(parsed.products ?? []),
          ...(parsed.orders ?? []),
          ...(parsed.settings ? [parsed.settings] : []),
        ]
        data.mergeRemote(all)
        message.success('Бэкап импортирован')
      } catch {
        message.error('Не удалось прочитать файл бэкапа')
      }
    }
    reader.readAsText(file)
  }

  return (
    <div className="page-container">
      <Typography.Title level={3}>Настройки</Typography.Title>

      <Typography.Title level={5}>Точка продаж</Typography.Title>
      <Form layout="vertical" style={{ maxWidth: 560 }}>
        <Form.Item label="Название точки">
          <Input defaultValue={data.settings.shopName} onBlur={(event) => saveShopName(event.target.value)} />
        </Form.Item>
        <Form.Item label="Способы оплаты">
          <div className="settings-inline-options">
            {paymentMethodOptions.map((method) => (
              <div className="settings-inline-option" key={method}>
                <Typography.Text strong>{method}</Typography.Text>
                <Switch
                  checked={data.settings.paymentMethods.includes(method)}
                  onChange={(enabled) => togglePaymentMethod(method, enabled)}
                />
              </div>
            ))}
          </div>
        </Form.Item>
        <Form.Item label="Типы заказа">
          <div className="settings-inline-options settings-inline-order-types">
            {data.settings.orderTypes.map((orderType, index) => (
              <div className="settings-inline-option" key={orderType.id}>
                <Typography.Text strong>{orderType.name}</Typography.Text>
                <label className="settings-surcharge-field">
                  <span>Доплата</span>
                  <InputNumber
                    min={0}
                    value={orderType.surcharge}
                    addonAfter="₽"
                    onFocus={(event) => event.target.select()}
                    onChange={(value) => updateOrderType(index, { surcharge: Math.max(0, Number(value) || 0) })}
                  />
                </label>
                <Switch
                  checked={orderType.enabled}
                  onChange={(enabled) => updateOrderType(index, { enabled })}
                />
              </div>
            ))}
          </div>
        </Form.Item>
      </Form>

      <Typography.Title level={5}>Печать и звук</Typography.Title>
      <Space direction="vertical" style={{ marginBottom: 24 }}>
        <div className="settings-inline-option" style={{ maxWidth: 420 }}>
          <Typography.Text strong>Печатать чек после оплаты</Typography.Text>
          <Switch
            checked={!!data.settings.printReceiptAfterPay}
            onChange={(printReceiptAfterPay) => data.updateSettings({ printReceiptAfterPay })}
          />
        </div>
        <div className="settings-inline-option" style={{ maxWidth: 420 }}>
          <Typography.Text strong>Звук при оформлении заказа</Typography.Text>
          <Switch
            checked={data.settings.playSoundOnPay !== false}
            onChange={(playSoundOnPay) => data.updateSettings({ playSoundOnPay })}
          />
        </div>
      </Space>

      <Typography.Title level={5}>Синхронизация</Typography.Title>
      <Space direction="vertical" style={{ marginBottom: 24 }}>
        {!auth.configured && (
          <Alert type="warning" showIcon message="Supabase не настроен" description="Приложение работает только локально. Добавьте переменные VITE_SUPABASE_* перед продовой сборкой." />
        )}
        {(data.storageError || cart.storageError) && (
          <Alert type="error" showIcon message="Ошибка локального хранилища" description={data.storageError ?? cart.storageError} />
        )}
        {sync.lastError && <Alert type="error" showIcon message="Ошибка синхронизации" description={sync.lastError} />}
        <div>
          Статус:{' '}
          <Tag color={sync.status === 'idle' ? 'green' : sync.status === 'offline' ? 'default' : sync.status === 'error' ? 'red' : 'blue'}>
            {syncStatusLabels[sync.status]}
          </Tag>
        </div>
        <div>В очереди на отправку: {sync.pendingCount}</div>
        {sync.lastSyncAt && <div>Последняя синхронизация: {dayjs(sync.lastSyncAt).format('DD.MM.YYYY HH:mm:ss')}</div>}
        <Button onClick={() => sync.syncNow()}>Синхронизировать сейчас</Button>
        {auth.configured && auth.session && (
          <Popconfirm
            title="Поставить все локальные данные в очередь?"
            description="Используйте это один раз при переносе с Mokky. Локальные категории, товары, настройки и заказы будут отправлены в Supabase."
            okText="Подготовить перенос"
            cancelText="Отмена"
            onConfirm={() => {
              data.queueFullUpload()
              void sync.syncNow()
            }}
          >
            <Button>Перенести локальные данные в Supabase</Button>
          </Popconfirm>
        )}
        {auth.configured && auth.authenticated && <Button danger onClick={() => auth.signOut()}>Заблокировать кассу</Button>}
      </Space>

      {auth.configured && (
        <>
          <Typography.Title level={5}>Хранилище Supabase</Typography.Title>
          <Space direction="vertical" style={{ marginBottom: 24, maxWidth: 480, width: '100%' }}>
            {usageError && <Alert type="error" showIcon message="Не удалось получить данные о занятом месте" description={usageError} />}
            <div>
              <Typography.Text strong>Картинки (Storage)</Typography.Text>
              <Progress
                percent={usage ? Math.min(100, (usage.storageBytes / STORAGE_LIMIT_BYTES) * 100) : 0}
                status={usage && usage.storageBytes / STORAGE_LIMIT_BYTES >= 0.9 ? 'exception' : 'normal'}
                format={() => usage ? `${((usage.storageBytes / STORAGE_LIMIT_BYTES) * 100).toFixed(0)}%` : '—'}
              />
              <Typography.Text type="secondary">
                {usage
                  ? `Занято ${formatBytes(usage.storageBytes)} из ${formatBytes(STORAGE_LIMIT_BYTES)} · осталось ${formatBytes(Math.max(0, STORAGE_LIMIT_BYTES - usage.storageBytes))}`
                  : 'Загрузка…'}
              </Typography.Text>
            </div>
            <div>
              <Typography.Text strong>Данные (база)</Typography.Text>
              <Progress
                percent={usage ? Math.min(100, (usage.dbBytes / DB_LIMIT_BYTES) * 100) : 0}
                status={usage && usage.dbBytes / DB_LIMIT_BYTES >= 0.9 ? 'exception' : 'normal'}
                format={() => usage ? `${((usage.dbBytes / DB_LIMIT_BYTES) * 100).toFixed(0)}%` : '—'}
              />
              <Typography.Text type="secondary">
                {usage
                  ? `Занято ${formatBytes(usage.dbBytes)} из ${formatBytes(DB_LIMIT_BYTES)} · осталось ${formatBytes(Math.max(0, DB_LIMIT_BYTES - usage.dbBytes))}`
                  : 'Загрузка…'}
              </Typography.Text>
            </div>
            <Button icon={<RefreshCw size={16} />} loading={usageLoading} onClick={() => void loadUsage()}>
              Обновить
            </Button>
          </Space>
        </>
      )}

      <Typography.Title level={5}>Резервная копия</Typography.Title>
      <Space>
        <Button icon={<Download size={16} />} onClick={exportBackup}>Экспорт бэкапа</Button>
        <Button icon={<Upload size={16} />} onClick={() => fileRef.current?.click()}>Импорт бэкапа</Button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json"
          style={{ display: 'none' }}
          onChange={(event) => {
            const file = event.target.files?.[0]
            if (file) importBackup(file)
            event.target.value = ''
          }}
        />
      </Space>

      <Typography.Title level={5} style={{ marginTop: 24 }}>Сайт кассы</Typography.Title>
      <Space direction="vertical" style={{ marginBottom: 24 }}>
        <QRCode value={SITE_URL} size={180} />
        <Typography.Link href={SITE_URL} target="_blank">{SITE_URL}</Typography.Link>
      </Space>
    </div>
  )
})
