import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { viteSingleFile } from 'vite-plugin-singlefile'
import { fileURLToPath } from 'node:url'

// La marca SOGRUB lleva tipografías propias; con IV (mode distinto de 'sogrub')
// '#marca-extra' es un archivo vacío y las fuentes no entran al build.
const extra = (mode) => fileURLToPath(new URL(
  mode === 'sogrub' ? './src/core/marcaExtra.sogrub.js' : './src/core/marcaExtra.iv.js', import.meta.url))

export default defineConfig(({ mode }) => ({
  plugins: [react(), tailwindcss(), viteSingleFile()],
  base: './',
  resolve: { alias: { '#marca-extra': extra(mode) } },
}))
