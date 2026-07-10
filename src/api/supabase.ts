import { createClient } from '@supabase/supabase-js'

export const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim() ?? ''
export const supabasePublishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim() ?? ''
export const supabaseShopId = import.meta.env.VITE_SUPABASE_SHOP_ID?.trim() ?? ''

export const isSupabaseConfigured = Boolean(supabaseUrl && supabasePublishableKey && supabaseShopId)

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabasePublishableKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null
