// ══════════════════════════════════════════════════════════════
// Flexocompresión según la NTC-Concreto 2023 (Gaceta CDMX).
//
//   · 3.8.1.1  resistencia de diseño = FR × resistencia nominal
//   · 3.8.2.2  FR para momento, axial o combinación (tabla 3.8.2.2), en
//              función de la deformación unitaria neta de tensión εt del
//              acero extremo a tensión:
//                εt ≤ εty                 controlada por compresión  0.65 (zunchos 0.75)
//                εty < εt < εty + 0.003   transición                 0.65 + 0.25(εt − εty)/0.003
//                                                                    (zunchos 0.75 + 0.15(…)/0.003)
//                εt ≥ εty + 0.003         controlada por tensión     0.90
//   · 3.8.2.3  refuerzo asimétrico: FR no excede la interpolación lineal
//              entre el FR de compresión en PbR y 0.9 en 0.1 f'c Ag
//   · 3.8.2.4  εty = fy/Es
//   · 3.8.2.6  se acepta el FR de compresión en la transición (opción)
//   · 5.3.2.1  excentricidad de diseño ≥ 0.05h y ≥ 20 mm, en la dirección
//              de la flexión
//   · 5.4.1.1  flexocompresión en dos direcciones con las hipótesis de 3.6
//              (aquí: eje neutro inclinado) o con el método aproximado
//   · 5.4.1.2  1/PR = 1/PRx + 1/PRy − 1/PR0           (ec. 5.4.1.2.a)
//              si PR/PR0 < 0.1: Mux/MRx + Muy/MRy ≤ 1  (ec. 5.4.1.2.b)
//
// No se encontró en la NTC-Concreto 2023 un tope general a la carga axial
// de diseño de columnas (del tipo 0.8·FR·P0): el 0.8·FR·Po sólo aparece
// para pilas y pilotes (9.7.3.1.b). Por eso aquí el tope axial es FR·P0.
//
// Este módulo no importa nada del resto de la app: recibe la sección ya
// preparada por columnCalculator.js (barras, P0, β1).
// ══════════════════════════════════════════════════════════════

/** FR de la tabla 3.8.2.2 y la clasificación de la sección */
export function frTabla(epsT, epsTy, { zunchos = false, transicionComoCompresion = false } = {}) {
  const FRc = zunchos ? 0.75 : 0.65
  const pend = zunchos ? 0.15 : 0.25
  if (!(epsT > epsTy)) return { FR: FRc, clase: 'compresión', inciso: zunchos ? 'a' : 'b' }
  if (epsT >= epsTy + 0.003) return { FR: 0.9, clase: 'tensión', inciso: zunchos ? 'e' : 'f' }
  if (transicionComoCompresion) return { FR: FRc, clase: 'transición', inciso: '3.8.2.6' }
  return { FR: FRc + (pend * (epsT - epsTy)) / 0.003, clase: 'transición', inciso: zunchos ? 'c' : 'd' }
}

/** FR de compresión (inciso a o b de la tabla 3.8.2.2) */
export const frCompresion = (opts = {}) => (opts.zunchos ? 0.75 : 0.65)

/**
 * 3.8.2.3 · refuerzo asimétrico. FR no excede la recta que va del FR de
 * compresión en P = PbR a 0.9 en P = 0.1 f'c Ag, con P la carga axial de
 * diseño (FR·Pn) del mismo punto. Se resuelve FR ≤ tope(FR·Pn) sin iterar:
 * la recta es decreciente en P, así que el FR más grande que cumple es
 * FR* = (FRc + k·PbR)/(1 + k·Pn), con k = (0.9 − FRc)/(PbR − P01).
 */
export function topeAsimetrico(FR, FRc, Pn, PbR, P01) {
  if (!(PbR > P01) || !(Pn > 0)) return FR
  const k = (0.9 - FRc) / (PbR - P01)
  const lim = Math.min(0.9, Math.max(FRc, (FRc + k * PbR) / (1 + k * Pn)))
  return Math.min(FR, lim)
}

/** 5.3.2.1 · excentricidad mínima de diseño (m) para un peralte en cm */
export const excentricidadMinima = (peralteCm) => Math.max(0.05 * peralteCm, 2) / 100

/** Opciones de FR guardadas en la columna */
export function opcionesFR(col = {}) {
  return { zunchos: !!col.zunchos, transicionComoCompresion: !!col.frTransicionCompresion }
}

// ── Diagrama de diseño de una dirección ──────────────────────

/**
 * Agrega FR, εt y la clasificación a cada punto nominal de una dirección y
 * devuelve la curva de diseño (P = FR·Pn, M = FR·Mn), en el mismo orden de c.
 * @param nominal  [{ c, P, M }] (c = null para la compresión pura)
 * @param S        { epsC, epsTy, dt, FRc, asimetrico, PbR, P01, fr }
 */
export function curvaDeDiseno(nominal, S) {
  return nominal.map((pt) => {
    const d = puntoDeDiseno(pt.c, pt.P, S)
    return { c: pt.c, Pn: pt.P, Mn: pt.M, ...d, P: d.FR * pt.P, M: d.FR * pt.M }
  })
}

/** FR, εt y clase de un punto (c, Pn) */
export function puntoDeDiseno(c, Pn, S) {
  // compresión pura: todo el acero comprimido
  const epsT = c == null ? -S.epsC : (S.epsC * (S.dt - c)) / c
  const t = frTabla(epsT, S.epsTy, S.fr)
  let FR = t.FR
  let topado = false
  if (S.asimetrico) {
    const F2 = topeAsimetrico(FR, S.FRc, Pn, S.PbR, S.P01)
    topado = F2 < FR - 1e-12
    FR = F2
  }
  return { epsT, FR, clase: t.clase, inciso: topado ? '3.8.2.3' : t.inciso }
}

// ── Revisión de un punto contra una curva ────────────────────

/**
 * MR al nivel Pu sobre una curva ordenada por c (se recorre en ese orden, sin
 * reordenar por P: la curva de diseño puede no ser monótona en la transición).
 * Si hay varios cruces se toma el de mayor M. Además del MR devuelve, ya
 * interpoladas, las propiedades del punto resistente (FR, εt, clase, c).
 */
export function mrEnCurva(curve, Pu) {
  let Pmin = Infinity, Pmax = -Infinity
  for (const p of curve) { if (p.P < Pmin) Pmin = p.P; if (p.P > Pmax) Pmax = p.P }
  if (!(Pu >= Pmin - 1e-12 && Pu <= Pmax + 1e-12)) return { enRango: false, MR: 0, Pmin, Pmax, punto: null }
  let best = null
  for (let i = 0; i < curve.length - 1; i++) {
    const a = curve[i], b = curve[i + 1]
    const lo = Math.min(a.P, b.P), hi = Math.max(a.P, b.P)
    if (Pu < lo - 1e-12 || Pu > hi + 1e-12) continue
    const t = hi === lo ? 0 : (Pu - a.P) / (b.P - a.P)
    const M = a.M + t * (b.M - a.M)
    if (!best || M > best.M) best = { M, a, b, t }
  }
  if (!best) return { enRango: false, MR: 0, Pmin, Pmax, punto: null }
  return { enRango: true, MR: Math.max(0, best.M), Pmin, Pmax, punto: interpPunto(best.a, best.b, best.t) }
}

function interpPunto(a, b, t) {
  const L = (k) => (a[k] == null || b[k] == null ? (t < 0.5 ? a[k] : b[k]) : a[k] + t * (b[k] - a[k]))
  const epsT = L('epsT')
  return {
    c: L('c'), FR: L('FR'), epsT,
    clase: t < 0.5 ? a.clase : b.clase,
    inciso: t < 0.5 ? a.inciso : b.inciso,
    Pn: L('Pn'), Mn: L('Mn'),
  }
}

/**
 * Carga resistente de diseño con excentricidad e (m): el primer cruce de la
 * recta M = e·P (P > 0) con la curva de diseño. e = 0 → la compresión pura.
 */
export function prConExcentricidad(curve, e) {
  const top = curve.reduce((m, p) => (p.P > m ? p.P : m), -Infinity)
  if (!(e > 0)) return top
  let best = Infinity
  for (let i = 0; i < curve.length - 1; i++) {
    const a = curve[i], b = curve[i + 1]
    const fa = a.M - e * a.P, fb = b.M - e * b.P
    if (fa * fb > 0 || fa === fb) continue
    const t = fa / (fa - fb)
    const P = a.P + t * (b.P - a.P)
    if (P > 0 && P < best) best = P
  }
  return best === Infinity ? 0 : best
}

// ── Superficie de diseño con eje neutro inclinado (3.6 / 5.4.1.1) ──

/**
 * Bloque de concreto: el rectángulo b×h (centro en el origen, u a lo ancho,
 * v hacia la cara superior) recortado por el semiplano u·nu + v·nv ≥ s0.
 * @returns { A, uc, vc } área (cm²) y centroide (cm)
 */
export function bloqueComprimido(b, h, nu, nv, s0) {
  const rect = [[-b / 2, -h / 2], [b / 2, -h / 2], [b / 2, h / 2], [-b / 2, h / 2]]
  const s = (p) => p[0] * nu + p[1] * nv - s0
  const poly = []
  for (let i = 0; i < 4; i++) {
    const p = rect[i], q = rect[(i + 1) % 4]
    const sp = s(p), sq = s(q)
    if (sp >= 0) poly.push(p)
    if ((sp >= 0) !== (sq >= 0)) {
      const t = sp / (sp - sq)
      poly.push([p[0] + t * (q[0] - p[0]), p[1] + t * (q[1] - p[1])])
    }
  }
  if (poly.length < 3) return { A: 0, uc: 0, vc: 0 }
  let A2 = 0, cu = 0, cv = 0
  for (let i = 0; i < poly.length; i++) {
    const [x0, y0] = poly[i], [x1, y1] = poly[(i + 1) % poly.length]
    const cr = x0 * y1 - x1 * y0
    A2 += cr; cu += (x0 + x1) * cr; cv += (y0 + y1) * cr
  }
  if (Math.abs(A2) < 1e-12) return { A: 0, uc: 0, vc: 0 }
  return { A: A2 / 2, uc: cu / (3 * A2), vc: cv / (3 * A2) }
}

/**
 * Punto nominal para un eje neutro inclinado. La dirección de compresión es
 * n = (nu, nv); la fibra extrema a compresión es la esquina con mayor u·nu +
 * v·nv. Mismas hipótesis que la hoja (3.6.1): deformación plana, εc en la
 * fibra extrema, bloque 0.85 f'c hasta β1·c medido perpendicular al eje
 * neutro y acero elastoplástico. Signos: Mx > 0 comprime la cara superior
 * (lecho 1), My > 0 comprime la cara izquierda (x = 0), como la dirección Y.
 */
export function puntoInclinado(c, nu, nv, S, smax) {
  let P = 0, Mx = 0, My = 0
  for (const br of S.bars) {
    const d = smax - (br.u * nu + br.v * nv)
    const eps = (S.epsC * (c - d)) / c
    const f = Math.abs(eps) > S.epsY ? S.fy * Math.sign(eps) : S.E * eps
    const F = (f * br.area) / 1000
    P += F; Mx += F * br.v * 0.01; My -= F * br.u * 0.01
  }
  const a = Math.min(S.b1 * c, 2 * smax)
  const blk = bloqueComprimido(S.b, S.h, nu, nv, smax - a)
  const CC = (0.85 * S.fc * blk.A) / 1000
  P += CC; Mx += CC * blk.vc * 0.01; My -= CC * blk.uc * 0.01
  return { P, Mx, My }
}

/**
 * La superficie de diseño: para cada ángulo φ de la dirección de compresión,
 * la curva (FR·Pn, FR·Mx, FR·My) al barrer c de D/20 a D/β1 (D = peralte en
 * esa dirección) y cerrar en FR·P0. Con φ = 90° es la dirección X y con
 * φ = 180° la Y, con el mismo barrido que sus diagramas 2D.
 * @param S { b, h, fc, fy, E, epsC, epsY, epsTy, b1, bars:[{u,v,area}], P0, Ag, asimetrico, fr }
 */
export function superficieDeDiseno(S, { nPhi = 144, nC = 80 } = {}) {
  const FRc = frCompresion(S.fr)
  const P01 = (0.1 * S.fc * S.Ag) / 1000
  const curvas = []
  for (let k = 0; k < nPhi; k++) {
    const phi = (2 * Math.PI * k) / nPhi
    const nu = Math.cos(phi), nv = Math.sin(phi)
    const smax = Math.abs(nu) * (S.b / 2) + Math.abs(nv) * (S.h / 2)
    const D = 2 * smax
    let dt = -Infinity
    for (const br of S.bars) dt = Math.max(dt, smax - (br.u * nu + br.v * nv))
    const cb = (S.epsC * dt) / (S.epsC + S.epsTy)
    const PbR = FRc * puntoInclinado(cb, nu, nv, S, smax).P
    const SD = { epsC: S.epsC, epsTy: S.epsTy, dt, FRc, asimetrico: S.asimetrico, PbR, P01, fr: S.fr }
    const cMin = D / 20, cMax = D / S.b1
    const pts = []
    for (let i = 0; i <= nC; i++) {
      const c = cMin + ((cMax - cMin) * i) / nC
      const n = puntoInclinado(c, nu, nv, S, smax)
      const d = puntoDeDiseno(c, n.P, SD)
      pts.push({ c, Pn: n.P, Mxn: n.Mx, Myn: n.My, ...d, P: d.FR * n.P, Mx: d.FR * n.Mx, My: d.FR * n.My })
    }
    const d0 = puntoDeDiseno(null, S.P0, SD)
    pts.push({ c: null, Pn: S.P0, Mxn: 0, Myn: 0, ...d0, P: d0.FR * S.P0, Mx: 0, My: 0 })
    curvas.push({ phi, pts })
  }
  return { nPhi, nC, curvas, PR0: FRc * S.P0, P0: S.P0, FRc }
}

/**
 * El contorno de momentos de diseño al nivel Pu: un vértice por φ (el cruce
 * de su curva con P = Pu de mayor momento). Si para algún φ el nivel queda
 * fuera de su curva, el vértice va al origen (del lado seguro) y se avisa.
 */
export function contornoEnP(sup, Pu) {
  const verts = []
  let faltan = 0
  for (const { phi, pts } of sup.curvas) {
    let best = null
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i], b = pts[i + 1]
      const lo = Math.min(a.P, b.P), hi = Math.max(a.P, b.P)
      if (Pu < lo - 1e-12 || Pu > hi + 1e-12) continue
      const t = hi === lo ? 0 : (Pu - a.P) / (b.P - a.P)
      const Mx = a.Mx + t * (b.Mx - a.Mx), My = a.My + t * (b.My - a.My)
      const m = Math.hypot(Mx, My)
      if (!best || m > best.m) best = { phi, Mx, My, m, ...interpPunto(a, b, t) }
    }
    if (!best) { faltan++; best = { phi, Mx: 0, My: 0, m: 0, c: null, FR: null, epsT: null, clase: null, inciso: null } }
    verts.push(best)
  }
  return { Pu, verts, faltan, fuera: faltan === verts.length }
}

/**
 * MR(θ): donde el rayo desde el origen con ángulo θ (en el plano Mx–My)
 * corta el contorno. Si lo corta más de una vez se toma el corte más
 * cercano (del lado seguro). Devuelve también FR, εt y clase del corte.
 */
export function mrEnDireccion(cont, theta) {
  const dx = Math.cos(theta), dy = Math.sin(theta)
  const V = cont.verts
  let best = null
  for (let i = 0; i < V.length; i++) {
    const A = V[i], B = V[(i + 1) % V.length]
    const ex = B.Mx - A.Mx, ey = B.My - A.My
    const den = dx * ey - dy * ex
    if (Math.abs(den) < 1e-14) continue
    const t = (A.Mx * ey - A.My * ex) / den
    const s = (A.Mx * dy - A.My * dx) / den
    if (s < -1e-9 || s > 1 + 1e-9 || !(t > 1e-12)) continue
    if (!best || t < best.t) best = { t, A, B, s: Math.min(1, Math.max(0, s)) }
  }
  if (!best) return { MR: 0, punto: null }
  const { A, B, s } = best
  const ok = A.FR != null && B.FR != null
  const L = (k) => (ok ? A[k] + s * (B[k] - A[k]) : null)
  return {
    MR: best.t,
    MRx: best.t * dx, MRy: best.t * dy,
    punto: ok
      ? { FR: L('FR'), epsT: L('epsT'), c: L('c'), phi: A.phi + s * angDiff(A.phi, B.phi), clase: s < 0.5 ? A.clase : B.clase, inciso: s < 0.5 ? A.inciso : B.inciso }
      : null,
  }
}

const angDiff = (a, b) => {
  let d = b - a
  while (d > Math.PI) d -= 2 * Math.PI
  while (d < -Math.PI) d += 2 * Math.PI
  return d
}

// ── La revisión completa de un punto (Pu, Mux, Muy) ──────────

const cociente = (Mu, MR, enRango) => (!enRango ? Infinity : MR > 1e-12 ? Mu / MR : Mu > 1e-12 ? Infinity : 0)

export const METODO_GENERAL = 'NTC 5.4.1.1 · hipótesis de 3.6 (eje neutro inclinado)'
export const ETIQUETA_EC = {
  '5.4.1.2.a': 'NTC ec. 5.4.1.2.a (Bresler): 1/PR = 1/PRx + 1/PRy − 1/PR0',
  '5.4.1.2.b': 'NTC ec. 5.4.1.2.b: Mux/MRx + Muy/MRy ≤ 1 (PR/PR0 < 0.1)',
}

/**
 * Revisión de flexocompresión biaxial según la NTC-Concreto 2023.
 * @param N  { curvaX, curvaY, superficie, h, b } — curvas de DISEÑO (con FR)
 * @param Pu carga axial de diseño (t, compresión +)
 * @param Mux, Muy momentos de diseño (t·m, se usan magnitudes)
 * @returns el objeto de la revisión (ver campos abajo)
 */
export function revisarFlexocompresionNTC(N, Pu, Mux, Muy) {
  Pu = +Pu || 0
  Mux = Math.abs(+Mux || 0); Muy = Math.abs(+Muy || 0)
  const comp = Pu > 0
  // 5.3.2.1 · Mx trabaja el peralte h; My, la base b
  const exMin = excentricidadMinima(N.h), eyMin = excentricidadMinima(N.b)
  const MuxD = comp ? Math.max(Mux, Pu * exMin) : Mux
  const MuyD = comp ? Math.max(Muy, Pu * eyMin) : Muy
  const eminX = comp && Pu * exMin > Mux
  const eminY = comp && Pu * eyMin > Muy

  // Uniaxiales con los diagramas de diseño
  const rx = mrEnCurva(N.curvaX, Pu)
  const ry = mrEnCurva(N.curvaY, Pu)
  const checkX = { ok: rx.enRango && MuxD <= rx.MR + 1e-9, MR: rx.MR, ratio: cociente(MuxD, rx.MR, rx.enRango), Pmin: rx.Pmin, Pmax: rx.Pmax, enRango: rx.enRango, punto: rx.punto, Mu: MuxD }
  const checkY = { ok: ry.enRango && MuyD <= ry.MR + 1e-9, MR: ry.MR, ratio: cociente(MuyD, ry.MR, ry.enRango), Pmin: ry.Pmin, Pmax: ry.Pmax, enRango: ry.enRango, punto: ry.punto, Mu: MuyD }

  // a) Método general: eje neutro inclinado
  const cont = contornoEnP(N.superficie, Pu)
  const theta = Math.atan2(MuyD, MuxD)
  const ray = cont.fuera ? { MR: 0, punto: null } : mrEnDireccion(cont, theta)
  const Mu = Math.hypot(MuxD, MuyD)
  const dcGeneral = cont.fuera ? Infinity : cociente(Mu, ray.MR, true)
  const general = {
    metodo: METODO_GENERAL, theta, thetaGrados: (theta * 180) / Math.PI, Mu, MR: ray.MR,
    MRx: ray.MRx ?? 0, MRy: ray.MRy ?? 0, dc: dcGeneral, punto: ray.punto,
    vertices: cont.faltan, fueraDeRango: cont.fuera,
  }

  // b) Método aproximado 5.4.1.2
  const PR0 = N.superficie.PR0
  let PRx = null, PRy = null, PR = null
  if (comp) {
    PRx = prConExcentricidad(N.curvaX, MuxD / Pu)
    PRy = prConExcentricidad(N.curvaY, MuyD / Pu)
    const inv = PRx > 0 && PRy > 0 ? 1 / PRx + 1 / PRy - 1 / PR0 : Infinity
    PR = inv > 0 && isFinite(inv) ? 1 / inv : 0
  }
  const usaA = comp && PR / PR0 >= 0.1
  const ecuacion = usaA ? '5.4.1.2.a' : '5.4.1.2.b'
  const dcLineal = !rx.enRango || !ry.enRango ? Infinity : cociente(MuxD, rx.MR, true) + cociente(MuyD, ry.MR, true)
  const dcAprox = usaA ? Pu / PR : dcLineal
  const aproximado = {
    metodo: ETIQUETA_EC[ecuacion], ecuacion, PR, PRx, PRy, PR0,
    relacionPR: comp && PR0 > 0 ? PR / PR0 : null,
    MRx: rx.MR, MRy: ry.MR, dc: dcAprox,
    dcLineal, dcBresler: usaA ? Pu / PR : (comp && PR > 0 ? Pu / PR : null),
  }

  const gobiernaGeneral = !(dcAprox > dcGeneral)
  const dc = Math.max(dcGeneral, dcAprox)
  const ok = dc <= 1 + 1e-9 && checkX.ok && checkY.ok
  return {
    norma: 'NTC-Concreto 2023',
    Pu, Mux, Muy, MuxD, MuyD, eminX, eminY, exMin, eyMin,
    checkX, checkY, general, aproximado,
    dc, ok,
    gobierna: gobiernaGeneral ? 'general' : 'aproximado',
    gobiernaEcuacion: gobiernaGeneral ? METODO_GENERAL : ETIQUETA_EC[ecuacion],
    // FR, εt y clase del punto resistente del método que gobierna (si es el
    // aproximado, los del diagrama de la dirección más exigida)
    punto: gobiernaGeneral
      ? ray.punto
      : (checkX.ratio >= checkY.ratio ? rx.punto : ry.punto),
  }
}

// ── Textos (informes, memoria, consola) ──────────────────────

const f3 = (v) => (v == null ? '—' : !isFinite(v) ? '∞' : Number(v).toFixed(3))

/** «método general (5.4.1.1)» o «ec. 5.4.1.2.b» */
export const nombreGobierna = (bi) => (bi.gobierna === 'general' ? 'método general (5.4.1.1)' : `ec. ${bi.aproximado.ecuacion}`)

/**
 * Una línea con lo que decide la columna:
 * «NTC-Concreto 2023 · D/C 1.061, gobierna ec. 5.4.1.2.b · general 1.041 ·
 *  5.4.1.2 1.061 (ec. 5.4.1.2.b) · FR 0.900, εt 0.00756 (tensión)»
 */
export function resumenNTC(bi) {
  if (!bi) return ''
  const p = bi.punto
  return `NTC-Concreto 2023 · D/C ${f3(bi.dc)}, gobierna ${nombreGobierna(bi)} · general ${f3(bi.general.dc)} · `
    + `5.4.1.2 ${f3(bi.aproximado.dc)} (ec. ${bi.aproximado.ecuacion})`
    + (p ? ` · FR ${f3(p.FR)}, εt ${p.epsT == null ? '—' : p.epsT.toFixed(5)} (${p.clase})` : '')
    + (bi.eminX || bi.eminY ? ` · excentricidad mínima 5.3.2 en ${[bi.eminX && 'X', bi.eminY && 'Y'].filter(Boolean).join(' y ')}` : '')
}

// ── Contornos al nivel Pu (para dibujar Mx–My) ───────────────

/**
 * Los contornos de momentos de diseño al nivel Pu, en el primer cuadrante
 * (las demandas se revisan en magnitud):
 *   general   el del eje neutro inclinado (5.4.1.1)
 *   aprox     el de 5.4.1.2: Bresler si Pu/PR0 ≥ 0.1 (en la frontera PR = Pu),
 *             si no, la recta Mx/MRx + My/MRy = 1
 * @param N   { curvaX, curvaY, superficie } como en revisarFlexocompresionNTC
 */
export function contornosEnP(N, Pu, nTheta = 46) {
  const cont = contornoEnP(N.superficie, Pu)
  const MRx = mrEnCurva(N.curvaX, Pu).MR, MRy = mrEnCurva(N.curvaY, Pu).MR
  const PR0 = N.superficie.PR0
  const bresler = Pu > 0 && Pu / PR0 >= 0.1
  const general = [], aprox = []
  for (let j = 0; j < nTheta; j++) {
    const th = (Math.PI / 2) * (j / (nTheta - 1))
    const c = Math.cos(th), s = Math.sin(th)
    const g = cont.fuera ? 0 : mrEnDireccion(cont, th).MR
    general.push({ Mx: g * c, My: g * s })
    let m
    if (bresler) {
      // la escala k con PR(k·cosθ, k·sinθ) = Pu; PR baja al crecer k
      const PRde = (k) => {
        const PRx = prConExcentricidad(N.curvaX, (k * c) / Pu), PRy = prConExcentricidad(N.curvaY, (k * s) / Pu)
        const inv = PRx > 0 && PRy > 0 ? 1 / PRx + 1 / PRy - 1 / PR0 : Infinity
        return inv > 0 && isFinite(inv) ? 1 / inv : 0
      }
      let lo = 0, hi = Math.max(MRx, MRy, 1e-6) * 2
      for (let k = 0; k < 40; k++) { const mid = (lo + hi) / 2; if (PRde(mid) >= Pu) lo = mid; else hi = mid }
      m = lo
    } else {
      const den = (MRx > 1e-12 ? c / MRx : c > 1e-12 ? Infinity : 0) + (MRy > 1e-12 ? s / MRy : s > 1e-12 ? Infinity : 0)
      m = den > 0 && isFinite(den) ? 1 / den : 0
    }
    aprox.push({ Mx: m * c, My: m * s })
  }
  return { Pu, general, aprox, ecuacion: bresler ? '5.4.1.2.a' : '5.4.1.2.b', MRx, MRy, fuera: cont.fuera }
}
