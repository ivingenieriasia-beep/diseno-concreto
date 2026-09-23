import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { parseModeloRam, seccionSugerida } from '../src/core/ramModel.js'
import { analyzeGroup, perfilCompleto } from '../src/core/longitudinal.js'
import { analyzeColumn } from '../src/core/columnCalculator.js'
import { evaluateEnvelope } from '../src/core/ramParser.js'
import { proponerTrabe, proponerColumna, textoArmadoTrabe } from '../src/core/propuesta.js'
import useBeamStore from '../src/store/useBeamStore.js'

const here = dirname(fileURLToPath(import.meta.url))
const R = parseModeloRam(readFileSync(join(here, 'fixtures', 'modelo_ram.json'), 'utf-8'))

// Una trabe como la deja «crear las secciones»: armado de fábrica (2#3 y 2#3)
const trabeDe = (nombre) => {
  const g = R.grupos.find((x) => x.nombre === nombre)
  const s = seccionSugerida(g)
  return {
    nombre: s.nombre, ancho: s.ancho, peralte: s.peralte, recub: 3, fc: 250,
    calInf: '3', cantInf: 2, calSup: '3', cantSup: 2,
    calBastonInf: '3', cantBastonInf: 0, calBastonSup: '3', cantBastonSup: 0,
    cantBastonPuntInf: 0, cantBastonPuntSup: 0,
    calEst: '2.5', sepLcuarto: 8, sepRest: 16,
    calc: { fy: 4200, varEstNum: 2, nramas: 2, SL4: null, SLresto: null },
    perfil: g.perfil,
    envelope: { points: g.points, invertir: false },
  }
}

const columnaDe = (nombre) => {
  const g = R.grupos.find((x) => x.nombre === nombre)
  const s = seccionSugerida(g)
  return {
    nombre: s.nombre, b: s.ancho, h: s.peralte, r: 3, fc: 250, fy: 4200, E: 2e6, epsC: 0.003,
    nLechos: 2, lechos: [{ n: 2, num: '4' }, { n: 2, num: '4' }], estriboNum: '2.5',
    envelope: { mapping: 'M33X', points: g.points },
  }
}

describe('armado propuesto para una trabe recién creada', () => {
  for (const nombre of ['T5', 'T6', 'T4']) {
    it(`${nombre}: lo que propone lo aprueba el mismo análisis que luego verifica`, () => {
      const t = trabeDe(nombre)
      const p = proponerTrabe(t, R.model)
      expect(p).not.toBeNull()
      // se re-verifica desde cero, como lo haría el módulo Longitudinal
      const final = { ...t, ...p.patch, calc: { ...t.calc, varEstNum: null, SL4: null, SLresto: null } }
      const G = analyzeGroup(final, perfilCompleto(final, R.model))
      expect(G.allOk).toBe(p.estado === 'ok')
      if (p.estado === 'ok') {
        expect(G.nInsuf).toBe(0)
        expect(G.nShear).toBe(0)
        expect(G.caps.okBase).toBe(true)
      } else {
        expect(p.motivos.length).toBeGreaterThan(0)
      }
    })
  }

  it('el armado de fábrica no pasaba: la propuesta sí cambia algo', () => {
    const t = trabeDe('T5')
    const antes = analyzeGroup(t, perfilCompleto(t, R.model))
    const p = proponerTrabe(t, R.model)
    expect(antes.allOk).toBe(false)
    expect(p.estado).toBe('ok')
    expect(p.patch.armadoPropuesto).toBe(true)
  })

  it('los extremos nunca quedan más holgados que el centro', () => {
    for (const nombre of ['T5', 'T6', 'T4', 'T7']) {
      const p = proponerTrabe(trabeDe(nombre), R.model)
      expect(p.patch.sepLcuarto).toBeLessThanOrEqual(p.patch.sepRest)
      expect(Number.isInteger(p.patch.sepLcuarto)).toBe(true)
      expect(p.patch.sepLcuarto).toBeGreaterThanOrEqual(6)
    }
  })

  it('una sección que no alcanza se entrega marcada, no escondida', () => {
    // T5 en 10×15: no hay armado que la salve
    const t = { ...trabeDe('T5'), ancho: 10, peralte: 15 }
    const p = proponerTrabe(t, R.model)
    expect(p.estado).toBe('revisar')
    expect(p.motivos.join(' ')).toMatch(/sección/)
  })

  it('el texto se lee como en obra', () => {
    const txt = textoArmadoTrabe({
      cantInf: 3, calInf: '4', cantBastonInf: 0, calBastonInf: '4', cantBastonPuntInf: 2,
      cantSup: 2, calSup: '4', cantBastonSup: 1, calBastonSup: '4', cantBastonPuntSup: 0,
      calEst: '2.5', sepLcuarto: 10, sepRest: 15,
    })
    expect(txt).toBe('inf 3#4 + 2#4 puntual · sup 2#4 + 1#4 bastón · E#2.5 @10/15')
  })
})

describe('armado propuesto para una columna', () => {
  it('C1: la más ligera que pasa la envolvente completa', () => {
    const col = columnaDe('C1')
    const p = proponerColumna(col)
    expect(p.estado).toBe('ok')
    const an = analyzeColumn({ ...col, ...p.patch })
    expect(evaluateEnvelope(col.envelope.points, an.dirX, an.dirY, 'M33X').allOk).toBe(true)
    expect(p.texto).toMatch(/ρ \d+\.\d+ %/)
  })

  it('nunca por debajo de la cuantía mínima de la propuesta', () => {
    const col = columnaDe('C1')
    const p = proponerColumna(col, { rhoMin: 0.01 })
    const As = p.patch.lechos.reduce((s, L) => s + L.n * { 3: 0.71, 4: 1.27, 5: 1.98, 6: 2.85, 8: 5.07 }[L.num], 0)
    expect(As / (col.b * col.h)).toBeGreaterThanOrEqual(0.01)
  })

  it('una columna que no alcanza se marca con el motivo', () => {
    const col = { ...columnaDe('C1'), b: 12, h: 12 }
    const p = proponerColumna(col)
    expect(p.estado).toBe('revisar')
    expect(p.motivos[0]).toMatch(/sección/)
  })
})

describe('el armado escrito por índice no deja atrás a su gemelo de calc', () => {
  it('patchSectionAt sincroniza calc como lo hace el formulario', () => {
    const S = useBeamStore.getState()
    S.createSection()
    const idx = useBeamStore.getState().sections.length - 1
    S.patchSectionAt(idx, { calInf: '5', cantInf: 3, calEst: '3', sepLcuarto: 10, sepRest: 15 })
    const c = useBeamStore.getState().sections[idx].calc
    expect(c.varPNum).toBe(5)
    expect(c.varPCount).toBe(3)
    expect(c.varEstNum).toBe(3)
    expect(c.SL4).toBe(10)
    expect(c.SLresto).toBe(15)
  })

  it('una propuesta deja de serlo en cuanto el ingeniero toca el armado', () => {
    const S = useBeamStore.getState()
    S.createSection()
    const idx = useBeamStore.getState().sections.length - 1
    S.patchSectionAt(idx, { calInf: '4', cantInf: 3, armadoPropuesto: true })
    S.selectSection(idx)
    // abrir la calculadora reimporta los mismos valores: no cuenta
    useBeamStore.getState().setCalc({ varPNum: 4, varPCount: 3 })
    expect(useBeamStore.getState().sections[idx].armadoPropuesto).toBe(true)
    // cambiar una varilla sí
    useBeamStore.getState().setForm({ cantInf: 4 })
    expect(useBeamStore.getState().sections[idx].armadoPropuesto).toBe(false)
  })
})

describe('estribos de la columna propuesta, por zonas', () => {
  it('C1 sale con extremos y centro, y la zona de extremo sabe la altura', () => {
    const col = columnaDe('C1')
    const H = Math.max(...R.grupos.find((x) => x.nombre === 'C1').perfil.members.map((m) => m.Lreport))
    const p = proponerColumna(col, { H })
    expect(p.patch.sepExt).toBeGreaterThan(0)
    expect(p.patch.sepCen).toBe(2 * p.patch.sepExt + (p.patch.sepCen % 2))
    expect(p.patch.longExt).toBeGreaterThanOrEqual(Math.max(60, (H * 100) / 6))
    expect(p.patch.altura).toBe(H)
    expect(p.texto).toMatch(/en extremos \(\d+ cm\) · @ \d+ cm al centro/)
  })
})
