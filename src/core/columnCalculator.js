// ══════════════════════════════════════════════════════════════
// Column Calculator — Diseño por flexocompresión
// Réplica exacta de la hoja "Columnas" de DISEN_O_DE_CONCRETO_v2.xlsx
// (fórmulas celda a celda), generalizada a N lechos y barrido fino
// del eje neutro para un diagrama de interacción continuo.
// ══════════════════════════════════════════════════════════════

import {
  curvaDeDiseno, puntoDeDiseno, frCompresion, opcionesFR, superficieDeDiseno, revisarFlexocompresionNTC,
} from './columnasNTC'

// ── Tabla BD (hoja "BD" del Excel — diámetro cm / área cm²) ──
// Nota: difiere ligeramente de VARILLAS del módulo de vigas en #9/#10
// (6.41 vs 6.45, 7.92 vs 8.19); se conservan los valores del Excel.
export const BD_VARILLAS = [
  { num: 2,   diam: 0.64, area: 0.32 },
  { num: 2.5, diam: 0.79, area: 0.49 },
  { num: 3,   diam: 0.95, area: 0.71 },
  { num: 4,   diam: 1.27, area: 1.27 },
  { num: 5,   diam: 1.59, area: 1.98 },
  { num: 6,   diam: 1.90, area: 2.85 },
  { num: 7,   diam: 2.22, area: 3.88 },
  { num: 8,   diam: 2.54, area: 5.07 },
  { num: 9,   diam: 2.86, area: 6.41 },
  { num: 10,  diam: 3.18, area: 7.92 },
  { num: 11,  diam: 3.49, area: 9.58 },
  { num: 12,  diam: 3.81, area: 11.40 },
]
export const bdLookup = (num) => BD_VARILLAS.find((v) => +v.num === +num) || BD_VARILLAS[2]

// ── β1 · Excel D18: =IF(f'c>280, 1.05−f'c/1400, 0.85) ─────────
export function beta1Col(fc) {
  return fc > 280 ? 1.05 - fc / 1400 : 0.85
}

// ── Posiciones de lechos · Excel F25/F26…: dp_i = ((h−2r)/(Le−1))·(i−1)+r
export function lechoDepths(h, r, nLechos) {
  if (nLechos <= 1) return [h / 2]
  const step = (h - 2 * r) / (nLechos - 1)
  return Array.from({ length: nLechos }, (_, i) => r + step * i)
}

/**
 * Normaliza los parámetros de una dirección de análisis.
 * lechos: [{ n, num }] del lecho 1 (cara de compresión) al último.
 */
function prepare({ h, b, r, fc, fy = 4200, E = 2e6, epsC = 0.003, lechos }) {
  const b1 = beta1Col(fc)
  const d = h - r
  // εs de fluencia · Excel D56 = 0.0021 (= 4200/2e6). Generalizado: fy/E.
  const epsY = fy / E
  const dps = lechoDepths(h, r, lechos.length)
  const capas = lechos.map((L, i) => ({
    n: +L.n || 0,
    num: L.num,
    // Excel E25 = LOOKUP(ϕ)·n; en la dirección Y, el área exacta del grupo
    // (puede mezclar calibres de lechos distintos)
    area: L.area !== undefined ? +L.area : bdLookup(L.num).area * (+L.n || 0),
    dp: L.dp !== undefined ? L.dp : dps[i],   // dp explícito (dirección Y) o distribuido
  }))
  const Ast = capas.reduce((s, c) => s + c.area, 0)
  return { h, b, r, fc, fy, E, epsC, epsY, b1, d, capas, Ast }
}

// ── POC · Excel D35: ((0.85·((h·b)−Ast)·f'c)+(Ast·fy))/1000 [ton]
export function calcPOC(P) {
  return ((0.85 * (P.h * P.b - P.Ast) * P.fc) + P.Ast * P.fy) / 1000
}

/**
 * Punto (P, M) para una profundidad de eje neutro c.
 * Réplica de las tablas "Fuerzas resistentes por lecho" del Excel:
 *   ε_i = εc·(c−dp_i)/c                        [C44]
 *   f_i = |ε_i|>εy ? fy·sign(ε_i) : E·ε_i      [D44]
 *   F_i = f_i·As_i/1000                        [E44]  (+ = compresión)
 *   Z_i = h/2 − dp_i                           [F44]
 *   M_i = F_i·Z_i·0.01                         [G44]
 *   CC  = 0.85·f'c·β1·c·b/1000                 [E49]
 *   Zcc = h/2 − β1·c/2                         [F49]
 *   P = ΣF + CC · M = ΣM + CC·Zcc·0.01         [D51/D52]
 */
export function pointForC(c, P) {
  const capas = P.capas.map((L) => {
    const eps = (P.epsC * (c - L.dp)) / c
    const f = Math.abs(eps) > P.epsY ? P.fy * Math.sign(eps) : P.E * eps
    const F = (f * L.area) / 1000
    const Z = P.h / 2 - L.dp
    const M = F * Z * 0.01
    return { ...L, eps, f, F, Z, M }
  })
  const CC = (0.85 * P.fc * P.b1 * c * P.b) / 1000
  const Zcc = P.h / 2 - (c * P.b1) / 2
  const Mcc = CC * Zcc * 0.01
  const Pt = capas.reduce((s, L) => s + L.F, 0) + CC
  const Mt = capas.reduce((s, L) => s + L.M, 0) + Mcc
  return { c, capas, CC, Zcc, Mcc, P: Pt, M: Mt }
}

/**
 * Análisis completo de una dirección (el "Excel" completo):
 * puntos canónicos + barrido fino para la curva.
 */
export function analyzeDirection(input, opts = {}) {
  const P = prepare(input)
  const { nSweep = 80 } = opts

  const POC = calcPOC(P)
  // cD · Excel D58: (d·εc)/(εs+εc)
  const cD = (P.d * P.epsC) / (P.epsY + P.epsC)
  // c del punto M0 · Excel D109: h/10
  const cM0 = P.h / 10
  // c del punto 1 · Excel D39: (h−cD)/2 + cD
  const c1 = (P.h - cD) / 2 + cD
  // c puntos 2 y 3 · Excel D75/D92: tercios entre cM0 y cD
  const c2 = ((cD - cM0) / 3) * 2 + cM0
  const c3 = ((cD - cM0) / 3) * 1 + cM0

  const canonical = [
    { key: 'POC', label: 'POC', c: null, P: POC, M: 0, detail: null },
    { key: 'P1', label: 'Punto 1', ...ptWrap(pointForC(c1, P)) },
    { key: 'D', label: 'D (balanceada)', ...ptWrap(pointForC(cD, P)) },
    { key: 'P2', label: 'Punto 2', ...ptWrap(pointForC(c2, P)) },
    { key: 'P3', label: 'Punto 3', ...ptWrap(pointForC(c3, P)) },
    { key: 'M0', label: 'M0', ...ptWrap(pointForC(cM0, P)) },
  ]

  // ── Barrido fino: de c pequeño (h/20) a c_max = h/β1 (a = h) ──
  // El bloque a = β1·c no puede exceder h; más allá la curva se une a POC.
  const cMax = P.h / P.b1
  const cMin = P.h / 20
  const curve = []
  for (let i = 0; i <= nSweep; i++) {
    const c = cMin + ((cMax - cMin) * i) / nSweep
    const pt = pointForC(c, P)
    curve.push({ c, P: pt.P, M: pt.M })
  }
  // Empalme final hacia compresión pura
  curve.push({ c: null, P: POC, M: 0 })

  // ── Diagrama de DISEÑO (NTC-Concreto 2023, 3.8.1.1 y 3.8.2.2) ──
  // FR por punto según εt del lecho extremo a tensión (dt); P = FR·Pn, M = FR·Mn.
  const fr = opts.fr || {}
  const FRc = frCompresion(fr)
  const conAcero = P.capas.filter((L) => L.area > 0)
  const dt = Math.max(...(conAcero.length ? conAcero : P.capas).map((L) => L.dp))
  const epsTy = P.epsY // 3.8.2.4: εty = fy/Es
  const cb = (P.epsC * dt) / (P.epsC + epsTy)
  const SD = {
    epsC: P.epsC, epsTy, dt, FRc, fr,
    asimetrico: !!opts.asimetrico,
    PbR: FRc * pointForC(cb, P).P,
    P01: (0.1 * P.fc * P.h * P.b) / 1000,
  }
  const curveDiseno = curvaDeDiseno(curve, SD)
  for (const k of canonical) {
    const d = puntoDeDiseno(k.c, k.P, SD)
    k.diseno = { ...d, P: d.FR * k.P, M: d.FR * k.M }
  }

  return { params: P, POC, cD, cM0, c1, c2, c3, canonical, curve, curveDiseno, diseno: { ...SD, PR0: FRc * POC, cb } }
}

function ptWrap(pt) {
  return { c: pt.c, P: pt.P, M: pt.M, detail: pt }
}

/**
 * Retícula de barras (para dibujo y para la dirección Y).
 * Cada lecho reparte sus n barras uniformemente a lo ancho, con las
 * extremas a r de cada cara (n=1 → centrada).
 * Devuelve [{x, y, num, area, diam}] con y = dp del lecho (desde cara sup.)
 */
export function barGrid({ h, b, r, lechos }) {
  const dps = lechoDepths(h, r, lechos.length)
  const bars = []
  lechos.forEach((L, i) => {
    const n = +L.n || 0
    if (n <= 0) return
    const v = bdLookup(L.num)
    for (let j = 0; j < n; j++) {
      const x = n === 1 ? b / 2 : r + ((b - 2 * r) * j) / (n - 1)
      bars.push({ x, y: dps[i], num: +L.num, area: v.area, diam: v.diam })
    }
  })
  return bars
}

/**
 * Lechos equivalentes para la dirección Y (flexión alrededor del otro eje):
 * las barras se agrupan por su coordenada x → capas con dp = x, peralte = b.
 */
export function lechosY(input) {
  const bars = barGrid(input)
  const groups = new Map()
  for (const bar of bars) {
    const key = bar.x.toFixed(4)
    if (!groups.has(key)) groups.set(key, { dp: bar.x, area: 0, bars: [] })
    const g = groups.get(key)
    g.area += bar.area
    g.bars.push(bar)
  }
  return [...groups.values()].sort((a, b2) => a.dp - b2.dp)
    .map((g) => ({
      n: g.bars.length,
      num: g.bars[0].num, // representativo (puede haber mezcla)
      dp: g.dp,
      areaOverride: g.area,
    }))
}

/**
 * ¿El acero es simétrico respecto al eje de flexión X? (lecho i ↔ lecho N+1−i
 * con la misma área). En Y la retícula siempre es simétrica: cada lecho
 * reparte sus barras de r a b−r. Sirve para 3.8.2.3.
 */
export function aceroAsimetrico(lechos) {
  const a = (lechos || []).map((L) => bdLookup(L.num).area * (+L.n || 0))
  return a.some((v, i) => Math.abs(v - a[a.length - 1 - i]) > 1e-9)
}

/**
 * Análisis biaxial completo de la columna.
 *  - X: flexión que trabaja el peralte h (la hoja de Excel tal cual)
 *  - Y: sección girada 90° (h↔b) con capas agrupadas por x
 *  - superficie: diagrama de diseño con eje neutro inclinado (NTC 5.4.1.1)
 * Cada dirección trae su curva nominal (`curve`, la del Excel) y la de
 * diseño (`curveDiseno`, con FR de la tabla 3.8.2.2).
 * opts.fr = { zunchos, transicionComoCompresion } (por omisión, los de la columna)
 */
export function analyzeColumn(col, opts = {}) {
  const base = {
    h: +col.h, b: +col.b, r: +col.r, fc: +col.fc,
    fy: +col.fy || 4200, E: +col.E || 2e6, epsC: +col.epsC || 0.003,
  }
  const lechos = (col.lechos || []).map((L) => ({ n: +L.n || 0, num: L.num }))
  const fr = { ...opcionesFR(col), ...(opts.fr || {}) }
  const asimetrico = aceroAsimetrico(lechos)
  const o = { ...opts, fr, asimetrico }

  const dirX = analyzeDirection({ ...base, lechos }, o)

  // Dirección Y: swap h↔b, capas desde la retícula real, con el área exacta
  // de cada grupo (antes se tomaba el calibre representativo del grupo).
  const capasY = lechosY({ h: base.h, b: base.b, r: base.r, lechos })
    .map((L) => ({ n: L.n, num: L.num, dp: L.dp, area: L.areaOverride }))
  const dirY = analyzeDirection(
    { ...base, h: base.b, b: base.h, lechos: capasY },
    o,
  )

  // Superficie de diseño (eje neutro inclinado), con las barras reales
  const bars = barGrid({ h: base.h, b: base.b, r: base.r, lechos })
    .map((br) => ({ u: br.x - base.b / 2, v: base.h / 2 - br.y, area: br.area }))
  const P = dirX.params
  const superficie = superficieDeDiseno({
    b: base.b, h: base.h, fc: base.fc, fy: base.fy, E: base.E, epsC: base.epsC,
    epsY: P.epsY, epsTy: P.epsY, b1: P.b1, bars, P0: dirX.POC, Ag: base.b * base.h,
    asimetrico, fr,
  }, opts.superficie)

  const res = {
    dirX, dirY, superficie,
    ntc: { fr, asimetrico, epsTy: P.epsY, FRc: superficie.FRc, P0: dirX.POC, PR0: superficie.PR0 },
  }
  // Para que checkBiaxial(dirX, dirY, …) llegue a la superficie sin cambiar
  // de firma. No enumerable: no entra a JSON ni crea ciclos al serializar.
  Object.defineProperty(dirX, 'columna', { value: res, enumerable: false })
  Object.defineProperty(dirY, 'columna', { value: res, enumerable: false })
  return res
}

// ── Excentricidad y modo de revisión · Excel D8/B10 ───────────
export function excentricidad(Mu, Pu, b, h) {
  const e = Pu > 0 ? Mu / Pu : Infinity
  const eLim = 0.1 * (Math.min(b, h) / 100)
  return {
    e, eLim,
    modo: e < eLim ? 'Realizar revisión por compresión' : 'Realizar revisión por flexocompresión',
  }
}

/**
 * ¿El punto de demanda (Mu, Pu) queda dentro del diagrama?
 * Para el nivel Pu se interpola el M máximo de la frontera.
 */
export function checkPoint(curve, Pu, Mu) {
  // Curva ordenada por P ascendente (M0 tension → POC)
  const pts = [...curve].sort((a, b) => a.P - b.P)
  const Pmin = pts[0].P, Pmax = pts[pts.length - 1].P
  if (Pu < Pmin || Pu > Pmax) return { ok: false, MR: 0, ratio: Infinity, Pmin, Pmax }
  let MR = 0
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i], b = pts[i + 1]
    if (Pu >= a.P && Pu <= b.P) {
      const t = b.P === a.P ? 0 : (Pu - a.P) / (b.P - a.P)
      MR = Math.max(MR, a.M + t * (b.M - a.M))
    }
  }
  const ratio = MR > 0 ? Mu / MR : (Mu > 0 ? Infinity : 0)
  return { ok: Mu <= MR, MR, ratio, Pmin, Pmax }
}

/**
 * Revisión de flexocompresión de la columna según la NTC-Concreto 2023, con
 * los diagramas de DISEÑO (FR de 3.8.2.2) y la excentricidad mínima de 5.3.2:
 *   a) método general (5.4.1.1, hipótesis de 3.6, eje neutro inclinado):
 *      D/C = √(Mux² + Muy²) / MR(θ) al nivel Pu;
 *   b) método aproximado 5.4.1.2: Bresler (ec. 5.4.1.2.a) o, si
 *      PR/PR0 < 0.1, Mux/MRx + Muy/MRy (ec. 5.4.1.2.b).
 * Desde la 3.08 el D/C de la columna es el del método general (`dc`); 5.4.1.2
 * se queda como referencia (`aproximado.referencia`). Criterio de FB, 2026-11-11:
 * «ok, vamos a manejar el método general en la aplicación».
 * El contorno elíptico α = 2 de antes ya no se usa (pedido de FB, 2026-11-11).
 */
export function revisarColumnaNTC(an, Pu, Mux, Muy) {
  return revisarFlexocompresionNTC(datosNTC(an), Pu, Mux, Muy)
}

/** Lo que piden las funciones de columnasNTC.js (curvas de diseño y superficie) */
export function datosNTC(an) {
  return {
    curvaX: an.dirX.curveDiseno, curvaY: an.dirY.curveDiseno, superficie: an.superficie,
    h: an.dirX.params.h, b: an.dirX.params.b,
  }
}

/**
 * La misma revisión con la firma de siempre (dirX, dirY). Devuelve además
 * `checkX` y `checkY` (uniaxiales con los diagramas de diseño).
 */
export function checkBiaxial(anX, anY, Pu, Mux, Muy) {
  const an = anX?.columna || anY?.columna
  if (!an) throw new Error('checkBiaxial: la dirección no viene de analyzeColumn')
  return revisarColumnaNTC(an, Pu, Mux, Muy)
}

// ── Estribos · Excel D163–D167 (fórmulas exactas de la hoja) ───
// s1 = LOOKUP(ϕest → área BD)·16 · s2 = LOOKUP(ϕ lecho 1 → área BD)·48
// s3 = min(h, b) · s = ROUNDDOWN(min(s1,s2,s3))
export function calcEstribos({ estriboNum, longNum, h, b }) {
  const s1 = bdLookup(estriboNum).area * 16
  const s2 = bdLookup(longNum).area * 48
  const s3 = Math.min(+h, +b)
  const s = Math.floor(Math.min(s1, s2, s3))
  return { s1, s2, s3, s }
}

/**
 * Estribos de columna por zonas: extremos (arriba y abajo de cada unión) y
 * centro, como en las trabes.
 *
 *  · Columna (lado menor ≥ 20 cm) — NTC-Concreto, marcos no dúctiles:
 *      centro   s ≤ 850/√fy · db de la barra longitudinal más delgada,
 *               48 · db del estribo, y la mitad del lado menor;
 *      extremos la mitad, en una longitud no menor que el lado mayor,
 *               H/6 y 60 cm.
 *  · Castillo (lado menor < 20 cm) — NTC-Mampostería: centro s ≤ 1.5·t y
 *      20 cm. En los extremos se toma también la mitad: es criterio, no
 *      requisito de esa norma.
 *
 * La fórmula de la hoja (calcEstribos) no se toca: los proyectos que ya
 * existen conservan su separación única (ver estribosDe).
 * @param H  altura de la columna, m (del modelo); sin ella no entra H/6
 */
export function estribosColumna({ b, h, estriboNum, lechos, fy = 4200, H = null }) {
  b = +b; h = +h
  const t = Math.min(b, h)
  const castillo = t < 20
  let sMax, reglas
  if (castillo) {
    sMax = Math.min(1.5 * t, 20)
    reglas = [`1.5·t = ${(1.5 * t).toFixed(1)}`, '20 cm']
  } else {
    const nums = (lechos || []).filter((L) => +L.n > 0).map((L) => L.num)
    const dbL = Math.min(...(nums.length ? nums : [3]).map((n) => bdLookup(n).diam))
    const s1 = (850 / Math.sqrt(fy)) * dbL
    const s2 = 48 * bdLookup(estriboNum).diam
    const s3 = t / 2
    sMax = Math.min(s1, s2, s3)
    reglas = [`850/√fy·db = ${s1.toFixed(1)}`, `48·dbe = ${s2.toFixed(1)}`, `t/2 = ${s3.toFixed(1)}`]
  }
  const sCen = Math.floor(sMax)
  const sExt = Math.floor(sMax / 2)
  // longitud de la zona de extremo, a múltiplos de 5 cm hacia arriba
  const lExt = Math.ceil(Math.max(b, h, H ? (H * 100) / 6 : 0, 60) / 5) * 5
  return { sCen, sExt, lExt, castillo, reglas, conH: !!H }
}

/**
 * Cómo van los estribos de UNA columna: por zonas si las tiene capturadas
 * (sepExt / sepCen) y, si no, la separación única de siempre. Así un proyecto
 * viejo no cambia de estribos al abrirlo.
 */
export function estribosDe(col) {
  const legado = calcEstribos({ estriboNum: col.estriboNum, longNum: col.lechos?.[0]?.num || 3, h: +col.h, b: +col.b })
  const sExt = +col.sepExt || 0, sCen = +col.sepCen || 0
  const e = `E#${col.estriboNum}`
  if (!(sExt > 0 && sCen > 0)) {
    return { zonas: false, s: legado.s, legado, texto: `${e} @ ${legado.s} cm`, corto: `${e} @${legado.s}` }
  }
  const lExt = +col.longExt || null
  return {
    zonas: true, sExt, sCen, lExt, legado,
    texto: `${e} @ ${sExt} cm en extremos${lExt ? ` (${lExt} cm)` : ''} · @ ${sCen} cm al centro`,
    corto: `${e} @${sExt}/${sCen}`,
  }
}
