/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string
  readonly VITE_SUPABASE_PUBLISHABLE_KEY?: string
  readonly VITE_SUPABASE_SHOP_ID?: string
  readonly VITE_SUPABASE_LOGIN_EMAIL?: string
  readonly VITE_SENTRY_DSN?: string
  readonly VITE_APP_ENV?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
/// <reference types="vite-plugin-pwa/client" />
