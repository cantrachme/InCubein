import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Override via VITE_OUT_DIR when building inside Docker (nginx stage).
// Defaults to the backend's static dir so the FastAPI app can serve the SPA directly.
const outDir = process.env.VITE_OUT_DIR || '../backend/app/static'

// https://vite.dev/config/
export default defineConfig(({command}) => ({
  base: '/',
  plugins: [
    react(),
    tailwindcss(),
  ],
  build: {
    outDir,
    emptyOutDir: true,
  },
  server: {
    allowedHosts: ["backendsolpay.rugveddev.tech"],
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
        secure: false,
      }
    }
  }
}))
