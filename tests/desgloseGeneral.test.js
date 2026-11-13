import { describe, it, expect } from 'vitest'
import { analyzeColumn, revisarColumnaNTC } from '../src/core/columnCalculator.js'
import { superficieDeDiseno } from '../src/core/columnasNTC.js'
import { desgloseMetodoGeneral, seccionInclinada } from '../src/core/desgloseGeneral.js'

// Columnas ficticias (3.10): el desglose es solo presentación y no cambia el D/C.
const col15 = { b: 15, h: 15, r: 3, fc: 250, fy: 4200, lechos: [{ n: 2, num: '3' }, { n: 2, num: '3' }] }
const col30 = { b: 30, h: 40, r: 4, fc: 250, fy: 4200, lechos: [{ n: 3, num: '5' }, { n: 2, num: '5' }, { n: 3, num: '4' }] }

describe('desglose del método general (5.4.1.1)', () => {
  it('la sección es la misma con la que el motor arma la superficie', () => {
    for (const col of [col15, col30]) {
      const an = analyzeColumn(col)
      const s = superficieDeDiseno(seccionInclinada(col, an))
      expect(s.curvas.length).toBe(an.superficie.curvas.length)
      s.curvas.forEach((cv, k) => cv.pts.forEach((p, i) => {
        const q = an.superficie.curvas[k].pts[i]
        expect(p.P).toBeCloseTo(q.P, 12); expect(p.Mx).toBeCloseTo(q.Mx, 12); expect(p.My).toBeCloseTo(q.My, 12)
      }))
    }
  })

  const casos = [
    [col15, 0.8, 0.30, 0.05], [col15, 3.0, 0.10, 0.22], [col15, -0.5, 0.20, 0.20],
    [col30, 40, 6.0, 2.0], [col30, 12, 1.0, 5.0], [col30, 80, 0.5, 0.2],
  ]
  it.each(casos)('cuadra el estado exacto y no cambia el D/C (Pu %s)', (col, Pu, Mux, Muy) => {
    const an = analyzeColumn(col)
    const bi = revisarColumnaNTC(an, Pu, Mux, Muy)
    const dcAntes = bi.dc
    const d = desgloseMetodoGeneral(col, an, bi)
    expect(d.ok).toBe(true)
    expect(revisarColumnaNTC(an, Pu, Mux, Muy).dc).toBe(dcAntes)     // el motor no cambia
    expect(d.dc).toBe(dcAntes)
    // el estado está sobre el rayo de demanda, al nivel Pu
    expect(d.P).toBeCloseTo(Pu, 5)
    expect(Math.atan2(d.MRy, d.MRx)).toBeCloseTo(d.theta, 6)
    // las sumas de la tabla son las del motor: ΣF + Cc = Pn y lo mismo con los momentos
    expect(d.sumaF + d.bloque.Cc).toBeCloseTo(d.Pn, 9)
    expect(d.sumaMx + d.bloque.Mx).toBeCloseTo(d.Mxn, 9)
    expect(d.sumaMy + d.bloque.My).toBeCloseTo(d.Myn, 9)
    expect(d.FR * d.Pn).toBeCloseTo(d.P, 9)
    expect(d.a).toBeCloseTo(Math.min(d.seccion.b1 * d.c, d.D), 12)
    // la capacidad exacta y la del motor (interpolada) difieren poco
    expect(Math.abs(d.diferencia)).toBeLessThan(0.02)
  })

  it('sin punto resistente lo dice y no inventa un desglose', () => {
    const an = analyzeColumn(col15)
    const bi = revisarColumnaNTC(an, 9999, 0.1, 0.1)
    const d = desgloseMetodoGeneral(col15, an, bi)
    expect(d.ok).toBe(false)
    expect(d.motivo).toMatch(/fuera/)
  })
})
