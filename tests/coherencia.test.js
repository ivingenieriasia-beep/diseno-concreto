import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { parseRamStations, memberProfile, analyzeGroup, refDeUnidad, miembrosCompartidos, compartidosCon } from '../src/core/longitudinal.js'
import { beamEnvelopeByMember, parseRamEnvelope } from '../src/core/ramParser.js'

const here = dirname(fileURLToPath(import.meta.url))

// La envolvente de la pestaña Cálculo y el análisis a lo largo tienen que
// decir lo mismo del mismo miembro: los dos salen del mismo reporte.
describe('coherencia entre la envolvente de la sección y el análisis a lo largo', () => {
  it('mismo miembro, mismo Mu en la envolvente y en el análisis a lo largo', () => {
    const P = parseRamStations(readFileSync('tests/fixtures/T4_estaciones.txt', 'utf-8'))
    // lo que ve la pestaña Cálculo
    const env = beamEnvelopeByMember(P.points, false)
    const porId = new Map(env.map((e) => [String(e.member), e]))
    let iguales = 0
    const dif = []
    for (const mb of P.members) {
      const e = porId.get(String(mb.id))
      if (!e) continue
      const prof = memberProfile(mb, 4)          // lo que ve Longitudinal
      const dP = Math.abs(e.MuP - prof.muPmax), dN = Math.abs(e.MuN - prof.muNmax), dV = Math.abs(e.Vu - prof.vuMax)
      if (dP < 1e-9 && dN < 1e-9 && dV < 1e-9) iguales++
      else dif.push({ id: mb.id, env: [e.MuP, e.MuN, e.Vu], long: [prof.muPmax, prof.muNmax, prof.vuMax] })
    }
    console.log(`miembros: ${P.members.length} · coinciden exactamente: ${iguales} · difieren: ${dif.length}`)
    if (dif.length) console.log('casos:', JSON.stringify(dif.slice(0, 5)))
    expect(dif).toHaveLength(0)
  })
  it('leyendo sólo las estaciones impresas, el análisis quedaba por debajo (el bug corregido)', () => {
    const P = parseRamStations(readFileSync('tests/fixtures/T4_estaciones.txt', 'utf-8'))
    const env = new Map(beamEnvelopeByMember(P.points, false).map((e) => [String(e.member), e]))
    let dif = 0
    for (const mb of P.members) {
      const e = env.get(String(mb.id))
      const prof = memberProfile(mb, 4, false, { ajustar: false })
      if (Math.abs(e.MuP - prof.muPmax) > 1e-9 || Math.abs(e.MuN - prof.muNmax) > 1e-9) dif++
    }
    console.log(`sin ajuste, miembros donde Longitudinal quedaba por debajo: ${dif}`)
    expect(dif).toBeGreaterThan(0)
  })
})

// ── El caso de T-5: dos reportes del mismo modelo, uno pide más ──
// El .txt de máximos dice que el miembro 22 llega a M33 = −4.36, pero las
// estaciones del otro reporte sólo llegan a −3.17. El diseño tiene que usar
// −4.36: entre las dos fuentes gobierna la mayor.
describe('T-5: la envolvente cargada gobierna sobre las estaciones', () => {
  const T5 = readFileSync(join(here, 'fixtures', 'T5_maximos.txt'), 'utf-8')
  const secc = {
    nombre: 'T-5', ancho: 20, peralte: 25, recub: 3, fc: 250,
    calSup: '3', cantSup: 4, calInf: '3', cantInf: 4, calBastonSup: '3', cantBastonSup: 0,
    calBastonInf: '3', cantBastonInf: 0, calEst: '3', sepLcuarto: 8, sepRest: 16,
    calc: { fy: 4200, varEstNum: 3, nramas: 2 },
  }
  // estaciones sintéticas del miembro 22, como las trae el otro reporte: +0.92 / −3.17
  const m22 = {
    id: '22', Lreport: 9.35,
    stations: [0, 0.25, 0.5, 0.75, 1].map((p, i) => ({
      pos: p,
      m33: { max: [0.0, 0.92, 0.5, -1.5, -3.17][i], min: [0.0, 0.92, 0.5, -1.5, -3.17][i] },
      v2: { max: 3.16, min: -3.16 },
    })),
  }

  it('el .txt de máximos trae el −4.36 del miembro 22', () => {
    const E = parseRamEnvelope(T5)
    const p22 = E.points.filter((p) => String(p.member) === '22')
    expect(Math.min(...p22.map((p) => p.m33))).toBe(-4.36)
    expect(Math.max(...p22.map((p) => p.m33))).toBe(0.92)
    expect(E.points.filter((p) => String(p.member) === '31').map((p) => p.m33)).toContain(-4.5)
  })

  it('sin la envolvente, el análisis se queda en el 3.17 de las estaciones', () => {
    const G = analyzeGroup(secc, { members: [m22], L: 9.35 })
    expect(G.results[0].profile.muNmax).toBeCloseTo(3.17, 9)
  })

  it('con la envolvente cargada, el análisis diseña con el 4.36', () => {
    const E = parseRamEnvelope(T5)
    const envRef = {}
    for (const p of E.points) {
      const k = String(p.member)
      const a = envRef[k] || { m33max: -Infinity, m33min: Infinity, v2: 0 }
      a.m33max = Math.max(a.m33max, p.m33); a.m33min = Math.min(a.m33min, p.m33)
      a.v2 = Math.max(a.v2, Math.abs(p.v2 ?? 0))
      envRef[k] = a
    }
    const G = analyzeGroup(secc, { members: [m22], L: 9.35, envRef })
    const r = G.results[0]
    expect(r.profile.muNmax).toBeCloseTo(4.36, 9)      // ya no 3.17
    expect(r.profile.muPmax).toBeCloseTo(0.92, 9)
    expect(r.profile.ajuste.rep.muN).toBe(4.36)
    expect(r.profile.ajuste.rep.fuentes).toContain('envolvente')
    expect(r.profile.ajuste.kN).toBeCloseTo(4.36 / 3.17, 2)
    // y eso cambia el diseño: pide más bastón que con el valor chico
    const sinEnv = analyzeGroup(secc, { members: [m22], L: 9.35 })
    expect(r.sup.bars.length + (r.status === 'insuficiente' ? 1 : 0)).toBeGreaterThanOrEqual(sinEnv.sup?.bars?.length || 0)
    expect(r.profile.muNmax).toBeGreaterThan(sinEnv.results[0].profile.muNmax)
  })

  it('un elemento toma la envolvente de todos sus tramos', () => {
    const envRef = { 22: { m33max: 0.92, m33min: -4.36, v2: 3.22 }, 31: { m33max: 0.35, m33min: -4.5, v2: 3.64 } }
    const el = { id: 'E 22…31', isElement: true, members: [{ id: '22' }, { id: '31' }] }
    expect(refDeUnidad(el, { envRef })).toEqual({ m33max: 0.92, m33min: -4.5, v2: 3.64 })
    expect(refDeUnidad({ id: '22' }, { envRef })).toEqual({ m33max: 0.92, m33min: -4.36, v2: 3.22 })
    expect(refDeUnidad({ id: '99' }, { envRef })).toBeNull()
  })
})

// ── Una variante sacada de una familia (T-5A) no debe seguir contando en T-5 ──
describe('miembros que aparecen en dos trabes', () => {
  const perfil = (ids, excluir = []) => ({ members: ids.map((id) => ({ id: String(id), stations: [] })), excluir })
  const proyecto = [
    { nombre: 'T-5', perfil: perfil([1757, 1825, 1830, 22, 31]) },
    { nombre: 'T-5A', perfil: perfil([1757, 1825, 1830]) },
    { nombre: 'T-6', perfil: perfil([900]) },
    { nombre: 'T-7', perfil: null },
  ]

  it('detecta los miembros repartidos en más de una trabe', () => {
    const c = miembrosCompartidos(proyecto)
    expect(c.map((x) => x.id).sort()).toEqual(['1757', '1825', '1830'])
    expect(c[0].trabes.map((t) => t.nombre)).toEqual(['T-5', 'T-5A'])
  })

  it('los agrupa por la trabe con la que chocan', () => {
    const c = compartidosCon(proyecto, 'T-5')
    expect(c).toHaveLength(1)
    expect(c[0]).toMatchObject({ nombre: 'T-5A', idx: 1 })
    expect(c[0].ids.sort()).toEqual(['1757', '1825', '1830'])
    expect(compartidosCon(proyecto, 'T-6')).toEqual([])
    expect(compartidosCon(proyecto, 'T-7')).toEqual([])
  })

  it('excluirlos de una de las dos resuelve el choque', () => {
    const arreglado = [{ ...proyecto[0], perfil: perfil([1757, 1825, 1830, 22, 31], ['1757', '1825', '1830']) }, ...proyecto.slice(1)]
    expect(miembrosCompartidos(arreglado)).toEqual([])
    expect(compartidosCon(arreglado, 'T-5')).toEqual([])
  })

  it('un proyecto sin reportes no truena', () => {
    expect(miembrosCompartidos([])).toEqual([])
    expect(miembrosCompartidos(null)).toEqual([])
    expect(miembrosCompartidos([{ nombre: 'X' }])).toEqual([])
  })
})
