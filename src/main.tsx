import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { ConfigProvider } from 'antd'
import ruRU from 'antd/locale/ru_RU'
import { registerSW } from 'virtual:pwa-register'
import './index.css'
import App from './App.tsx'
import { StoreProvider } from './stores/context'
import { createRootStore } from './stores/RootStore'
import { AuthGate } from './components/AuthGate'
import { PrintProvider } from './print/PrintContext'
import * as Sentry from '@sentry/react'

if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
  registerSW({ immediate: true })
}

if (import.meta.env.VITE_SENTRY_DSN) {
  Sentry.init({
    dsn: import.meta.env.VITE_SENTRY_DSN,
    environment: import.meta.env.VITE_APP_ENV ?? import.meta.env.MODE,
    sendDefaultPii: false,
  })
}

async function bootstrap() {
  const rootStore = await createRootStore()
  createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ConfigProvider locale={ruRU} theme={{ token: { colorPrimary: '#1677ff', controlHeight: 44, fontSize: 15, borderRadius: 10 } }}>
      <StoreProvider value={rootStore}>
        <Sentry.ErrorBoundary fallback={<div className="fatal-error">Произошла ошибка приложения. Перезапустите Piatto POS и проверьте синхронизацию.</div>}>
          <AuthGate>
            <PrintProvider>
              <App />
            </PrintProvider>
          </AuthGate>
        </Sentry.ErrorBoundary>
      </StoreProvider>
    </ConfigProvider>
  </StrictMode>,
  )
}

void bootstrap()
