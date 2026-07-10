export type EntityType = 'category' | 'product' | 'modifierGroup' | 'order' | 'settings' | 'shift'

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

export interface OrderRefund {
  ts: string // ISO время возврата
  amount: number
  items: { name: string; qty: number; sum: number }[]
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
  refunds?: OrderRefund[] // частичные возвраты; status остаётся 'paid', пока не возвращено всё
  refundedAt?: string // ISO — момент последнего (или полного) возврата
}

export interface Settings extends BaseEntity {
  type: 'settings'
  shopName: string
  paymentMethods: PaymentMethod[]
  orderTypes: OrderTypeConfig[]
  nextOrderNumber: number
  printReceiptAfterPay?: boolean
  playSoundOnPay?: boolean
}

export type AnyEntity = Category | ModifierGroup | Product | Order | Settings | Shift

export interface CartLine {
  productClientId: string
  name: string
  basePrice: number
  qty: number
  mods: OrderItemMod[]
}

// Отложенный чек намеренно остаётся локальным (для клиента, ждущего у кассы) — в Supabase не синхронизируется.
export interface ParkedCart {
  id: string
  ts: string // ISO — когда отложен
  lines: CartLine[]
  note?: string
}

export interface CashMovement {
  id: string
  ts: string // ISO
  kind: 'in' | 'out'
  amount: number
  note?: string
}

export interface ShiftPaymentBreakdown {
  payment: string
  orders: number
  total: number
}

export interface ShiftSummary {
  revenue: number
  ordersCount: number
  itemsSold: number
  byPayment: ShiftPaymentBreakdown[]
  refundsTotal: number
  refundsCount: number
  cashSalesTotal: number
  cashRefundsTotal: number
  cashIn: number
  cashOut: number
  expectedCash: number
}

export interface ShiftClosing {
  actualCash: number
  expectedCash: number
  summary: ShiftSummary
}

export interface Shift extends BaseEntity {
  type: 'shift'
  openedAt: string // ISO
  closedAt?: string // ISO
  openingCash: number
  cashMovements: CashMovement[]
  closing?: ShiftClosing
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
