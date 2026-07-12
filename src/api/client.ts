import type { AnyEntity, OutboxOp } from '../types'
import { isSupabaseConfigured, supabase, supabaseShopId, toCanonicalUrl } from './supabase'
import { uuid } from '../utils/uuid'

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024
export const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const

function imageExtension(type: string): string {
  if (type === 'image/png') return 'png'
  if (type === 'image/webp') return 'webp'
  return 'jpg'
}

function validateImage(file: Blob): void {
  if (!ALLOWED_IMAGE_TYPES.includes(file.type as typeof ALLOWED_IMAGE_TYPES[number])) {
    throw new Error('Поддерживаются только JPEG, PNG и WebP')
  }
  if (file.size > MAX_IMAGE_BYTES) throw new Error('Изображение не должно превышать 5 МБ')
}

function requireClient() {
  if (!supabase || !isSupabaseConfigured) {
    throw new Error('Supabase не настроен. Заполните VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY и VITE_SUPABASE_SHOP_ID.')
  }
  return supabase
}

export const api = {
  configured: isSupabaseConfigured,

  async createDevicePairing(deviceId: string, adminPin: string, deviceName: string) {
    const { data, error } = await requireClient().rpc('create_device_pairing', { p_shop_id: supabaseShopId, p_device_id: deviceId, p_admin_pin: adminPin, p_device_name: deviceName })
    if (error) throw error
    return data as { id:string; token:string; code:string; expiresAt:string; deviceName:string }
  },

  async listDevices(deviceId: string, adminPin: string) {
    const { data, error } = await requireClient().rpc('list_devices', { p_shop_id: supabaseShopId, p_device_id: deviceId, p_admin_pin: adminPin })
    if (error) throw error
    return data as Array<{id:string;name:string;primary:boolean;lastSeenAt:string;createdAt:string;revokedAt:string|null}>
  },

  async revokeDevice(deviceId:string,targetId:string,adminPin:string) {
    const { error }=await requireClient().rpc('revoke_device',{p_shop_id:supabaseShopId,p_device_id:deviceId,p_target_id:targetId,p_admin_pin:adminPin})
    if(error)throw error
  },

  async transferPrimaryDevice(deviceId:string,targetId:string,adminPin:string) {
    const { error }=await requireClient().rpc('transfer_primary_device',{p_shop_id:supabaseShopId,p_device_id:deviceId,p_target_id:targetId,p_admin_pin:adminPin})
    if(error)throw error
  },

  async emergencyClaimPrimary(deviceId:string,adminPin:string) {
    const { error }=await requireClient().rpc('emergency_claim_primary',{p_shop_id:supabaseShopId,p_device_id:deviceId,p_admin_pin:adminPin})
    if(error)throw error
  },

  async fetchAll(): Promise<AnyEntity[]> {
    const client = requireClient()
    const { data, error } = await client.rpc('pull_shop_state', { p_shop_id: supabaseShopId })
    if (error) throw error
    return (data ?? []) as AnyEntity[]
  },

  async applyOperation(operation: OutboxOp): Promise<AnyEntity[]> {
    const client = requireClient()
    const { data, error } = await client.rpc('apply_sync_operation', {
      p_shop_id: supabaseShopId,
      p_operation: operation,
    })
    if (error) throw error
    return (data ?? []) as AnyEntity[]
  },

  async uploadImage(file: File, folder: 'products' | 'categories' = 'products'): Promise<string> {
    validateImage(file)
    const client = requireClient()
    const extension = file.name.split('.').pop()?.toLowerCase() || 'jpg'
    const path = `${supabaseShopId}/${folder}/${uuid()}.${extension}`
    const { error } = await client.storage.from('product-images').upload(path, file, {
      cacheControl: '31536000',
      upsert: false,
    })
    if (error) throw error
    return toCanonicalUrl(client.storage.from('product-images').getPublicUrl(path).data.publicUrl)
  },

  async uploadMigratedImage(blob: Blob, clientId: string, folder: 'products' | 'categories'): Promise<string> {
    validateImage(blob)
    const client = requireClient()
    const path = `${supabaseShopId}/${folder}/${clientId}.${imageExtension(blob.type)}`
    const { error } = await client.storage.from('product-images').upload(path, blob, {
      cacheControl: '31536000',
      upsert: true,
      contentType: blob.type,
    })
    if (error) throw error
    return toCanonicalUrl(client.storage.from('product-images').getPublicUrl(path).data.publicUrl)
  },

  async uploadProductImage(file: File): Promise<string> {
    return this.uploadImage(file, 'products')
  },

  async getUsage(): Promise<{ storageBytes: number; dbBytes: number }> {
    const client = requireClient()
    const { data, error } = await client.rpc('get_shop_usage', { p_shop_id: supabaseShopId })
    if (error) throw error
    return { storageBytes: data?.storage_bytes ?? 0, dbBytes: data?.db_bytes ?? 0 }
  },
}
