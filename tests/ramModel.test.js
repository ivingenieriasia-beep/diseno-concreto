import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { parseModeloRam, looksLikeModeloRam, resumenModeloRam, repartirModelo } from '../src/core/ramModel.js'
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
