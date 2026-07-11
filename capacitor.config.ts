import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'ru.piatto.pos',
  appName: 'Piatto POS',
  webDir: 'dist',
  android: {
    backgroundColor: '#ffffff',
    allowMixedContent: false,
  },
}

export default config
