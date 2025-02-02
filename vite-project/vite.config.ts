import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  esbuild: {
    loader: 'tsx',
    tsconfigRaw: {
      compilerOptions: {
      }
    }
  }
})
