import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    rollupOptions: {
      output: {
        // Keep optional, heavy workspaces out of the initial application
        // payload. Route-level lazy imports then fetch these groups only when
        // a user opens the related module.
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined
          if (/[\\/]node_modules[\\/](xlsx|luckyexcel|handsontable|@handsontable|@fortune-sheet)/.test(id)) return 'vendor-spreadsheet'
          if (/[\\/]node_modules[\\/](html2canvas|html2pdf\.js|jspdf|pdf-lib|qrcode|dompurify)/.test(id)) return 'vendor-documents'
          if (/[\\/]node_modules[\\/](recharts|d3-)/.test(id)) return 'vendor-charts'
          if (/[\\/]node_modules[\\/](framer-motion|@dnd-kit)/.test(id)) return 'vendor-motion'
          if (/[\\/]node_modules[\\/](@apollo|graphql)/.test(id)) return 'vendor-graphql'
          return undefined
        },
      },
    },
  },
})
