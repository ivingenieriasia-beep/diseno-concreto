import { describe, it, expect } from 'vitest'
import { analyzeColumn, revisarColumnaNTC, checkBiaxial, aceroAsimetrico } from '../src/core/columnCalculator.js'
import {
  frTabla, topeAsimetrico, excentricidadMinima, mrEnCurva, prConExcentricidad, contornoEnP, mrEnDireccion,
  bloqueComprimido, resumenNTC,
} from '../src/core/columnasNTC.js'

// Pedido del Ing. Fernando Burgos (2026-11-11): FR de la NTC-Concreto 2023 y
// revisión biaxial de verdad. Los valores esperados de este archivo se
// calcularon a mano (las cuentas van en los comentarios), no con el código.

// Sección 15×15, r = 3, 2 lechos de 2#4 (As = 2.54 cm² por lecho, dp = 3 y 12),
// f'c = 250, fy = 4200, Es = 2×10⁶ → εty = 0.0021, β1 = 0.85.
const col15 = { b: 15, h: 15, r: 3, fc: 250, fy: 4200, lechos: [{ n: 2, num: '4' }, { n: 2, num: '4' }] }

describe('tabla 3.8.2.2 · FR según εt (estribos y zunchos)', () => {
  const ety = 0.0021
  it('controlada por compresión, transición y tensión (estribos «Otros»)', () => {
    expect(frTabla(0.001, ety)).toMatchObject({ FR: 0.65, clase: 'compresión', inciso: 'b' })
    expect(frTabla(ety, ety).FR).toBe(0.65)                          // εt = εty todavía es compresión
    // 0.65 + 0.25·(0.0036 − 0.0021)/0.003 = 0.65 + 0.125 = 0.775
    expect(frTabla(0.0036, ety)).toMatchObject({ clase: 'transición', inciso: 'd' })
    expect(frTabla(0.0036, ety).FR).toBeCloseTo(0.775, 12)
    expect(frTabla(0.0051, ety)).toMatchObject({ FR: 0.9, clase: 'tensión', inciso: 'f' })
    expect(frTabla(0.02, ety).FR).toBe(0.9)
  })
  it('con zunchos (14.7.4): 0.75 / 0.75 + 0.15(…)/0.003 / 0.90', () => {
    expect(frTabla(0.001, ety, { zunchos: true }).FR).toBe(0.75)
    expect(frTabla(0.0036, ety, { zunchos: true }).FR).toBeCloseTo(0.825, 12) // 0.75 + 0.15·0.5
    expect(frTabla(0.006, ety, { zunchos: true }).FR).toBe(0.9)
  })
  it('3.8.2.6: se acepta el FR de compresión en la transición', () => {
    expect(frTabla(0.0036, ety, { transicionComoCompresion: true })).toMatchObject({ FR: 0.65, clase: 'transición', inciso: '3.8.2.6' })
  })
  it('3.8.2.3 refuerzo asimétrico: tope lineal entre (PbR, FRc) y (0.1 f\'c Ag, 0.9)', () => {
    // FRc = 0.65, PbR = 20 t, 0.1 f'c Ag = 5 t, Pn = 10 t:
    // FR* = (0.65 + k·20)/(1 + k·10), k = 0.25/15 → 0.98333/1.16667 = 0.842857
    // comprobación: FR·Pn = 8.42857 → 0.65 + 0.25·(20 − 8.42857)/15 = 0.842857
    expect(topeAsimetrico(0.9, 0.65, 10, 20, 5)).toBeCloseTo(0.842857142857, 9)
    expect(topeAsimetrico(0.7, 0.65, 10, 20, 5)).toBe(0.7)          // nunca sube el FR
    expect(topeAsimetrico(0.9, 0.65, 40, 20, 5)).toBeCloseTo(0.65, 12) // arriba de PbR: el de compresión
    expect(topeAsimetrico(0.9, 0.65, -3, 20, 5)).toBe(0.9)           // en tensión no aplica
    expect(aceroAsimetrico([{ n: 3, num: '5' }, { n: 2, num: '5' }])).toBe(true)
    expect(aceroAsimetrico([{ n: 3, num: '5' }, { n: 2, num: '5' }, { n: 3, num: '5' }])).toBe(false)
  })
  it('5.3.2: excentricidad mínima = máx(0.05h, 20 mm)', () => {
    expect(excentricidadMinima(15)).toBeCloseTo(0.02, 12)   // 0.75 cm < 2 cm
    expect(excentricidadMinima(60)).toBeCloseTo(0.03, 12)   // 3 cm
  })
})

describe('diagrama de diseño · un punto por clase (15×15 4#4, a mano)', () => {
  const an = analyzeColumn(col15)
  const [POC, P1, D, P2, P3] = an.dirX.canonical

  it('compresión pura y Punto 1: controlados por compresión, FR = 0.65', () => {
    // P0 = 0.85·250·(225 − 5.08) + 5.08·4200 = 46 733 + 21 336 = 68 069 kg
    expect(POC.P).toBeCloseTo(68.069, 6)
    expect(POC.diseno.FR).toBe(0.65)
    expect(an.superficie.PR0).toBeCloseTo(0.65 * 68.069, 6)
    // c1 = 11.0294 → εt = 0.003·(12 − 11.0294)/11.0294 = 0.000264
    expect(P1.diseno.epsT).toBeCloseTo(0.003 * (12 - P1.c) / P1.c, 12)
    expect(P1.diseno.epsT).toBeCloseTo(0.000264, 6)
    expect(P1.diseno).toMatchObject({ FR: 0.65, clase: 'compresión' })
  })

  it('balanceada: εt = εty → todavía controlada por compresión', () => {
    expect(D.diseno.epsT).toBeCloseTo(0.0021, 12)
    expect(D.diseno.FR).toBe(0.65)
  })

  it('Punto 2 (c = 5.2059): transición, FR = 0.8013 y P = FR·Pn', () => {
    // c2 = (7.0588 − 1.5)·2/3 + 1.5 = 5.20588
    // εt = 0.003·(12 − 5.20588)/5.20588 = 0.0039153
    // FR = 0.65 + 0.25·(0.0039153 − 0.0021)/0.003 = 0.80127
    // Pn: lecho 1 ε = 0.0012712 → 2542.4·2.54 = 6.4577 t; lecho 2 fluye: −10.668 t;
    //     CC = 0.85·250·0.85·5.20588·15 = 14.1043 t → Pn = 9.894 t
    expect(P2.c).toBeCloseTo(5.20588, 5)
    expect(P2.diseno.epsT).toBeCloseTo(0.0039153, 7)
    expect(P2.diseno).toMatchObject({ clase: 'transición', inciso: 'd' })
    expect(P2.diseno.FR).toBeCloseTo(0.80127, 5)
    expect(P2.P).toBeCloseTo(9.894, 3)
    expect(P2.diseno.P).toBeCloseTo(0.80127 * 9.894, 3)
    expect(P2.diseno.M).toBeCloseTo(P2.diseno.FR * P2.M, 12)
  })

  it('Punto 3 (c = 3.3529): controlado por tensión, FR = 0.90', () => {
    // εt = 0.003·(12 − 3.35294)/3.35294 = 0.0077368 ≥ 0.0051
    expect(P3.diseno.epsT).toBeCloseTo(0.0077368, 7)
    expect(P3.diseno).toMatchObject({ FR: 0.9, clase: 'tensión' })
  })

  it('la curva de diseño es la nominal × FR, punto por punto', () => {
    for (const p of an.dirX.curveDiseno) {
      expect(p.P).toBeCloseTo(p.FR * p.Pn, 12)
      expect(p.M).toBeCloseTo(p.FR * p.Mn, 12)
    }
    expect(an.dirX.curveDiseno).toHaveLength(an.dirX.curve.length)
  })
})

describe('caso real 15×15 4#4, f\'c 250: Pu 0.373 t, Mux 0.02, Muy 1.051 t·m', () => {
  const an = analyzeColumn(col15)
  const r = revisarColumnaNTC(an, 0.373, 0.02, 1.051)

  it('no entra la excentricidad mínima (0.373·0.02 = 0.0075 t·m < Mu)', () => {
    expect(r.eminX).toBe(false)
    expect(r.eminY).toBe(false)
  })

  it('MRx = MRy = 0.9·Mn con Pn = 0.373/0.9 (controlada por tensión)', () => {
    // Pn(c) = 2.709375c + 15.24(c − 3)/c − 10.668 = 0.41444  →  c = 3.41167 cm
    // εt = 0.003·(12 − 3.41167)/3.41167 = 0.0075521  →  FR = 0.90
    // Mn = 1.83895·0.045 + 10.668·0.045 + 9.24339·(7.5 − 1.44996)·0.01 = 1.12204 t·m
    // MR = 0.9·1.12204 = 1.00984 t·m
    expect(r.checkX.punto.FR).toBe(0.9)
    expect(r.checkX.punto.clase).toBe('tensión')
    expect(r.checkX.punto.epsT).toBeCloseTo(0.0075521, 4)
    expect(r.checkX.MR).toBeCloseTo(1.00984, 3)
    expect(r.checkY.MR).toBeCloseTo(1.00984, 3)
  })

  it('5.4.1.2: PR/PR0 < 0.1 → ec. 5.4.1.2.b = (0.02 + 1.051)/1.00984 = 1.0606', () => {
    expect(r.aproximado.ecuacion).toBe('5.4.1.2.b')
    expect(r.aproximado.relacionPR).toBeLessThan(0.1)
    expect(r.aproximado.dc).toBeCloseTo(1.071 / 1.00984, 3)
  })

  it('método general: MR(θ) con el eje neutro inclinado, contra una integración por fibras', () => {
    const ref = mrPorFibras(col15, 0.373, Math.atan2(1.051, 0.02))
    expect(r.general.punto.FR).toBe(0.9)
    expect(r.general.MR).toBeGreaterThan(ref * 0.995)
    expect(r.general.MR).toBeLessThan(ref * 1.003)
    expect(r.general.dc).toBeCloseTo(Math.hypot(0.02, 1.051) / r.general.MR, 12)
    expect(r.general.dc).toBeCloseTo(1.041, 2)
  })

  // 3.08, criterio del Ing. Fernando Burgos (2026-11-11): «ok, vamos a manejar
  // el método general en la aplicación». 5.4.1.2 queda solo como referencia.
  it('gobierna el método general (1.041) y la columna NO pasa; 5.4.1.2.b (1.061) es referencia', () => {
    expect(r.dc).toBe(r.general.dc)
    expect(r.dc).toBeCloseTo(1.041, 2)
    expect(r.aproximado.dc).toBeCloseTo(1.0606, 3)
    expect(r.aproximado.referencia).toBe(true)
    expect(r.aproximado.mayorQueGeneral).toBe(true)
    expect(r.gobierna).toBe('general')
    expect(r.gobiernaEcuacion).toMatch(/5\.4\.1\.1/)
    expect(r.criterio).toMatch(/criterio de FB/)
    expect(r.ok).toBe(false)
    expect(resumenNTC(r)).toMatch(/gobierna método general \(5\.4\.1\.1\) · referencia 5\.4\.1\.2 1\.06\d \(ec\. 5\.4\.1\.2\.b\)/)
    // el contorno elíptico α = 2 de antes ya no se calcula
    expect(r).not.toHaveProperty('elipticoAnterior')
  })
})

describe('5.4.1.2.a Bresler (PR/PR0 ≥ 0.1) en una 30×30 8#5', () => {
  const col = { b: 30, h: 30, r: 4, fc: 250, fy: 4200, lechos: [{ n: 3, num: '5' }, { n: 2, num: '5' }, { n: 3, num: '5' }] }
  const an = analyzeColumn(col)
  const r = revisarColumnaNTC(an, 60, 6, 4)

  it('PR0 = 0.65·P0, P0 = 0.85 f\'c (Ag − As) + As fy', () => {
    // 0.85·250·(900 − 15.84) + 15.84·4200 = 187 884 + 66 528 = 254 412 kg
    expect(an.ntc.P0).toBeCloseTo(254.412, 3)
    expect(r.aproximado.PR0).toBeCloseTo(0.65 * 254.412, 3)
  })

  it('PRx y PRy caen sobre la recta M = e·P de su diagrama de diseño', () => {
    const { PRx, PRy } = r.aproximado
    expect(mrEnCurva(an.dirX.curveDiseno, PRx).MR).toBeCloseTo((6 / 60) * PRx, 3)
    expect(mrEnCurva(an.dirY.curveDiseno, PRy).MR).toBeCloseTo((4 / 60) * PRy, 3)
  })

  it('1/PR = 1/PRx + 1/PRy − 1/PR0 y D/C = Pu/PR', () => {
    const { PR, PRx, PRy, PR0 } = r.aproximado
    expect(1 / PR).toBeCloseTo(1 / PRx + 1 / PRy - 1 / PR0, 12)
    expect(PR / PR0).toBeGreaterThanOrEqual(0.1)
    expect(r.aproximado.ecuacion).toBe('5.4.1.2.a')
    expect(r.aproximado.dc).toBeCloseTo(60 / PR, 12)
  })

  it('a PR/PR0 < 0.1 (Pu = 5 t, mismos momentos) pasa a la suma lineal 5.4.1.2.b', () => {
    const b = revisarColumnaNTC(an, 5, 6, 4)
    expect(b.aproximado.relacionPR).toBeLessThan(0.1)
    expect(b.aproximado.ecuacion).toBe('5.4.1.2.b')
    const MR = mrEnCurva(an.dirX.curveDiseno, 5).MR              // cuadrada y simétrica: MRx = MRy
    expect(b.aproximado.dc).toBeCloseTo((6 + 4) / MR, 9)
  })

  it('un punto de compresión alta queda controlado por compresión (FR = 0.65)', () => {
    const c = revisarColumnaNTC(an, 140, 1, 1)
    expect(c.punto.clase).toBe('compresión')
    expect(c.punto.FR).toBe(0.65)
  })

  it('excentricidad mínima: con Pu = 100 t y sin momentos, 2 t·m en cada dirección', () => {
    const e = revisarColumnaNTC(an, 100, 0, 0)
    expect(e.eminX && e.eminY).toBe(true)
    expect(e.MuxD).toBeCloseTo(2, 12)
    expect(e.MuyD).toBeCloseTo(2, 12)
    expect(e.general.thetaGrados).toBeCloseTo(45, 9)
  })
})

describe('método general · el eje neutro inclinado', () => {
  it('el bloque recortado: área y centroide de un triángulo y de un trapecio', () => {
    // 30×30, compresión hacia la esquina superior derecha a 45°, s0 = 21.2132·cos… :
    // con nu = nv = √2/2 y s0 = 15√2 − 10 la zona es un triángulo de catetos 10√2 = 14.142
    const k = Math.SQRT1_2
    const t = bloqueComprimido(30, 30, k, k, 15 * Math.SQRT2 - 10)
    expect(t.A).toBeCloseTo(0.5 * 200, 9)                     // catetos² / 2 = 100 cm²
    expect(t.uc).toBeCloseTo(15 - 14.1421356 / 3, 6)
    expect(t.vc).toBeCloseTo(15 - 14.1421356 / 3, 6)
    // eje neutro horizontal: rectángulo de 30 × 10 arriba
    const r = bloqueComprimido(30, 30, 0, 1, 5)
    expect(r.A).toBeCloseTo(300, 9)
    expect(r.vc).toBeCloseTo(10, 9)
  })

  it('a 0° y 90° coincide con los diagramas de diseño X y Y', () => {
    const an = analyzeColumn({ b: 40, h: 60, r: 4, fc: 250, fy: 4200, lechos: [{ n: 4, num: '6' }, { n: 2, num: '6' }, { n: 2, num: '6' }, { n: 4, num: '6' }] })
    for (const Pu of [-20, 0, 30, 100, 200]) {
      const cont = contornoEnP(an.superficie, Pu)
      expect(mrEnDireccion(cont, 0).MR).toBeCloseTo(mrEnCurva(an.dirX.curveDiseno, Pu).MR, 6)
      expect(mrEnDireccion(cont, Math.PI / 2).MR).toBeCloseTo(mrEnCurva(an.dirY.curveDiseno, Pu).MR, 6)
    }
  })

  it('a 45° en una cuadrada: MR contra una integración por fibras independiente', () => {
    const col = { b: 30, h: 30, r: 4, fc: 250, fy: 4200, lechos: [{ n: 3, num: '5' }, { n: 2, num: '5' }, { n: 3, num: '5' }] }
    const an = analyzeColumn(col)
    // Pu = 5 t: en diagonal la zona comprimida es un triángulo y el punto
    // queda en la transición (FR ≈ 0.86); la referencia calcula su propio FR
    const cont = contornoEnP(an.superficie, 5)
    const g = mrEnDireccion(cont, Math.PI / 4)
    expect(g.punto.clase).toBe('transición')
    const ref = mrPorFibras(col, 5, Math.PI / 4)
    expect(g.MR).toBeGreaterThan(ref * 0.995)
    expect(g.MR).toBeLessThan(ref * 1.003)
    // y es menor que el MR uniaxial: la esquina comprimida es más chica
    expect(g.MR).toBeLessThan(mrEnCurva(an.dirX.curveDiseno, 5).MR)
  })

  it('checkBiaxial(dirX, dirY, …) es la misma revisión', () => {
    const an = analyzeColumn(col15)
    const a = checkBiaxial(an.dirX, an.dirY, 0.373, 0.02, 1.051)
    expect(a.dc).toBe(revisarColumnaNTC(an, 0.373, 0.02, 1.051).dc)
    expect(JSON.stringify(an.dirX).length).toBeGreaterThan(0) // sin ciclos al serializar
  })

  it('fuera del rango de P (más que PR0) no pasa', () => {
    const an = analyzeColumn(col15)
    const r = revisarColumnaNTC(an, an.superficie.PR0 * 1.01, 0, 0)
    expect(r.ok).toBe(false)
    expect(r.dc).toBe(Infinity)
  })
})

// ── Referencia independiente: integración por fibras ─────────
// Concreto en una malla fina de celdas (sin recortar polígonos) y las barras
// de la retícula. Para la dirección θ del momento se busca el ángulo del eje
// neutro y la profundidad c con FR(εt)·Pn = Pu, con el FR de la tabla
// 3.8.2.2 (estribos) escrito aquí aparte. Devuelve MR = FR·|Mn| (t·m).
function mrPorFibras(col, Pu, theta, N = 200) {
  const { b, h, r, fc, fy } = col
  const E = 2e6, ec = 0.003, ey = fy / E, b1 = 0.85
  const areas = { 3: 0.71, 4: 1.27, 5: 1.98, 6: 2.85 }
  const nL = col.lechos.length
  const bars = []
  col.lechos.forEach((L, i) => {
    const y = r + ((h - 2 * r) * i) / (nL - 1)
    for (let j = 0; j < L.n; j++) bars.push({ u: (L.n === 1 ? b / 2 : r + ((b - 2 * r) * j) / (L.n - 1)) - b / 2, v: h / 2 - y, A: areas[L.num] })
  })
  const cells = []
  const du = b / N, dv = h / N
  for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) cells.push({ u: -b / 2 + (i + 0.5) * du, v: -h / 2 + (j + 0.5) * dv })
  const dA = du * dv
  const FRde = (et) => (et <= ey ? 0.65 : et >= ey + 0.003 ? 0.9 : 0.65 + (0.25 * (et - ey)) / 0.003)
  const punto = (phi, c) => {
    const nu = Math.cos(phi), nv = Math.sin(phi)
    const smax = Math.abs(nu) * b / 2 + Math.abs(nv) * h / 2
    let P = 0, Mx = 0, My = 0, dt = 0
    for (const q of cells) {
      if (smax - (q.u * nu + q.v * nv) <= b1 * c) { const F = 0.85 * fc * dA / 1000; P += F; Mx += F * q.v * 0.01; My -= F * q.u * 0.01 }
    }
    for (const br of bars) {
      const d = smax - (br.u * nu + br.v * nv)
      dt = Math.max(dt, d)
      const eps = ec * (c - d) / c
      const f = Math.abs(eps) > ey ? fy * Math.sign(eps) : E * eps
      const F = f * br.A / 1000
      P += F; Mx += F * br.v * 0.01; My -= F * br.u * 0.01
    }
    const FR = FRde((ec * (dt - c)) / c)
    return { P: FR * P, Mx: FR * Mx, My: FR * My }
  }
  const enP = (phi) => {
    let lo = 0.3, hi = 2 * Math.max(b, h)
    for (let k = 0; k < 50; k++) { const m = (lo + hi) / 2; if (punto(phi, m).P > Pu) hi = m; else lo = m }
    return punto(phi, (lo + hi) / 2)
  }
  // ángulo del eje neutro cuyo momento apunta a θ (bisección sobre φ en [90°, 180°])
  let lo = Math.PI / 2, hi = Math.PI
  for (let k = 0; k < 40; k++) {
    const m = (lo + hi) / 2
    const p = enP(m)
    if (Math.atan2(p.My, p.Mx) < theta) lo = m; else hi = m
  }
  const p = enP((lo + hi) / 2)
  return Math.hypot(p.Mx, p.My)
}

// Casos de una iteración real (datos de prueba, sin nombre de cliente), del
// Diseñador de concreto con el motor de 6fe3d8d. C-1 ya trae los momentos
// amplificados por esbeltez (Fab 1.10, Cm = 1), porque la app no la revisa.
describe('3.08: con el método general, los dos casos del Diseñador de concreto', () => {
  it("15×15 4#5, f'c 250: Pu 0.373, Mux 0.022007, Muy 1.156489 → general 0.776 (5.4.1.2.b 0.791, referencia)", () => {
    const an = analyzeColumn({ h: 15, b: 15, r: 3, fc: 250, fy: 4200, lechos: [{ n: 2, num: '5' }, { n: 2, num: '5' }] })
    const r = revisarColumnaNTC(an, 0.373, 0.022007, 1.156489)
    expect(r.general.dc).toBeCloseTo(0.77623, 4)
    expect(r.aproximado.dc).toBeCloseTo(0.79080, 4)
    expect(r.dc).toBe(r.general.dc)
    expect(r.ok).toBe(true)
  })
  it("15×15 4#3, f'c 200: Pu 0.273, Mux 0.337, Muy 0.013 → general 0.566 (5.4.1.2.b 0.587, referencia)", () => {
    const an = analyzeColumn({ h: 15, b: 15, r: 3, fc: 200, fy: 4200, lechos: [{ n: 2, num: '3' }, { n: 2, num: '3' }] })
    const r = revisarColumnaNTC(an, 0.273, 0.337, 0.013)
    expect(r.general.dc).toBeCloseTo(0.56602, 4)
    expect(r.aproximado.dc).toBeCloseTo(0.58742, 4)
    expect(r.dc).toBe(r.general.dc)
    expect(r.ok).toBe(true)
  })
})
