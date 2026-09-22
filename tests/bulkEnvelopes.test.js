import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { claveNombre, indiceDestinos, repartirEnvolventes, resumenReparto } from '../src/core/bulkEnvelopes.js'

const here = dirname(fileURLToPath(import.meta.url))
const fx = (n) => readFileSync(join(here, 'fixtures', n), 'utf-8')
const T2 = fx('T2.txt')                 // envolvente por miembro (Máximos esfuerzos)
const C1 = fx('C1.txt')                 // envolvente de columna
const EST = fx('T4_estaciones.txt')     // reporte por estaciones

const trabes = [{ nombre: 'T-2' }, { nombre: 'T-4' }, { nombre: 'T-2A' }]
const columnas = [{ nombre: 'C-1' }, { nombre: 'C-2' }]

describe('carga masiva de envolventes por nombre de archivo', () => {
  it('casa el archivo con el chip aunque cambien mayúsculas, guiones o espacios', () => {
    expect(claveNombre('T-2A.txt')).toBe('t2a')
    expect(claveNombre('t 2 a.TXT')).toBe('t2a')
    expect(claveNombre('  C-1.txt ')).toBe('c1')
    expect(claveNombre('N-1.txt')).toBe('n1')
    expect(claveNombre('')).toBe('')
  })
  it('el índice de destinos separa trabes de columnas y da prioridad a las trabes', () => {
    const idx = indiceDestinos({ trabes: [{ nombre: 'X-1' }], columnas: [{ nombre: 'X 1' }, { nombre: 'C-9' }] })
    expect(idx.get('x1')).toMatchObject({ tipo: 'trabe', idx: 0 })
    expect(idx.get('c9')).toMatchObject({ tipo: 'columna', idx: 1 })
  })
  it('reparte cada archivo a su sección y dice qué encontró en cada uno', () => {
    const r = repartirEnvolventes([
      { nombre: 'T-2.txt', texto: T2 },
      { nombre: 'C-1.txt', texto: C1 },
    ], { trabes, columnas })
    expect(r.asignados).toHaveLength(2)
    expect(r.sinDestino).toEqual([])
    expect(r.ilegibles).toEqual([])
    const t = r.asignados.find((a) => a.nombre === 'T-2')
    expect(t).toMatchObject({ tipo: 'trabe', idx: 0, formato: 'miembros' })
    expect(t.env.points.length).toBeGreaterThan(0)
    expect(t.env.invertir).toBe(false)
    expect(t.perfil).toBeUndefined()
    const c = r.asignados.find((a) => a.nombre === 'C-1')
    expect(c).toMatchObject({ tipo: 'columna', idx: 0, formato: 'miembros' })
    expect(c.env.mapping).toBe('M33X')   // las columnas nacen con el mapeo por omisión
  })
  it('un reporte por estaciones deja la trabe lista también para Longitudinal', () => {
    const r = repartirEnvolventes([{ nombre: 'T-4.txt', texto: EST }], { trabes, columnas })
    const a = r.asignados[0]
    expect(a).toMatchObject({ tipo: 'trabe', idx: 1, formato: 'estaciones', miembros: 98 })
    expect(a.env.fromStations).toBe(true)
    expect(a.perfil.members).toHaveLength(98)
    expect(a.perfil.porElemento).toBe(true)
    expect(a.combo).toBe('CD=1.3CM+1.5CV+3.12PM')
  })
  it('avisa de los archivos sin sección, de los ilegibles y de los repetidos', () => {
    const r = repartirEnvolventes([
      { nombre: 'T-9.txt', texto: T2 },              // no hay chip T-9
      { nombre: 'T-2.txt', texto: 'nada de nada' },  // no se puede leer
      { nombre: 'T-4.txt', texto: T2 },
      { nombre: 'T_4.txt', texto: EST },             // mismo destino que el anterior
    ], { trabes, columnas })
    expect(r.sinDestino).toEqual(['T-9.txt'])
    expect(r.ilegibles).toHaveLength(1)
    expect(r.ilegibles[0].archivo).toBe('T-2.txt')
    expect(r.repetidos).toHaveLength(1)
    expect(r.repetidos[0]).toMatchObject({ nombre: 'T-4', archivo: 'T_4.txt', reemplaza: 'T-4.txt' })
    // gana el último y no se duplica el destino
    expect(r.asignados).toHaveLength(1)
    expect(r.asignados[0].formato).toBe('estaciones')
  })
  it('el resumen dice en una línea qué pasó', () => {
    const r = repartirEnvolventes([
      { nombre: 'T-2.txt', texto: T2 }, { nombre: 'C-1.txt', texto: C1 },
      { nombre: 'T-4.txt', texto: EST }, { nombre: 'X-9.txt', texto: T2 },
    ], { trabes, columnas })
    const txt = resumenReparto(r)
    expect(txt).toMatch(/2 trabe\(s\) y 1 columna\(s\)/)
    expect(txt).toMatch(/1 por estaciones/)
    expect(txt).toMatch(/sin sección que coincida: X-9\.txt/)
  })
  it('sin archivos o sin secciones no truena', () => {
    expect(repartirEnvolventes([], { trabes, columnas }).asignados).toEqual([])
    expect(repartirEnvolventes(null, {}).sinDestino).toEqual([])
    const r = repartirEnvolventes([{ nombre: 'T-2.txt', texto: T2 }], {})
    expect(r.asignados).toEqual([])
    expect(r.sinDestino).toEqual(['T-2.txt'])
    expect(resumenReparto(r)).toMatch(/No se cargó ninguna envolvente/)
  })
})
