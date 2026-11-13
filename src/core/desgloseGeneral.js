// ══════════════════════════════════════════════════════════════
// Desglose del método general (NTC-Concreto 2023, 5.4.1.1) del punto que
// gobierna, para la pestaña «Cálculo (Excel)» (3.10, pedido del Ing.
// Fernando Burgos, 2026-11-13).
//
// SOLO PRESENTACIÓN: no cambia el motor ni el D/C. El D/C que gobierna sigue
// siendo el de revisarFlexocompresionNTC, que interpola sobre la superficie
// de diseño (144 ángulos × 80 profundidades). Como esa interpolación mezcla
// dos ejes neutros vecinos, aquí se busca el eje neutro EXACTO sobre el rayo
// de demanda, (φ, c) con FR·Pn = Pu y la dirección de (MRx, MRy) igual a la
// de (Mux, Muy), con las mismas funciones del motor (puntoInclinado,
// puntoDeDiseno, bloqueComprimido), y se desglosa barra por barra. Se
// muestran las dos capacidades: la del motor (la que decide) y la del estado
// exacto (la que se puede revisar a mano).
// ══════════════════════════════════════════════════════════════

import { barGrid } from './columnCalculator'
import { puntoInclinado, puntoDeDiseno, bloqueComprimido, frCompresion } from './columnasNTC'

const grados = (r) => (r * 180) / Math.PI
const angDiff = (a, b) => {
  let d = b - a
  while (d > Math.PI) d -= 2 * Math.PI
  while (d < -Math.PI) d += 2 * Math.PI
  return d
}

/**
 * La sección tal como la arma analyzeColumn para la superficie de diseño
 * (las mismas barras y los mismos parámetros). Una prueba comprueba que con
 * ella superficieDeDiseno da exactamente la superficie del análisis.
 */
export function seccionInclinada(col, an) {
  const P = an.dirX.params
  const b = +col.b, h = +col.h, r = +col.r
  const lechos = (col.lechos || []).map((L) => ({ n: +L.n || 0, num: L.num }))
  const bars = barGrid({ h, b, r, lechos })
    .map((br) => ({ u: br.x - b / 2, v: h / 2 - br.y, area: br.area, num: br.num, diam: br.diam }))
  return {
    b, h, fc: +col.fc, fy: +col.fy || 4200, E: +col.E || 2e6, epsC: +col.epsC || 0.003,
    epsY: P.epsY, epsTy: P.epsY, b1: P.b1, bars, P0: an.dirX.POC, Ag: b * h,
    asimetrico: an.ntc.asimetrico, fr: an.ntc.fr,
  }
}

/** Lo que superficieDeDiseno prepara para cada φ (dt, PbR y los datos de FR) */
function datosDeFi(S, phi) {
  const nu = Math.cos(phi), nv = Math.sin(phi)
  const smax = Math.abs(nu) * (S.b / 2) + Math.abs(nv) * (S.h / 2)
  let dt = -Infinity
  for (const br of S.bars) dt = Math.max(dt, smax - (br.u * nu + br.v * nv))
  const FRc = frCompresion(S.fr)
  const P01 = (0.1 * S.fc * S.Ag) / 1000
  const cb = (S.epsC * dt) / (S.epsC + S.epsTy)
  const PbR = FRc * puntoInclinado(cb, nu, nv, S, smax).P
  return { nu, nv, smax, SD: { epsC: S.epsC, epsTy: S.epsTy, dt, FRc, asimetrico: S.asimetrico, PbR, P01, fr: S.fr } }
}

/** Un estado (φ, c): nominal, FR y de diseño, igual que un punto de la superficie */
export function estadoInclinado(S, phi, c) {
  const k = datosDeFi(S, phi)
  const n = puntoInclinado(c, k.nu, k.nv, S, k.smax)
  const d = puntoDeDiseno(c, n.P, k.SD)
  return { phi, c, ...k, Pn: n.P, Mxn: n.Mx, Myn: n.My, ...d, P: d.FR * n.P, Mx: d.FR * n.Mx, My: d.FR * n.My }
}

/**
 * El eje neutro exacto sobre el rayo θ al nivel Pu, desde el punto del motor.
 * Newton en (φ, c) con derivadas numéricas y paso amortiguado.
 */
export function ejeNeutroSobreRayo(S, Pu, theta, phi0, c0, { iter = 60 } = {}) {
  const D = Math.max(S.b, S.h)
  const g = (phi, c) => {
    const e = estadoInclinado(S, phi, c)
    return [(e.P - Pu) / Math.max(1, S.P0), angDiff(theta, Math.atan2(e.My, e.Mx))]
  }
  let phi = phi0, c = c0
  let r = g(phi, c)
  for (let i = 0; i < iter; i++) {
    if (Math.abs(r[0]) < 1e-10 && Math.abs(r[1]) < 1e-10) break
    const hp = 1e-6, hc = 1e-6 * D
    const rp = g(phi + hp, c), rc = g(phi, c + hc)
    const J = [[(rp[0] - r[0]) / hp, (rc[0] - r[0]) / hc], [(rp[1] - r[1]) / hp, (rc[1] - r[1]) / hc]]
    const det = J[0][0] * J[1][1] - J[0][1] * J[1][0]
    if (!(Math.abs(det) > 1e-30)) break
    let dphi = -(J[1][1] * r[0] - J[0][1] * r[1]) / det
    let dc = -(-J[1][0] * r[0] + J[0][0] * r[1]) / det
    // paso amortiguado: que el residuo baje
    let t = 1, mejor = null
    const n0 = Math.hypot(...r)
    for (let k = 0; k < 30; k++) {
      const cN = c + t * dc
      if (cN > 1e-6) {
        const rN = g(phi + t * dphi, cN)
        if (Math.hypot(...rN) < n0) { mejor = { phi: phi + t * dphi, c: cN, r: rN }; break }
      }
      t /= 2
    }
    if (!mejor) break
    ;({ phi, c, r } = mejor)
  }
  const ok = Math.abs(r[0]) < 1e-7 && Math.abs(r[1]) < 1e-7
  return { ok, phi, c, residuo: r }
}

/**
 * El desglose completo del punto que gobierna.
 * @param col  la columna (b, h, r, f'c, lechos…)
 * @param an   analyzeColumn(col)
 * @param bi   la revisión del caso que gobierna (revisarFlexocompresionNTC)
 */
export function desgloseMetodoGeneral(col, an, bi) {
  if (!an || !bi) return null
  const G = bi.general
  const base = {
    Pu: bi.Pu, Mux: bi.Mux, Muy: bi.Muy, MuxD: bi.MuxD, MuyD: bi.MuyD, eminX: bi.eminX, eminY: bi.eminY,
    exMin: bi.exMin, eyMin: bi.eyMin,
    theta: G.theta, thetaGrados: G.thetaGrados, Mu: G.Mu,
    MRmotor: G.MR, dc: bi.dc, aproximado: bi.aproximado,
    transicionComoCompresion: !!an.ntc.fr?.transicionComoCompresion, zunchos: !!an.ntc.fr?.zunchos,
  }
  if (G.fueraDeRango || !G.punto || !(G.MR > 0)) {
    return { ...base, ok: false, motivo: G.fueraDeRango ? 'Pu queda fuera de la superficie de diseño' : 'el motor no dio un punto resistente sobre el rayo' }
  }
  const S = seccionInclinada(col, an)
  const sol = ejeNeutroSobreRayo(S, bi.Pu, G.theta, G.punto.phi, G.punto.c)
  if (!sol.ok) return { ...base, ok: false, motivo: 'no se encontró el eje neutro exacto sobre el rayo (el D/C del motor no cambia)' }
  const e = estadoInclinado(S, sol.phi, sol.c)
  const { nu, nv, smax } = e
  const barras = S.bars.map((br, i) => {
    const d = smax - (br.u * nu + br.v * nv)
    const eps = (S.epsC * (sol.c - d)) / sol.c
    const f = Math.abs(eps) > S.epsY ? S.fy * Math.sign(eps) : S.E * eps
    const F = (f * br.area) / 1000
    return {
      n: i + 1, num: br.num, area: br.area, u: br.u, v: br.v, d, eps, f, F,
      zx: br.v, zy: -br.u, Mx: F * br.v * 0.01, My: -F * br.u * 0.01, fluye: Math.abs(eps) > S.epsY,
    }
  })
  const a = Math.min(S.b1 * sol.c, 2 * smax)
  const blk = bloqueComprimido(S.b, S.h, nu, nv, smax - a)
  const Cc = (0.85 * S.fc * blk.A) / 1000
  const suma = (k) => barras.reduce((s, x) => s + x[k], 0)
  const MR = Math.hypot(e.Mx, e.My)
  return {
    ...base, ok: true,
    seccion: { b: S.b, h: S.h, fc: S.fc, fy: S.fy, E: S.E, epsC: S.epsC, epsY: S.epsY, b1: S.b1 },
    phi: sol.phi, phiGrados: grados(sol.phi), ejeNeutroGrados: ((grados(sol.phi) + 90) % 180 + 180) % 180,
    c: sol.c, a, smax, dt: e.SD.dt, D: 2 * smax,
    bloque: { A: blk.A, uc: blk.uc, vc: blk.vc, Cc, zx: blk.vc, zy: -blk.uc, Mx: Cc * blk.vc * 0.01, My: -Cc * blk.uc * 0.01 },
    barras,
    sumaF: suma('F'), sumaMx: suma('Mx'), sumaMy: suma('My'),
    Pn: e.Pn, Mxn: e.Mxn, Myn: e.Myn,
    epsT: e.epsT, clase: e.clase, inciso: e.inciso, FR: e.FR,
    P: e.P, MRx: e.Mx, MRy: e.My, MRexacto: MR,
    diferencia: G.MR > 0 ? (G.MR - MR) / MR : null,
    dcExacto: MR > 0 ? G.Mu / MR : Infinity,
  }
}
