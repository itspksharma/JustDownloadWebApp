import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  base: '/',
  plugins: [
    react(),
    VitePWA({
      registerType: "prompt", // or autoUpdate
      includeAssets: ["favicon.svg", "favicon.ico", "robots.txt", "apple-touch-icon.png"],
      manifest: {
        name: "Just Download",
        short_name: "JD",
        theme_color: "#ffffff",
        start_url: ".",
        display: "standalone",
        background_color: "#ffffff",
        icons: [
          {
            src: "/pwa-192x192.png",
            sizes: "192x192",
            type: "image/png",
          },
          {
            src: "/pwa-512x512.png",
            sizes: "512x512",
            type: "image/png",
          },
        ]
      },
      workbox: {
        navigateFallback: '/index.html',
        // ⚖️ Strategy:
        // - index.html -> network-first (hamesha latest UI)
        // - hashed assets -> cache-first (fast + offline)
        runtimeCaching: [
          {
            urlPattern: ({ request }) => request.mode === 'navigate',
            handler: 'NetworkFirst',
            options: { cacheName: 'html-cache', networkTimeoutSeconds: 5 }
          },
          {
            urlPattern: ({ request }) =>
              ['style', 'script', 'worker'].includes(request.destination),
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'asset-cache' }
          },
          {
            urlPattern: ({ url }) => url.pathname.startsWith('/api/'),
            handler: 'NetworkOnly', // API kabhi cache nahi
            options: { cacheName: 'api-bypass' }
          }
        ]
      },
      devOptions: { enabled: true } // dev me bhi sw test ho jayega
    })
  ],
  server: {
    proxy: {
      '/api': 'http://localhost:8000',
      '/downloads': 'http://localhost:8000',
    },
  },
})
