import { makeAutoObservable, runInAction } from 'mobx'
import type { Session } from '@supabase/supabase-js'
import { isSupabaseConfigured, supabase, supabaseShopId } from '../api/supabase'

const DEVICE_KEY = 'piatto-device-id'
const PIN_SALT_KEY = 'piatto-offline-pin-salt'
const PIN_HASH_KEY = 'piatto-offline-pin-hash'
const ITERATIONS = 120_000

function b64(bytes: Uint8Array) { return btoa(String.fromCharCode(...bytes)) }
function bytes(value: string) { return Uint8Array.from(atob(value), c => c.charCodeAt(0)) }
async function hashPin(pin: string, salt: Uint8Array) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(pin), 'PBKDF2', false, ['deriveBits'])
  const result = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: salt as Uint8Array<ArrayBuffer>, iterations: ITERATIONS }, key, 256)
  return b64(new Uint8Array(result))
}
async function rememberPin(pin: string) { const salt=crypto.getRandomValues(new Uint8Array(16)); localStorage.setItem(PIN_SALT_KEY,b64(salt)); localStorage.setItem(PIN_HASH_KEY,await hashPin(pin,salt)) }
async function checkLocalPin(pin: string) { const s=localStorage.getItem(PIN_SALT_KEY), h=localStorage.getItem(PIN_HASH_KEY); return !!s && !!h && await hashPin(pin,bytes(s))===h }

export class AuthStore {
  session: Session | null = null
  loading = isSupabaseConfigured
  locked = true
  securityEnabled = false
  setupRequired = false
  deviceActive = false
  serviceUnavailable = false
  error: string | null = null
  readonly configured = isSupabaseConfigured
  deviceId = localStorage.getItem(DEVICE_KEY)

  constructor() {
    makeAutoObservable(this)
    if (!supabase) { this.loading=false; return }
    void this.initialize()
    window.addEventListener('online', () => void this.retryInitialize())
  }

  get authenticated() { return !this.configured || (this.deviceActive && !this.locked) }

  private async initialize() {
    runInAction(() => { this.loading=true; this.error=null; this.serviceUnavailable=false })
    if (!navigator.onLine && this.deviceId) {
      const { data: auth } = await supabase!.auth.getSession()
      runInAction(() => { this.session=auth.session; this.securityEnabled=true; this.deviceActive=true; this.loading=false })
      return
    }

    const [authResult, security] = await Promise.all([
      supabase!.auth.getSession(),
      supabase!.rpc('has_device_security', { p_shop_id: supabaseShopId }),
    ])
    if (authResult.error || security.error) {
      runInAction(() => {
        this.session=authResult.data.session
        this.setupRequired=false
        this.serviceUnavailable=true
        this.error='Не удалось проверить состояние кассы. Привязка устройства не изменена.'
        this.loading=false
      })
      return
    }

    runInAction(() => {
      this.session=authResult.data.session
      this.securityEnabled=security.data === true
      this.setupRequired=security.data === false && !!authResult.data.session
    })
    if (this.securityEnabled && this.session && this.deviceId) await this.validateDevice()
    runInAction(() => { this.loading=false })
  }

  async retryInitialize() { await this.initialize() }

  async legacySignIn(email: string, pin: string) {
    this.loading=true; this.error=null
    const { error } = await supabase!.auth.signInWithPassword({ email, password: pin })
    const { data } = await supabase!.auth.getSession()
    runInAction(() => { this.session=data.session; this.setupRequired=!error && !!data.session; this.error=error?'Неверный PIN-код':null; this.loading=false })
  }

  async bootstrap(name: string, workPin: string, adminPin: string) {
    this.loading=true; this.error=null
    const { data, error } = await supabase!.rpc('bootstrap_device',{ p_shop_id:supabaseShopId,p_name:name,p_work_pin:workPin,p_admin_pin:adminPin })
    if (!error) { localStorage.setItem(DEVICE_KEY,data); await rememberPin(workPin) }
    runInAction(() => { this.deviceId=data??this.deviceId; this.securityEnabled=!error; this.setupRequired=!!error; this.deviceActive=!error; this.locked=!!error; this.error=error?.message??null; this.loading=false })
  }

  async validateDevice() {
    if (!navigator.onLine || !this.session || !this.deviceId) return
    const { data, error } = await supabase!.rpc('verify_device',{p_shop_id:supabaseShopId,p_device_id:this.deviceId})
    if (error) {
      runInAction(() => { this.serviceUnavailable=true; this.error='Не удалось проверить привязку устройства. Повторите попытку.' })
      return
    }
    runInAction(() => { this.serviceUnavailable=false; this.deviceActive=Boolean(data?.active); if (!data?.active) { this.locked=true; this.error='Это устройство отвязано' } })
  }

  async unlock(pin: string) {
    this.loading=true; this.error=null
    let valid=false
    if (!navigator.onLine) valid=await checkLocalPin(pin).catch(()=>false)
    else if (this.deviceId) {
      const { data,error }=await supabase!.rpc('unlock_device',{p_shop_id:supabaseShopId,p_device_id:this.deviceId,p_pin:pin})
      if(error){runInAction(()=>{this.serviceUnavailable=true;this.error='Сервер временно недоступен. Привязка устройства сохранена.';this.loading=false});return false}
      valid=Boolean(data);if(valid)await rememberPin(pin)
    }
    runInAction(()=>{this.locked=!valid;this.deviceActive=valid||this.deviceActive;this.error=valid?null:'Неверный PIN-код';this.loading=false})
    return valid
  }

  async pair(tokenOrCode: string) {
    this.loading=true; this.error=null
    const isCode=/^\d{6}$/.test(tokenOrCode)
    const { data, error }=await supabase!.functions.invoke('redeem-device',{body:{shopId:supabaseShopId,...(isCode?{code:tokenOrCode}:{token:tokenOrCode})}})
    let errorMessage=data?.error as string|undefined
    if(error && 'context' in error && error.context instanceof Response) {
      const details=await error.context.clone().json().catch(()=>null) as {error?:string}|null
      errorMessage=details?.error
    }
    if (!error && data?.session) { await supabase!.auth.setSession({access_token:data.session.access_token,refresh_token:data.session.refresh_token}); localStorage.setItem(DEVICE_KEY,data.deviceId) }
    runInAction(()=>{this.session=data?.session??null;this.deviceId=data?.deviceId??null;this.deviceActive=!error;this.locked=true;this.error=errorMessage??error?.message??null;this.loading=false})
  }

  signOut() { this.locked=true; this.error=null }
}
