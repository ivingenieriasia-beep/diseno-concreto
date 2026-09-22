import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { parseRamStations, memberProfile } from '../src/core/longitudinal.js'
import { beamEnvelopeByMember } from '../src/core/ramParser.js'

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
