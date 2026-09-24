// ══════════════════════════════════════════════════════════════
// Cimentaciones · núcleo común
//
// Lo que comparten todos los cimientos de concreto: varillas, flexión por
// franja, cortante en una dirección, penetración, aplastamiento, anclaje y la
// capacidad efectiva del suelo. Cada revisión devuelve también sus PASOS
// (fórmula, sustitución y resultado), que son la memoria: la pantalla, el PDF
// y el Word leen lo mismo, así que no pueden contar cosas distintas.
//
// Criterio: el de las hojas de la oficina (Cimentaciones1-V2.xlsm), con sus
// unidades corregidas. El suelo se revisa con cargas de SERVICIO contra la
// capacidad efectiva qe = qadm − relleno − peso propio; el concreto con cargas
// FACTORIZADAS (1.3 CM + 1.5 CV) y NTC-Concreto: FR 0.9 en flexión y 0.75 en
// cortante. Unidades: t, m, t·m y t/m² para el suelo; cm, kg y kg/cm² dentro
// de la sección de concreto.
// ══════════════════════════════════════════════════════════════

import { VARILLAS, beta1 } from '../sectionCalculator'
import { developmentLength } from '../longitudinal'

export const GC = 2.4                                   // t/m³, concreto reforzado

/** Criterios de la obra (se pueden cambiar en «Suelo y criterios») */
export const CRITERIOS = {
  fcm: 1.3, fcv: 1.5,        // factores de carga gravitacional
  facc: 1.1,                 // combinación accidental: 1.1 (CM + CV + S)
  kS: 1.33,                  // la capacidad admisible sube con sismo (práctica; confírmalo con el estudio)
  fcEmpuje: 1.5,             // factor de carga del empuje de tierras (hoja Muro Contención)
  fsVolteo: 2.0, fsDesl: 1.5,
  sMin: 10, sMax: 30, paso: 2.5,   // separaciones de parrilla, cm
  calibres: [4, 5, 6, 8],    // los que se prueban al proponer
  plantilla: 5,              // cm de plantilla de concreto pobre bajo el cimiento
  hMin: 15,                  // cm, peralte mínimo de una zapata
  Bmin: 0.6,                 // m, ancho mínimo de una zapata
  DfMin: 0.6,                // m, desplante mínimo
  ligaAci: false,            // liga con lado ≥ claro libre/20 (ACI 18.13.3.3, alta sismicidad); si no, la CT-1
}

/** Revisiones de los mínimos de la oficina: ancho de zapata y desplante */
export function minimos(C, { B = null, Df = null, que = 'ancho' } = {}) {
  const out = { checks: [], pasos: [] }
  if (B != null) {
    out.checks.push(check('anchoMin', 'Ancho mínimo', num(C.Bmin, 0.6), B, 'm', { grupo: 'Detallado', ok: B >= num(C.Bmin, 0.6) - 1e-9, nota: `${que} ≥ ${f2(num(C.Bmin, 0.6))} m` }))
    out.pasos.push(paso('Ancho mínimo', `${que} ≥ ${f2(num(C.Bmin, 0.6))} m`, `${que} = ${f2(B)}`, B >= num(C.Bmin, 0.6) - 1e-9 ? 'cumple' : 'no cumple', '', { ok: B >= num(C.Bmin, 0.6) - 1e-9 }))
  }
  if (Df != null) {
    out.checks.push(check('desplante', 'Desplante mínimo', num(C.DfMin, 0.6), Df, 'm', { grupo: 'Detallado', ok: Df >= num(C.DfMin, 0.6) - 1e-9, nota: `Df ≥ ${f2(num(C.DfMin, 0.6))} m` }))
    out.pasos.push(paso('Desplante mínimo', `Df ≥ ${f2(num(C.DfMin, 0.6))} m`, `Df = ${f2(Df)}`, Df >= num(C.DfMin, 0.6) - 1e-9 ? 'cumple' : 'no cumple', '', { ok: Df >= num(C.DfMin, 0.6) - 1e-9 }))
  }
  return out
}

/** Suelo de la obra (del estudio de mecánica de suelos) */
export const SUELO = {
  qadm: 15,       // t/m², capacidad admisible
  gs: 1.6,        // t/m³, peso volumétrico del suelo y del relleno
  Df: 1.0,        // m, profundidad de desplante
  phi: 28,        // °, fricción interna del relleno (empujes)
  c: 0,           // t/m², cohesión del suelo de apoyo
  phiB: 28,       // °, fricción del suelo de apoyo (deslizamiento y pasivo)
  mu: 0.45,       // coeficiente de fricción base-suelo (mampostería)
  gsB: null,      // t/m³, suelo de apoyo frente a la punta (pasivo); vacío = el mismo γs
}

export const MAT = { fc: 250, fy: 4200, r: 5 }

// ── números y redondeos ──────────────────────────────────────
export const f1 = (v) => (Number.isFinite(v) ? v.toFixed(1) : '—')
export const f2 = (v) => (Number.isFinite(v) ? v.toFixed(2) : '—')
export const f3 = (v) => (Number.isFinite(v) ? v.toFixed(3) : '—')
export const f0 = (v) => (Number.isFinite(v) ? v.toFixed(0) : '—')
const EPS = 1e-9
/** Hacia arriba a múltiplos de `m` (0.05 m, 5 cm…) sin arrastrar el error del flotante */
const limpio = (v) => Math.round(v * 1e6) / 1e6
export const arriba = (x, m) => limpio(Math.ceil(x / m - 1e-6) * m)
export const abajo = (x, m) => limpio(Math.floor(x / m + 1e-6) * m)
export const redondea = (x, m) => limpio(Math.round(x / m) * m)
export const num = (v, def = 0) => { const n = parseFloat(v); return Number.isFinite(n) ? n : def }

// ── varillas ─────────────────────────────────────────────────
export function varilla(n) {
  const k = parseFloat(n)
  return VARILLAS.find((v) => v.num === k) || VARILLAS.find((v) => v.num === 4)
}
/** kg por metro de una varilla */
export const kgm = (v) => v.area * 0.785

/** «#4 @ 20» */
export const txtArm = (a) => (a ? `#${a.num} @ ${fmtS(a.s)}` : '—')

/**
 * Una parrilla con la CANTIDAD programada (modo 'n', desde el formulario): la
 * separación que da exactamente esas varillas en el ancho W (o 100/n en una
 * franja por metro). Así, si cambia el ancho, se quedan las mismas varillas.
 * (El 1 − 1e-9 es para que `parrilla` cuente justo n y no n + 1 por redondeo.)
 */
export function armEfectivo(a, { W = 100, r = 5, porMetro = false } = {}) {
  if (!a || a.modo !== 'n' || !(Number(a.n) > 0)) return a
  if (porMetro) return { ...a, s: 100 / Math.max(1, Math.round(Number(a.n))) }
  const n = Math.max(2, Math.round(Number(a.n)))
  const libre = Math.max(0, W - 2 * r - varilla(a.num).diam)
  if (!(libre > 0)) return a
  return { ...a, n, s: (libre / (n - 1)) * (1 - 1e-9) }
}
export const fmtS = (s) => (Number.isInteger(s) ? `${s}` : s.toFixed(1))

// ── pasos de la memoria ──────────────────────────────────────
/**
 * Un renglón de la memoria.
 * @param t   concepto              «Presión de contacto»
 * @param f   fórmula               «q′ = N / A′»
 * @param n   sustitución numérica  «= 12.35 / 1.44»
 * @param v   resultado (número o texto)
 * @param u   unidades
 * @param x   { ok, lim, nota } si el renglón es una revisión
 */
export const paso = (t, f, n, v, u = '', x = {}) => ({ t, f, n, v, u, ...x })

/** Una revisión con su resultado para el panel: aprovechamiento = actuante / resistente */
export function check(id, titulo, act, res, unidad, { ok, nota = '', menor = true, grupo = '' } = {}) {
  const u = menor ? (res > 0 ? act / res : (act > 0 ? Infinity : 0)) : (act > 0 ? res / act : Infinity)
  return { id, titulo, act, res, unidad, u, ok: ok ?? (u <= 1 + 1e-9), nota, grupo }
}

// ── suelo ────────────────────────────────────────────────────
/**
 * Capacidad efectiva: lo que le queda al suelo para las cargas de la
 * estructura, descontado el relleno sobre el cimiento y su peso propio.
 * (La hoja la calculaba así, pero restaba t/m³ a kg/m² y el descuento salía
 * mil veces chico.)
 */
export function capacidadEfectiva({ qadm, gs, Df, h }, k = 1) {
  const hz = h / 100
  const relleno = gs * Math.max(0, Df - hz)
  const propio = GC * hz
  const qe = k * qadm - relleno - propio
  return {
    qe, relleno, propio,
    pasos: [
      paso('Capacidad efectiva', `qe = ${k !== 1 ? `${k}·` : ''}qadm − γs (Df − h) − γc h`,
        `= ${k !== 1 ? `${k}·` : ''}${f2(qadm)} − ${f2(gs)} (${f2(Df)} − ${f2(hz)}) − ${GC} × ${f2(hz)}`, qe, 't/m²'),
    ],
  }
}

/**
 * Presiones bajo una base rectangular B × L con la resultante N en (ex, ey)
 * desde el centro. Área efectiva de Meyerhof B′ = B − 2|ex| (la que usan las
 * NTC-Cimentaciones para revisar con excentricidad) y, de referencia, las
 * presiones elásticas en las esquinas.
 */
export function presiones(N, B, L, ex = 0, ey = 0) {
  const Bp = B - 2 * Math.abs(ex), Lp = L - 2 * Math.abs(ey)
  // si la resultante sale de la base no queda área que apoye (y dos negativos
  // no hacen un área positiva)
  const sinArea = Bp <= EPS || Lp <= EPS
  const Ap = sinArea ? 0 : Bp * Lp
  const q = N > 0 ? (sinArea ? Infinity : N / Ap) : 0
  const A = B * L
  const kx = (6 * Math.abs(ex)) / B, ky = (6 * Math.abs(ey)) / L
  const qmax = (N / A) * (1 + kx + ky)
  const qmin = (N / A) * (1 - kx - ky)
  // región con presión: el rectángulo efectivo, del lado de la resultante
  const x0 = ex >= 0 ? B / 2 - Bp : -B / 2, x1 = ex >= 0 ? B / 2 : -B / 2 + Bp
  const y0 = ey >= 0 ? L / 2 - Lp : -L / 2, y1 = ey >= 0 ? L / 2 : -L / 2 + Lp
  return { Bp, Lp, Ap, q, qmax, qmin, despega: qmin < -EPS, enNucleo: kx + ky <= 1 + 1e-9, region: sinArea ? { x0: 0, x1: 0, y0: 0, y1: 0 } : { x0, x1, y0, y1 }, sinArea }
}

// ── flexión por franja ───────────────────────────────────────
/**
 * Acero por flexión de una franja de ancho b (cm) con peralte útil d.
 * Regla de la hoja (ACI 9.6.1.3 con el mínimo de temperatura de losas):
 *   As = Asreq si Asreq ≥ Asmín; si no, el menor entre Asmín y 4/3·Asreq,
 *   sin bajar del de temperatura.
 */
export function flexion({ Mu, b, d, h, fc, fy, FR = 0.9, nombre = '' }) {
  const fcc = 0.85 * fc
  const Rn = (Mu * 1e5) / (FR * b * d * d)
  const disc = 1 - (2 * Rn) / fcc
  const insuficiente = disc < 0
  const rho = insuficiente ? NaN : (fcc / fy) * (1 - Math.sqrt(disc))
  const AsReq = insuficiente ? NaN : rho * b * d
  const AsMin = (0.7 * Math.sqrt(fc) / fy) * b * d
  const AsTemp = 0.0018 * b * h
  const rhoBal = (beta1(fc) * fcc / fy) * (6000 / (6000 + fy))
  const AsMax = 0.9 * rhoBal * b * d
  let As, rige
  if (insuficiente) { As = NaN; rige = 'insuficiente' }
  else if (AsReq >= AsMin) { As = AsReq; rige = 'calculado' }
  else if ((4 / 3) * AsReq < AsMin) { As = Math.max((4 / 3) * AsReq, AsTemp); rige = (4 / 3) * AsReq >= AsTemp ? '4/3 del calculado' : 'temperatura' }
  else { As = AsMin; rige = 'mínimo' }
  const pasos = [
    paso(`Momento último${nombre ? ` ${nombre}` : ''}`, 'Mu', '', Mu, 't·m'),
    paso('Factor de resistencia', 'Rn = Mu / (FR b d²)', `= ${f2(Mu)}×10⁵ / (${FR} × ${f1(b)} × ${f1(d)}²)`, Rn, 'kg/cm²'),
    paso('Cuantía requerida', 'ρ = (f″c/fy)(1 − √(1 − 2Rn/f″c))', insuficiente ? 'la raíz sale negativa' : `= (${f1(fcc)}/${fy})(1 − √(1 − 2×${f2(Rn)}/${f1(fcc)}))`, insuficiente ? 'no alcanza' : rho, '', { ok: !insuficiente, nota: insuficiente ? 'la sección no alcanza: sube el peralte' : '' }),
    paso('Acero requerido', 'As,req = ρ b d', `= ${f3(rho)} × ${f1(b)} × ${f1(d)}`, AsReq, 'cm²'),
    paso('Acero mínimo', 'As,mín = 0.7√f′c / fy · b d', `= 0.7√${fc} / ${fy} × ${f1(b)} × ${f1(d)}`, AsMin, 'cm²'),
    paso('Acero por temperatura', 'As,t = 0.0018 b h', `= 0.0018 × ${f1(b)} × ${f1(h)}`, AsTemp, 'cm²'),
    paso('Acero de diseño', 'As', `rige ${rige}`, As, 'cm²'),
  ]
  return { Mu, b, d, h, Rn, rho, AsReq, AsMin, AsTemp, AsMax, As, rige, insuficiente, FR, pasos }
}

/** Momento resistente de As en una franja b × d */
export function momentoResistente({ As, b, d, fc, fy, FR = 0.9 }) {
  const a = (As * fy) / (0.85 * fc * b)
  return (FR * As * fy * (d - a / 2)) / 1e5
}

// ── parrillas: # y separación ───────────────────────────────
/**
 * Varillas de un # a separación s repartidas en un ancho W (cm), con el
 * recubrimiento r a cada lado: la primera y la última van a r del borde.
 */
export function parrilla({ num: n, s, W, r, porMetro = false }) {
  const v = varilla(n)
  // franja de 1 m en un elemento corrido: 100/s varillas por metro
  if (porMetro) return { v, n: 100 / s, sReal: s, As: (100 / s) * v.area, porM: (100 / s) * v.area }
  const libre = Math.max(0, W - 2 * r - v.diam)
  const piezas = Math.max(2, Math.floor(libre / s + 1e-6) + 1 + (libre % s > 1e-6 ? 1 : 0))
  const sReal = piezas > 1 ? libre / (piezas - 1) : 0
  return { v, n: piezas, sReal, As: piezas * v.area, porM: (piezas * v.area * 100) / W }
}

/**
 * Propone # y separación para un acero As (cm²) en un ancho W (cm): la
 * separación práctica (a cada `paso` cm, entre sMin y sMax) con menos acero;
 * a igual acero, la varilla más gruesa y más separada.
 */
export function proponerParrilla({ As, W, r, porMetro = false, calibres = CRITERIOS.calibres, sMin = CRITERIOS.sMin, sMax = CRITERIOS.sMax, paso: p = CRITERIOS.paso, filtro = null }) {
  let mejor = null
  for (const n of calibres) {
    const v = varilla(n)
    const sCalc = (v.area * (porMetro ? 100 : W)) / Math.max(As, EPS)
    let s = Math.min(sMax, abajo(sCalc, p))
    if (s < sMin) continue
    let g = parrilla({ num: n, s, W, r, porMetro })
    while (g.As < As - 1e-6 && s - p >= sMin) { s -= p; g = parrilla({ num: n, s, W, r, porMetro }) }
    if (g.As < As - 1e-6) continue
    if (filtro && !filtro(n, s)) continue
    const cand = { num: n, s, As: g.As, n: g.n }
    if (!mejor || cand.As < mejor.As - 1e-6 || (Math.abs(cand.As - mejor.As) < 1e-6 && n > mejor.num)) mejor = cand
  }
  // en una zapata chica ningún calibre de los preferidos ancla: se prueba el #3
  if (!mejor && !calibres.includes(3)) return proponerParrilla({ As, W, r, porMetro, calibres: [3], sMin, sMax, paso: p, filtro })
  return mejor
}

/** Revisión de una parrilla contra el acero de diseño */
export function revisaParrilla({ arm, As, W, r, porMetro = false, sMin = CRITERIOS.sMin, sMax = CRITERIOS.sMax, nombre = '' }) {
  const g = parrilla({ num: arm.num, s: arm.s, W, r, porMetro })
  const okAs = g.As >= As - 1e-6
  const libreMin = Math.max(2.5, g.v.diam)
  const okSmax = arm.s <= sMax + 1e-6
  const okSmin = arm.s - g.v.diam >= libreMin - 1e-6
  const apretada = arm.s < sMin - 1e-6
  const pasos = [
    porMetro
      ? paso(`Parrilla${nombre ? ` ${nombre}` : ''}`, `#${arm.num} @ ${fmtS(arm.s)}: as · 100 / s`, `= ${f2(g.v.area)} × 100 / ${fmtS(arm.s)}`, g.As, 'cm²/m', { ok: okAs, lim: `≥ As = ${f2(As)} cm²/m` })
      : paso(`Parrilla${nombre ? ` ${nombre}` : ''}`, `#${arm.num} @ ${fmtS(arm.s)} en ${f0(W)} cm`, `${g.n} varillas × ${f2(g.v.area)} cm²`, g.As, 'cm²', { ok: okAs, lim: `≥ As = ${f2(As)} cm²` }),
    paso('Separación máxima', 's ≤ s,máx', `${fmtS(arm.s)} ≤ ${sMax}`, okSmax ? 'cumple' : 'no cumple', '', { ok: okSmax }),
  ]
  if (!okSmin) pasos.push(paso('Separación libre mínima', 's − db ≥ máx(2.5, db)', `${fmtS(arm.s)} − ${f2(g.v.diam)} ≥ ${f2(libreMin)}`, 'no cumple', '', { ok: false }))
  return { ...g, okAs, okSmax, okSmin, apretada, ok: okAs && okSmax && okSmin, pasos }
}

// ── cortante en una dirección ────────────────────────────────
/**
 * Elementos anchos (zapatas, losas): VcR = 0.5 FR b d √f′c. Para peraltes
 * mayores de 70 cm se reduce por tamaño: × (1 − 0.0004 (h − 700 mm)) ≥ 0.8.
 */
export function cortante1D({ Vu, b, d, h, fc, FR = 0.75, nombre = '' }) {
  const kT = h > 70 ? Math.max(0.8, 1 - 0.0004 * (h * 10 - 700)) : 1
  const VcR = (kT * FR * 0.5 * b * d * Math.sqrt(fc)) / 1000
  const ok = Vu <= VcR + 1e-9
  const pasos = [
    paso(`Cortante último${nombre ? ` ${nombre}` : ''}`, 'Vu', '', Vu, 't'),
    paso('Resistencia del concreto', `VcR = ${kT < 1 ? `${f2(kT)}·` : ''}0.5 FR b d √f′c`, `= ${kT < 1 ? `${f2(kT)} × ` : ''}0.5 × ${FR} × ${f1(b)} × ${f1(d)} × √${fc} / 1000`, VcR, 't', { ok, lim: `Vu = ${f2(Vu)} t` }),
  ]
  return { Vu, VcR, kT, ok, pasos }
}

// ── penetración ──────────────────────────────────────────────
/**
 * Cortante por penetración alrededor de una columna c1 × c2 (cm) con centro en
 * (xc, yc) (m, desde el centro de la base B × L). La sección crítica va a d/2
 * de las caras y pierde los lados que caen fuera de la base (columna de
 * lindero o de esquina). Con transferencia de momento:
 *   vu = Vu/(b0 d) + αx Mux cy/Jcx + αy Muy cx/Jcy
 *   vcR = FR (0.5 + γ) √f′c ≤ FR √f′c,  γ = lado corto / lado largo
 * `carga(rect)` da la reacción del suelo dentro de un rectángulo (t).
 */
export function penetracion({ Pu, Mux = 0, Muy = 0, c1, c2, xc = 0, yc = 0, B, L, d, fc, carga, FR = 0.75 }) {
  const D = d / 100, a = c1 / 100, b = c2 / 100
  const tol = 1e-6
  // rectángulo crítico (m) y recortado a la base
  let xa = xc - a / 2 - D / 2, xb = xc + a / 2 + D / 2
  let ya = yc - b / 2 - D / 2, yb = yc + b / 2 + D / 2
  const lados = { izq: xa > -B / 2 + tol, der: xb < B / 2 - tol, inf: ya > -L / 2 + tol, sup: yb < L / 2 - tol }
  xa = Math.max(xa, -B / 2); xb = Math.min(xb, B / 2); ya = Math.max(ya, -L / 2); yb = Math.min(yb, L / 2)
  const bx = (xb - xa) * 100, by = (yb - ya) * 100          // cm
  // lados que existen: [x1, y1, x2, y2] en cm
  const segs = []
  if (lados.izq) segs.push({ x: xa * 100, y0: ya * 100, y1: yb * 100, dir: 'y' })
  if (lados.der) segs.push({ x: xb * 100, y0: ya * 100, y1: yb * 100, dir: 'y' })
  if (lados.inf) segs.push({ y: ya * 100, x0: xa * 100, x1: xb * 100, dir: 'x' })
  if (lados.sup) segs.push({ y: yb * 100, x0: xa * 100, x1: xb * 100, dir: 'x' })
  const lon = (s) => (s.dir === 'y' ? s.y1 - s.y0 : s.x1 - s.x0)
  const b0 = segs.reduce((t, s) => t + lon(s), 0)
  const posicion = segs.length === 4 ? 'interior' : segs.length === 3 ? 'borde' : segs.length === 2 ? 'esquina' : 'sin perímetro'
  if (b0 <= 0) return { ok: false, b0: 0, posicion, pasos: [paso('Penetración', 'b0', 'la sección crítica cae fuera de la base', 'no se puede revisar', '', { ok: false })] }
  // centroide de la sección crítica
  const xm = (s) => (s.dir === 'y' ? s.x : (s.x0 + s.x1) / 2)
  const ym = (s) => (s.dir === 'x' ? s.y : (s.y0 + s.y1) / 2)
  const xg = segs.reduce((t, s) => t + lon(s) * xm(s), 0) / b0
  const yg = segs.reduce((t, s) => t + lon(s) * ym(s), 0) / b0
  // momentos polares (cm⁴): lados paralelos al giro con su inercia propia
  let Jy = 0, Jx = 0
  for (const s of segs) {
    const l = lon(s)
    if (s.dir === 'x') {
      Jy += (d * l ** 3) / 12 + (l * d ** 3) / 12 + l * d * (xm(s) - xg) ** 2
      Jx += l * d * (ym(s) - yg) ** 2
    } else {
      Jx += (d * l ** 3) / 12 + (l * d ** 3) / 12 + l * d * (ym(s) - yg) ** 2
      Jy += l * d * (xm(s) - xg) ** 2
    }
  }
  const cx = Math.max(...segs.map((s) => (s.dir === 'y' ? Math.abs(s.x - xg) : Math.max(Math.abs(s.x0 - xg), Math.abs(s.x1 - xg)))))
  const cy = Math.max(...segs.map((s) => (s.dir === 'x' ? Math.abs(s.y - yg) : Math.max(Math.abs(s.y0 - yg), Math.abs(s.y1 - yg)))))
  // reacción del suelo dentro de la sección crítica
  const dentro = carga({ x0: xa, x1: xb, y0: ya, y1: yb })
  const Vu = Math.max(0, Pu - dentro)
  // el cortante actúa en el centro de la columna: si el centroide está corrido
  // (lindero, esquina), su excentricidad suma momento a transferir
  const Muy2 = Math.abs(Muy) + Vu * Math.abs(xc * 100 - xg) / 100
  const Mux2 = Math.abs(Mux) + Vu * Math.abs(yc * 100 - yg) / 100
  const ay = 1 - 1 / (1 + 0.67 * Math.sqrt(bx / by))       // momento alrededor de y (varía en x)
  const ax = 1 - 1 / (1 + 0.67 * Math.sqrt(by / bx))
  const v1 = (Vu * 1000) / (b0 * d)
  const vy = Jy > 0 ? (ay * Muy2 * 1e5 * cx) / Jy : 0
  const vx = Jx > 0 ? (ax * Mux2 * 1e5 * cy) / Jx : 0
  const vu = v1 + vx + vy
  const gamma = Math.min(c1, c2) / Math.max(c1, c2)
  const vcR = Math.min(FR * (0.5 + gamma) * Math.sqrt(fc), FR * Math.sqrt(fc))
  const ok = vu <= vcR + 1e-9
  const hayM = Muy2 > 1e-6 || Mux2 > 1e-6
  const pasos = [
    paso('Sección crítica a d/2 de las caras', `${posicion}: ${segs.length} lados`, `(${f1(c1)} + d) × (${f1(c2)} + d) → ${f1(bx)} × ${f1(by)} cm`, b0, 'cm', { nota: 'perímetro b0' }),
    paso('Reacción del suelo dentro de la sección', 'qu · Ac', '', dentro, 't'),
    paso('Cortante por penetración', 'Vu = Pu − qu·Ac', `= ${f2(Pu)} − ${f2(dentro)}`, Vu, 't'),
    paso('Esfuerzo directo', 'Vu / (b0 d)', `= ${f2(Vu)}×1000 / (${f1(b0)} × ${f1(d)})`, v1, 'kg/cm²'),
  ]
  if (hayM) {
    pasos.push(paso('Fracción del momento por cortante', 'α = 1 − 1/(1 + 0.67√(b1/b2))', `αy = ${f3(ay)} · αx = ${f3(ax)}`, '', ''))
    if (Muy2 > 1e-6) pasos.push(paso('Por Muy', 'αy Muy cx / Jcy', `= ${f3(ay)} × ${f2(Muy2)}×10⁵ × ${f1(cx)} / ${f0(Jy)}`, vy, 'kg/cm²'))
    if (Mux2 > 1e-6) pasos.push(paso('Por Mux', 'αx Mux cy / Jcx', `= ${f3(ax)} × ${f2(Mux2)}×10⁵ × ${f1(cy)} / ${f0(Jx)}`, vx, 'kg/cm²'))
  }
  pasos.push(paso('Esfuerzo último', 'vu', hayM ? `= ${f2(v1)} + ${f2(vx + vy)}` : '', vu, 'kg/cm²'))
  pasos.push(paso('Resistencia', 'vcR = FR (0.5 + γ) √f′c ≤ FR √f′c', `γ = ${f2(gamma)} → ${FR} × ${f2(Math.min(0.5 + gamma, 1))} × √${fc}`, vcR, 'kg/cm²', { ok, lim: `vu = ${f2(vu)}` }))
  return { Vu, vu, vcR, b0, bx, by, posicion, ok, u: vu / vcR, rect: { xa, xb, ya, yb }, lados, pasos }
}

// ── aplastamiento ────────────────────────────────────────────
export function aplastamiento({ Pu, c1, c2, fc, fy = 4200, A2A1 = 4, FR = 0.65 }) {
  const A1 = c1 * c2
  const k = Math.min(Math.sqrt(A2A1), 2)
  const PRc = (FR * 0.85 * fc * A1 * k) / 1000
  // lo que el concreto no alcanza lo pasan varillas que cruzan la junta
  // (las de la columna prolongadas o bastones de arranque), con 0.5 % de A1
  // como mínimo siempre y 4 % como máximo razonable
  const AsMin = 0.005 * A1, AsMax = 0.04 * A1
  const AsT = Pu > PRc ? ((Pu - PRc) * 1000) / (FR * fy) : 0
  const AsDow = Math.max(AsT, AsMin)
  const conBastones = AsT > 0
  const PR = conBastones ? PRc + (FR * fy * Math.min(AsT, AsMax)) / 1000 : PRc
  const ok = Pu <= PR + 1e-9
  return {
    Pu, PR, PRc, ok, AsT, AsDow, AsMax, conBastones,
    pasos: [
      paso('Aplastamiento del concreto bajo la columna', 'PR = FR 0.85 f′c A1 √(A2/A1), √(A2/A1) ≤ 2', `= ${FR} × 0.85 × ${fc} × ${f0(A1)} × ${f2(k)} / 1000`, PRc, 't', conBastones ? { nota: `Pu = ${f2(Pu)} t lo excede` } : { ok: true, lim: `≥ Pu = ${f2(Pu)} t` }),
      ...(conBastones ? [paso('Acero que transfiere el excedente', 'As = (Pu − PR) / (FR fy)', `= (${f2(Pu)} − ${f2(PRc)}) × 1000 / (${FR} × ${fy})`, AsT, 'cm²', { ok, lim: `≤ 4 % A1 = ${f2(AsMax)} cm²`, nota: ok ? 'varillas de la columna ancladas en la zapata' : 'no cabe: agranda la columna o sube f′c' })] : []),
      paso('Varillas de arranque mínimas', 'As ≥ 0.005 A1', `= 0.005 × ${f0(A1)}`, AsMin, 'cm²', { nota: 'cruzan la junta columna–zapata' }),
    ],
  }
}

// ── anclaje ──────────────────────────────────────────────────
/**
 * ¿Le alcanza a una varilla el largo disponible (de la sección crítica al
 * extremo, menos el recubrimiento) para desarrollarse? Si no, con gancho
 * estándar de 90°: Ldh = 0.076 db fy/√f′c ≥ 8 db, 15 cm.
 */
export function anclaje({ num: n, s, disponible, fc, fy, r, AsReq = null, AsProv = null }) {
  const v = varilla(n)
  const c = Math.min(r + v.diam / 2, s / 2)
  const L = developmentLength({ area: v.area, db: v.diam, fy, fc, c })
  // la varilla trabaja al esfuerzo que pide la flexión, no a fy: el largo se
  // reduce en la proporción As,req / As,prov (con sus mínimos)
  const k = AsReq != null && AsProv > 0 ? Math.min(1, Math.max(0, AsReq / AsProv)) : 1
  const Ld = Math.max(L.Ld * k, 30)
  const Ldh = Math.max((0.076 * v.diam * fy) / Math.sqrt(fc) * k, 8 * v.diam, 15)
  const recto = disponible >= Ld - 1e-6
  const gancho = !recto && disponible >= Ldh - 1e-6
  const ok = recto || gancho
  return {
    Ld, Ldh, k, disponible, recto, gancho, ok,
    pasos: [
      paso(`Longitud de desarrollo #${n}`, 'Ld = as fy / (3 (c + Ktr) √f′c)', `= ${f2(v.area)} × ${fy} / (3 × ${f2(L.cEff)} × √${fc})`, L.Ld, 'cm'),
      ...(k < 1 ? [paso('Por el esfuerzo real', 'Ld · As,req/As,prov ≥ 30 · Ldh ≥ 8db, 15', `× ${f2(k)} → Ld = ${f1(Ld)} · Ldh = ${f1(Ldh)}`, '', 'cm')] : []),
      paso('Largo disponible', 'del paño al extremo − r', '', disponible, 'cm', {
        ok, lim: recto ? `≥ Ld: recta` : gancho ? `≥ Ldh = ${f1(Ldh)} cm: con gancho a 90°` : `< Ldh = ${f1(Ldh)} cm`,
      }),
    ],
  }
}

/** Capa de abajo y de arriba de una parrilla en dos direcciones */
export function peraltes(h, r, numAbajo, numArriba) {
  const va = varilla(numAbajo), vb = varilla(numArriba)
  return { dAbajo: h - r - va.diam / 2, dArriba: h - r - va.diam - vb.diam / 2 }
}
