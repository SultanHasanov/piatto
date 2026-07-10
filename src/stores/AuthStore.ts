import { makeAutoObservable, runInAction } from 'mobx'
import type { Session } from '@supabase/supabase-js'
import { isSupabaseConfigured, supabase } from '../api/supabase'

const OFFLINE_SALT_KEY = 'piatto-offline-pin-salt'
const OFFLINE_HASH_KEY = 'piatto-offline-pin-hash'
const PBKDF2_ITERATIONS = 120_000

function bytesToBase64(bytes: Uint8Array): string {
  let binary = ''
  bytes.forEach((byte) => { binary += String.fromCharCode(byte) })
  return btoa(binary)
}

function base64ToBytes(value: string): Uint8Array {
  return Uint8Array.from(atob(value), (character) => character.charCodeAt(0))
}

async function derivePinHash(password: string, salt: Uint8Array): Promise<string> {
  const material = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits'],
  )
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: salt as Uint8Array<ArrayBuffer>, iterations: PBKDF2_ITERATIONS },
    material,
    256,
  )
  return bytesToBase64(new Uint8Array(bits))
}

async function rememberOfflinePin(password: string): Promise<void> {
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const hash = await derivePinHash(password, salt)
  localStorage.setItem(OFFLINE_SALT_KEY, bytesToBase64(salt))
  localStorage.setItem(OFFLINE_HASH_KEY, hash)
}

async function verifyOfflinePin(password: string): Promise<boolean> {
  const encodedSalt = localStorage.getItem(OFFLINE_SALT_KEY)
  const expectedHash = localStorage.getItem(OFFLINE_HASH_KEY)
  if (!encodedSalt || !expectedHash) return false
  return derivePinHash(password, base64ToBytes(encodedSalt)).then((hash) => hash === expectedHash)
}

export class AuthStore {
  session: Session | null = null
  offlineUnlocked = false
  loading = isSupabaseConfigured
  error: string | null = null
  readonly configured = isSupabaseConfigured

  constructor() {
    makeAutoObservable(this)
    if (!supabase) return

    void supabase.auth.getSession()
      .then(({ data, error }) => runInAction(() => {
        this.session = data.session
        this.error = error?.message ?? null
      }))
      .catch(() => undefined)
      .finally(() => runInAction(() => { this.loading = false }))

    supabase.auth.onAuthStateChange((_event, session) => runInAction(() => {
      this.session = session
      this.loading = false
    }))

    window.addEventListener('online', () => runInAction(() => {
      if (this.offlineUnlocked && !this.session) {
        this.offlineUnlocked = false
        this.error = 'Интернет восстановлен. Введите PIN для синхронизации данных.'
      }
    }))
  }

  get authenticated(): boolean {
    return Boolean(this.session) || this.offlineUnlocked
  }

  private async tryOfflineUnlock(password: string): Promise<boolean> {
    const valid = await verifyOfflinePin(password).catch(() => false)
    runInAction(() => {
      this.offlineUnlocked = valid
      this.error = valid
        ? null
        : (localStorage.getItem(OFFLINE_HASH_KEY)
            ? 'Неверный PIN-код'
            : 'Для первого офлайн-входа нужно один раз войти с интернетом')
      this.loading = false
    })
    return valid
  }

  async signIn(email: string, password: string): Promise<boolean> {
    if (!supabase) return false
    this.loading = true
    this.error = null

    if (!navigator.onLine) return this.tryOfflineUnlock(password)

    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (!error) {
        await rememberOfflinePin(password)
        runInAction(() => {
          this.offlineUnlocked = false
          this.error = null
          this.loading = false
        })
        return true
      }

      const message = error.message.toLowerCase()
      if (message.includes('fetch') || message.includes('network')) return this.tryOfflineUnlock(password)
      runInAction(() => {
        this.error = message.includes('invalid login credentials') ? 'Неверный PIN-код' : 'Не удалось выполнить вход'
        this.loading = false
      })
      return false
    } catch {
      return this.tryOfflineUnlock(password)
    }
  }

  async signOut() {
    runInAction(() => {
      this.offlineUnlocked = false
      this.session = null
      this.error = null
    })
    if (!supabase) return
    await supabase.auth.signOut({ scope: 'local' }).catch(() => undefined)
  }
}
