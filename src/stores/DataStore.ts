import { makeAutoObservable, runInAction, toJS } from 'mobx'
import { uuid } from '../utils/uuid'
import { saveAppState, saveShifts, type PersistedAppState } from '../db/localDb'
import { calculateOrderTotal, calculateShiftSummary } from '../domain/orderMath'
import type {
  AnyEntity,
  Category,
  ModifierGroup,
  Order,
  OrderItem,
  OrderRefund,
  OrderTypeConfig,
  OutboxOp,
  Product,
  Settings,
  Shift,
  ShiftSummary,
} from '../types'

export const SEED_VERSION = 3

const DEFAULT_ORDER_TYPES: OrderTypeConfig[] = [
  { id: 'dine-in', name: 'Зал', enabled: true, surcharge: 0 },
  { id: 'delivery', name: 'Доставка', enabled: true, surcharge: 0 },
  { id: 'vip', name: 'VIP', enabled: false, surcharge: 0 },
]

function defaultSettings(): Settings {
  return {
    clientId: uuid(),
    type: 'settings',
    shopName: 'Piatto',
    paymentMethods: ['Наличные', 'Карта', 'Перевод'],
    orderTypes: DEFAULT_ORDER_TYPES.map((orderType) => ({ ...orderType })),
    nextOrderNumber: 1,
    playSoundOnPay: true,
    updatedAt: new Date().toISOString(),
  }
}

function normalizeSettings(settings: Settings): Settings {
  return {
    ...settings,
    paymentMethods: settings.paymentMethods?.length ? settings.paymentMethods : ['Наличные', 'Карта', 'Перевод'],
    orderTypes: settings.orderTypes?.length
      ? settings.orderTypes.map((orderType) => ({
          ...orderType,
          name: orderType.id === 'vip' ? 'VIP' : orderType.name,
          enabled: orderType.enabled ?? true,
          surcharge: Math.max(0, Number(orderType.surcharge) || 0),
        }))
      : DEFAULT_ORDER_TYPES.map((orderType) => ({ ...orderType })),
    playSoundOnPay: settings.playSoundOnPay ?? true,
  }
}

export class DataStore {
  categories: Category[] = []
  modifierGroups: ModifierGroup[] = []
  products: Product[] = []
  orders: Order[] = []
  settings: Settings
  outbox: OutboxOp[] = []
  shifts: Shift[] = []
  storageError: string | null = null
  private persistQueue: Promise<void> = Promise.resolve()
  private persistShiftsQueue: Promise<void> = Promise.resolve()

  constructor(persisted: PersistedAppState, shifts: Shift[] = []) {
    makeAutoObservable(this)
    // Старые локальные смены (до перехода на синк) хранились без BaseEntity-полей — достраиваем их.
    this.shifts = shifts.map((shift) => ({
      ...shift,
      type: 'shift',
      updatedAt: shift.updatedAt ?? shift.closedAt ?? shift.openedAt,
    }))

    if (!persisted.seeded) {
      const settings = defaultSettings()
      this.categories = []
      this.modifierGroups = []
      this.products = []
      this.settings = settings
      this.orders = []
      this.outbox = [
        this.makeOp('create', settings),
      ]
    } else {
      this.categories = persisted.categories
      this.modifierGroups = persisted.modifierGroups
      this.products = persisted.products
      this.orders = persisted.orders.map((o) => ({
        ...o,
        orderType: (o as { orderType?: Order['orderType'] }).orderType ?? 'dine-in',
      }))
      this.settings = persisted.settings ?? defaultSettings()
      this.outbox = persisted.outbox
    }
    this.settings = normalizeSettings(this.settings)
    this.orders = this.orders.map((order) => {
      const configuredType = this.settings.orderTypes.find((orderType) => orderType.id === order.orderType)
      return {
        ...order,
        orderTypeName: order.orderType === 'vip' ? 'VIP' : (order.orderTypeName ?? configuredType?.name ?? (order.orderType === 'delivery' ? 'Доставка' : 'Зал')),
        orderTypeSurcharge: Math.max(0, Number(order.orderTypeSurcharge) || 0),
      }
    })
    this.persist()
  }

  private persist() {
    const snapshot = toJS({
      categories: this.categories,
      modifierGroups: this.modifierGroups,
      products: this.products,
      orders: this.orders,
      settings: this.settings,
      outbox: this.outbox,
      seeded: true,
      seedVersion: SEED_VERSION,
    }) as PersistedAppState

    this.persistQueue = this.persistQueue
      .then(() => saveAppState(snapshot))
      .then(() => runInAction(() => { this.storageError = null }))
      .catch((error: unknown) => {
        runInAction(() => {
          this.storageError = error instanceof Error ? error.message : 'Не удалось сохранить локальные данные'
        })
      })
  }

  private makeOp(op: OutboxOp['op'], entity: AnyEntity, action?: OutboxOp['action']): OutboxOp {
    return { id: uuid(), op, action, type: entity.type, clientId: entity.clientId, payload: op === 'delete' ? undefined : toJS(entity), ts: new Date().toISOString() }
  }

  private enqueue(op: OutboxOp['op'], entity: AnyEntity) {
    if (op === 'update') {
      const pending = [...this.outbox].reverse().find((item) => !item.action && item.type === entity.type && item.clientId === entity.clientId && item.op !== 'delete')
      if (pending) {
        pending.payload = toJS(entity)
        pending.ts = new Date().toISOString()
        return
      }
    }
    this.outbox.push(this.makeOp(op, entity))
  }

  private enqueueDomain(action: NonNullable<OutboxOp['action']>, order: Order) {
    this.outbox.push(this.makeOp(action === 'checkout' ? 'create' : 'update', order, action))
  }

  private commit() {
    this.persist()
  }

  private persistShifts() {
    const snapshot = toJS(this.shifts)
    this.persistShiftsQueue = this.persistShiftsQueue
      .then(() => saveShifts(snapshot))
      .then(() => runInAction(() => { this.storageError = null }))
      .catch((error: unknown) => runInAction(() => {
        this.storageError = error instanceof Error ? error.message : 'Не удалось сохранить смену'
      }))
  }

  // ---------- Categories ----------
  addCategory(data: Omit<Category, 'clientId' | 'type' | 'updatedAt'>): Category {
    const entity: Category = { ...data, clientId: uuid(), type: 'category', updatedAt: new Date().toISOString() }
    this.categories.push(entity)
    this.enqueue('create', entity)
    this.commit()
    return entity
  }

  updateCategory(clientId: string, patch: Partial<Category>) {
    const item = this.categories.find((c) => c.clientId === clientId)
    if (!item) return
    Object.assign(item, patch, { updatedAt: new Date().toISOString() })
    this.enqueue('update', item)
    this.commit()
  }

  removeCategory(clientId: string) {
    const idx = this.categories.findIndex((c) => c.clientId === clientId)
    if (idx === -1) return
    const [item] = this.categories.splice(idx, 1)
    this.enqueue('delete', item)
    this.commit()
  }

  // ---------- Modifier groups ----------
  addModifierGroup(data: Omit<ModifierGroup, 'clientId' | 'type' | 'updatedAt'>): ModifierGroup {
    const entity: ModifierGroup = { ...data, clientId: uuid(), type: 'modifierGroup', updatedAt: new Date().toISOString() }
    this.modifierGroups.push(entity)
    this.enqueue('create', entity)
    this.commit()
    return entity
  }

  updateModifierGroup(clientId: string, patch: Partial<ModifierGroup>) {
    const item = this.modifierGroups.find((g) => g.clientId === clientId)
    if (!item) return
    Object.assign(item, patch, { updatedAt: new Date().toISOString() })
    this.enqueue('update', item)
    this.commit()
  }

  removeModifierGroup(clientId: string) {
    const idx = this.modifierGroups.findIndex((g) => g.clientId === clientId)
    if (idx === -1) return
    const [item] = this.modifierGroups.splice(idx, 1)
    this.products.forEach((p) => {
      p.modifierGroupIds = p.modifierGroupIds.filter((id) => id !== clientId)
    })
    this.enqueue('delete', item)
    this.commit()
  }

  // ---------- Products ----------
  addProduct(data: Omit<Product, 'clientId' | 'type' | 'updatedAt'>): Product {
    const entity: Product = { ...data, clientId: uuid(), type: 'product', updatedAt: new Date().toISOString() }
    this.products.push(entity)
    this.enqueue('create', entity)
    this.commit()
    return entity
  }

  updateProduct(clientId: string, patch: Partial<Product>) {
    const item = this.products.find((p) => p.clientId === clientId)
    if (!item) return
    Object.assign(item, patch, { updatedAt: new Date().toISOString() })
    this.enqueue('update', item)
    this.commit()
  }

  removeProduct(clientId: string) {
    const idx = this.products.findIndex((p) => p.clientId === clientId)
    if (idx === -1) return
    const [item] = this.products.splice(idx, 1)
    this.enqueue('delete', item)
    this.commit()
  }

  adjustStock(clientId: string, delta: number) {
    const item = this.products.find((p) => p.clientId === clientId)
    if (!item || item.stock === null) return
    item.stock += delta
    item.updatedAt = new Date().toISOString()
    this.enqueue('update', item)
    this.commit()
  }

  // ---------- Orders ----------
  checkoutOrder(data: Omit<Order, 'clientId' | 'type' | 'updatedAt' | 'number'>): Order {
    const number = this.settings.nextOrderNumber
    const entity: Order = { ...data, clientId: uuid(), type: 'order', number, updatedAt: new Date().toISOString() }
    this.orders.push(entity)
    this.settings.nextOrderNumber = number + 1
    this.settings.updatedAt = new Date().toISOString()
    entity.items.forEach((line) => {
      const product = this.products.find((item) => item.clientId === line.productClientId)
      if (product?.stock !== null && product) {
        product.stock -= line.qty
        product.updatedAt = entity.updatedAt
      }
    })
    this.enqueueDomain('checkout', entity)
    this.commit()
    return entity
  }

  refundOrder(clientId: string) {
    const item = this.orders.find((o) => o.clientId === clientId)
    if (!item || item.status === 'refunded') return
    const now = new Date().toISOString()
    item.status = 'refunded'
    item.refundedAt = now
    item.updatedAt = now
    item.items.forEach((line) => {
      const product = this.products.find((p) => p.clientId === line.productClientId)
      if (product && product.stock !== null) {
        product.stock += line.qty
        product.updatedAt = now
      }
    })
    this.enqueueDomain('refund', item)
    this.commit()
  }

  /**
   * Частичный возврат: returnQty — сколько вернуть по каждой позиции (по индексу в order.items).
   * Если возвращается всё — делегирует в refundOrder (статус меняется на 'refunded').
   * Иначе статус остаётся 'paid', возврат добавляется в order.refunds, стоки и total пересчитываются.
   */
  refundOrderItems(clientId: string, returnQty: Map<number, number>) {
    const order = this.orders.find((o) => o.clientId === clientId)
    if (!order || order.status === 'refunded') return

    const totalReturning = order.items.reduce((sum, line, index) => sum + Math.min(returnQty.get(index) ?? 0, line.qty), 0)
    const totalRemaining = order.items.reduce((sum, line) => sum + line.qty, 0) - totalReturning
    if (totalReturning <= 0) return
    if (totalRemaining <= 0) {
      this.refundOrder(clientId)
      return
    }

    const now = new Date().toISOString()
    const refundedItems: OrderRefund['items'] = []
    let refundAmount = 0
    const nextItems: OrderItem[] = []

    order.items.forEach((line, index) => {
      const qtyToReturn = Math.min(returnQty.get(index) ?? 0, line.qty)
      if (qtyToReturn > 0) {
        const unitPrice = line.basePrice + line.mods.reduce((s, m) => s + m.priceDelta, 0)
        const sum = unitPrice * qtyToReturn
        refundedItems.push({ name: line.name, qty: qtyToReturn, sum })
        refundAmount += sum

        const product = this.products.find((p) => p.clientId === line.productClientId)
        if (product && product.stock !== null) {
          product.stock += qtyToReturn
          product.updatedAt = now
        }
      }
      const remainingQty = line.qty - qtyToReturn
      if (remainingQty > 0) {
        nextItems.push({ ...line, qty: remainingQty, total: (line.basePrice + line.mods.reduce((s, m) => s + m.priceDelta, 0)) * remainingQty })
      }
    })

    order.items = nextItems
    order.total = calculateOrderTotal(nextItems, order.orderTypeSurcharge ?? 0)
    order.refunds = [...(order.refunds ?? []), { ts: now, amount: refundAmount, items: refundedItems }]
    order.refundedAt = now
    order.updatedAt = now
    this.enqueueDomain('editOrder', order)
    this.commit()
  }

  updateOrderItems(
    clientId: string,
    items: OrderItem[],
    meta?: { payment?: string; orderType?: string; orderTypeName?: string; orderTypeSurcharge?: number },
  ) {
    const order = this.orders.find((o) => o.clientId === clientId)
    if (!order || order.status === 'refunded' || items.length === 0) return

    const oldQtyByProduct = new Map<string, number>()
    const newQtyByProduct = new Map<string, number>()

    order.items.forEach((line) => {
      oldQtyByProduct.set(
        line.productClientId,
        (oldQtyByProduct.get(line.productClientId) ?? 0) + line.qty,
      )
    })
    items.forEach((line) => {
      newQtyByProduct.set(
        line.productClientId,
        (newQtyByProduct.get(line.productClientId) ?? 0) + line.qty,
      )
    })

    const productIds = new Set([...oldQtyByProduct.keys(), ...newQtyByProduct.keys()])
    const now = new Date().toISOString()

    productIds.forEach((productClientId) => {
      const delta = (oldQtyByProduct.get(productClientId) ?? 0) - (newQtyByProduct.get(productClientId) ?? 0)
      if (delta === 0) return

      const product = this.products.find((p) => p.clientId === productClientId)
      if (!product || product.stock === null) return

      product.stock += delta
      product.updatedAt = now
    })

    if (meta?.payment) order.payment = meta.payment
    if (meta?.orderType) {
      order.orderType = meta.orderType
      if (meta.orderTypeName !== undefined) order.orderTypeName = meta.orderTypeName
      order.orderTypeSurcharge = Math.max(0, Number(meta.orderTypeSurcharge) || 0)
    }

    order.items = items
    order.total = calculateOrderTotal(items, order.orderTypeSurcharge ?? 0)
    order.updatedAt = now
    this.enqueueDomain('editOrder', order)
    this.commit()
  }

  // ---------- Settings ----------
  updateSettings(patch: Partial<Settings>) {
    Object.assign(this.settings, patch, { updatedAt: new Date().toISOString() })
    this.enqueue('update', this.settings)
    this.commit()
  }

  // ---------- Shifts (синхронизируются с Supabase как обычные сущности) ----------
  get activeShift(): Shift | undefined {
    return this.shifts.find((shift) => !shift.closedAt)
  }

  openShift(openingCash: number): Shift {
    const shift: Shift = {
      clientId: uuid(),
      type: 'shift',
      updatedAt: new Date().toISOString(),
      openedAt: new Date().toISOString(),
      openingCash: Math.max(0, Number(openingCash) || 0),
      cashMovements: [],
    }
    this.shifts.push(shift)
    this.persistShifts()
    this.enqueue('create', shift)
    this.commit()
    return shift
  }

  addCashMovement(kind: 'in' | 'out', amount: number, note?: string) {
    const shift = this.activeShift
    if (!shift || amount <= 0) return
    shift.cashMovements.push({ id: uuid(), ts: new Date().toISOString(), kind, amount, note })
    shift.updatedAt = new Date().toISOString()
    this.persistShifts()
    this.enqueue('update', shift)
    this.commit()
  }

  shiftSummary(shift: Shift): ShiftSummary {
    return calculateShiftSummary(this.orders, shift.openingCash, shift.cashMovements, shift.openedAt, shift.closedAt)
  }

  closeShift(actualCash: number): Shift | undefined {
    const shift = this.activeShift
    if (!shift) return undefined
    shift.closedAt = new Date().toISOString()
    const summary = this.shiftSummary(shift)
    shift.closing = { actualCash: Math.max(0, Number(actualCash) || 0), expectedCash: summary.expectedCash, summary }
    shift.updatedAt = shift.closedAt
    this.persistShifts()
    this.enqueue('update', shift)
    this.commit()
    return shift
  }

  // ---------- Outbox / sync support ----------
  removeFromOutbox(opId: string) {
    this.outbox = this.outbox.filter((o) => o.id !== opId)
    this.commit()
  }

  findEntity(clientId: string, type: AnyEntity['type']): AnyEntity | undefined {
    return this.listFor(type).find((entity) => entity.clientId === clientId)
  }

  queueFullUpload() {
    const entities: AnyEntity[] = [
      ...this.categories,
      ...this.modifierGroups,
      ...this.products,
      ...this.orders,
      ...this.shifts,
      this.settings,
    ]
    const pendingKeys = new Set(this.outbox.map((operation) => `${operation.type}:${operation.clientId}`))
    entities.forEach((entity) => {
      const key = `${entity.type}:${entity.clientId}`
      if (!pendingKeys.has(key)) this.outbox.push(this.makeOp('create', entity))
    })
    this.commit()
  }

  private listFor(type: AnyEntity['type']): AnyEntity[] {
    switch (type) {
      case 'category':
        return this.categories
      case 'modifierGroup':
        return this.modifierGroups
      case 'product':
        return this.products
      case 'order':
        return this.orders
      case 'settings':
        return [this.settings]
      case 'shift':
        return this.shifts
    }
  }

  mergeRemote(remote: AnyEntity[]) {
    runInAction(() => {
      for (const entity of remote) {
        this.mergeOne(entity)
      }
      this.commit()
      if (remote.some((entity) => entity.type === 'shift')) this.persistShifts()
    })
  }

  private mergeOne(entity: AnyEntity) {
    if (entity.type === 'settings') {
      const remoteIsNewer = (entity.version ?? 0) > (this.settings?.version ?? 0)
        || ((entity.version ?? 0) === (this.settings?.version ?? 0) && new Date(entity.updatedAt) > new Date(this.settings.updatedAt))
      if (!this.settings || remoteIsNewer) {
        this.settings = normalizeSettings(entity as Settings)
      }
      return
    }
    const normalizedEntity = entity.type === 'order'
      ? {
          ...entity,
          orderTypeName: entity.orderType === 'vip'
            ? 'VIP'
            : (entity.orderTypeName
              ?? this.settings.orderTypes.find((orderType) => orderType.id === entity.orderType)?.name
              ?? (entity.orderType === 'delivery' ? 'Доставка' : 'Зал')),
          orderTypeSurcharge: Math.max(0, Number(entity.orderTypeSurcharge) || 0),
        }
      : entity
    const list = this.listFor(normalizedEntity.type) as AnyEntity[]
    const existingIdx = list.findIndex((e) => e.clientId === normalizedEntity.clientId)
    if (existingIdx === -1) {
      if (!normalizedEntity.deleted) (list as AnyEntity[]).push(normalizedEntity)
      return
    }
    const existing = list[existingIdx]
    const remoteIsNewer = (normalizedEntity.version ?? 0) > (existing.version ?? 0)
      || ((normalizedEntity.version ?? 0) === (existing.version ?? 0) && new Date(normalizedEntity.updatedAt) >= new Date(existing.updatedAt))
    if (remoteIsNewer) {
      if (normalizedEntity.deleted) {
        list.splice(existingIdx, 1)
      } else {
        list[existingIdx] = normalizedEntity
      }
    }
  }
}
