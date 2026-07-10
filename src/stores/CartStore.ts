import { makeAutoObservable, runInAction, toJS } from 'mobx'
import type { CartLine, OrderItemMod } from '../types'
import { saveCart } from '../db/localDb'

function lineTotal(line: CartLine): number {
  const modsSum = line.mods.reduce((s, m) => s + m.priceDelta, 0)
  return (line.basePrice + modsSum) * line.qty
}

export class CartStore {
  lines: CartLine[] = []
  storageError: string | null = null
  private persistQueue: Promise<void> = Promise.resolve()

  constructor(initialLines: CartLine[] = []) {
    this.lines = initialLines
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
}
