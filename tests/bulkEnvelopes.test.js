import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { claveNombre, indiceDestinos, repartirEnvolventes, resumenReparto, carpetaDeColumnas } from '../src/core/bulkEnvelopes.js'

const here = dirname(fileURLToPath(import.meta.url))
const fx = (n) => readFileSync(join(here, 'fixtures', n), 'utf-8')
const T2 = fx('T2.txt')                 // envolvente por miembro (Máximos esfuerzos)
const C1 = fx('C1.txt')                 // envolvente de columna
const EST = fx('T4_estaciones.txt')     // reporte por estaciones

const trabes = [{ nombre: 'T-2' }, { nombre: 'T-4' }, { nombre: 'T-2A' }]
const columnas = [{ nombre: 'C-1' }, { nombre: 'C-2' }]

describe('carga masiva de reportes por nombre de archivo', () => {
  it('casa el archivo con el chip aunque cambien mayúsculas, guiones o espacios', () => {
    expect(claveNombre('T-2A.txt')).toBe('t2a')
    expect(claveNombre('t 2 a.TXT')).toBe('t2a')
    expect(claveNombre('  C-1.txt ')).toBe('c1')
    expect(claveNombre('N-1.txt')).toBe('n1')
    expect(claveNombre('')).toBe('')
  })
  it('el índice guarda los dos destinos posibles de un mismo nombre', () => {
    const idx = indiceDestinos({ trabes: [{ nombre: 'X-1' }], columnas: [{ nombre: 'X 1' }, { nombre: 'C-9' }] })
    expect(idx.get('x1').trabe).toMatchObject({ tipo: 'trabe', idx: 0 })
    expect(idx.get('x1').columna).toMatchObject({ tipo: 'columna', idx: 0 })
    expect(idx.get('c9')).toEqual({ columna: { tipo: 'columna', idx: 1, nombre: 'C-9' } })
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
    expect(t).toMatchObject({ tipo: 'trabe', idx: 0, formato: 'miembros', exacta: true })
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
    expect(a.env.fromStations).toBe(true)     // provisional: sale de las mismas estaciones
    expect(a.exacta).toBe(false)
    expect(a.perfil.members).toHaveLength(98)
    expect(a.perfil.porElemento).toBe(true)
    expect(a.combo).toBe('CD=1.3CM+1.5CV+3.12PM')
  })

  // ── Lo que hace falta para que el pico no se quede corto ──
  it('los dos reportes de la misma trabe se acumulan: el perfil de uno y el pico exacto del otro', () => {
    const r = repartirEnvolventes([
      { nombre: 'T-4.txt', texto: EST, carpeta: 'LONGITUDINAL' },
      { nombre: 'T-4.txt', texto: T2, carpeta: 'MAXIMOS' },
    ], { trabes, columnas })
    expect(r.asignados).toHaveLength(1)        // un solo destino, no dos
    expect(r.repetidos).toEqual([])            // no se pisan: son cosas distintas
    const a = r.asignados[0]
    expect(a.archivos).toEqual({ largo: 'T-4.txt', maximos: 'T-4.txt' })
    expect(a.perfil.members).toHaveLength(98)  // el perfil, del de estaciones
    expect(a.env.fromStations).toBeUndefined() // la envolvente, del de máximos: es la exacta
    expect(a.exacta).toBe(true)
    expect(resumenReparto(r)).toMatch(/todas con su máximo exacto/)
  })
  it('avisa cuando una trabe se queda sin su reporte de máximos', () => {
    const r = repartirEnvolventes([{ nombre: 'T-4.txt', texto: EST }], { trabes, columnas })
    expect(resumenReparto(r)).toMatch(/SIN máximos exactos: T-4/)
  })
  it('la carpeta desempata cuando una trabe y una columna se llaman igual', () => {
    expect(carpetaDeColumnas('COLUMNAS')).toBe(true)
    expect(carpetaDeColumnas('Columnas')).toBe(true)
    expect(carpetaDeColumnas('LONGITUDINAL')).toBe(false)
    expect(carpetaDeColumnas(undefined)).toBe(false)
    const dobles = { trabes: [{ nombre: 'X-1' }], columnas: [{ nombre: 'X-1' }] }
    const sinCarpeta = repartirEnvolventes([{ nombre: 'X-1.txt', texto: C1 }], dobles)
    expect(sinCarpeta.asignados[0].tipo).toBe('trabe')          // por omisión, la trabe
    const conCarpeta = repartirEnvolventes([{ nombre: 'X-1.txt', texto: C1, carpeta: 'COLUMNAS' }], dobles)
    expect(conCarpeta.asignados[0].tipo).toBe('columna')
    expect(conCarpeta.asignados[0].env.mapping).toBe('M33X')
  })

  it('avisa de los archivos sin sección, de los ilegibles y de los repetidos', () => {
    const r = repartirEnvolventes([
      { nombre: 'T-9.txt', texto: T2 },              // no hay chip T-9
      { nombre: 'T-2.txt', texto: 'nada de nada' },  // no se puede leer
      { nombre: 'T-4.txt', texto: EST },
      { nombre: 'T_4.txt', texto: EST },             // mismo destino Y mismo tipo que el anterior
    ], { trabes, columnas })
    expect(r.sinDestino).toEqual(['T-9.txt'])
    expect(r.ilegibles).toHaveLength(1)
    expect(r.ilegibles[0].archivo).toBe('T-2.txt')
    expect(r.repetidos).toHaveLength(1)
    expect(r.repetidos[0]).toMatchObject({ nombre: 'T-4', archivo: 'T_4.txt', reemplaza: 'T-4.txt' })
    // gana el último y no se duplica el destino
    expect(r.asignados).toHaveLength(1)
    expect(r.asignados[0].perfil.archivo).toBe('T_4.txt')
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
    expect(resumenReparto(r)).toMatch(/No se cargó ningún reporte/)
  })
})
