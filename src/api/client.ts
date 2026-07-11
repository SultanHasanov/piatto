import type { AnyEntity, OutboxOp } from '../types'
import { isSupabaseConfigured, supabase, supabaseShopId } from './supabase'

function requireClient() {
  if (!supabase || !isSupabaseConfigured) {
    throw new Error('Supabase не настроен. Заполните VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY и VITE_SUPABASE_SHOP_ID.')
  }
  return supabase
}

export const api = {
  configured: isSupabaseConfigured,

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
    const client = requireClient()
    const extension = file.name.split('.').pop()?.toLowerCase() || 'jpg'
    const path = `${supabaseShopId}/${folder}/${crypto.randomUUID()}.${extension}`
    const { error } = await client.storage.from('product-images').upload(path, file, {
      cacheControl: '31536000',
      upsert: false,
    })
    if (error) throw error
    return client.storage.from('product-images').getPublicUrl(path).data.publicUrl
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
