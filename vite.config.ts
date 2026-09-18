import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  base: '/kids-english/',
  plugins: [react()],
  server: {
    // 让手机 / iPad / 电脑都能通过局域网地址访问
    host: true,
    // 内部端口（5173 由网关统一占用）
    port: 5176,
    strictPort: true,
    // 独立的 HMR 路径，方便网关区分两个应用的 websocket
    hmr: { path: '/kids-english-hmr' },
  },
  build: {
    outDir: 'dist',
  },
})
