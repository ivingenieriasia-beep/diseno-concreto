import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { parseRamStations, memberProfile, analyzeGroup, refDeUnidad, miembrosCompartidos, compartidosCon } from '../src/core/longitudinal.js'
import { beamEnvelopeByMember, parseRamEnvelope, evaluateBeamEnvelope } from '../src/core/ramParser.js'
import { computeSectionCapacities, resistenciasConPuntual } from '../src/core/sectionResults.js'
import { parseRamActions } from '../src/core/ramActions.js'
import { attachGeometry } from '../src/core/geometry.js'

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
    expect(refDeUnidad(el, { envRef })).toEqual({ m33max: 0.92, m33min: -4.5, v2: 3.64, exacta: true })
    expect(refDeUnidad({ id: '22' }, { envRef })).toEqual({ m33max: 0.92, m33min: -4.36, v2: 3.22, exacta: true })
    expect(refDeUnidad({ id: '99' }, { envRef })).toBeNull()
    // si la envolvente se armó con estas mismas estaciones, no aporta un máximo exacto
    expect(refDeUnidad({ id: '22' }, { envRef, envExacta: false }).exacta).toBe(false)
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

// ── Las juntas entre tramos no son apoyos ──
// Analizando cada tramo por separado, la junta con el siguiente se toma como
// extremo y le toca la separación de los cuartos extremos; dentro del elemento
// completo ese punto cae en el centro del claro. Con @12 en extremos y @6 al
// centro (como la T-2A del proyecto) eso hace que un miembro «falle por
// cortante» cuando el elemento no falla.
describe('cortante: por tramo suelto vs por elemento completo', () => {
  const est = (v, n = 9) => Array.from({ length: n }, (_, i) => ({
    pos: i / (n - 1),
    m33: { max: 0.1, min: -0.1 },
    v2: { max: v(i / (n - 1)), min: -v(i / (n - 1)) },
  }))
  // dos tramos de 4 m: el cortante es máximo junto a la junta (x = 4 m)
  const m1 = { id: '1', Lreport: 4, stations: est((p) => 1 + 6 * p) }        // 1 → 7 t
  const m2 = { id: '2', Lreport: 4, stations: est((p) => 7 - 6 * p) }        // 7 → 1 t
  const nodos = { A: { x: 0, y: 0, z: 0 }, B: { x: 4, y: 0, z: 0 }, C: { x: 8, y: 0, z: 0 } }
  const model = {
    rows: [{ member: '1', nj: 'A', nk: 'B', seccion: '15 x 25' }, { member: '2', nj: 'B', nk: 'C', seccion: '15 x 25' }],
    nodes: nodos,
  }
  const secc = {
    nombre: 'T-2A', ancho: 15, peralte: 25, recub: 3, fc: 250,
    calSup: '3', cantSup: 4, calInf: '3', cantInf: 2, calBastonSup: '3', cantBastonSup: 3,
    calBastonInf: '3', cantBastonInf: 0, calEst: '2', sepLcuarto: 12, sepRest: 6,
    calc: { fy: 4200, varEstNum: 2, nramas: 2 },
  }
  const base = { members: [m1, m2], L: 4, minLen: 0.6 }

  it('los dos tramos se unen en un solo elemento de 8 m', () => {
    const p = attachGeometry(base, model)
    expect(p.geom.chains).toHaveLength(1)
    expect(p.geom.chains[0].members).toHaveLength(2)
    expect(p.geom.chains[0].L).toBeCloseTo(8, 6)
  })

  it('por tramo suelto sale un fallo de cortante que el elemento no tiene', () => {
    const porTramo = analyzeGroup(secc, base)
    const porElemento = analyzeGroup(secc, attachGeometry(base, model))
    expect(porTramo.n).toBe(2)
    expect(porElemento.n).toBe(1)
    // cada tramo ve su pico pegado a una punta, donde la separación es la
    // ancha (@12): los dos «fallan». Unidos, ese pico cae al centro del claro
    // real, donde va la cerrada (@6), y no falla ninguno.
    expect(porTramo.nShear).toBe(2)
    expect(porElemento.nShear).toBe(0)
    // y es el mismo cortante en los dos casos: cambia sólo la zona de estribos
    expect(porElemento.results[0].profile.vuMax).toBeCloseTo(7, 6)
    expect(Math.max(...porTramo.results.map((r) => r.profile.vuMax))).toBeCloseTo(7, 6)
  })

  it('el informe y el módulo coinciden cuando los dos ven la geometría', () => {
    const conGeo = attachGeometry(base, model)
    const delModulo = analyzeGroup(secc, conGeo)
    const delInforme = analyzeGroup(secc, conGeo)   // así los llama App tras pegar la geometría
    expect(delInforme.nShear).toBe(delModulo.nShear)
    expect(delInforme.n).toBe(delModulo.n)
  })
})

// ── El pico real casi nunca cae en una estación impresa ──────────
// RAM dibuja el máximo exacto del miembro (M33 = −6.03), pero el reporte de
// acciones sólo imprime unas cuantas estaciones y la mayor de ellas puede ser
// −5.84. La única fuente del pico exacto es el bloque «Máximos esfuerzos en
// miembros»; sin él, «pasa» por un 1 % no significa nada.
describe('picos entre estaciones: lo impreso se queda corto', () => {
  const ACC = readFileSync(join(here, 'fixtures', 'T5_acciones.txt'), 'utf-8')

  it('en un modelo real, las estaciones impresas quedan por debajo del máximo en la mayoría de los miembros', () => {
    const A = parseRamActions(ACC)
    expect(A.conMaximos).toBe(A.members.length)     // este .txt sí trae el bloque
    let cortos = 0, peor = 1
    for (const mb of A.members) {
      const stN = Math.max(0, ...mb.stations.map((s) => -s.m33.min))
      const stP = Math.max(0, ...mb.stations.map((s) => s.m33.max))
      const repN = Math.max(0, -Math.min(mb.repMin.m33, mb.repMax.m33))
      const repP = Math.max(0, Math.max(mb.repMin.m33, mb.repMax.m33))
      if (repN > stN + 1e-6 || repP > stP + 1e-6) {
        cortos++
        peor = Math.max(peor, repN / (stN || repN || 1), repP / (stP || repP || 1))
      }
    }
    console.log(`miembros donde lo impreso se queda corto: ${cortos}/${A.members.length} · el peor, ×${peor.toFixed(3)}`)
    expect(cortos).toBeGreaterThan(A.members.length / 2)
    expect(peor).toBeGreaterThan(1.1)               // hasta un 12 % por debajo
  })

  const secc = {
    nombre: 'T-5A', ancho: 20, peralte: 25, recub: 3, fc: 250,
    calSup: '4', cantSup: 4, calInf: '3', cantInf: 3, calBastonSup: '4', cantBastonSup: 3,
    calBastonInf: '3', cantBastonInf: 0, calEst: '3', sepLcuarto: 8, sepRest: 16,
    calc: { fy: 4200, varEstNum: 3, nramas: 2 },
  }
  // un miembro cuyo pico impreso (5.84) queda justo debajo del MR− de la trabe
  const m12 = {
    id: '12', Lreport: 7.97,
    stations: [0, 0.25, 0.5, 0.85, 1].map((p, i) => ({
      pos: p,
      m33: { max: [0, 0.46, 0.30, -3.0, -5.84][i], min: [0, 0.46, 0.30, -3.0, -5.84][i] },
      v2: { max: 4.86, min: -4.86 },
    })),
  }

  it('lo marca «al filo» en vez de darlo por bueno', () => {
    const G = analyzeGroup(secc, { members: [m12], L: 7.97 })
    const r = G.results[0]
    expect(r.status).toBe('ok')                  // con el armado corrido le alcanza…
    expect(r.muestreado).toBe(true)              // …pero el pico sale sólo de las estaciones
    expect(r.alFilo).toBe(true)
    expect(r.holgura.que).toBe('MR−')
    expect(r.holgura.v).toBeLessThan(0.05)       // pasa por menos del 5 %
    expect(G.nFilo).toBe(1)
  })

  it('con el máximo exacto cargado deja de ser una suposición', () => {
    const conMax = analyzeGroup(secc, {
      members: [m12], L: 7.97,
      envRef: { 12: { m33max: 0.46, m33min: -6.03, v2: 4.86 } },   // «Máximos esfuerzos en miembros»
    })
    const r = conMax.results[0]
    expect(r.profile.muNmax).toBeCloseTo(6.03, 6)  // ahora sí se diseña con el 6.03
    expect(r.muestreado).toBe(false)
    expect(r.alFilo).toBe(false)
    expect(conMax.nFilo).toBe(0)
    expect(r.sup.bars.length).toBeGreaterThan(0)   // y resulta que sí pedía bastón
  })

  it('una envolvente armada con las mismas estaciones no cuenta como máximo exacto', () => {
    const G = analyzeGroup(secc, {
      members: [m12], L: 7.97,
      envRef: { 12: { m33max: 0.46, m33min: -5.84, v2: 4.86 } }, envExacta: false,
    })
    expect(G.results[0].muestreado).toBe(true)
    expect(G.nFilo).toBe(1)
  })
})

// ── La verificación tiene que leer el bastón puntual ─────────────
// Los puntuales no van en el corte, así que no entran en el MR de la sección;
// pero existen en la trabe, donde el análisis a lo largo los colocó. Un
// ejemplar que sólo pasa con ellos está cubierto, no descubierto: el informe no
// puede mandar a revisar un diseño que ya pasa.
describe('ejemplares cubiertos por el bastón puntual anotado', () => {
  const base = {
    nombre: 'T-5', ancho: 20, peralte: 25, recub: 3, fc: 250,
    calSup: '3', cantSup: 3, calInf: '3', cantInf: 3,
    calBastonSup: '3', cantBastonSup: 3, calBastonInf: '3', cantBastonInf: 0,
    calEst: '3', sepLcuarto: 8, sepRest: 16,
    calc: { fy: 4200, varEstNum: 3, nramas: 2 },
  }
  // T-5 del proyecto real: MR+ 1.69 (3#3 corridas) · MR− 3.20 (3#3 + 3 de bastón corrido).
  // Dos ejemplares: al 18 le basta el corrido; el 32 pide Mu+ 2.30 > MR+ 1.69.
  const pts = [
    { member: '18', tipo: 'Max', m33: 0.9, v2: 1.6 }, { member: '18', tipo: 'Min', m33: -0.9, v2: -1.6 },
    { member: '32', tipo: 'Max', m33: 2.3, v2: 2.1 }, { member: '32', tipo: 'Min', m33: -2.0, v2: -2.1 },
  ]

  it('sin puntuales anotados, el que rebasa el MR del corte no queda cubierto', () => {
    const R = computeSectionCapacities(base)
    const ev = evaluateBeamEnvelope(pts, R, false, resistenciasConPuntual(base))
    expect(resistenciasConPuntual(base)).toBeNull()
    expect(ev.total).toBe(2)
    expect(ev.failing).toBe(1)
    expect(ev.conPuntual).toBe(0)
    expect(ev.results.find((r) => r.member === '32').cubierto).toBe(false)
  })

  it('con 2 bastones puntuales anotados, ese mismo ejemplar sí queda cubierto', () => {
    const t = { ...base, cantBastonPuntInf: 2 }
    const punt = resistenciasConPuntual(t)
    expect(punt.kInf).toBe(2)
    expect(punt.MRP).toBeGreaterThan(computeSectionCapacities(t).resP.MRT)
    const ev = evaluateBeamEnvelope(pts, computeSectionCapacities(t), false, punt)
    const r32 = ev.results.find((r) => r.member === '32')
    expect(r32.ok).toBe(false)            // con el corte no le alcanza…
    expect(r32.conPuntual).toBe(true)     // …pero el puntual lo cubre
    expect(r32.cubierto).toBe(true)
    expect(r32.utilPunt).toBeLessThanOrEqual(1)
    expect(ev.failing).toBe(0)
    expect(ev.allOk).toBe(true)
    expect(ev.passing).toBe(2)
    expect(ev.conPuntual).toBe(1)
    expect(ev.soloCorridas).toBe(1)
    expect(ev.miembrosConPuntual).toEqual(['32'])
  })

  it('el puntual no tapa lo que de verdad no alcanza', () => {
    const t = { ...base, cantBastonPuntInf: 2 }
    const exagerado = [{ member: '99', tipo: 'Max', m33: 12, v2: 1 }, { member: '99', tipo: 'Min', m33: -1, v2: -1 }]
    const ev = evaluateBeamEnvelope(exagerado, computeSectionCapacities(t), false, resistenciasConPuntual(t))
    expect(ev.results[0].conPuntual).toBe(false)
    expect(ev.failing).toBe(1)
    expect(ev.allOk).toBe(false)
  })

  it('el puntual es de flexión: no salva un problema de cortante', () => {
    const t = { ...base, cantBastonPuntInf: 2, cantBastonPuntSup: 2 }
    const cortante = [{ member: '77', tipo: 'Max', m33: 0.5, v2: 99 }, { member: '77', tipo: 'Min', m33: -0.5, v2: -99 }]
    const ev = evaluateBeamEnvelope(cortante, computeSectionCapacities(t), false, resistenciasConPuntual(t))
    expect(ev.results[0].okV).toBe(false)
    expect(ev.results[0].conPuntual).toBe(false)
    expect(ev.failing).toBe(1)
  })
})
