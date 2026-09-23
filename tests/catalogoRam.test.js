import { describe, it, expect } from 'vitest'
import { SECCIONES_RAM, MATERIALES_RAM, materialRam, enCatalogo, nombreSeccionRam, RECUB_RAM } from '../src/core/catalogoRam.js'

describe('catálogo de secciones para RAM', () => {
  it('21 vigas (con la nervadura) y 9 columnas, con s = 3 cm', () => {
    const vigas = SECCIONES_RAM.filter((s) => s.tipo === 'viga')
    const cols = SECCIONES_RAM.filter((s) => s.tipo === 'columna')
    expect(vigas).toHaveLength(21)
    expect(cols.map((s) => s.nombre)).toEqual([
      'COL 15 X 15', 'COL 15 X 20', 'COL 15 X 25', 'COL 20 X 20', 'COL 20 X 25',
      'COL 25 X 10', 'COL 25 X 25', 'COL 30 X 30', 'COL 36 X 36',
    ])
    expect(SECCIONES_RAM.every((s) => s.s === 3)).toBe(true)
    expect(RECUB_RAM).toBe(3)
  })

  it('ningún nombre se repite: RAM busca las secciones por nombre', () => {
    const nombres = SECCIONES_RAM.map((s) => s.nombre.toLowerCase())
    expect(new Set(nombres).size).toBe(nombres.length)
    // y justo las que chocarían sin el prefijo existen en las dos tablas
    for (const m of ['15 X 20', '20 X 25', '25 X 25']) {
      expect(SECCIONES_RAM.some((s) => s.nombre === m && s.tipo === 'viga')).toBe(true)
      expect(SECCIONES_RAM.some((s) => s.nombre === `COL ${m}` && s.tipo === 'columna')).toBe(true)
    }
  })

  it('cada una sabe en qué tabla de RAM va', () => {
    expect(SECCIONES_RAM.find((s) => s.nombre === '10 X 25').tabla).toBe('Vigas de Concreto')
    expect(SECCIONES_RAM.find((s) => s.nombre === 'COL 36 X 36').tabla).toBe('Columnas de Concreto')
  })

  it('se nombran como en RAM', () => {
    expect(nombreSeccionRam(15, 15)).toBe('15 X 15')
    expect(nombreSeccionRam(15, 15, 'columna')).toBe('COL 15 X 15')
    expect(SECCIONES_RAM[0].nombre).toBe('10 X 25')
  })

  it('sabe qué hay y qué no, y en qué tabla', () => {
    expect(enCatalogo(15, 25)).toBe(true)
    expect(enCatalogo('25', '50')).toBe(true)
    expect(enCatalogo(36, 36)).toBe(true)
    expect(enCatalogo(36, 36, 'viga')).toBe(false)
    expect(enCatalogo(36, 36, 'columna')).toBe(true)
    expect(enCatalogo(30, 30, 'columna')).toBe(true)
    expect(enCatalogo(30, 30, 'viga')).toBe(false)
    expect(enCatalogo(40, 40)).toBe(false)
  })
})

describe('materiales para RAM', () => {
  it('F\'C 250 con su f\'c real, no los 4 ksi de la plantilla US', () => {
    const m = materialRam(250)
    expect(m.nombre).toBe("F'C 250")
    expect(m.fc).toBe(250)
    expect(m.fyt).toBe(4200)
    // el mismo Ec que ya tenía en RAM: 2.21E+05
    expect(m.Ec).toBe(221359)
    expect(m.clase).toBe(1)
  })

  it('el F\'C 200 es clase 2: casi la mitad de rigidez', () => {
    const m = materialRam(200)
    expect(m.clase).toBe(2)
    expect(m.Ec).toBe(113137)
  })

  it('agregado basáltico, si hiciera falta', () => {
    expect(materialRam(250, { agregado: 'basaltico' }).Ec).toBe(173925)
  })

  it('de 200 a 400', () => {
    expect(MATERIALES_RAM.map((m) => m.fc)).toEqual([200, 250, 300, 350, 400])
    expect(MATERIALES_RAM.every((m) => m.pesoUnitario === 0.0024 && m.nu === 0.2)).toBe(true)
  })
})
