import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    server: {
      deps: {
        inline: [
          /@exodus\/bytes/
        ]
      }
    },
    alias: {
      '@': path.resolve(__dirname, './js')
    },
    exclude: ['e2e/**', 'node_modules/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['js/**/*.js'],
      exclude: ['js/__tests__/**']
    }
  }
})
