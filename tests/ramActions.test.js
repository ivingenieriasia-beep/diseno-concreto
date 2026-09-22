import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { parseRamActions, looksLikeActions } from '../src/core/ramActions.js'
import { looksLikeStations, memberProfile, analyzeGroup } from '../src/core/longitudinal.js'
import { parseRamEnvelope } from '../src/core/ramParser.js'

const here = dirname(fileURLToPath(import.meta.url))
const ACC = readFileSync(join(here, 'fixtures', 'T5_acciones.txt'), 'utf-8')
const MAX = readFileSync(join(here, 'fixtures', 'T5_maximos.txt'), 'utf-8')
const EST = readFileSync(join(here, 'fixtures', 'T4_estaciones.txt'), 'utf-8')

describe('reporte «Acciones discriminadas y puntos de inflexión»', () => {
  const A = parseRamActions(ACC)
  const m = (id) => A.members.find((x) => x.id === id)

  it('se distingue de los otros reportes de RAM', () => {
    expect(looksLikeActions(ACC)).toBe(true)
    expect(looksLikeActions(EST)).toBe(false)
    expect(looksLikeActions(MAX)).toBe(false)
    // este .txt trae los tres reportes seguidos, así que también parece "de
    // estaciones": por eso el de acciones se revisa primero
    expect(looksLikeStations(ACC)).toBe(true)
  })

  it('lee los miembros, sus combinaciones y la longitud que trae el propio reporte', () => {
    expect(A.members.length).toBe(34)   // 34 miembros, cada uno en los tres reportes del archivo
    expect(A.warnings).toEqual([])
    expect(A.combos).toEqual(['CD=1.3CM+1.5CV', 'CS=CM+CV'])
    expect(m('22').Lreport).toBeCloseTo(9.345, 3)   // ya no hay que capturar la L
    expect(m('22').combos).toHaveLength(2)
  })

  it('captura el pico real del miembro 22 (−4.331 a 1.40 m), que la rejilla fija se saltaba', () => {
    const st = m('22').stations
    const min = Math.min(...st.map((s) => s.m33.min))
    expect(min).toBeCloseTo(-4.331, 3)
    const pico = st.find((s) => Math.abs(s.m33.min - min) < 1e-9)
    expect(pico.raw).toBeCloseTo(1.402, 3)
    expect(pico.pos).toBeCloseTo(1.402 / 9.345, 3)
    // …y coincide con lo que dice el reporte de máximos del mismo modelo
    const E = parseRamEnvelope(MAX).points.filter((p) => String(p.member) === '22')
    expect(Math.min(...E.map((p) => p.m33))).toBeCloseTo(-4.36, 2)
  })

  it('envuelve todas las combinaciones: se queda con la que gobierna en cada punto', () => {
    const st = m('22').stations.find((s) => Math.abs(s.raw - 1.402) < 1e-6)
    expect(st.m33.min).toBeCloseTo(-4.331, 3)   // CD manda sobre CS (−3.197)
    expect(st.v2.min).toBeCloseTo(-3.221, 3)
    // el máximo positivo del miembro también sale de CD
    expect(Math.max(...m('22').stations.map((s) => s.m33.max))).toBeCloseTo(0.921, 3)
  })

  it('el perfil y el diseño salen directo, sin capturar longitudes', () => {
    const prof = memberProfile(m('22'), 0)
    expect(prof.L).toBeCloseTo(9.345, 3)
    // las estaciones llegan a 4.331 y el bloque de máximos del mismo archivo
    // dice 4.36: gobierna el mayor
    expect(prof.crudo.muNmax).toBeCloseTo(4.331, 3)
    expect(prof.muNmax).toBeCloseTo(4.36, 3)
    expect(prof.muPmax).toBeCloseTo(0.92, 2)
    const secc = {
      nombre: 'T-5', ancho: 20, peralte: 25, recub: 3, fc: 250,
      calSup: '3', cantSup: 4, calInf: '3', cantInf: 4, calBastonSup: '3', cantBastonSup: 0,
      calBastonInf: '3', cantBastonInf: 0, calEst: '3', sepLcuarto: 8, sepRest: 16,
      calc: { fy: 4200, varEstNum: 3, nramas: 2 },
    }
    const G = analyzeGroup(secc, { members: [m('22')], L: 0 })
    expect(G.results[0].L).toBeCloseTo(9.345, 3)
    expect(G.results[0].profile.muNmax).toBeCloseTo(4.36, 3)
    expect(G.results[0].status).not.toBe('ok')   // 4.33 t·m pide bastón, no pasa con las corridas
  })

  it('la envolvente por miembro que sale de aquí sirve para la revisión de sección', () => {
    const p22 = A.points.filter((p) => String(p.member) === '22')
    expect(Math.min(...p22.map((p) => p.m33))).toBeCloseTo(-4.36, 3)   // el mayor de las dos fuentes
    expect(A.points).toHaveLength(A.members.length * 2)
    expect(p22[0].combo).toContain('CD=1.3CM+1.5CV')
  })

  it('un archivo vacío o de otro tipo no truena', () => {
    expect(parseRamActions('').members).toEqual([])
    expect(parseRamActions('').warnings[0]).toMatch(/Acciones discriminadas/)
    expect(parseRamActions(MAX).members).toEqual([])
  })
})
