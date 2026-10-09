import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // The browser only ever talks to /api; the proxy server holds the OpenAI key.
  server: { proxy: { '/api': 'http://localhost:3001' } },
})
