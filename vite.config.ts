import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      // @tensorflow-models/pose-detection importa @mediapipe/pose estaticamente pro runtime
      // BlazePose (não usado — só MoveNet aqui); o pacote real não é um módulo ESM válido e
      // quebra o build. Ver src/tracking/stubs/mediapipePose.ts.
      '@mediapipe/pose': fileURLToPath(new URL('./src/tracking/stubs/mediapipePose.ts', import.meta.url)),
    },
  },
})
