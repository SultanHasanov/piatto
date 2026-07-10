import Dexie, { type EntityTable } from 'dexie'
import type { CartLine, Category, ModifierGroup, Order, OutboxOp, ParkedCart, Product, Settings, Shift } from '../types'

export interface PersistedAppState {
  categories: Category[]
  modifierGroups: ModifierGroup[]
  products: Product[]
  orders: Order[]
  settings: Settings | null
  outbox: OutboxOp[]
  seeded: boolean
  seedVersion?: number
}

interface KeyValueRecord {
  key: string
  value: unknown
}

class PiattoLocalDb extends Dexie {
  state!: EntityTable<KeyValueRecord, 'key'>

  constructor() {
    super('piatto-pos')
    this.version(1).stores({ state: '&key' })
  }
}

const db = new PiattoLocalDb()
const LEGACY_STORAGE_KEY = 'piatto-db'

/**
 * IndexedDB uses the structured-clone algorithm and cannot persist MobX
 * observable proxies. A JSON round trip also strips functions and `undefined`
 * fields that must never be part of the persisted application state.
 */
function toSerializable<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

export function emptyAppState(): PersistedAppState {
  return {
    categories: [],
    modifierGroups: [],
    products: [],
    orders: [],
    settings: null,
    outbox: [],
    seeded: false,
    seedVersion: 0,
  }
}

export async function loadAppState(): Promise<PersistedAppState> {
  const stored = await db.state.get('app')
  if (stored) return stored.value as PersistedAppState

  const legacy = localStorage.getItem(LEGACY_STORAGE_KEY)
  if (legacy) {
    const parsed = JSON.parse(legacy) as PersistedAppState
    await saveAppState(parsed)
    localStorage.removeItem(LEGACY_STORAGE_KEY)
    return parsed
  }

  return emptyAppState()
}

export async function saveAppState(value: PersistedAppState): Promise<void> {
  await db.state.put({ key: 'app', value: toSerializable(value) })
}

export async function loadCart(): Promise<CartLine[]> {
  const stored = await db.state.get('cart')
  return stored ? (stored.value as CartLine[]) : []
}

export async function saveCart(lines: CartLine[]): Promise<void> {
  await db.state.put({ key: 'cart', value: toSerializable(lines) })
}

export async function loadParked(): Promise<ParkedCart[]> {
  const stored = await db.state.get('parked')
  return stored ? (stored.value as ParkedCart[]) : []
}

export async function saveParked(parked: ParkedCart[]): Promise<void> {
  await db.state.put({ key: 'parked', value: toSerializable(parked) })
}

export async function loadShifts(): Promise<Shift[]> {
  const stored = await db.state.get('shifts')
  return stored ? (stored.value as Shift[]) : []
}

export async function saveShifts(shifts: Shift[]): Promise<void> {
  await db.state.put({ key: 'shifts', value: toSerializable(shifts) })
}

export async function requestPersistentStorage(): Promise<boolean> {
  if (!navigator.storage?.persist) return false
  if (await navigator.storage.persisted()) return true
  return navigator.storage.persist()
}
