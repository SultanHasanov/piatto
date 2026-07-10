import { makeAutoObservable, runInAction, toJS } from 'mobx'
import type { CartLine, OrderItemMod, ParkedCart } from '../types'
import { saveCart, saveParked } from '../db/localDb'
import { uuid } from '../utils/uuid'

function lineTotal(line: CartLine): number {
  const modsSum = line.mods.reduce((s, m) => s + m.priceDelta, 0)
  return (line.basePrice + modsSum) * line.qty
}

export class CartStore {
  lines: CartLine[] = []
  parked: ParkedCart[] = []
  storageError: string | null = null
  private persistQueue: Promise<void> = Promise.resolve()
  private persistParkedQueue: Promise<void> = Promise.resolve()

  constructor(initialLines: CartLine[] = [], initialParked: ParkedCart[] = []) {
    this.lines = initialLines
    this.parked = initialParked
    makeAutoObservable(this)
  }

  private persist() {
    const snapshot = toJS(this.lines)
    this.persistQueue = this.persistQueue
      .then(() => saveCart(snapshot))
      .then(() => runInAction(() => { this.storageError = null }))
      .catch((error: unknown) => runInAction(() => {
        this.storageError = error instanceof Error ? error.message : 'Не удалось сохранить корзину'
      }))
  }

  private persistParked() {
    const snapshot = toJS(this.parked)
    this.persistParkedQueue = this.persistParkedQueue
      .then(() => saveParked(snapshot))
      .then(() => runInAction(() => { this.storageError = null }))
      .catch((error: unknown) => runInAction(() => {
        this.storageError = error instanceof Error ? error.message : 'Не удалось сохранить отложенные чеки'
      }))
  }

  get total() {
    return this.lines.reduce((s, l) => s + lineTotal(l), 0)
  }

  get count() {
    return this.lines.reduce((s, l) => s + l.qty, 0)
  }

  add(productClientId: string, name: string, basePrice: number, mods: OrderItemMod[] = []) {
    // строки с разным набором модификаторов не объединяем — считаем их отдельными позициями
    const modsKey = JSON.stringify([...mods].sort((a, b) => a.name.localeCompare(b.name)))
    const existing = this.lines.find(
      (l) => l.productClientId === productClientId && JSON.stringify([...l.mods].sort((a, b) => a.name.localeCompare(b.name))) === modsKey
    )
    if (existing) {
      existing.qty += 1
    } else {
      this.lines.push({ productClientId, name, basePrice, qty: 1, mods })
    }
    this.persist()
  }

  setQty(index: number, qty: number) {
    if (qty < 1) qty = 1
    this.lines[index].qty = qty
    this.persist()
  }

  increment(index: number) {
    this.lines[index].qty += 1
    this.persist()
  }

  /** Уменьшает количество, но не ниже 1 — удалить позицию можно только явно кнопкой корзины. */
  decrement(index: number) {
    const line = this.lines[index]
    if (line.qty > 1) line.qty -= 1
    this.persist()
  }

  removeAt(index: number): { line: CartLine; index: number } {
    const [line] = this.lines.splice(index, 1)
    this.persist()
    return { line, index }
  }

  restoreAt(index: number, line: CartLine) {
    this.lines.splice(Math.min(index, this.lines.length), 0, line)
    this.persist()
  }

  clear() {
    this.lines = []
    this.persist()
  }

  lineTotal(line: CartLine) {
    return lineTotal(line)
  }

  /** Откладывает текущий чек и освобождает корзину для следующего клиента. */
  park(note?: string) {
    if (this.lines.length === 0) return
    this.parked.push({ id: uuid(), ts: new Date().toISOString(), lines: toJS(this.lines), note })
    this.persistParked()
    this.clear()
  }

  /** Возвращает отложенный чек в корзину. Если корзина не пуста — текущий чек тоже откладывается (swap). */
  resume(id: string) {
    const idx = this.parked.findIndex((p) => p.id === id)
    if (idx === -1) return
    const [resumed] = this.parked.splice(idx, 1)
    this.persistParked()
    if (this.lines.length > 0) this.park()
    this.lines = resumed.lines
    this.persist()
  }

  discardParked(id: string) {
    this.parked = this.parked.filter((p) => p.id !== id)
    this.persistParked()
  }

  parkedTotal(parked: ParkedCart) {
    return parked.lines.reduce((s, l) => s + lineTotal(l), 0)
  }
}
