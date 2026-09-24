// ══════════════════════════════════════════════════════════════
// Detallado de cada cimiento: planta, cortes, alzado y diagramas
//
// Una sola función por tipo, que sirve para la pantalla (con manijas y
// zonas de clic), el DXF (a escala real), el PDF y el Word. Dibuja lo que
// la revisión calculó: número real de varillas, ganchos donde el anclaje los
// pide, bastones con su largo, área efectiva y sección crítica.
// Manijas: `campo` es la ruta del dato ('geo.B'); `factor` pasa el
// desplazamiento del ratón (cm del modelo) a las unidades del dato; `paso` es
// el redondeo en esas unidades.
// ══════════════════════════════════════════════════════════════

import { lienzo, COL } from './lienzo'
import { varilla, txtArm, num, f2 } from './comun'
import { txtVarillasCT } from './ct'

const cm = (m) => m * 100
const f0 = (v) => Math.round(v).toString()
const FONDO = '#f7f3ee'
const COL2 = '#0e7490'            // segunda dirección de la parrilla

/** k para que un dibujo de ancho natural `anchoCm` quepa en `px` */
export const escalaPara = (anchoCm, px, { min = 0.9, max = 6 } = {}) => Math.max(min, Math.min(max, px / Math.max(anchoCm, 1)))

/** posiciones de n varillas repartidas entre a y b */
const reparto = (a, b, nn) => (nn <= 1 ? [(a + b) / 2] : Array.from({ length: nn }, (_, i) => a + ((b - a) * i) / (nn - 1)))

/**
 * Corte de una contratrabe de liga (la CT de una zapata o una TL), como el
 * detalle de la oficina: estribo con su gancho, varillas en las esquinas y
 * los recubrimientos (3 arriba y a los lados, 5 abajo, contra el suelo).
 * Origen: centro de la cara de abajo.
 */
function corteLiga(S, { b, h, r, rInf, sup, inf, est }, { ids = null, k = 3, cotas = true } = {}) {
  const vs = varilla(sup.num), vi = varilla(inf.num), ve = varilla(est.num)
  S.rect(-b / 2, 0, b, h, { c: COL.concreto, w: 1.6, fill: FONDO })
  const x0 = -b / 2 + r, x1 = b / 2 - r, y0 = rInf, y1 = h - r
  S.rect(x0, y0, x1 - x0, y1 - y0, { c: COL.estribo, w: 1.1 })
  // gancho a 135° en la esquina de arriba a la izquierda
  const g = Math.max(6 * ve.diam, 3)
  S.line(x0 + ve.diam, y1 - ve.diam, x0 + ve.diam + g * 0.7, y1 - ve.diam - g * 0.7, { c: COL.estribo, w: 1.1 })
  S.line(x0 + 2 * ve.diam, y1, x0 + 2 * ve.diam + g * 0.7, y1 - g * 0.7, { c: COL.estribo, w: 1.1 })
  const yS = h - r - ve.diam - vs.diam / 2, yI = rInf + ve.diam + vi.diam / 2
  const rad = (v) => Math.max(2, (v.diam / 2) * k)
  for (const x of reparto(x0 + ve.diam + vs.diam / 2, x1 - ve.diam - vs.diam / 2, sup.n)) S.dot(x, yS, rad(vs), COL.arriba)
  for (const x of reparto(x0 + ve.diam + vi.diam / 2, x1 - ve.diam - vi.diam / 2, inf.n)) S.dot(x, yI, rad(vi), COL.abajo)
  if (cotas) {
    S.dimH(-b / 2, b / 2, 0, 22, `${f0(b)}`)
    S.dimV(0, h, -b / 2, -18, `${f0(h)}`)
    S.dimV(y1, h, b / 2, 16, `${f0(r)}`)
    S.dimV(0, y0, b / 2, 16, `${f0(rInf)}`)
  }
  if (ids) {
    S.etiqueta(ids.sup, b / 2, yS, `${sup.n}#${sup.num} arriba`, { c: COL.arriba, anchor: 'start', dx: 40, dy: 4, titulo: 'Varillas de arriba' })
    S.etiqueta(ids.inf, b / 2, yI, `${inf.n}#${inf.num} abajo`, { c: COL.abajo, anchor: 'start', dx: 40, dy: 4, titulo: 'Varillas de abajo' })
    S.etiqueta(ids.est, b / 2, h / 2, `E#${est.num} @ ${est.s}`, { c: COL.estribo, anchor: 'start', dx: 40, dy: 4, titulo: 'Estribos' })
  }
  return { yS, yI }
}

/**
 * El detalle de la CT de una zapata en su propio lienzo, a la derecha del
 * dibujo (en pantalla, más grande; en el DXF, a la escala de todo).
 */
function detalleCT(ct, x, top, { k, exportar }) {
  const kd = exportar ? k : Math.max(k, Math.min(4, 150 / Math.max(ct.h, 1)))
  const S = lienzo(kd)
  const cx = x + 40 + (ct.b / 2) * kd, cy = top + 52 + ct.h * kd
  S.vista(cx, cy)
  S.titulo(x, top + 14, `CONTRATRABE ${ct.nombre}`, `${f0(ct.b)} × ${f0(ct.h)} cm · ${txtVarillasCT(ct)} · E#${ct.est.num} @ ${ct.est.s} · recubrimiento ${f0(ct.r)} arriba y a los lados, ${f0(ct.rInf)} abajo`)
  corteLiga(S, ct, { ids: { sup: 'ct-sup', inf: 'ct-inf', est: 'ct-est' }, k: kd })
  S.text(0, 0, 'lecho alto al nivel del terreno', { dy: 40, size: 9.5, c: COL.tenue })
  S.manija('ct-h', 0, ct.h, { eje: 'y', campo: 'ct.h', factor: 1, pasoCm: 5, min: 30, max: 150, titulo: 'h de la CT' })
  S.manija('ct-b', ct.b / 2, ct.h * 0.55, { eje: 'x', campo: 'ct.b', factor: 2, pasoCm: 5, min: 15, max: 60, titulo: 'b de la CT' })
  return { S, W: cx + (ct.b / 2) * kd + 190, H: cy + 56 }
}

/** Junta el dibujo con el detalle de su CT (si lleva) */
function conDetalleCT(d, ct, op) {
  if (!ct) return d
  // debajo del dibujo, a la izquierda: a lo ancho ya no cabe
  const det = detalleCT(ct, 30, d.H - 10, { k: d.k, exportar: op.exportar })
  const r2 = det.S.resultado(Math.max(d.W, det.W), Math.max(d.H, det.H))
  const W = Math.max(d.W, det.W), H = Math.max(d.H, det.H)
  const inner = d.inner + r2.inner
  return {
    ...d, inner, W, H,
    handles: [...d.handles, ...r2.handles], hits: [...d.hits, ...r2.hits],
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" font-family="DM Mono, monospace">${inner}</svg>`,
  }
}

// ── Zapata aislada ───────────────────────────────────────────
function aislada(z, R, op = {}) {
  const { ancho = 900, k: kFijo } = op
  const D = R.datos
  const B = cm(D.B), Lc = cm(D.L), h = D.h, c1 = D.c1, c2 = D.c2, xc = cm(D.xc), yc = cm(D.yc)
  const r = num(z.mat?.r, 5)
  const arm = D.arm
  const vx = varilla(arm.x.num), vy = varilla(arm.y.num)
  const DfCm = cm(R.datosSuelo?.Df ?? 1)
  const Ht = Math.max(DfCm, h) + 45
  // ancho natural: planta + corte + márgenes
  const k = kFijo ?? escalaPara(B * 2 + 60, ancho - 260, { max: 4 })
  const L = lienzo(k)
  const M = 70, top = 58
  const plX = M + (B / 2) * k, plY = top + (Lc / 2) * k + 10
  const W1 = M + B * k + 90
  const secX = W1 + 40 + (B / 2 + 30) * k, secBase = top + Ht * k + 10
  const W = secX + (B / 2 + 30) * k + 70
  const H = Math.max(plY + (Lc / 2) * k + 110, secBase + 150)

  // ── planta ──
  L.titulo(M - 40, 22, 'PLANTA', `${f2(D.B)} × ${f2(D.L)} m · columna ${f0(c1)} × ${f0(c2)} cm`)
  L.vista(plX, plY)
  L.rect(-B / 2, -Lc / 2, B, Lc, { c: COL.concreto, w: 1.6, fill: FONDO })
  // área efectiva y sección crítica
  const reg = D.region
  if (reg && (reg.x1 - reg.x0 < D.B - 1e-6 || reg.y1 - reg.y0 < D.L - 1e-6)) {
    L.rect(cm(reg.x0), cm(reg.y0), cm(reg.x1 - reg.x0), cm(reg.y1 - reg.y0), { c: COL.presion, w: 1, dash: '6 4', fill: 'rgba(232,131,10,0.06)' })
    L.text(cm(reg.x1) - 4, cm(reg.y1) - 4, 'A′', { anchor: 'end', size: 10, c: COL.presion, dy: 10 })
  }
  // varillas en x (repartidas en L) y en y (repartidas en B)
  const ysX = reparto(-Lc / 2 + r + vx.diam / 2, Lc / 2 - r - vx.diam / 2, D.nX)
  const xsY = reparto(-B / 2 + r + vy.diam / 2, B / 2 - r - vy.diam / 2, D.nY)
  for (const y of ysX) L.line(-B / 2 + r, y, B / 2 - r, y, { c: COL.abajo, w: 1 })
  for (const x of xsY) L.line(x, -Lc / 2 + r, x, Lc / 2 - r, { c: COL2, w: 1 })
  if (D.pen) L.rect(cm(D.pen.xa), cm(D.pen.ya), cm(D.pen.xb - D.pen.xa), cm(D.pen.yb - D.pen.ya), { c: COL.critica, w: 1, dash: '3 3' })
  L.rect(xc - c1 / 2, yc - c2 / 2, c1, c2, { c: COL.concreto, w: 1.6, fill: '#ecdde3' })
  L.line(xc - c1 / 2, yc - c2 / 2, xc + c1 / 2, yc + c2 / 2, { c: COL.concreto, w: 0.6 })
  L.line(xc - c1 / 2, yc + c2 / 2, xc + c1 / 2, yc - c2 / 2, { c: COL.concreto, w: 0.6 })
  // corte A-A
  L.line(-B / 2 - 20 / k, yc, B / 2 + 20 / k, yc, { c: COL.tenue, w: 0.8, dash: '10 3 2 3' })
  L.text(-B / 2, yc, 'A', { anchor: 'end', dx: -22, dy: 4, weight: 700, size: 12 })
  L.text(B / 2, yc, 'A', { anchor: 'start', dx: 22, dy: 4, weight: 700, size: 12 })
  // cotas
  L.dimH(-B / 2, B / 2, -Lc / 2, 26, `B = ${f2(D.B)}`)
  L.dimV(-Lc / 2, Lc / 2, -B / 2, -40, `L = ${f2(D.L)}`)
  if (Math.abs(xc) > 0.5) L.dimH(-B / 2, xc, Lc / 2, -16, `${f2((xc + B / 2) / 100)}`)
  if (Math.abs(yc) > 0.5) L.dimV(-Lc / 2, yc, B / 2, 16, `${f2((yc + Lc / 2) / 100)}`)
  // etiquetas de varilla (clic para cambiar)
  L.etiqueta('x', 0, -Lc / 2, `${txtArm(arm.x)}${D.ganchoX ? ' c/gancho' : ''}`, { c: COL.abajo, dy: 62, titulo: 'Varillas en x (a lo largo de B)' })
  L.etiqueta('y', B / 2, Lc / 2, `${txtArm(arm.y)}${D.ganchoY ? ' c/gancho' : ''}`, { c: COL2, anchor: 'start', dx: 14, dy: 18, titulo: 'Varillas en y (a lo largo de L)' })
  // manijas
  const g = z.geo
  const fB = g.px === 'centro' || g.px === 'libre' ? 2 : 1
  const fL = g.py === 'centro' || g.py === 'libre' ? 2 : 1
  if (g.px === 'max') L.manija('B', -B / 2, 0, { eje: 'x', campo: 'geo.B', factor: -fB / 100, pasoCm: 0.05, min: D.Bmin ?? 0.6, titulo: 'B' })
  else L.manija('B', B / 2, 0, { eje: 'x', campo: 'geo.B', factor: fB / 100, pasoCm: 0.05, min: D.Bmin ?? 0.6, titulo: 'B' })
  if (!g.cuadrada) {
    if (g.py === 'max') L.manija('L', 0, -Lc / 2, { eje: 'y', campo: 'geo.L', factor: -fL / 100, pasoCm: 0.05, min: D.Bmin ?? 0.6, titulo: 'L' })
    else L.manija('L', 0, Lc / 2, { eje: 'y', campo: 'geo.L', factor: fL / 100, pasoCm: 0.05, min: D.Bmin ?? 0.6, titulo: 'L' })
  }
  L.manija('col', xc, yc, { eje: 'xy', campo: 'col', factor: 1 / 100, pasoCm: 0.05, titulo: 'columna', forma: 'punto' })

  // ── corte A-A ──
  L.titulo(W1 + 20, 22, 'CORTE A-A', `h = ${f0(h)} cm · r = ${f0(r)} cm · desplante ${f2(DfCm / 100)} m`)
  L.vista(secX, secBase)
  const pl = R.plantilla ?? 5
  L.tierra(-B / 2 - 30, 0, B / 2 + 30, DfCm)
  L.line(-B / 2 - 30, DfCm, xc - c1 / 2, DfCm, { c: COL.suelo, w: 1.2 })
  L.line(xc + c1 / 2, DfCm, B / 2 + 30, DfCm, { c: COL.suelo, w: 1.2 })
  L.text(B / 2 + 28, DfCm, 'N.T.', { anchor: 'end', dy: -4, size: 9.5, c: COL.suelo })
  L.rect(-B / 2 - 5, -pl, B + 10, pl, { c: COL.plantilla, w: 0.8, fill: '#e7e2d9' })
  L.rect(-B / 2, 0, B, h, { c: COL.concreto, w: 1.6, fill: FONDO })
  const top_ = Math.max(DfCm, h) + 40
  // su contratrabe de liga, con el lecho alto al nivel del terreno: en este
  // corte se ve la que corre en x, a los dos lados de la columna
  const ct = D.ct
  if (ct) {
    const y0 = Math.max(h, DfCm - ct.h), y1 = DfCm
    const xa = -B / 2 - 30, xb = B / 2 + 30
    for (const [a, b] of [[xa, xc - c1 / 2], [xc + c1 / 2, xb]]) {
      if (b - a < 1) continue
      L.rect(a, y0, b - a, y1 - y0, { c: COL.concreto, w: 1.2, fill: '#f3ece6' })
      L.line(a + 2, y1 - ct.r - 1, b - 2, y1 - ct.r - 1, { c: COL.arriba, w: 1.2 })
      L.line(a + 2, y0 + ct.rInf + 1, b - 2, y0 + ct.rInf + 1, { c: COL.abajo, w: 1.2 })
    }
    L.text(xa, (y0 + y1) / 2, ct.nombre, { anchor: 'start', dx: 4, dy: 4, size: 9.5, weight: 700, c: COL.concreto })
  }
  L.rect(xc - c1 / 2, h, c1, top_ - h, { c: COL.concreto, w: 1.4, fill: '#ecdde3' })
  L.poly([[xc - c1 / 2 - 6, top_ - 4], [xc - 4, top_ + 3], [xc + 4, top_ - 7], [xc + c1 / 2 + 6, top_]], { c: COL.tenue, w: 0.8 }, false)
  // varillas de la columna (anclaje en la zapata)
  const vcol = varilla(5)
  for (const x of [xc - c1 / 2 + 4 + vcol.diam / 2, xc + c1 / 2 - 4 - vcol.diam / 2]) {
    const dir = x < xc ? -1 : 1
    L.poly([[x, top_ - 4], [x, r + vx.diam + vy.diam + 1], [x + dir * 12 * vcol.diam, r + vx.diam + vy.diam + 1]], { c: COL.arriba, w: 1.1 }, false)
  }
  // parrilla: la capa que corre en x se ve como línea; la otra como puntos
  const yAb = r + (D.abajoX ? vx.diam : vy.diam) / 2
  const yAr = r + (D.abajoX ? vx.diam + vy.diam / 2 : vy.diam + vx.diam / 2)
  const yLinea = D.abajoX ? yAb : yAr, yPuntos = D.abajoX ? yAr : yAb
  const gancho = D.ganchoX ? 12 * vx.diam : 0
  L.poly([[-B / 2 + r, yLinea + gancho], [-B / 2 + r, yLinea], [B / 2 - r, yLinea], [B / 2 - r, yLinea + gancho]].filter((_, i) => gancho || (i > 0 && i < 3)), { c: COL.abajo, w: 1.6 }, false)
  for (const x of xsY) L.dot(x, yPuntos, Math.max(1.6, (vy.diam / 2) * k), COL2)
  L.dimV(0, h, B / 2, 22, `h = ${f0(h)}`)
  L.dimV(0, DfCm, -B / 2 - 30, -16, `Df = ${f2(DfCm / 100)}`)
  L.dimH(-B / 2, B / 2, -pl, 26, `${f2(D.B)}`)
  L.text(-B / 2, -pl, `plantilla ${pl} cm`, { anchor: 'start', dy: 14, size: 9.5, c: COL.tenue })
  // presión efectiva de servicio
  if (Number.isFinite(D.q)) {
    const x0 = cm(reg ? reg.x0 : -D.B / 2), x1 = cm(reg ? reg.x1 : D.B / 2)
    const hq = 22 / k
    L.poly([[x0, -pl - 34 / k], [x1, -pl - 34 / k], [x1, -pl - 34 / k - hq], [x0, -pl - 34 / k - hq]], { c: COL.presion, w: 0.9, fill: 'rgba(232,131,10,0.12)' })
    const okq = D.q <= D.qe + 1e-9
    L.text((x0 + x1) / 2, -pl - 34 / k - hq, `q = ${f2(D.q)} t/m² ${okq ? '≤' : '>'} qe = ${f2(D.qe)}`, { dy: 14, size: 10, c: okq ? COL.presion : COL.mal, weight: okq ? 400 : 700 })
  }
  L.manija('h', 0, 0, { eje: 'y', campo: 'geo.h', factor: -1, pasoCm: 5, min: 15, max: 200, titulo: 'h' })
  return conDetalleCT(L.resultado(W, H), D.ct, op)
}

// ── Zapata corrida bajo muro ─────────────────────────────────
function corrida(z, R, op = {}) {
  const { ancho = 900, k: kFijo } = op
  const D = R.datos
  const B = cm(D.B), h = D.h, t = D.t, xm = cm(D.xm), r = num(z.mat?.r, 5)
  const arm = D.arm
  const vt = varilla(arm.t.num), vl = varilla(arm.l.num)
  const DfCm = cm(R.datosSuelo?.Df ?? 1)
  const Lp = 160                                        // tramo de planta dibujado, cm
  const k = kFijo ?? escalaPara(B + Lp + 140, ancho - 220, { max: 5 })
  const L = lienzo(k)
  const top = 58, M = 70
  const secX = M + 30 * k + (B / 2) * k, base = top + (Math.max(DfCm, h) + 80) * k
  const W1 = secX + (B / 2 + 30) * k
  const plX = W1 + 70, plY = top + 30 + (B / 2) * k
  const W = plX + Lp * k + 60
  const H = Math.max(base + 120, plY + (B / 2) * k + 100)

  L.titulo(M - 40, 22, 'CORTE TRANSVERSAL', `B = ${f2(D.B)} m · h = ${f0(h)} cm · muro ${f0(t)} cm de ${z.geo.muro === 'concreto' ? 'concreto' : 'mampostería'}`)
  L.vista(secX, base)
  const pl = R.plantilla ?? 5
  L.tierra(-B / 2 - 30, 0, B / 2 + 30, DfCm)
  L.line(-B / 2 - 30, DfCm, xm - t / 2, DfCm, { c: COL.suelo, w: 1.2 })
  L.line(xm + t / 2, DfCm, B / 2 + 30, DfCm, { c: COL.suelo, w: 1.2 })
  L.rect(-B / 2 - 5, -pl, B + 10, pl, { c: COL.plantilla, w: 0.8, fill: '#e7e2d9' })
  L.rect(-B / 2, 0, B, h, { c: COL.concreto, w: 1.6, fill: FONDO })
  const tope = Math.max(DfCm, h) + 60
  const ct = D.ct
  if (z.geo.muro === 'concreto') L.rect(xm - t / 2, h, t, tope - h, { c: COL.concreto, w: 1.4, fill: '#ecdde3' })
  else {
    // el muro, y su contratrabe de liga (la dala de desplante) con el lecho
    // alto al nivel del terreno
    const y0 = ct ? Math.max(h, DfCm - ct.h) : tope, y1 = ct ? DfCm : tope
    for (const [a, b] of [[h, y0], [y1, tope]]) {
      if (b - a < 0.5) continue
      L.rect(xm - t / 2, a, t, b - a, { c: COL.piedra, w: 1.2, fill: '#efe9e1' })
      for (let y = a + 10; y < b; y += 10) L.line(xm - t / 2, y, xm + t / 2, y, { c: COL.piedra, w: 0.5 })
    }
    if (ct) {
      L.vista(secX + xm * k, base - y0 * k)
      corteLiga(L, { ...ct, h: y1 - y0 }, { k, cotas: false })
      L.vista(secX, base)
      L.text(xm + Math.max(t, ct.b) / 2, (y0 + y1) / 2, ct.nombre, { anchor: 'start', dx: 26, dy: 4, size: 9.5, weight: 700, c: COL.concreto })
    }
  }
  L.poly([[xm - t / 2 - 6, tope - 4], [xm - 3, tope + 3], [xm + 3, tope - 7], [xm + t / 2 + 6, tope]], { c: COL.tenue, w: 0.8 }, false)
  const yT = r + vt.diam / 2, yLg = r + vt.diam + vl.diam / 2
  const gancho = D.gancho ? 12 * vt.diam : 0
  L.poly([[-B / 2 + r, yT + gancho], [-B / 2 + r, yT], [B / 2 - r, yT], [B / 2 - r, yT + gancho]].filter((_, i) => gancho || (i > 0 && i < 3)), { c: COL.abajo, w: 1.6 }, false)
  const xsL = reparto(-B / 2 + r + vl.diam / 2, B / 2 - r - vl.diam / 2, D.nL)
  for (const x of xsL) L.dot(x, yLg, Math.max(1.6, (vl.diam / 2) * k), COL2)
  L.dimH(-B / 2, B / 2, -pl, 26, `B = ${f2(D.B)}`)
  L.dimV(0, h, B / 2, 22, `h = ${f0(h)}`)
  L.dimV(0, DfCm, -B / 2 - 30, -16, `Df = ${f2(DfCm / 100)}`)
  L.dimH(xm - t / 2, xm + t / 2, tope - 20, -10, `${f0(t)}`)
  L.etiqueta('t', 0, yT, `${txtArm(arm.t)}${D.gancho ? ' c/gancho' : ''}`, { c: COL.abajo, dy: 62 + pl * k, titulo: 'Transversal (por metro)' })
  L.etiqueta('l', B / 2, yLg, `${D.nL}#${arm.l.num} long.`, { c: COL2, anchor: 'start', dx: 44, dy: -24, titulo: 'Longitudinal' })
  const g = z.geo
  L.manija('B', B / 2, h / 2, { eje: 'x', campo: 'geo.B', factor: (g.pos === 'lindero' ? 1 : 2) / 100, pasoCm: 0.05, min: D.Bmin ?? 0.6, titulo: 'B' })
  L.manija('h', 0, 0, { eje: 'y', campo: 'geo.h', factor: -1, pasoCm: 5, min: 15, max: 100, titulo: 'h' })
  L.manija('t', xm + t / 2, tope - 30, { eje: 'x', campo: 'geo.t', factor: 2, pasoCm: 1, min: 10, max: 60, titulo: 'muro' })

  // ── planta de un tramo ──
  L.titulo(W1 + 40, 22, 'PLANTA (tramo)', `transversales ${txtArm(arm.t)} · ${D.nL}#${arm.l.num} longitudinales`)
  L.vista(plX, plY)
  L.rect(0, -B / 2, Lp, B, { c: COL.concreto, w: 1.4, fill: FONDO })
  L.rect(0, xm - t / 2, Lp, t, { c: COL.tenue, w: 0.8, dash: '5 3' })
  for (let x = r; x <= Lp - r + 1e-6; x += arm.t.s) L.line(x, -B / 2 + r, x, B / 2 - r, { c: COL.abajo, w: 1 })
  for (const y of xsL) L.line(0, y, Lp, y, { c: COL2, w: 1 })
  L.poly([[Lp + 4, -B / 2 - 6], [Lp + 4, -4], [Lp + 10, 0], [Lp - 2, 4], [Lp + 4, 8], [Lp + 4, B / 2 + 6]], { c: COL.tenue, w: 0.7 }, false)
  L.dimH(0, Math.min(Lp, r + arm.t.s), B / 2, -14, `@ ${arm.t.s}`)
  return conDetalleCT(L.resultado(W, H), D.ct, op)
}

// ── Zapata corrida con contratrabe ───────────────────────────
function contratrabe(z, R, { ancho = 900, exportar = false, escalas = null } = {}) {
  const D = R.datos
  const Lm = D.L, Lc = cm(Lm), B = cm(D.B), h = D.h, bw = D.bw, Ht = D.H
  const r = num(z.mat?.r, 5)
  const arm = D.arm
  const vi = varilla(arm.inf.num), vs = varilla(arm.sup.num), ve = varilla(arm.est.num), va = varilla(arm.alero.num)
  const top = 58, M = 70
  const kx = escalas?.kx ?? escalaPara(Lc + 60, Math.max(420, ancho - 330), { max: 3 })
  const ks = escalas?.ks ?? escalaPara(B + 60, 250, { max: 3.2 })
  // en pantalla el alzado exagera la altura para leer el armado; el DXF va a escala
  const kz = exportar ? kx : escalas?.kz ?? Math.max(kx, Math.min(ks, 170 / Math.max(Ht, 1)))
  const cols = z.columnas || []

  // ── planta ──
  const P = lienzo(kx)
  const plY = top + (B / 2) * kx + 14
  P.titulo(M - 40, 22, 'PLANTA', `${f2(Lm)} × ${f2(D.B)} m · contratrabe ${f0(bw)} × ${f0(Ht)} cm`)
  P.vista(M, plY)
  P.rect(0, -B / 2, Lc, B, { c: COL.concreto, w: 1.6, fill: FONDO })
  P.rect(0, -bw / 2, Lc, bw, { c: COL.concreto, w: 1, fill: '#efe3e8' })
  for (let x = r; x <= Lc - r + 1e-6; x += arm.alero.s) {
    P.line(x, -B / 2 + r, x, -bw / 2, { c: COL.abajo, w: 0.8 })
    P.line(x, bw / 2, x, B / 2 - r, { c: COL.abajo, w: 0.8 })
  }
  cols.forEach((c, i) => {
    const x = cm(num(c.x)), a = num(c.c, 30), b = num(c.cb, 30)
    P.rect(x - a / 2, -b / 2, a, b, { c: COL.concreto, w: 1.6, fill: '#e0cbd4' })
    P.text(x, b / 2, `C${i + 1}`, { dy: -6, size: 10, weight: 700, c: COL.concreto })
    P.manija(`c${i}`, x, 0, { eje: 'x', campo: `columnas.${i}.x`, factor: 1 / 100, pasoCm: 0.05, min: 0, max: Lm, titulo: `C${i + 1}`, forma: 'punto' })
  })
  P.dimH(0, Lc, -B / 2, 24, `L = ${f2(Lm)}`)
  P.dimV(-B / 2, B / 2, 0, -22, `B = ${f2(D.B)}`)
  P.etiqueta('alero', Lc / 2, B / 2, `aleros ${txtArm(arm.alero)}`, { c: COL.abajo, dy: -8, titulo: 'Varillas de los aleros' })
  P.manija('L', Lc, 0, { eje: 'x', campo: 'geo.L', factor: 1 / 100, pasoCm: 0.05, min: 1, titulo: 'L' })
  P.manija('B', Lc / 2, -B / 2, { eje: 'y', campo: 'geo.B', factor: -2 / 100, pasoCm: 0.05, min: 0.6, titulo: 'B' })

  // ── alzado ──
  const E = lienzo(kx, kz)
  const elTop = plY + (B / 2) * kx + 70
  const elY = elTop + Ht * kz + 40
  E.titulo(M - 40, elTop - 18, 'ALZADO DE LA CONTRATRABE', `${arm.inf.n}#${arm.inf.num} abajo · ${arm.sup.n}#${arm.sup.num} arriba · E#${arm.est.num} @ ${arm.est.s}${kz > kx * 1.05 ? ` · alturas × ${f2(kz / kx)}` : ''}`)
  E.vista(M, elY)
  E.rect(0, 0, Lc, Ht, { c: COL.concreto, w: 1.6, fill: FONDO })
  E.line(0, h, Lc, h, { c: COL.concreto, w: 0.6, dash: '4 3' })
  cols.forEach((c) => {
    const x = cm(num(c.x)), a = num(c.c, 30)
    E.rect(x - a / 2, Ht, a, 36 / kz, { c: COL.concreto, w: 1.2, fill: '#e0cbd4' })
  })
  const yi = r + ve.diam + vi.diam / 2, ysu = Ht - r - ve.diam - vs.diam / 2
  E.poly([[r, yi + 12 / kz * 1.2], [r, yi], [Lc - r, yi], [Lc - r, yi + 12 / kz * 1.2]], { c: COL.abajo, w: 1.8 }, false)
  E.poly([[r, ysu - 14 / kz], [r, ysu], [Lc - r, ysu], [Lc - r, ysu - 14 / kz]], { c: COL.arriba, w: 1.8 }, false)
  for (let x = 5; x <= Lc - 5 + 1e-6; x += arm.est.s) E.line(x, r, x, Ht - r, { c: COL.estribo, w: 0.7 })
  E.etiqueta('inf', Lc * 0.25, 0, `${arm.inf.n}#${arm.inf.num}`, { c: COL.abajo, dy: 22, titulo: 'Lecho de abajo' })
  E.etiqueta('sup', Lc * 0.5, Ht, `${arm.sup.n}#${arm.sup.num}`, { c: COL.arriba, dy: 22, titulo: 'Lecho de arriba' })
  E.etiqueta('est', Lc * 0.75, 0, `E#${arm.est.num} @ ${arm.est.s}`, { c: COL.estribo, dy: 22, titulo: 'Estribos' })
  E.dimV(0, Ht, Lc, 22, `H = ${f0(Ht)}`)

  // ── diagramas ──
  const dg = D.diag
  const dY = elY + 60, hM = 70
  const Mmax = Math.max(1e-6, ...dg.M.map(Math.abs))
  const Vmax = Math.max(1e-6, ...dg.V.map(Math.abs))
  const trazo = (vals, y0, esc, c) => {
    const pts = dg.X.map((x, i) => `${(M + x * 100 * kx).toFixed(1)},${(y0 + vals[i] * esc).toFixed(1)}`).join(' ')
    E.raw(`<polyline points="${M},${y0} ${pts} ${M + Lc * kx},${y0}" fill="${c}" fill-opacity="0.12" stroke="${c}" stroke-width="1.2"/>`)
    E.raw(`<line x1="${M}" y1="${y0}" x2="${M + Lc * kx}" y2="${y0}" stroke="${COL.tinta}" stroke-width="0.6"/>`)
  }
  E.textPx(M - 40, dY - 8, `Momento último: M+ (tensión abajo) hacia abajo · máx ${f2(D.Mp)} / ${f2(D.Mn)} t·m`, { size: 10.5, c: COL.tenue })
  trazo(dg.M, dY + hM / 2 + 6, (hM / 2) / Mmax, '#6d28d9')
  const vY = dY + hM + 40
  E.textPx(M - 40, vY - 8, `Cortante último · a d de la cara ${f2(D.Vu)} t`, { size: 10.5, c: COL.tenue })
  trazo(dg.V.map((v) => -v), vY + hM / 2 + 6, (hM / 2) / Vmax, COL.estribo)

  // ── corte transversal ──
  const S = lienzo(ks)
  const cxX = M + Lc * kx + 80 + (B / 2) * ks, cxY = top + 50 + Ht * ks
  S.vista(cxX, cxY)
  S.titulo(cxX - (B / 2) * ks - 10, 22, 'CORTE', `losa ${f0(h)} cm · alma ${f0(bw)} cm`)
  S.poly([[-B / 2, 0], [B / 2, 0], [B / 2, h], [bw / 2, h], [bw / 2, Ht], [-bw / 2, Ht], [-bw / 2, h], [-B / 2, h]], { c: COL.concreto, w: 1.6, fill: FONDO })
  S.rect(-bw / 2 + r, r, bw - 2 * r, Ht - 2 * r, { c: COL.estribo, w: 1 })
  const xsI = reparto(-bw / 2 + r + ve.diam + vi.diam / 2, bw / 2 - r - ve.diam - vi.diam / 2, arm.inf.n)
  const xsS = reparto(-bw / 2 + r + ve.diam + vs.diam / 2, bw / 2 - r - ve.diam - vs.diam / 2, arm.sup.n)
  for (const x of xsI) S.dot(x, yi, Math.max(2, (vi.diam / 2) * ks), COL.abajo)
  for (const x of xsS) S.dot(x, ysu, Math.max(2, (vs.diam / 2) * ks), COL.arriba)
  S.line(-B / 2 + r, r + va.diam / 2, B / 2 - r, r + va.diam / 2, { c: COL.abajo, w: 1.3 })
  S.dimH(-B / 2, B / 2, 0, 24, `B = ${f2(D.B)}`)
  S.dimV(0, Ht, B / 2, 22, `H = ${f0(Ht)}`)
  S.dimV(0, h, -B / 2, -16, `${f0(h)}`)
  S.manija('H', 0, Ht, { eje: 'y', campo: 'geo.H', factor: 1, pasoCm: 5, min: 30, max: 250, titulo: 'H' })
  S.manija('h', -B / 2 + 8, h, { eje: 'y', campo: 'geo.h', factor: 1, pasoCm: 5, min: 15, max: 80, titulo: 'h' })
  S.manija('bw', bw / 2, Ht * 0.7, { eje: 'x', campo: 'geo.bw', factor: 2, pasoCm: 5, min: 15, max: 100, titulo: 'bw' })

  const W = Math.max(M + Lc * kx + 70, cxX + (B / 2) * ks + 70)
  const Htot = Math.max(vY + hM + 30, cxY + 70)
  const partes = [P.resultado(W, Htot), E.resultado(W, Htot), S.resultado(W, Htot)]
  const inner = partes.map((x) => x.inner).join('')
  return {
    inner, W, H: Htot, k: kx, escalas: { kx, ks, kz },
    handles: partes.flatMap((x) => x.handles), hits: partes.flatMap((x) => x.hits),
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${Htot}" width="${W}" height="${Htot}" font-family="DM Mono, monospace">${inner}</svg>`,
  }
}

// ── Muro de contención de concreto ───────────────────────────
function contencion(z, R, { ancho = 900, k: kFijo } = {}) {
  const D = R.datos
  const Hc = cm(D.H), tc = cm(D.tc), tb = cm(D.tb), p = cm(D.p), tal = cm(D.tal), hz = cm(D.hz), hk = cm(D.hk), bk = cm(D.bk), Df = cm(D.Df)
  const B = p + tb + tal
  const arm = D.arm
  const r = num(z.mat?.r, 5)
  const beta = D.beta, tb_ = Math.tan((beta * Math.PI) / 180)
  const k = kFijo ?? escalaPara(B + 260, ancho - 120, { max: 3.2 })
  const L = lienzo(k)
  const M = 90, top = 60
  const oy = top + (Hc + tal * tb_ + 40) * k
  const W = M + 40 * k + (B + 110) * k + 150
  const H = oy + hk * k + 190
  L.titulo(M - 60, 24, 'CORTE DEL MURO', `H = ${f2(D.H)} m · base ${f2(D.B)} × ${f0(hz)} cm · pantalla ${f0(tc)}–${f0(tb)} cm`)
  L.vista(M + 40 * k, oy)
  const xb = p + tb
  // relleno detrás y suelo frente a la punta
  L.tierraPoli([[xb, hz], [B + 90, hz], [B + 90, Hc + (B + 90 - xb) * tb_], [xb, Hc]])
  L.line(xb, Hc, B + 90, Hc + (B + 90 - xb) * tb_, { c: COL.suelo, w: 1.2 })
  if (D.q > 0) {
    for (let x = xb + 10; x < B + 80; x += 22) L.line(x, Hc + (x - xb) * tb_ + 26, x, Hc + (x - xb) * tb_ + 4, { c: COL.presion, w: 0.8 })
    L.text(B + 40, Hc + (B + 40 - xb) * tb_ + 26, `q = ${f2(D.q)} t/m²`, { dy: -6, size: 10, c: COL.presion })
  }
  L.tierra(-50, 0, p, Df)
  L.line(-50, Df, p, Df, { c: COL.suelo, w: 1.2 })
  // concreto
  L.rect(-5, -5, B + 10, 5, { c: COL.plantilla, w: 0.8, fill: '#e7e2d9' })
  L.poly([[0, 0], [B, 0], [B, hz], [xb, hz], [xb, Hc], [xb - tc, Hc], [p, hz], [0, hz]], { c: COL.concreto, w: 1.6, fill: FONDO })
  if (hk > 0) L.rect(p, -hk, bk, hk, { c: COL.concreto, w: 1.6, fill: FONDO })
  // armado de la pantalla: cara del relleno (tensión), bastones, cara exterior
  const vpv = varilla(arm.pv.num), vts = varilla(arm.ts.num), vpi = varilla(arm.pi.num)
  const xr = xb - r - vpv.diam / 2
  const yAnc = r + vpi.diam + 2
  L.poly([[xr - 20, yAnc], [xr, yAnc], [xr, Hc - r]], { c: COL.arriba, w: 1.8 }, false)
  if (arm.bast.on) {
    const Lb = cm(D.Lb)
    L.poly([[xr - 3 - 20, yAnc + 4], [xr - 3, yAnc + 4], [xr - 3, hz + Lb]], { c: COL.arriba, w: 1.4, dash: '8 3' }, false)
    L.dimV(hz, hz + Lb, xb, 30, `bastón ${f2(D.Lb)}`)
  }
  const xe = (y) => p + (tb - tc) * ((y - hz) / Math.max(Hc - hz, 1)) + r
  L.poly([[xe(hz + 5) + 12, yAnc + 6], [xe(hz + 5), yAnc + 6], [xe(hz + 5), hz + 5], [xe(Hc - r), Hc - r]], { c: COL.estribo, w: 1.1 }, false)
  // horizontales (puntos) en ambas caras
  for (let y = hz + 15; y < Hc - 5; y += arm.ph.s) {
    L.dot(xr - vpv.diam - 2, y, 1.6, COL2)
    L.dot(xe(y) + 3, y, 1.6, COL2)
  }
  // base: arriba (talón) y abajo (punta)
  const yS = hz - r - vts.diam / 2, yI = r + vpi.diam / 2
  L.poly([[r, yS - 12], [r, yS], [B - r, yS], [B - r, yS - 18]], { c: COL.arriba, w: 1.6 }, false)
  L.poly([[r, yI + 18], [r, yI], [B - r, yI], [B - r, yI + 12]], { c: COL.abajo, w: 1.6 }, false)
  for (let x = r + 10; x < B - r; x += arm.pl.s) { L.dot(x, yS - vts.diam, 1.5, COL2); L.dot(x, yI + vpi.diam, 1.5, COL2) }
  // empuje y presión en la base
  const Ha = cm(D.Ha)
  const eK = 55 / Math.max(D.Ka * D.gs * D.Ha + D.Ka * D.q, 1e-6)
  const pb = D.pb
  L.poly([[B + 110, Ha], [B + 110, 0], [B + 110 + (D.Ka * D.gs * D.Ha + D.Ka * D.q) * eK, 0], [B + 110 + D.Ka * D.q * eK, Ha]], { c: COL.presion, w: 0.9, fill: 'rgba(232,131,10,0.12)' })
  L.text(B + 112, Ha / 3, `Pa ${f2(D.Pa)} t`, { anchor: 'start', size: 10, c: COL.presion })
  const eq = 40 / Math.max(pb.qmax, 1e-6)
  const q = (x) => pb.q(x / 100)
  const y0p = -hk - 36 / k
  const pts = [[0, y0p]]
  for (let i = 0; i <= 24; i++) { const x = (B * i) / 24; pts.push([x, y0p - q(x) * eq / k]) }
  pts.push([B, y0p])
  L.poly(pts, { c: COL.presion, w: 0.9, fill: 'rgba(232,131,10,0.12)' })
  L.text(0, y0p - q(0) * eq / k, `${f2(pb.q(0))}`, { anchor: 'end', dx: -4, size: 10, c: COL.presion })
  L.text(B, y0p - q(B) * eq / k, `${f2(pb.q(D.B))} t/m²`, { anchor: 'start', dx: 4, size: 10, c: COL.presion })
  // cotas
  L.dimH(0, p, -hk, 100, `${f2(D.p)}`)
  L.dimH(p, xb, -hk, 100, `${f0(tb)}`)
  L.dimH(xb, B, -hk, 100, `${f2(D.tal)}`)
  L.dimH(0, B, -hk, 124, `B = ${f2(D.B)}`)
  L.dimV(0, Hc, -50, -18, `H = ${f2(D.H)}`)
  L.dimV(0, hz, B, 22, `${f0(hz)}`)
  L.dimV(0, Df, -50, -40, `Df ${f2(D.Df)}`)
  L.dimH(xb - tc, xb, Hc, -14, `${f0(tc)}`)
  // etiquetas
  L.etiqueta('pv', xb, Hc * 0.62, `${txtArm(arm.pv)}${arm.bast.on ? ` + bast.` : ''}`, { c: COL.arriba, anchor: 'start', dx: 14, titulo: 'Pantalla, cara del relleno' })
  if (arm.bast.on) L.etiqueta('bast', xb, hz + cm(D.Lb) * 0.5, `bastones ${txtArm(arm.bast)}`, { c: COL.arriba, anchor: 'start', dx: 60, titulo: 'Bastones' })
  L.etiqueta('pe', p, Hc * 0.45, txtArm(arm.pe), { c: COL.estribo, anchor: 'end', dx: -14, titulo: 'Pantalla, cara exterior' })
  L.etiqueta('ph', xb, Hc * 0.82, `H ${txtArm(arm.ph)}`, { c: COL2, anchor: 'start', dx: 14, titulo: 'Horizontales' })
  L.etiqueta('ts', xb + tal / 2, hz, `${txtArm(arm.ts)}`, { c: COL.arriba, dy: -18, titulo: 'Talón, arriba' })
  L.etiqueta('pi', p / 2, 0, `${txtArm(arm.pi)}`, { c: COL.abajo, dy: 26, titulo: 'Base, abajo' })
  L.etiqueta('pl', B - 20, hz / 2, `long. ${txtArm(arm.pl)}`, { c: COL2, anchor: 'start', dx: 18, titulo: 'Longitudinales de la base' })
  // manijas
  L.manija('punta', 0, hz / 2, { eje: 'x', campo: 'geo.punta', factor: -1 / 100, pasoCm: 0.05, min: 0.2, titulo: 'punta' })
  L.manija('talon', B, hz / 2, { eje: 'x', campo: 'geo.talon', factor: 1 / 100, pasoCm: 0.05, min: 0.2, titulo: 'talón' })
  L.manija('H', xb - tc / 2, Hc, { eje: 'y', campo: 'geo.H', factor: 1 / 100, pasoCm: 0.05, min: 0.8, titulo: 'H' })
  L.manija('hz', B * 0.75, 0, { eje: 'y', campo: 'geo.hz', factor: -1 / 100, pasoCm: 0.05, min: 0.2, titulo: 'hz' })
  L.manija('tb', p, hz + 8, { eje: 'x', campo: ['geo.tb', 'geo.punta'], factor: [-1 / 100, 1 / 100], pasoCm: 0.05, min: 0.15, titulo: 'tb' })
  L.manija('tc', xb - tc, Hc - 6, { eje: 'x', campo: 'geo.tc', factor: -1 / 100, pasoCm: 0.05, min: 0.15, titulo: 'tc' })
  L.manija('hk', p + bk / 2, -hk, { eje: 'y', campo: 'geo.hk', factor: -1 / 100, pasoCm: 0.1, min: 0, max: 1.5, titulo: 'dentellón' })
  return L.resultado(W, H)
}

// ── Muro de mampostería (gravedad) ───────────────────────────
function gravedad(z, R, { ancho = 900, k: kFijo } = {}) {
  const D = R.datos
  const Hc = cm(D.H), c = cm(D.c), B = cm(D.B), m1 = cm(D.m1), m2 = cm(D.m2), Df = cm(D.Df)
  const k = kFijo ?? escalaPara(B + 240, ancho - 120, { max: 3.5 })
  const L = lienzo(k)
  const M = 90, top = 60
  const oy = top + (Hc + 40) * k
  const W = M + (B + 220) * k, H = oy + 150
  L.titulo(M - 60, 24, 'CORTE DEL MURO DE PIEDRA', `H = ${f2(D.H)} m · corona ${f2(D.c)} · base ${f2(D.B)} m`)
  L.vista(M + 40 * k, oy)
  L.tierraPoli([[m1 + c, Hc], [B, 0], [B + 90, 0], [B + 90, Hc]])
  L.line(m1 + c, Hc, B + 90, Hc, { c: COL.suelo, w: 1.2 })
  L.tierra(-50, 0, m1 * (Df / Hc), Df)
  L.line(-50, Df, m1 * (Df / Hc), Df, { c: COL.suelo, w: 1.2 })
  const sec = [[0, 0], [B, 0], [m1 + c, Hc], [m1, Hc]]
  L.poly(sec, { c: COL.piedra, w: 1.6, fill: '#efe9e1' })
  L.piedra(sec, 3)
  L.poly(sec, { c: COL.piedra, w: 1.6 })
  // resultantes en cada junta
  for (const j of D.juntas) {
    const y = cm(j.y), xf = cm(j.xf), w = cm(j.w)
    L.line(xf, y, xf + w, y, { c: COL.tenue, w: 0.5, dash: '3 3' })
    L.line(xf + w / 3, y, xf + (2 * w) / 3, y, { c: COL.ok, w: 2.2, op: 0.6 })
    L.dot(xf + cm(j.x), y, 3, j.okE ? COL.ok : COL.mal)
  }
  L.text(B + 30, 8, 'resultante en el tercio medio', { anchor: 'start', size: 9.5, c: COL.ok })
  L.dimH(0, B, 0, 30, `B = ${f2(D.B)}`)
  L.dimH(m1, m1 + c, Hc, -14, `c = ${f2(D.c)}`)
  L.dimV(0, Hc, -50, -18, `H = ${f2(D.H)}`)
  if (m1 > 0) L.dimH(0, m1, 0, 52, `${f2(D.m1)}`)
  L.manija('B', B, 0, { eje: 'x', campo: 'geo.B', factor: 1 / 100, pasoCm: 0.05, min: 0.4, titulo: 'B' })
  L.manija('c', m1 + c, Hc, { eje: 'x', campo: 'geo.c', factor: 1 / 100, pasoCm: 0.05, min: 0.3, titulo: 'c' })
  L.manija('H', m1 + c / 2, Hc, { eje: 'y', campo: 'geo.H', factor: 1 / 100, pasoCm: 0.05, min: 0.5, titulo: 'H' })
  L.manija('m1', m1, Hc, { eje: 'x', campo: 'geo.m1', factor: 1 / 100, pasoCm: 0.05, min: 0, titulo: 'frente' })
  return L.resultado(W, H)
}

// ── Cimiento de mampostería ──────────────────────────────────
function mamposteria(z, R, { ancho = 900, k: kFijo } = {}) {
  const D = R.datos
  const B = cm(D.B), Hc = cm(D.H), c = cm(D.c), t = cm(D.t)
  const lind = D.lind
  const k = kFijo ?? escalaPara(B + 200, ancho - 160, { max: 4 })
  const L = lienzo(k)
  const M = 90, top = 60
  const oy = top + (Hc + 110) * k
  const W = M + (B + 180) * k, H = oy + 110
  L.titulo(M - 60, 24, lind ? 'CIMIENTO DE LINDERO' : 'CIMIENTO INTERIOR', `B = ${f2(D.B)} · corona ${f2(D.c)} · H = ${f2(D.H)} m · escarpio ${f2(D.p)} : 1`)
  L.vista(M + 40 * k, oy)
  const x0 = lind ? 0 : -B / 2
  const sec = lind ? [[0, 0], [B, 0], [c, Hc], [0, Hc]] : [[-B / 2, 0], [B / 2, 0], [c / 2, Hc], [-c / 2, Hc]]
  const xc = lind ? t / 2 : 0
  L.tierra(x0 - 40, 0, x0 + B + 40, Hc + 20)
  L.poly(sec, { c: COL.piedra, w: 1.6, fill: '#efe9e1' })
  L.piedra(sec, 7)
  L.poly(sec, { c: COL.piedra, w: 1.6 })
  // dala y muro encima
  L.rect(xc - t / 2 - 2.5, Hc, t + 5, 20, { c: COL.concreto, w: 1.2, fill: '#ecdde3' })
  L.rect(xc - t / 2, Hc + 20, t, 70, { c: COL.piedra, w: 1, fill: '#f3eee7' })
  for (let y = Hc + 30; y < Hc + 90; y += 10) L.line(xc - t / 2, y, xc + t / 2, y, { c: COL.piedra, w: 0.4 })
  L.text(xc + t / 2 + 2.5, Hc + 10, 'dala', { anchor: 'start', dx: 6, size: 9.5, c: COL.concreto, dy: 4 })
  L.text(xc + t / 2 + 6, Hc + 60, `muro ${f0(t)} cm`, { anchor: 'start', size: 9.5, c: COL.tenue })
  L.dimH(x0, x0 + B, 0, 28, `B = ${f2(D.B)}`)
  L.dimH(lind ? 0 : -c / 2, lind ? c : c / 2, Hc, -(20 * k + 16), `c = ${f2(D.c)}`)
  L.dimV(0, Hc, x0, -18, `H = ${f2(D.H)}`)
  const ang = (Math.atan(D.p) * 180) / Math.PI
  L.text(lind ? c + (B - c) / 2 : (c / 2 + B / 2) / 2, Hc / 2, `${ang.toFixed(1)}°`, { anchor: 'start', dx: 10, size: 10.5, c: ang >= 56.3 ? COL.ok : COL.mal })
  L.manija('B', x0 + B, 0, { eje: 'x', campo: 'geo.B', factor: (lind ? 1 : 2) / 100, pasoCm: 0.05, min: 0.6, titulo: 'B' })
  L.manija('H', lind ? c / 2 : 0, Hc, { eje: 'y', campo: 'geo.H', factor: 1 / 100, pasoCm: 0.05, min: 0.3, titulo: 'H' })
  L.manija('c', lind ? c : c / 2, Hc - 12, { eje: 'x', campo: 'geo.c', factor: (lind ? 1 : 2) / 100, pasoCm: 0.05, min: 0.2, titulo: 'c' })
  return L.resultado(W, H)
}

// ── Contratrabe de liga ──────────────────────────────────────
function liga(z, R, { ancho = 900, exportar = false, escalas = null } = {}) {
  const D = R.datos
  const { b, h, dado, cs, arm } = D
  const vs = varilla(arm.sup.num), vi = varilla(arm.inf.num), ve = varilla(arm.est.num)
  const x00 = cm(cs[0].x) - cs[0].c / 2 - 40
  const X = (c) => cm(c.x) - x00
  const largo = cm(cs[cs.length - 1].x) + cs[cs.length - 1].c / 2 + 40 - x00
  const top = 64, M = 70
  const kx = escalas?.kx ?? escalaPara(largo, Math.max(420, ancho - 300), { min: 0.2, max: 2.6 })
  const ks = escalas?.ks ?? escalaPara(b + 70, 200, { max: 4 })
  // en pantalla se exageran las alturas para leer el armado; el DXF va a escala
  const kz = exportar ? kx : escalas?.kz ?? Math.max(kx, Math.min(3, 190 / (dado + h + 70)))

  // ── alzado ──
  const E = lienzo(kx, kz)
  const baseY = top + (h + 40) * kz + 26
  E.titulo(M - 40, 22, 'ALZADO DE LA LIGA', `${f0(b)} × ${f0(h)} cm · a la altura del dado · T = ${f2(D.T)} t (tensión y compresión)${kz > kx * 1.05 ? ` · alturas × ${f2(kz / kx)}` : ''}`)
  E.vista(M, baseY)
  cs.forEach((c, i) => {
    const x = X(c)
    // el dado bajo la liga y, punteada, la zapata que liga
    E.rect(x - c.c / 2, -dado, c.c, dado, { c: COL.concreto, w: 1.2, fill: FONDO })
    E.rect(x - 55, -dado - 28, 110, 28, { c: COL.tenue, w: 0.8, dash: '5 3' })
    E.text(x, -dado - 28, 'zapata', { dy: 12, size: 8.5, c: COL.tenue })
    E.rect(x - c.c / 2, h, c.c, 26 / kz, { c: COL.concreto, w: 1.2, fill: '#e0cbd4' })
    E.text(x, h + 26 / kz, `C${i + 1}`, { dy: -5, size: 10, weight: 700, c: COL.concreto })
    if (c.Me > 1e-6) E.text(x, h + 26 / kz, `N·e = ${f2(c.Me)} t·m`, { dy: -18, size: 9, c: COL.mal })
  })
  const x0 = X(cs[0]) - cs[0].c / 2, x1 = X(cs[cs.length - 1]) + cs[cs.length - 1].c / 2
  E.rect(x0, 0, x1 - x0, h, { c: COL.concreto, w: 1.6, fill: '#f3ece6' })
  const yS = h - D.rS, yI = D.rI
  const g = 14 / kz
  E.poly([[x0 + 4, yS - g], [x0 + 4, yS], [x1 - 4, yS], [x1 - 4, yS - g]], { c: COL.arriba, w: 1.8 }, false)
  E.poly([[x0 + 4, yI + g], [x0 + 4, yI], [x1 - 4, yI], [x1 - 4, yI + g]], { c: COL.abajo, w: 1.8 }, false)
  for (let i = 0; i < cs.length - 1; i++) {
    const a = X(cs[i]) + cs[i].c / 2 + 5, bb = X(cs[i + 1]) - cs[i + 1].c / 2 - 5
    for (let x = a; x <= bb + 1e-6; x += arm.est.s) E.line(x, 4, x, h - 4, { c: COL.estribo, w: 0.7 })
    E.dimH(X(cs[i]), X(cs[i + 1]), -dado - 28, 22, f2(cs[i + 1].x - cs[i].x))
  }
  const mid = (X(cs[0]) + X(cs[1])) / 2
  E.etiqueta('sup', mid, h, `${arm.sup.n}#${arm.sup.num}`, { c: COL.arriba, dy: -40, titulo: 'Lecho de arriba' })
  E.etiqueta('inf', mid - 55 / kx, 0, `${arm.inf.n}#${arm.inf.num}`, { c: COL.abajo, dy: 24, titulo: 'Lecho de abajo' })
  E.etiqueta('est', mid + 55 / kx, 0, `E#${arm.est.num} @ ${arm.est.s}`, { c: COL.estribo, dy: 24, titulo: 'Estribos' })
  E.dimV(0, h, x1, 22, `h = ${f0(h)}`)
  E.dimV(-dado, 0, x0, -18, `dado ${f0(dado)}`)

  // ── corte ──
  const S = lienzo(ks)
  const cxX = M + largo * kx + 60 + (b / 2) * ks, cxY = top + 34 + h * ks
  S.vista(cxX, cxY)
  S.titulo(cxX - (b / 2) * ks - 10, 22, 'CORTE', `${f0(b)} × ${f0(h)} cm · r ${f0(D.r ?? 3)} / ${f0(D.rInf ?? 5)}`)
  corteLiga(S, { b, h, r: D.r ?? 3, rInf: D.rInf ?? 5, sup: arm.sup, inf: arm.inf, est: arm.est }, { k: ks })
  S.manija('h', 0, h, { eje: 'y', campo: 'geo.h', factor: 1, pasoCm: 5, min: 30, max: 150, titulo: 'h' })
  S.manija('b', b / 2, h * 0.55, { eje: 'x', campo: 'geo.b', factor: 2, pasoCm: 5, min: 15, max: 80, titulo: 'b' })

  const W = Math.max(M + largo * kx + 30, cxX + (b / 2) * ks + 70)
  const Htot = Math.max(baseY + (dado + 28) * kz + 56, cxY + 60)
  const partes = [E.resultado(W, Htot), S.resultado(W, Htot)]
  const inner = partes.map((x) => x.inner).join('')
  return {
    inner, W, H: Htot, k: kx, escalas: { kx, ks, kz },
    handles: partes.flatMap((x) => x.handles), hits: partes.flatMap((x) => x.hits),
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${Htot}" width="${W}" height="${Htot}" font-family="DM Mono, monospace">${inner}</svg>`,
  }
}

const DIBUJOS = { aislada, corrida, contratrabe, contencion, gravedad, mamposteria, liga }

/**
 * @param z   cimiento
 * @param R   su revisión
 * @param op  { ancho (px del contenedor), Df (m, del suelo efectivo), plantilla }
 */
export function dibujarCim(z, R, op = {}) {
  const f = DIBUJOS[z.tipo]
  if (!f || !R?.datos) return null
  try {
    return f(z, { ...R, datosSuelo: { Df: op.Df ?? 1 }, plantilla: op.plantilla ?? 5 }, op)
  } catch (e) {
    console.error(e)
    return null
  }
}
