import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const localApiPort = Number(env.LOCAL_GALLERY_PORT || process.env.LOCAL_GALLERY_PORT || 8787)

  return {
    plugins: [react()],
    server: {
      proxy: {
        '/api': {
          target: `http://localhost:${localApiPort}`,
          changeOrigin: true,
        },
      },
    },
  }
})
