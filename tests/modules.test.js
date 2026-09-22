import { describe, it, expect, beforeEach, vi } from 'vitest'
import { MODULOS, getModulo, buscarModulos, cargarAbiertos, guardarAbiertos } from '../src/core/modules'

describe('registro de módulos', () => {
  it('todos traen id, nombre, tipo e ícono únicos', () => {
    const ids = MODULOS.map((m) => m.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const m of MODULOS) {
      expect(m.nombre).toBeTruthy()
      expect(['pestana', 'ventana']).toContain(m.tipo)
      expect(m.icono).toBeTruthy()
      expect(m.resumen).toBeTruthy()
    }
  })
  it('los de ventana declaran a dónde apuntan', () => {
    for (const m of MODULOS.filter((x) => x.tipo === 'ventana')) {
      expect(m.ventana?.url).toBeTruthy()
      expect(m.ventana?.target).toBeTruthy()
    }
  })
  it('getModulo por id', () => {
    expect(getModulo('pesos').nombre).toBe('Pesos Unitarios')
    expect(getModulo('no-existe')).toBe(null)
  })
})

describe('buscador del launcher', () => {
  it('sin texto devuelve todo', () => {
    expect(buscarModulos('')).toHaveLength(MODULOS.length)
  })
  it('encuentra por nombre, sin acentos ni mayúsculas', () => {
    expect(buscarModulos('PESOS').map((m) => m.id)).toEqual(['pesos'])
    expect(buscarModulos('malla').map((m) => m.id)).toContain('malla')
  })
  it('encuentra por palabra clave aunque no esté en el nombre', () => {
    expect(buscarModulos('tributaria').map((m) => m.id)).toEqual(['pesos'])
    expect(buscarModulos('bastones').map((m) => m.id)).toEqual(['longitudinal'])
  })
  it('varias palabras se exigen todas', () => {
    expect(buscarModulos('base datos').map((m) => m.id)).toEqual(['bdglobal'])
    expect(buscarModulos('pesos bastones')).toEqual([])
  })
})

describe('pestañas recordadas', () => {
  beforeEach(() => {
    let m = new Map()
    vi.stubGlobal('localStorage', {
      getItem: (k) => (m.has(k) ? m.get(k) : null),
      setItem: (k, v) => { m.set(k, String(v)) },
      removeItem: (k) => { m.delete(k) },
    })
  })
  it('guarda y recupera', () => {
    guardarAbiertos(['pesos', 'bdglobal'])
    expect(cargarAbiertos()).toEqual(['pesos', 'bdglobal'])
  })
  it('descarta ids que ya no existen o que no son de pestaña', () => {
    guardarAbiertos(['pesos', 'doublecheck', 'fantasma'])
    expect(cargarAbiertos()).toEqual(['pesos'])
  })
  it('sin nada guardado devuelve vacío y no revienta con basura', () => {
    expect(cargarAbiertos()).toEqual([])
    localStorage.setItem('iv_modulos_abiertos_v1', 'no es json')
    expect(cargarAbiertos()).toEqual([])
  })
})
