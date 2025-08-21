import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Use relative base so the app works when hosted under a subpath
  base: './',
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:8787',
        changeOrigin: true,
      },
      '/health': {
        target: 'http://localhost:8787',
        changeOrigin: true,
      },
      // WebSocket proxy to Moshi TypeScript server
      '/moshi': {
        target: 'ws://localhost:8088',
        changeOrigin: true,
        ws: true,
      },
    },
  },
})
