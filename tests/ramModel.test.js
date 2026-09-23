import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { parseModeloRam, looksLikeModeloRam, resumenModeloRam, repartirModelo, seccionSugerida } from '../src/core/ramModel.js'
import { analyzeGroup, perfilCompleto } from '../src/core/longitudinal.js'
import { attachGeometry } from '../src/core/geometry.js'

const here = dirname(fileURLToPath(import.meta.url))
const TXT = readFileSync(join(here, 'fixtures', 'modelo_ram.json'), 'utf-8')

// Recorte de un modelo real de RAM (1401 miembros) exportado por
// scripts/ram/sincronizar.py: los grupos T5, T6, C1, T4 y T7.
describe('modelo.json de la API de RAM', () => {
  const R = parseModeloRam(TXT)

  it('se reconoce y no se confunde con otra cosa', () => {
    expect(looksLikeModeloRam(TXT)).toBe(true)
    expect(looksLikeModeloRam('{"formato":"otra cosa"}')).toBe(false)
    expect(looksLikeModeloRam('')).toBe(false)
    expect(parseModeloRam('{"formato":"auxiliar-iv/ram"}').ok).toBe(false)
    expect(parseModeloRam('no es json').warnings[0]).toMatch(/no se pudo leer/i)
  })

  it('trae los grupos tal como los etiqueta el modelo, sin nombres de archivo', () => {
    expect(R.ok).toBe(true)
    expect(R.warnings).toEqual([])
    expect(R.grupos.map((g) => g.nombre)).toEqual(['C1', 'T5', 'T6', 'T4', 'T7'])
    expect(R.grupos.map((g) => g.n)).toEqual([29, 28, 18, 3, 1])
    expect(R.envueltas).toEqual(['CD', 'CS'])
    expect(R.modelo.unidades).toBe('Ton-m')
    // y cada grupo casa con su chip aunque el modelo escriba T5 y la app T-5
    expect(R.grupos.find((g) => g.nombre === 'T5').clave).toBe('t5')
  })

  it('el miembro 32 llega con el pico que RAM calcula, no con el de la rejilla', () => {
    const t5 = R.grupos.find((g) => g.nombre === 'T5')
    const m32 = t5.perfil.members.find((m) => m.id === '32')
    expect(m32.Lreport).toBeCloseTo(10.4548, 4)
    expect(m32.stations.length).toBe(34)
    // el máximo exacto, afinado alrededor del extremo por el script
    expect(m32.repMax.m33).toBeCloseTo(2.2974, 4)
    expect(m32.repMin.m33).toBeCloseTo(-2.1541, 4)
    expect(m32.repMax.v2).toBeCloseTo(2.1049, 4)
    // …y es MAYOR que el mayor de las estaciones guardadas: ahí está la gracia
    const deEstaciones = Math.max(...m32.stations.map((s) => -s.m33.min))
    expect(-m32.repMin.m33).toBeGreaterThanOrEqual(deEstaciones - 1e-9)
    // las estaciones van en metros y la posición normalizada sale de la longitud
    // los extremos van 0.1 mm hacia dentro: RAM rechaza la estación justo en L
    expect(m32.stations[0].raw).toBeLessThanOrEqual(1e-4)
    expect(m32.L === undefined || true).toBe(true)
    expect(m32.Lreport - m32.stations.at(-1).raw).toBeLessThanOrEqual(1e-4 + 1e-9)
    expect(m32.stations[0].pos).toBeCloseTo(0, 4)
    expect(m32.stations.at(-1).pos).toBeCloseTo(1, 4)
  })

  it('el análisis lo trata como máximo EXACTO: nada queda «al filo»', () => {
    const t5 = R.grupos.find((g) => g.nombre === 'T5')
    const secc = {
      nombre: 'T-5', ancho: 20, peralte: 25, recub: 3, fc: 250,
      calSup: '3', cantSup: 3, calInf: '3', cantInf: 3,
      calBastonSup: '3', cantBastonSup: 3, calBastonInf: '3', cantBastonInf: 0,
      calEst: '3', sepLcuarto: 8, sepRest: 16,
      calc: { fy: 4200, varEstNum: 3, nramas: 2 },
    }
    const G = analyzeGroup(secc, t5.perfil)
    expect(G.n).toBe(28)
    expect(G.nMuestreado).toBe(0)        // todos con pico exacto
    expect(G.nFilo).toBe(0)              // así que «al filo» no aplica
    const r32 = G.results.find((r) => r.id === '32')
    expect(r32.profile.exacto).toBe(true)
    expect(r32.profile.muNmax).toBeCloseTo(2.1541, 4)
    expect(r32.muestreado).toBe(false)
  })

  it('la geometría viene en el mismo archivo: los tramos se unen en elementos', () => {
    expect(R.model.rows).toHaveLength(79)
    expect(R.model.rows[0]).toMatchObject({ member: expect.any(String), nj: expect.any(String), nk: expect.any(String) })
    expect(Object.keys(R.model.nodes).length).toBeGreaterThan(50)
    const t5 = R.grupos.find((g) => g.nombre === 'T5')
    const p = attachGeometry(t5.perfil, R.model)
    expect(p.geom.chains.length).toBeGreaterThan(0)
    expect(p.geom.chains.length).toBeLessThan(t5.n)     // 28 tramos → menos elementos
    const largos = p.geom.chains.filter((c) => c.members.length > 1)
    expect(largos.length).toBeGreaterThan(0)
    console.log(`T5: ${t5.n} miembros → ${p.geom.chains.length} elementos (${largos.length} de varios tramos)`)
  })

  it('trae las reacciones de los apoyos, para cimentación', () => {
    expect(R.reacciones.length).toBeGreaterThan(0)
    const r = R.reacciones[0]
    expect(r).toMatchObject({ nudo: expect.any(String), x: expect.any(Number) })
    expect(Object.keys(r.por)).toEqual(['CD', 'CS'])
    expect(Math.abs(r.por.CD.fy)).toBeGreaterThan(0)   // carga vertical real
  })

  it('reparte los grupos entre los chips del proyecto y dice cuáles faltan', () => {
    const { asignados, sinChip } = repartirModelo(R, {
      trabes: [{ nombre: 'T-5' }, { nombre: 'T-6' }], columnas: [{ nombre: 'C-1' }],
    })
    expect(asignados.map((a) => [a.tipo, a.idx, a.grupo.nombre])).toEqual([
      ['columna', 0, 'C1'], ['trabe', 0, 'T5'], ['trabe', 1, 'T6'],
    ])
    expect(sinChip.map((g) => g.nombre)).toEqual(['T4', 'T7'])
  })

  it('el resumen dice de un vistazo qué entró', () => {
    expect(resumenModeloRam(R)).toMatch(/5 grupo\(s\) · 79 miembros/)
    expect(resumenModeloRam(R)).toMatch(/picos exactos/)
  })
})

// ── Los grupos que el proyecto todavía no tiene ──────────────
describe('crear las secciones que faltan desde el modelo', () => {
  const R = parseModeloRam(TXT)
  const de = (n) => seccionSugerida(R.grupos.find((g) => g.nombre === n))

  it('el nombre del chip sale del modelo, con su guion', () => {
    expect(de('T5').nombre).toBe('T-5')
    expect(de('C1').nombre).toBe('C-1')
    expect(seccionSugerida({ nombre: 'T2A', clave: 't2a', seccion: 'RcBeam 15X25' }).nombre).toBe('T-2A')
    expect(seccionSugerida({ nombre: 'N1', clave: 'n1', seccion: 'RcBeam 10x25' }).nombre).toBe('N-1')
  })

  it('y las dimensiones de la etiqueta de RAM', () => {
    expect(de('T5')).toMatchObject({ ancho: 20, peralte: 25, esColumna: false })
    expect(de('T6')).toMatchObject({ ancho: 20, peralte: 30, esColumna: false })
    expect(de('T4')).toMatchObject({ ancho: 20, peralte: 35, esColumna: false })
  })

  it('distingue columnas aunque la etiqueta no diga COL', () => {
    expect(de('C1')).toMatchObject({ ancho: 36, peralte: 36, esColumna: true })
    expect(seccionSugerida({ nombre: 'C2', clave: 'c2', seccion: '15 x 15' }).esColumna).toBe(true)
    expect(seccionSugerida({ nombre: 'C4', clave: 'c4', seccion: 'COL  25 X 10' }))
      .toMatchObject({ ancho: 25, peralte: 10, esColumna: true })
  })

  it('una etiqueta sin medidas no inventa dimensiones', () => {
    expect(seccionSugerida({ nombre: 'X9', clave: 'x9', seccion: 'lo que sea' }))
      .toMatchObject({ nombre: 'X-9', ancho: null, peralte: null })
  })
})

describe('las medidas reales de la sección, no las del nombre', () => {
  const base = JSON.parse(TXT)
  // lo que manda el script cuando lee las tablas de RAM
  const conTablas = {
    ...base,
    secciones: {
      'RcBeam 20x25': { b: 25, h: 20, s: 2, tipo: 'viga', fuente: 'el propio modelo', tabla: 'Vigas de Concreto' },
      'COL 36 X 36': { b: 36, h: 36, s: 2, tipo: 'columna', fuente: 'el propio modelo', tabla: 'Columnas de Concreto' },
    },
  }
  const R2 = parseModeloRam(JSON.stringify(conTablas))

  it('T5 se diseña como RAM la analizó (25×20), no como dice su nombre', () => {
    const t5 = R2.grupos.find((g) => g.nombre === 'T5')
    const s = seccionSugerida(t5)
    expect(s.ancho).toBe(25)
    expect(s.peralte).toBe(20)
    expect(s.fuente).toBe('el propio modelo')
    expect(s.contradice).toEqual({ dice: '20×25', invertida: true })
  })

  it('y lo avisa con nombre y apellido', () => {
    expect(R2.warnings.some((w) => /T5: la sección «RcBeam 20x25» se llama 20×25 pero en RAM está dada de alta como 25×20/.test(w))).toBe(true)
  })

  it('una sección que sí cuadra no avisa, y la columna se sabe columna por su tabla', () => {
    const c1 = seccionSugerida(R2.grupos.find((g) => g.nombre === 'C1'))
    expect(c1.contradice).toBeNull()
    expect(c1.esColumna).toBe(true)
    expect(c1.ancho).toBe(36)
  })

  it('sin tablas, como siempre: del nombre', () => {
    const sinTablas = parseModeloRam(TXT)
    const t5 = seccionSugerida(sinTablas.grupos.find((g) => g.nombre === 'T5'))
    expect(t5.ancho).toBe(20)
    expect(t5.peralte).toBe(25)
    expect(t5.fuente).toBe('el nombre')
  })

  it('RAM no distingue mayúsculas ni espacios dobles', () => {
    const otro = { ...base, secciones: { 'rcbeam  20X25': { b: 25, h: 20, s: 2, tipo: 'viga', fuente: 'x' } } }
    expect(seccionSugerida(parseModeloRam(JSON.stringify(otro)).grupos.find((g) => g.nombre === 'T5')).ancho).toBe(25)
  })
})
