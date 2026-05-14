import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  base: '/whiteboard/',
  server: {
    port: 4173,
    host: '0.0.0.0',
    // Allow all hosts (required for reverse proxy via host.docker.internal)
    allowedHosts: true,
    // Disable HMR to prevent header issues
    hmr: false,
    // Allow iframe embedding
    headers: {
      'X-Frame-Options': 'ALLOWALL',
      'Content-Security-Policy': "frame-ancestors *",
    },
  },
  // Configure preview server for production
  preview: {
    port: 4173,
    host: '0.0.0.0',
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
