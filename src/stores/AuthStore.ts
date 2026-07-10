import { makeAutoObservable, runInAction } from 'mobx'
import type { Session } from '@supabase/supabase-js'
import { isSupabaseConfigured, supabase } from '../api/supabase'

export class AuthStore {
  session: Session | null = null
  loading = isSupabaseConfigured
  error: string | null = null
  readonly configured = isSupabaseConfigured

  constructor() {
    makeAutoObservable(this)
    if (!supabase) return

    void supabase.auth.getSession().then(({ data, error }) => runInAction(() => {
      this.session = data.session
      this.error = error?.message ?? null
      this.loading = false
    }))

    supabase.auth.onAuthStateChange((_event, session) => runInAction(() => {
      this.session = session
      this.loading = false
    }))
  }

  async signIn(email: string, password: string): Promise<boolean> {
    if (!supabase) return false
    this.loading = true
    this.error = null
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    runInAction(() => {
      this.error = error
        ? (error.message.toLowerCase().includes('invalid login credentials')
            ? 'Неверный PIN-код'
            : 'Не удалось выполнить вход. Проверьте интернет и повторите попытку.')
        : null
      this.loading = false
    })
    return !error
  }

  async signOut() {
    if (!supabase) return
    await supabase.auth.signOut()
  }
}
