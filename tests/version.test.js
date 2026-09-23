import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { APP_VERSION } from '../src/core/constants.js'

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..')
const archivos = []
const recorrer = (dir) => {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name)
    if (e.isDirectory()) recorrer(p)
    else if (/\.jsx?$/.test(e.name)) archivos.push(p)
  }
}
recorrer(join(raiz, 'src'))

// La versión se escribe en la barra, en el PDF, en el informe detallado y en la
// memoria. Cuatro sitios que se quedaban atrás unos respecto de otros.
describe('la versión sale de un solo sitio', () => {
  it('package.json va a la par', () => {
    const pkg = JSON.parse(readFileSync(join(raiz, 'package.json'), 'utf-8'))
    expect(pkg.version.startsWith(`${APP_VERSION}.`) || pkg.version === APP_VERSION).toBe(true)
  })

  it('nadie escribe un número de versión a mano', () => {
    const sueltos = []
    for (const f of archivos) {
      if (f.endsWith('constants.js')) continue
      const texto = readFileSync(f, 'utf-8')
      for (const m of texto.matchAll(/v\d+\.\d+(\.\d+)?/g)) {
        // v4 de la malla de vigas y cosas así no cuentan: sólo "vN.N" junto al nombre
        const ctx = texto.slice(Math.max(0, m.index - 60), m.index + 20)
        if (/Auxiliar IV|IV Ingenier/i.test(ctx)) sueltos.push(`${f.replace(raiz + '/', '')}: ${m[0]}`)
      }
    }
    expect(sueltos).toEqual([])
  })

  it('todo el que la usa la importa', () => {
    const malos = []
    for (const f of archivos) {
      const texto = readFileSync(f, 'utf-8')
      if (f.endsWith('constants.js') || !texto.includes('APP_VERSION')) continue
      if (!/import\s*\{[^}]*APP_VERSION[^}]*\}\s*from/.test(texto)) malos.push(f.replace(raiz + '/', ''))
    }
    expect(malos).toEqual([])
  })
})
