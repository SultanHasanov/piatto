import { makeAutoObservable, runInAction } from 'mobx'
import { api } from '../api/client'
import { supabase } from '../api/supabase'
import type { DataStore } from './DataStore'
import type { SyncStatus } from '../types'

const SYNC_INTERVAL_MS = 30_000

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
      await this.push()
      await this.pull()
      runInAction(() => {
        this.status = 'idle'
        this.lastSyncAt = new Date().toISOString()
      })
    } catch (error) {
      runInAction(() => {
        this.status = navigator.onLine ? 'error' : 'offline'
        this.lastError = error instanceof Error ? error.message : 'Ошибка синхронизации'
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
