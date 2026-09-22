import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { REPORTES, getReporte, clasificarReporte, clasificarLote, looksLikeMaximos, looksLikeGeometria } from '../src/core/ramReports.js'

const here = dirname(fileURLToPath(import.meta.url))
const fx = (n) => readFileSync(join(here, 'fixtures', n), 'utf-8')
const ACC = fx('T5_acciones.txt')      // acciones discriminadas (+ envolvente + máximos)
const MAX = fx('T5_maximos.txt')       // sólo máximos por miembro
const EST = fx('T4_estaciones.txt')    // envolvente por estaciones (+ máximos)
const GEO = fx('geometria_jofrito.txt')
const MIE = fx('miembrost4.txt')
const COL = fx('C1.txt')

describe('catálogo de reportes de RAM', () => {
  it('el catálogo está completo: cada reporte dice dónde pedirlo, con qué y qué llena', () => {
    expect(REPORTES.map((r) => r.id)).toEqual(['acciones', 'estaciones', 'maximos', 'geometria'])
    for (const r of REPORTES) {
      expect(r.titulo && r.reporte && r.donde && r.llena && r.destino && r.formatos).toBeTruthy()
      expect(r.casillas.length).toBeGreaterThan(0)
      expect(typeof r.detecta).toBe('function')
    }
    expect(REPORTES.filter((r) => r.preferido)).toHaveLength(1)
    expect(getReporte('acciones').preferido).toBe(true)
    expect(getReporte('nada')).toBeNull()
  })

  it('clasifica cada archivo real por su contenido, no por su nombre', () => {
    expect(clasificarReporte(ACC, 'T-5.txt')).toBe('acciones')
    expect(clasificarReporte(MAX, 'T-5.txt')).toBe('maximos')
    expect(clasificarReporte(EST, 'cualquiera.txt')).toBe('estaciones')
    expect(clasificarReporte(GEO, 'jofrito.txt')).toBe('geometria')
    expect(clasificarReporte(MIE, 'miembros.txt')).toBe('geometria')
    expect(clasificarReporte(COL, 'C-1.txt')).toBe('maximos')
    expect(clasificarReporte('', 'nudos.xlsx')).toBe('geometria')   // por extensión
    expect(clasificarReporte('hola', 'x.txt')).toBeNull()
  })

  it('el de acciones gana cuando el .txt trae varios reportes juntos', () => {
    // ACC trae acciones + envolvente + máximos: se queda con el mejor
    expect(clasificarReporte(ACC)).toBe('acciones')
    expect(looksLikeMaximos(ACC)).toBe(false)
    expect(looksLikeGeometria(ACC)).toBe(false)
  })

  it('un lote se clasifica de golpe y separa lo que no reconoce', () => {
    const r = clasificarLote([
      { nombre: 'T-5.txt', texto: ACC }, { nombre: 'C-1.txt', texto: COL },
      { nombre: 'jofrito.txt', texto: GEO }, { nombre: 'notas.txt', texto: 'nada útil' },
    ])
    expect(r.acciones).toEqual(['T-5.txt'])
    expect(r.maximos).toEqual(['C-1.txt'])
    expect(r.geometria).toEqual(['jofrito.txt'])
    expect(r.desconocidos).toEqual(['notas.txt'])
    expect(r.estaciones).toEqual([])
  })

  it('el manual avisa del riesgo de la rejilla fija y recomienda más estaciones', () => {
    const est = getReporte('estaciones')
    expect(est.aviso).toMatch(/pico/)
    expect(est.parametros.join(' ')).toMatch(/20/)
    expect(getReporte('acciones').ventaja).toMatch(/inflexión/)
  })
})
