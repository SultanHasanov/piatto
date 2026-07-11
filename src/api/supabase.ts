import { createClient } from '@supabase/supabase-js'

// Канонический адрес проекта Supabase (*.supabase.co). В рантайме все запросы идут
// через same-origin прокси /supabase-proxy (vercel.json в проде, server.proxy в dev),
// потому что supabase.co блокируется некоторыми провайдерами в РФ.
export const supabaseCanonicalUrl = (import.meta.env.VITE_SUPABASE_URL?.trim() ?? '').replace(/\/$/, '')
export const supabasePublishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim() ?? ''
export const supabaseShopId = import.meta.env.VITE_SUPABASE_SHOP_ID?.trim() ?? ''

export const isSupabaseConfigured = Boolean(supabaseCanonicalUrl && supabasePublishableKey && supabaseShopId)

const proxyBase = typeof window !== 'undefined' ? `${window.location.origin}/supabase-proxy` : supabaseCanonicalUrl

export const supabaseUrl = isSupabaseConfigured ? proxyBase : ''

/** Переводит канонический supabase.co URL (например, сохранённый в базе URL картинки) на same-origin прокси. */
export function toProxiedUrl(url: string): string {
  if (supabaseCanonicalUrl && url.startsWith(supabaseCanonicalUrl)) {
    return proxyBase + url.slice(supabaseCanonicalUrl.length)
  }
  return url
}

/** Обратное преобразование: прокси-URL → канонический. Используется перед сохранением URL в базу. */
export function toCanonicalUrl(url: string): string {
  if (supabaseCanonicalUrl && url.startsWith(proxyBase)) {
    return supabaseCanonicalUrl + url.slice(proxyBase.length)
  }
  return url
}

// Ключ хранения сессии по умолчанию выводится из URL клиента. После перехода на
// /supabase-proxy он изменился бы и все устройства потеряли бы сессию — фиксируем
// прежний ключ (sb-<project-ref>-auth-token), выведенный из канонического адреса.
const projectRef = supabaseCanonicalUrl.match(/^https:\/\/([^.]+)\./)?.[1] ?? ''

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabasePublishableKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        ...(projectRef ? { storageKey: `sb-${projectRef}-auth-token` } : {}),
      },
    })
  : null
