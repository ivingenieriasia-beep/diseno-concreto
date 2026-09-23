import { describe, it, expect } from 'vitest'
import { SECCIONES_RAM, MATERIALES_RAM, materialRam, enCatalogo, nombreSeccionRam, RECUB_RAM } from '../src/core/catalogoRam.js'

describe('catálogo de secciones para RAM', () => {
  it('las 20 de uso corriente, sin repetidas y con s = 3 cm', () => {
    expect(SECCIONES_RAM).toHaveLength(20)
    const claves = SECCIONES_RAM.map((s) => `${s.b}x${s.h}`)
    expect(new Set(claves).size).toBe(20)
    expect(SECCIONES_RAM.every((s) => s.s === 3)).toBe(true)
    expect(RECUB_RAM).toBe(3)
  })

  it('se nombran como en RAM', () => {
    expect(nombreSeccionRam(15, 15)).toBe('15 X 15')
    expect(SECCIONES_RAM[0].nombre).toBe('15 X 20')
  })

  it('sabe qué hay y qué no', () => {
    expect(enCatalogo(15, 25)).toBe(true)
    expect(enCatalogo('25', '50')).toBe(true)
    expect(enCatalogo(36, 36)).toBe(false)
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
