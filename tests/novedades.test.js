import { describe, it, expect } from 'vitest'
import { APP_VERSION } from '../src/core/constants.js'
import { NOVEDADES, TIPOS, logVigente, mayorDe, compararVersion, fechaCorta } from '../src/core/novedades.js'

const E = (version) => ({ version, fecha: '2026-01-01', destacados: [{ tipo: 'nuevo', titulo: version, texto: 'x' }], cambios: [] })

describe('log de novedades', () => {
  it('la versión vigente tiene su entrega escrita', () => {
    // al subir la versión en constants.js hay que escribir aquí lo nuevo
    expect(NOVEDADES.map((e) => e.version)).toContain(APP_VERSION)
  })

  it('no hay entregas de versiones que todavía no salen', () => {
    for (const e of NOVEDADES) expect(compararVersion(e.version, APP_VERSION)).toBeLessThanOrEqual(0)
  })

  it('sólo muestra la versión mayor vigente, de la más nueva a la más vieja', () => {
    const lista = [E('2.9'), E('3.0'), E('3.1'), E('3.2'), E('4.0')]
    expect(logVigente('3.1', lista).entregas.map((e) => e.version)).toEqual(['3.1', '3.0'])
    expect(logVigente('3.2', lista).mayor).toBe(3)
    // al cambiar de número entero el log arranca de nuevo
    expect(logVigente('4.0', lista).entregas.map((e) => e.version)).toEqual(['4.0'])
    expect(logVigente('4.0', lista).mayor).toBe(4)
  })

  it('cuenta novedades grandes y cambios de todas las entregas vigentes', () => {
    const lista = [{ ...E('3.0'), cambios: [{ tipo: 'mejora', texto: 'a' }] }, E('3.1')]
    expect(logVigente('3.1', lista)).toMatchObject({ destacados: 2, cambios: 1 })
  })

  it('compara versiones parte por parte', () => {
    expect(compararVersion('3.10', '3.9')).toBeGreaterThan(0)
    expect(compararVersion('3.0', '3')).toBe(0)
    expect(mayorDe('12.4')).toBe(12)
  })

  it('cada novedad trae tipo conocido, título y texto; cada imagen, su descripción', () => {
    for (const e of NOVEDADES) {
      expect(e.fecha).toMatch(/^\d{4}-\d{2}-\d{2}$/)
      expect(fechaCorta(e.fecha)).toMatch(/^\d{1,2} [a-z]{3} \d{4}$/)
      for (const d of e.destacados || []) {
        expect(Object.keys(TIPOS)).toContain(d.tipo)
        expect(d.titulo && d.texto).toBeTruthy()
        if (d.img) {
          expect(typeof d.img).toBe('string')
          expect(d.alt).toBeTruthy()
        }
      }
      for (const c of e.cambios || []) {
        expect(Object.keys(TIPOS)).toContain(c.tipo)
        expect(c.texto).toBeTruthy()
      }
    }
  })

  it('fecha corta en español', () => {
    expect(fechaCorta('2026-09-23')).toBe('23 sep 2026')
  })
})
