export type EntityType = 'category' | 'product' | 'modifierGroup' | 'order' | 'settings'

export interface BaseEntity {
  version?: number // серверная версия для optimistic concurrency control
  clientId: string // локальный UUID — стабильный идентификатор до и после синхронизации
  type: EntityType
  updatedAt: string // ISO — для last-write-wins при мерже
  deleted?: boolean // мягкое удаление, чтобы удаление тоже синхронизировалось
}

export interface Category extends BaseEntity {
  type: 'category'
  name: string
  color: string
  sort: number
  image?: string // URL картинки
}

export interface ModifierOption {
  name: string
  priceDelta: number
}

export interface ModifierGroup extends BaseEntity {
  type: 'modifierGroup'
  name: string
  required: boolean
  multi: boolean
  options: ModifierOption[]
}

export interface Product extends BaseEntity {
  type: 'product'
  categoryId: string // clientId категории
  name: string
  price: number
  stock: number | null // null = не учитывать остаток
  image?: string // dataURL или URL картинки
  modifierGroupIds: string[] // clientId групп модификаторов
  disabled?: boolean // стоп-лист — временно недоступен для продажи
}

export interface OrderItemMod {
  name: string
  priceDelta: number
}

export interface OrderItem {
  productClientId: string
  name: string
  qty: number
  basePrice: number
  mods: OrderItemMod[]
  total: number
}

export type PaymentMethod = string

export type OrderType = string

export interface OrderTypeConfig {
  id: string
  name: string
  enabled: boolean
  surcharge: number
}

export interface Order extends BaseEntity {
  type: 'order'
  number: number
  ts: string // ISO время оформления
  items: OrderItem[]
  total: number
  payment: PaymentMethod
  orderType: OrderType
  orderTypeName: string
  orderTypeSurcharge: number
  status: 'paid' | 'refunded'
}

export interface Settings extends BaseEntity {
  type: 'settings'
  shopName: string
  paymentMethods: PaymentMethod[]
  orderTypes: OrderTypeConfig[]
  nextOrderNumber: number
}

export type AnyEntity = Category | ModifierGroup | Product | Order | Settings

export interface CartLine {
  productClientId: string
  name: string
  basePrice: number
  qty: number
  mods: OrderItemMod[]
}

export type SyncStatus = 'idle' | 'syncing' | 'offline' | 'error' | 'local'

export interface OutboxOp {
  id: string // uuid операции
  op: 'create' | 'update' | 'delete'
  action?: 'checkout' | 'refund' | 'editOrder'
  type: EntityType
  clientId: string
  payload?: AnyEntity
  ts: string
}
