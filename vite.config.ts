import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig(({ command }) => ({
  // 线上 GitHub Pages 部署在 https://lyiyang.github.io/kid-english/
  // 本地开发经网关访问 /kids-english/
  base: command === 'build' ? '/kid-english/' : '/kids-english/',
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
    // GitHub Pages 设置为 master 分支 /docs 目录
    outDir: 'docs',
    emptyOutDir: true,
  },
}))
