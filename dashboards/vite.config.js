import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      // Forwards /api/* calls to the FastAPI backend during development,
      // so the frontend never needs to hardcode http://localhost:8000
      // and CORS is a non-issue for local dev.
      '/api': 'http://localhost:8000',
    },
  },
})
