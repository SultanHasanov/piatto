import { makeAutoObservable, runInAction } from 'mobx'
import { api } from '../api/client'
import { supabase } from '../api/supabase'
import type { DataStore } from './DataStore'
import type { SyncStatus } from '../types'

const SYNC_INTERVAL_MS = 30_000

function syncErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  if (error && typeof error === 'object') {
    const value = error as { message?: unknown; details?: unknown; hint?: unknown; code?: unknown }
    const parts = [value.message, value.details, value.hint]
      .filter((part): part is string => typeof part === 'string' && part.length > 0)
    if (typeof value.code === 'string') parts.push(`Код: ${value.code}`)
    if (parts.length) return parts.join(' · ')
  }
  return 'Неизвестная ошибка синхронизации'
}

export class SyncStore {
  status: SyncStatus = api.configured ? (navigator.onLine ? 'idle' : 'offline') : 'local'
  lastSyncAt: string | null = null
  lastError: string | null = null
  private running = false
  private data: DataStore

  constructor(data: DataStore) {
    this.data = data
    makeAutoObservable(this)
    window.addEventListener('online', () => this.syncNow())
    window.addEventListener('offline', () => runInAction(() => (this.status = 'offline')))
    setInterval(() => this.syncNow(), SYNC_INTERVAL_MS)
    supabase?.auth.onAuthStateChange((_event, session) => {
      if (session) void this.syncNow()
    })
    void this.syncNow()
  }

  get pendingCount() {
    return this.data.outbox.length
  }

  async syncNow() {
    if (!api.configured) {
      this.status = 'local'
      return
    }
    if (this.running) return
    if (!navigator.onLine) {
      runInAction(() => (this.status = 'offline'))
      return
    }
    this.running = true
    runInAction(() => {
      this.status = 'syncing'
      this.lastError = null
    })
    try {
      const { data: authData } = await supabase!.auth.getSession()
      if (!authData.session) {
        throw new Error('Нет серверной сессии. Выйдите и войдите по PIN при включённом интернете.')
      }
      await this.push()
      await this.pull()
      runInAction(() => {
        this.status = 'idle'
        this.lastSyncAt = new Date().toISOString()
      })
    } catch (error) {
      runInAction(() => {
        this.status = navigator.onLine ? 'error' : 'offline'
        this.lastError = syncErrorMessage(error)
      })
    } finally {
      this.running = false
    }
  }

  private async push() {
    const operations = [...this.data.outbox]
    for (const operation of operations) {
      const current = this.data.findEntity(operation.clientId, operation.type)
      const effectiveOperation = operation.payload && current
        ? { ...operation, payload: { ...operation.payload, version: current.version } }
        : operation
      const changed = await api.applyOperation(effectiveOperation)
      if (changed.length) this.data.mergeRemote(changed)
      this.data.removeFromOutbox(operation.id)
    }
  }

  private async pull() {
    const remote = await api.fetchAll()
    this.data.mergeRemote(remote)
  }
}
