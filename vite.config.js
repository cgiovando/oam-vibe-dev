import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  // IMPORTANT: This must match your GitHub repository name!
  base: '/oam-fs/', 
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: 'https://api.openaerialmap.org',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, '')
      }
    }
  }
})