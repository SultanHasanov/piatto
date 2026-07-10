import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: true,
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: [
        'icons/icon-72.png',
        'icons/icon-96.png',
        'icons/icon-128.png',
        'icons/icon-144.png',
        'icons/icon-152.png',
        'icons/icon-180.png',
        'icons/icon-192.png',
        'icons/icon-384.png',
        'icons/icon-512.png',
        'icons/icon-maskable-512.png',
        'screenshots/pos-1280x800.png',
        'screenshots/pos-1920x1080.png',
      ],
      manifest: {
        name: 'Piatto POS',
        short_name: 'Piatto',
        description: 'Касса для кофейни/фастфуда',
        lang: 'ru',
        theme_color: '#1677ff',
        background_color: '#ffffff',
        display: 'standalone',
        orientation: 'landscape',
        start_url: '/',
        icons: [
          { src: 'icons/icon-72.png', sizes: '72x72', type: 'image/png' },
          { src: 'icons/icon-96.png', sizes: '96x96', type: 'image/png' },
          { src: 'icons/icon-128.png', sizes: '128x128', type: 'image/png' },
          { src: 'icons/icon-144.png', sizes: '144x144', type: 'image/png' },
          { src: 'icons/icon-152.png', sizes: '152x152', type: 'image/png' },
          { src: 'icons/icon-180.png', sizes: '180x180', type: 'image/png' },
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-384.png', sizes: '384x384', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
        screenshots: [
          {
            src: 'screenshots/pos-1280x800.png',
            sizes: '1280x800',
            type: 'image/png',
            form_factor: 'wide',
            label: 'Касса Piatto на планшете',
          },
          {
            src: 'screenshots/pos-1920x1080.png',
            sizes: '1920x1080',
            type: 'image/png',
            form_factor: 'wide',
            label: 'Каталог и чек Piatto POS',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
      },
      devOptions: {
        enabled: true,
      },
    }),
  ],
})
