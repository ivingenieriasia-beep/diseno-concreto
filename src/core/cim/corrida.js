// ══════════════════════════════════════════════════════════════
// Zapata corrida bajo muro (por metro lineal) — hoja «Zapata Corrida»
//
// Franja de 1 m bajo un muro de espesor t, al centro o de lindero. Diferencias
// con la hoja:
//   · la capacidad efectiva descuenta relleno y peso propio en t/m² (la hoja
//     mezclaba kg/m² con t/m³);
//   · muro de mampostería: la sección crítica de flexión va a la mitad entre
//     el eje y la cara del muro; de concreto, en la cara;
//   · lindero: con dala y muros perpendiculares que toman la excentricidad
//     (lo usual), o sin ellos, con el ancho efectivo B′ = B − 2e;
//   · el acero longitudinal de temperatura se reparte en el ancho real B.
// ══════════════════════════════════════════════════════════════

import {
  CRITERIOS, SUELO, MAT, paso, check, f1, f2, f3, arriba, num,
  capacidadEfectiva, presiones, flexion, revisaParrilla, proponerParrilla,
  cortante1D, anclaje, varilla, txtArm, parrilla, kgm, fmtS, GC,
} from './comun'

export function nuevaCorrida(nombre = 'ZC-1') {
  return {
    tipo: 'corrida', nombre,
    geo: { B: 0.8, h: 20, t: 15, muro: 'mamposteria', pos: 'centro', liga: true, Lz: 10 },
    cargas: { CM: { w: 4.75, M: 0 }, CV: { w: 1.2, M: 0 }, S: { w: 0, M: 0 } },
    arm: { t: { num: 3, s: 20 }, l: { num: 3, s: 25 } },
    mat: { ...MAT }, suelo: {},
  }
}

const Z = { w: 0, M: 0 }
const sg_ = (v) => (v < 0 ? -1 : 1)

export function combinacionesCorrida(cargas, C) {
  const cm = { ...Z, ...(cargas?.CM || {}) }, cv = { ...Z, ...(cargas?.CV || {}) }, s = { ...Z, ...(cargas?.S || {}) }
  const serv = { w: cm.w + cv.w, M: cm.M + cv.M }
  const out = {
    servicio: [{ id: 'CM + CV', ...serv, k: 1 }],
    ultimas: [{ id: `${C.fcm} CM + ${C.fcv} CV`, w: C.fcm * cm.w + C.fcv * cv.w, M: C.fcm * cm.M + C.fcv * cv.M }],
  }
  if (Math.abs(s.w) + Math.abs(s.M) > 1e-9) {
    // el sismo carga y descarga el muro; el momento siempre se agranda
    const conS = (f, sg) => ({ w: f * (serv.w + sg * Math.abs(s.w)), M: f * (serv.M + sg_(serv.M) * Math.abs(s.M)) })
    for (const sg of [1, -1]) {
      if (sg < 0 && Math.abs(s.w) < 1e-9) continue
      const t = sg > 0 ? '+' : '−'
      out.servicio.push({ id: `CM + CV ${t} S`, ...conS(1, sg), k: C.kS })
      out.ultimas.push({ id: `${C.facc} (CM + CV ${t} S)`, ...conS(C.facc, sg) })
    }
  }
  return out
}

export function revisarCorrida(z, obra = {}) {
  const C = { ...CRITERIOS, ...(obra.criterios || {}) }
  const S = { ...SUELO, ...(obra.suelo || {}), ...(z.suelo || {}) }
  const g = z.geo, m = { ...MAT, ...(z.mat || {}) }
  const B = num(g.B, 0.8), h = num(g.h, 20), t = num(g.t, 15)
  const fc = num(m.fc, 250), fy = num(m.fy, 4200), r = num(m.r, 5)
  const arm = { t: { num: 3, s: 20, ...(z.arm?.t || {}) }, l: { num: 3, s: 25, ...(z.arm?.l || {}) } }
  const lindero = g.pos === 'lindero'
  const xm = lindero ? -B / 2 + t / 200 : 0              // eje del muro, m
  const off = lindero && !g.liga ? xm : 0
  const cmb = combinacionesCorrida(z.cargas, C)
  const checks = [], secciones = [], avisos = []

  // ── suelo ──
  // con el peso de la zapata y el relleno por metro, W; con carga centrada es
  // lo mismo que la hoja (w/B ≤ qe = qadm − W/B)
  const hm = h / 100
  const qadm = num(S.qadm), gs = num(S.gs, 1.6), Df = num(S.Df, 1)
  const W = B * (GC * hm + gs * Math.max(0, Df - hm))
  const qeG = capacidadEfectiva({ ...S, h })
  const pS = [
    paso('Peso de la zapata y el relleno, por metro', 'W = B [γc h + γs (Df − h)]', `= ${f2(B)} × (${GC} × ${f2(hm)} + ${f2(gs)} × ${f2(Math.max(0, Df - hm))})`, W, 't/m'),
    { ...qeG.pasos[0], nota: 'qadm menos W/B: lo que queda para el muro' },
  ]
  // en neto, como la hoja: q = (w + W)/B′ − W/B ≤ qe = k qadm − W/B
  const wB = W / B
  const sue = cmb.servicio.map((c) => {
    const wt = c.w + W
    const e = wt > 0 ? (c.w * off + c.M) / wt : 0
    const pr = presiones(Math.max(wt, 0), B, 1, e, 0)
    const qe = c.k * qadm - wB
    const q = wt > 0 ? pr.q - wB : Infinity
    return { c, wt, e, pr, q, qe, u: q / qe }
  })
  for (const s of sue) {
    const et = sue.length > 1 ? ` (${s.c.id})` : ''
    pS.push(paso(`Carga del muro${et}`, 'w', s.c.id, s.c.w, 't/m'))
    pS.push(paso('Carga en el desplante', 'w + W', `= ${f2(s.c.w)} + ${f2(W)}`, s.wt, 't/m', s.wt > 0 ? {} : { ok: false, nota: 'se levanta' }))
    if (!(s.wt > 0)) continue
    if (Math.abs(s.e) > 1e-6) {
      pS.push(paso('Excentricidad', lindero && !g.liga ? 'e = (w · eje del muro + M) / (w + W)' : 'e = M / (w + W)', '', s.e, 'm'))
      pS.push(paso('Ancho efectivo', 'B′ = B − 2|e|', `= ${f2(B)} − 2 × ${f3(Math.abs(s.e))}`, s.pr.Bp, 'm', s.pr.sinArea ? { ok: false, nota: 'la resultante sale de la base' } : {}))
    }
    if (!s.pr.sinArea) {
      const lim = { ok: s.u <= 1, lim: `≤ qe = ${f2(s.qe)}${s.c.k !== 1 ? ` (${s.c.k} qadm − W/B)` : ''}` }
      if (Math.abs(s.e) > 1e-6) {
        pS.push(paso('Presión con el peso', 'q′ = (w + W) / B′', `= ${f2(s.wt)} / ${f3(s.pr.Bp)}`, s.pr.q, 't/m²'))
        pS.push(paso('Presión neta', 'q = q′ − W / B', `= ${f2(s.pr.q)} − ${f2(wB)}`, s.q, 't/m²', lim))
      } else pS.push(paso('Presión de contacto', 'q = w / B', `= ${f2(s.c.w)} / ${f2(B)}`, s.q, 't/m²', lim))
    }
  }
  pS.push(paso('Ancho mínimo por suelo', 'Bmín = w / qe', `= ${f2(cmb.servicio[0].w)} / ${f2(qeG.qe)}`, cmb.servicio[0].w / qeG.qe, 'm'))
  const sG = sue.reduce((a, b) => (b.u > a.u ? b : a))
  checks.push(check('suelo', 'Presión en el suelo', sG.q, sG.qe, 't/m²', { grupo: 'Suelo', nota: sG.c.id }))
  secciones.push({ titulo: 'Presión en el suelo (por metro, cargas de servicio)', pasos: pS })
  if (!(sG.wt > 0)) avisos.push(`Con ${sG.c.id} el muro levanta la zapata: agrándala o hazla más pesada.`)
  else if (!(sG.u <= 1) && B >= 5) avisos.push(`El suelo pide una corrida de más de ${f2(B)} m (qadm = ${f2(qadm)} t/m²): conviene contratrabe, losa de cimentación o mejorar el suelo.`)
  if (lindero && g.liga) avisos.push('Lindero: la excentricidad la toman la dala y los muros perpendiculares; confírmalo en planta.')

  // ── concreto ──
  const v = varilla(arm.t.num)
  const d = h - r - v.diam / 2
  // sección crítica de flexión: cara (concreto) o mitad entre eje y cara (mampostería)
  const retro = g.muro === 'concreto' ? 0 : t / 400
  const caras = { d: xm + t / 200 - retro, i: xm - t / 200 + retro }
  const carasV = { d: xm + t / 200, i: xm - t / 200 }
  // la reacción con el peso (0.9 W) en el ancho efectivo, menos el peso en todo
  // el ancho: con carga centrada, wu / B como siempre
  const Wu = 0.9 * W
  const ult = cmb.ultimas.map((c) => {
    const wt = c.w + Wu
    const e = wt > 0 ? (c.w * off + c.M) / wt : 0
    const pr = presiones(Math.max(wt, 0), B, 1, e, 0)
    const qu = pr.sinArea ? 0 : pr.q, qd = Wu / B
    const momQ = (q, x0, x1, xf, dir) => {
      const lo = dir > 0 ? Math.max(xf, x0) : Math.max(-xf, -x1), hi = dir > 0 ? x1 : -x0, f = dir * xf
      return hi > lo ? q * ((hi - f) ** 2 - (lo - f) ** 2) / 2 : 0
    }
    const corQ = (q, x0, x1, xf, dir) => {
      const s = dir * xf + d / 100
      const lo = dir > 0 ? Math.max(s, x0) : Math.max(s, -x1), hi = dir > 0 ? x1 : -x0
      return hi > lo ? q * (hi - lo) : 0
    }
    const { x0, x1 } = pr.region
    const mom = (xf, dir) => momQ(qu, x0, x1, xf, dir) - momQ(qd, -B / 2, B / 2, xf, dir)
    const cor = (xf, dir) => corQ(qu, x0, x1, xf, dir) - corQ(qd, -B / 2, B / 2, xf, dir)
    return { c, e, pr, qu, qd, Mu: Math.max(mom(caras.d, 1), mom(caras.i, -1), 0), Vu: Math.max(cor(carasV.d, 1), cor(carasV.i, -1), 0) }
  })
  const uM = ult.reduce((a, b) => (b.Mu > a.Mu ? b : a)), uV = ult.reduce((a, b) => (b.Vu > a.Vu ? b : a))
  const pU = []
  for (const k of ult) {
    const et = ult.length > 1 ? ` (${k.c.id})` : ''
    pU.push(paso(`Carga última${et}`, 'wu', k.c.id, k.c.w, 't/m'))
    if (Math.abs(k.e) > 1e-6) {
      pU.push(paso('Reacción con el peso', 'qu = (wu + 0.9 W) / B′', `= (${f2(k.c.w)} + ${f2(Wu)}) / ${f3(k.pr.Bp)}`, k.qu, 't/m²'))
      pU.push(paso('Menos el peso, en todo el ancho', 'qd = 0.9 W / B', `= ${f2(Wu)} / ${f2(B)}`, k.qd, 't/m²'))
    } else pU.push(paso('Reacción última neta', 'qu − qd = wu / B', `= ${f2(k.c.w)} / ${f2(B)}`, k.qu - k.qd, 't/m²'))
  }
  const vuelo = Math.max(B / 2 - caras.d, caras.i + B / 2)
  pU.push(paso('Vuelo a la sección crítica', g.muro === 'concreto' ? 'de la cara del muro a la orilla' : 'de t/4 dentro del muro a la orilla', '', vuelo, 'm'))
  secciones.push({ titulo: 'Reacción última del suelo', pasos: pU })

  const V = cortante1D({ Vu: uV.Vu, b: 100, d, h, fc, nombre: 'a d de la cara del muro' })
  checks.push(check('cortante', 'Cortante', V.Vu, V.VcR, 't', { grupo: 'Cortante' }))
  secciones.push({ titulo: 'Cortante por metro', pasos: V.pasos })

  const F = flexion({ Mu: uM.Mu, b: 100, d, h, fc, fy, nombre: 'por metro (transversal)' })
  const pT = revisaParrilla({ arm: arm.t, As: F.As, porMetro: true, sMin: C.sMin, sMax: C.sMax, nombre: 'transversal por metro' })
  checks.push(check('flexion', 'Flexión transversal', F.As, pT.As, 'cm²/m', { grupo: 'Flexión', ok: !F.insuficiente && pT.okAs && pT.okSmax && pT.okSmin, nota: txtArm(arm.t) }))
  // temperatura longitudinal repartida en el ancho B
  const AsL = 0.0018 * B * 100 * h
  const pL = parrilla({ num: arm.l.num, s: arm.l.s, W: B * 100, r })
  const okL = pL.As >= AsL - 1e-6 && arm.l.s <= C.sMax + 1e-6
  checks.push(check('temperatura', 'Longitudinal (temperatura)', AsL, pL.As, 'cm²', { grupo: 'Flexión', ok: okL, nota: `${pL.n}#${arm.l.num}` }))
  secciones.push({
    titulo: 'Flexión transversal y acero longitudinal',
    pasos: [
      ...F.pasos, ...pT.pasos,
      paso('Acero longitudinal por temperatura', 'As,t = 0.0018 B h', `= 0.0018 × ${f0c(B * 100)} × ${f1(h)}`, AsL, 'cm²'),
      paso('Longitudinales', `#${arm.l.num} @ ${fmtS(arm.l.s)} en B`, `${pL.n} varillas`, pL.As, 'cm²', { ok: okL, lim: `≥ ${f2(AsL)} cm²` }),
    ],
  })
  if (pT.apretada) avisos.push(`Transversales a menos de ${C.sMin} cm: sube el # o el peralte.`)

  // anclaje de la transversal
  const A = anclaje({ num: arm.t.num, s: arm.t.s, disponible: vuelo * 100 - r, fc, fy, r, AsReq: F.AsReq, AsProv: pT.As })
  checks.push(check('anclaje', 'Anclaje transversal', A.recto ? A.Ld : A.Ldh, A.disponible, 'cm', { grupo: 'Detallado', ok: A.ok, nota: A.recto ? 'recta' : A.gancho ? 'con gancho' : 'no se desarrolla' }))
  checks.push(check('peralte', 'Peralte mínimo', C.hMin, h, 'cm', { grupo: 'Detallado', nota: `h ≥ ${C.hMin} cm` }))
  secciones.push({ titulo: 'Anclaje y peralte', pasos: [...A.pasos, paso('Peralte mínimo', `h ≥ ${C.hMin} cm`, `h = ${f1(h)}`, h >= (C.hMin) ? 'cumple' : 'no cumple', '', { ok: h >= (C.hMin) })] })

  const Lz = num(g.Lz, 1)
  const nT = Math.floor((Lz * 100 - 2 * r) / arm.t.s) + 1
  const largoT = B - 2 * r / 100 + (A.gancho ? 2 * 12 * v.diam / 100 : 0)
  const cant = {
    concreto: B * h / 100 * Lz, plantilla: B * C.plantilla / 100 * Lz,
    acero: nT * largoT * kgm(v) + pL.n * Lz * 1.05 * kgm(pL.v),
    excavacion: B * (num(S.Df) + C.plantilla / 100) * Lz,
  }
  const ok = checks.every((c) => c.ok)
  return {
    tipo: 'corrida', ok, checks, secciones, avisos, cant,
    datos: { B, h, t, d, xm, lindero, gancho: A.gancho, nL: pL.n, qu: uM.qu - uM.qd, q: sG.q, qe: sG.qe, W, As: F.As, AsReq: F.AsReq, AsL, arm, vuelo },
    resumen: `Zapata corrida ${lindero ? 'de lindero' : 'central'} de ${f2(B)} m × ${f1(h)} cm bajo muro de ${f1(t)} cm, `
      + `transversal ${txtArm(arm.t)}${A.gancho ? ' con gancho' : ''} y ${pL.n}#${arm.l.num} longitudinales, f′c = ${fc} kg/cm²`,
  }
}
const f0c = (v) => v.toFixed(0)

export function proponerCorrida(z, obra = {}) {
  const C = { ...CRITERIOS, ...(obra.criterios || {}) }
  const t = num(z.geo.t, 15)
  let geo = { ...z.geo }
  let minB = Math.max(C.Bmin, arriba(t / 100 + 0.2, 0.05))
  const BMAX = 6, HMAX = 100
  const r = num(z.mat?.r, 5), fc = num(z.mat?.fc, 250), fy = num(z.mat?.fy, 4200)
  let arm = { t: { num: 4, s: 20, ...(z.arm?.t || {}) }, l: { num: 3, s: 25, ...(z.arm?.l || {}) } }
  const R0 = (gg, a = arm) => revisarCorrida({ ...z, geo: gg, arm: a }, obra)
  const pasa = (R, ids) => ids.every((id) => R.checks.find((c) => c.id === id)?.ok)
  const concOk = (R) => pasa(R, ['cortante', 'peralte']) && !R.secciones.some((s) => s.pasos.some((p) => p.v === 'no alcanza'))
  const sube = (v) => Math.round((v + 0.05) * 100) / 100
  const cal = [3, ...C.calibres.filter((n) => n !== 3)]
  let h = Math.max(C.hMin, arriba(num(geo.h, 15), 5))
  let hPiso = C.hMin                  // sólo sube: cuando el acero pide más peralte
  // mismo cierre que la aislada: suelo → peralte → varillas → se revisa todo
  // con las varillas elegidas, y lo que falle mueve B o h
  for (let v = 0; v < 40; v++) {
    let B = minB
    while (B < BMAX && !pasa(R0({ ...geo, B, h }), ['suelo'])) B = sube(B)
    let h2 = hPiso
    while (h2 < HMAX && !concOk(R0({ ...geo, B, h: h2 }))) h2 += 5
    geo = { ...geo, B, h: h2 }
    if (h2 !== h) { h = h2; continue }
    const R = R0(geo)
    const base = { porMetro: true, calibres: cal, sMin: C.sMin, sMax: C.sMax, paso: C.paso }
    const at = proponerParrilla({ ...base, As: R.datos.As, filtro: (n, s) => anclaje({ num: n, s, disponible: R.datos.vuelo * 100 - r, fc, fy, r, AsReq: R.datos.AsReq, AsProv: (100 / s) * varilla(n).area }).ok })
    const al = proponerParrilla({ As: R.datos.AsL, W: B * 100, r, calibres: [3, 4, 5], sMin: C.sMin, sMax: C.sMax, paso: C.paso })
    if (al) arm = { ...arm, l: { num: al.num, s: al.s } }
    if (!at) {
      const sinFiltro = proponerParrilla({ ...base, As: R.datos.As })
      if (!sinFiltro) { if (h >= HMAX) break; h += 5; hPiso = h; geo = { ...geo, h }; minB = Math.max(minB, B); continue }
      // ya no se puede abrir más: queda el acero que pide la flexión y el anclaje avisa
      if (B >= BMAX) { arm = { ...arm, t: { num: sinFiltro.num, s: sinFiltro.s } }; break }
      minB = sube(B); continue
    }
    const nuevo = { t: { num: at.num, s: at.s }, l: al ? { num: al.num, s: al.s } : arm.l }
    const igual = nuevo.t.num === arm.t.num && nuevo.t.s === arm.t.s && nuevo.l.num === arm.l.num && nuevo.l.s === arm.l.s
    arm = nuevo
    const R2 = R0(geo)
    if (R2.ok) break
    if (!igual) continue
    if (!pasa(R2, ['suelo']) && B < BMAX) { minB = sube(B); continue }
    if (!concOk(R2) || !pasa(R2, ['flexion', 'temperatura'])) { if (h >= HMAX) break; h += 5; hPiso = h; geo = { ...geo, h }; continue }
    if (!pasa(R2, ['anclaje'])) { if (B >= BMAX) break; minB = sube(B); continue }
    break
  }
  return { geo, arm }
}
