import { defineConfig } from 'vitest/config'
import { fileURLToPath } from 'node:url'

export default defineConfig({
  resolve: { alias: { '#marca-extra': fileURLToPath(new URL('./src/core/marcaExtra.iv.js', import.meta.url)) } },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.js'],
    environmentMatchGlobs: [['tests/**/*.dom.test.js', 'jsdom']],
  },
})
