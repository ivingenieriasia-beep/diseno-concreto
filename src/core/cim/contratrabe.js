// ══════════════════════════════════════════════════════════════
// Zapata corrida con contratrabe, bajo un eje de columnas
//
// Una franja de ancho B y largo L con una contratrabe bw × H a lo largo del
// eje. Método rígido: la presión del suelo es lineal a lo largo (uniforme si
// la resultante cae al centro; trapecial o triangular si no). Con ella:
//   · la contratrabe es una viga invertida: el suelo empuja hacia arriba y las
//     columnas la cargan hacia abajo. Entre columnas tracciona ARRIBA; bajo las
//     columnas, ABAJO. Se diseña con el mismo motor de las trabes de la app;
//   · los aleros (la losa a cada lado de la contratrabe) son voladizos por
//     metro, como una zapata corrida.
// Las columnas van con su x desde el extremo izquierdo de la zapata.
// ══════════════════════════════════════════════════════════════

import { calcFlexion, calcCortante } from '../sectionCalculator'
import { corridasMax } from '../propuesta'
import {
  CRITERIOS, SUELO, MAT, paso, check, f1, f2, f3, arriba, abajo, num,
  capacidadEfectiva, flexion, revisaParrilla, proponerParrilla, parrilla,
  cortante1D, anclaje, varilla, txtArm, kgm, GC,
} from './comun'

export function nuevaContratrabe(nombre = 'ZT-1') {
  const col = (x, P) => ({ x, c: 30, cb: 30, CM: { P, M: 0 }, CV: { P: P * 0.35, M: 0 }, S: { P: 0, M: 0 } })
  return {
    tipo: 'contratrabe', nombre,
    geo: { L: 8.6, B: 1.2, h: 20, bw: 25, H: 70 },
    columnas: [col(0.3, 18), col(4.3, 26), col(8.3, 16)],
    arm: {
      inf: { num: 5, n: 3 }, sup: { num: 5, n: 3 }, est: { num: 3, ramas: 2, s: 20 },
      alero: { num: 4, s: 25 }, long: { num: 3, s: 30 },
    },
    mat: { ...MAT }, suelo: {},
  }
}

const Z = { P: 0, M: 0, V: 0 }

/**
 * Cargas por columna de cada combinación (el sismo en los dos sentidos). El
 * momento de cada columna se lleva al desplante: M + V·H (H en m), con V el
 * cortante de la columna a lo largo del eje.
 */
export function combinacionesContratrabe(columnas, C, Hm = 0) {
  const cols = columnas || []
  const de = (c, k) => { const q = { ...Z, ...(c[k] || {}) }; return { P: num(q.P), M: num(q.M) + num(q.V) * Hm } }
  const serv = cols.map((c) => ({ x: num(c.x), c: num(c.c, 30), P: de(c, 'CM').P + de(c, 'CV').P, M: de(c, 'CM').M + de(c, 'CV').M }))
  const ult = cols.map((c) => ({ x: num(c.x), c: num(c.c, 30), P: C.fcm * de(c, 'CM').P + C.fcv * de(c, 'CV').P, M: C.fcm * de(c, 'CM').M + C.fcv * de(c, 'CV').M }))
  const out = { servicio: [{ id: 'CM + CV', cargas: serv, k: 1 }], ultimas: [{ id: `${C.fcm} CM + ${C.fcv} CV`, cargas: ult }] }
  const hayS = cols.some((c) => Math.abs(de(c, 'S').P) + Math.abs(de(c, 'S').M) > 1e-9)
  if (hayS) {
    for (const sg of [1, -1]) {
      const t = sg > 0 ? '+' : '−'
      out.servicio.push({ id: `CM + CV ${t} S`, k: C.kS, cargas: cols.map((c, i) => ({ ...serv[i], P: serv[i].P + sg * de(c, 'S').P, M: serv[i].M + sg * de(c, 'S').M })) })
      out.ultimas.push({ id: `${C.facc} (CM + CV ${t} S)`, cargas: cols.map((c, i) => ({ ...serv[i], P: C.facc * (serv[i].P + sg * de(c, 'S').P), M: C.facc * (serv[i].M + sg * de(c, 'S').M) })) })
    }
  }
  return out
}

/**
 * Presión lineal del suelo por metro de zapata (t/m) bajo cargas de columna.
 * @returns { R, e, w(x), wNeto(x), wmax, contacto }
 */
export function presionRigida(cargas, L, W = 0) {
  // W: peso centrado (zapata y relleno) que se suma a la resultante
  const R = cargas.reduce((s, c) => s + c.P, 0) + W
  const Mo = cargas.reduce((s, c) => s + c.P * (c.x - L / 2) + c.M, 0)
  const e = R > 0 ? Mo / R : 0
  let w, contacto
  if (Math.abs(e) <= L / 6 + 1e-9) {
    w = (x) => (R / L) * (1 + (12 * e * (x - L / 2)) / (L * L))
    contacto = L
  } else {
    const a = Math.max(1e-6, 3 * (L / 2 - Math.abs(e)))
    contacto = a
    w = e > 0
      ? (x) => (x < L - a ? 0 : (2 * R / a) * (x - (L - a)) / a)
      : (x) => (x > a ? 0 : (2 * R / a) * (a - x) / a)
  }
  const wmax = Math.max(w(0), w(L))
  // lo que carga la contratrabe: la presión menos ese peso, repartido en L
  const wNeto = (x) => w(x) - W / L
  return { R, e, w, wNeto, wmax, contacto, W }
}

/**
 * Cortante y momento a lo largo de la contratrabe. La carga de cada columna se
 * reparte en su ancho c; el momento de columna es un salto en M.
 * Signo: M > 0 tracciona abajo; V > 0 hacia arriba a la izquierda del corte.
 */
export function diagramas(cargas, L, w, n = 480) {
  const xs = new Set()
  for (let i = 0; i <= n; i++) xs.add((L * i) / n)
  for (const c of cargas) for (const d of [-c.c / 200, 0, c.c / 200]) xs.add(Math.min(L, Math.max(0, c.x + d)))
  const X = [...xs].sort((a, b) => a - b)
  const col = (x) => cargas.reduce((s, c) => {
    const a = c.x - c.c / 200, b = c.x + c.c / 200
    return s + c.P * Math.min(1, Math.max(0, (x - a) / Math.max(b - a, 1e-6)))
  }, 0)
  const V = [], M = []
  let Wacc = 0, Macc = 0, xp = 0, wp = w(0), Vp = 0
  for (const x of X) {
    const wx = w(x)
    Wacc += ((wp + wx) / 2) * (x - xp)
    const v = Wacc - col(x)
    Macc += ((Vp + v) / 2) * (x - xp)
    const saltos = cargas.reduce((s, c) => s + (x >= c.x - 1e-9 && xp < c.x - 1e-9 ? c.M : 0), 0)
    Macc += saltos
    V.push(v); M.push(Macc)
    xp = x; wp = wx; Vp = v
  }
  return { X, V, M }
}

/** Envolvente de diseño: M fuera del ancho de las columnas y V a d de sus caras */
function envolvente(dg, cargas, dM) {
  const dentro = (x, extra) => cargas.some((c) => Math.abs(x - c.x) < c.c / 200 + extra - 1e-9)
  let Mp = 0, Mn = 0, Vu = 0, xMp = 0, xMn = 0, xV = 0
  dg.X.forEach((x, i) => {
    if (!dentro(x, 0)) {
      if (dg.M[i] > Mp) { Mp = dg.M[i]; xMp = x }
      if (-dg.M[i] > Mn) { Mn = -dg.M[i]; xMn = x }
    }
    if (!dentro(x, dM / 100) && Math.abs(dg.V[i]) > Vu) { Vu = Math.abs(dg.V[i]); xV = x }
  })
  return { Mp, Mn, Vu, xMp, xMn, xV }
}

function datos(z, obra) {
  const C = { ...CRITERIOS, ...(obra.criterios || {}) }
  const S = { ...SUELO, ...(obra.suelo || {}), ...(z.suelo || {}) }
  const g = z.geo, m = { ...MAT, ...(z.mat || {}) }
  const L = num(g.L, 6), B = num(g.B, 1), h = num(g.h, 20), bw = num(g.bw, 25), H = Math.max(num(g.H, 60), h)
  // espesor equivalente para el peso propio (losa más el alma de la contratrabe)
  const hEq = (B * 100 * h + bw * (H - h)) / (B * 100)
  return { C, S, g, m, L, B, h, bw, H, hEq, fc: num(m.fc, 250), fy: num(m.fy, 4200), r: num(m.r, 5) }
}

export function revisarContratrabe(z, obra = {}) {
  const D = datos(z, obra)
  const { C, S, L, B, h, bw, H, hEq, fc, fy, r } = D
  const arm = {
    inf: { num: 5, n: 3, ...(z.arm?.inf || {}) }, sup: { num: 5, n: 3, ...(z.arm?.sup || {}) },
    est: { num: 3, ramas: 2, s: 20, ...(z.arm?.est || {}) },
    alero: { num: 4, s: 25, ...(z.arm?.alero || {}) }, long: { num: 3, s: 30, ...(z.arm?.long || {}) },
  }
  const cmb = combinacionesContratrabe(z.columnas, C, H / 100)
  const checks = [], secciones = [], avisos = []
  const fuera = (z.columnas || []).filter((c) => num(c.x) - num(c.c, 30) / 200 < -1e-6 || num(c.x) + num(c.c, 30) / 200 > L + 1e-6)
  if (fuera.length) avisos.push(`${fuera.length} columna(s) quedan fuera de la zapata: revisa sus x o el largo L.`)
  if (!(z.columnas || []).length) avisos.push('La contratrabe no tiene columnas.')

  // ── suelo ──
  // con el peso de la zapata y del relleno W (centrado): R = ΣP + W,
  // e = Σ[P (x − L/2) + M] / R y q = R / (B (L − 2|e|)) ≤ qadm; con carga
  // centrada es lo mismo que la hoja (ΣP/(B L) ≤ qe)
  const qadm = num(S.qadm), gs = num(S.gs, 1.6), Df = num(S.Df, 1)
  const W = B * L * (GC * hEq / 100 + gs * Math.max(0, Df - hEq / 100))
  const qeG = capacidadEfectiva({ ...S, h: hEq })
  const pS = [
    paso('Espesor equivalente', 'hₑ = (B h + bw (H − h)) / B', `= (${f1(B * 100)} × ${f1(h)} + ${f1(bw)} × ${f1(H - h)}) / ${f1(B * 100)}`, hEq, 'cm'),
    paso('Peso de la zapata y del relleno', 'W = B L [γc hₑ + γs (Df − hₑ)]', `= ${f2(B)} × ${f2(L)} × (${GC} × ${f2(hEq / 100)} + ${f2(gs)} × ${f2(Math.max(0, Df - hEq / 100))})`, W, 't'),
    { ...qeG.pasos[0], nota: 'qadm menos W/(B L): lo que queda para las columnas' },
  ]
  // en neto, como la hoja: q = R / (B L′) − W/(B L) ≤ qe = k qadm − W/(B L)
  const wA = W / (B * L)
  const sue = cmb.servicio.map((c) => {
    const P = presionRigida(c.cargas, L, W)
    const Lp = L - 2 * Math.abs(P.e)
    const qb = P.R > 0 && Lp > 0 ? P.R / (B * Lp) : Infinity
    const q = qb - wA, qe = c.k * qadm - wA
    return { c, P, Lp, qb, q, qe, u: q / qe, qmax: P.wmax / B }
  })
  for (const s of sue) {
    const et = sue.length > 1 ? ` (${s.c.id})` : ''
    pS.push(paso(`Resultante${et}`, 'R = ΣP + W', `${s.c.cargas.map((k) => f2(k.P)).join(' + ')} + ${f2(W)}`, s.P.R, 't', s.P.R > 0 ? {} : { ok: false, nota: 'la zapata se levanta' }))
    pS.push(paso('Excentricidad', 'e = Σ[P (x − L/2) + M] / R', '', s.P.e, 'm'))
    pS.push(paso('Presión con el peso', 'q′ = R / (B (L − 2|e|))', `= ${f2(s.P.R)} / (${f2(B)} × ${f3(s.Lp)})`, s.qb, 't/m²'))
    pS.push(paso('Presión neta', 'q = q′ − W / (B L)', `= ${f2(s.qb)} − ${f2(wA)}`, s.q, 't/m²', { ok: s.u <= 1, lim: `≤ qe = ${f2(s.qe)}${s.c.k !== 1 ? ` (${s.c.k} qadm − W/A)` : ''}` }))
    if (Math.abs(s.P.e) > L / 6) pS.push(paso('Presión lineal', 'la resultante sale del tercio medio', `contacto en ${f2(s.P.contacto)} m`, s.qmax, 't/m²', { nota: 'la zapata se despega en un extremo' }))
  }
  const sG = sue.reduce((a, b) => (b.u > a.u ? b : a))
  checks.push(check('suelo', 'Presión en el suelo', sG.q, sG.qe, 't/m²', { grupo: 'Suelo', nota: sG.c.id }))
  if (!(sG.P.R > 0)) avisos.push(`Con ${sG.c.id} la zapata se levanta: el sismo le quita más de lo que pesa.`)
  else if (!(sG.u <= 1) && B >= 5) avisos.push(`El suelo pide una zapata de más de ${f2(B)} m de ancho (qadm = ${f2(qadm)} t/m²): conviene losa de cimentación o mejorar el suelo.`)
  if (Math.abs(sG.P.e) > 0.05 * L) avisos.push(`La resultante está a ${f2(sG.P.e)} m del centro: «Centrar la resultante» ajusta los voladizos.`)
  secciones.push({ titulo: 'Presión en el suelo (cargas de servicio, método rígido)', pasos: pS })

  // ── contratrabe ──
  const ve = varilla(arm.est.num), vi = varilla(arm.inf.num), vs = varilla(arm.sup.num)
  const rInf = r + ve.diam + vi.diam / 2, rSup = r + ve.diam + vs.diam / 2
  const dInf = H - rInf, dSup = H - rSup
  // la presión con 0.9 W (el peso que estabiliza no se infla) menos ese peso:
  // lo que de verdad dobla la contratrabe
  const Wu = 0.9 * W
  const ult = cmb.ultimas.map((c) => {
    const P = presionRigida(c.cargas, L, Wu)
    const dg = diagramas(c.cargas, L, P.wNeto)
    return { c, P, dg, env: envolvente(dg, c.cargas, Math.min(dInf, dSup)) }
  })
  const gM = (k) => ult.reduce((a, b) => (b.env[k] > a.env[k] ? b : a))
  const uMp = gM('Mp'), uMn = gM('Mn'), uV = gM('Vu')
  const Mp = uMp.env.Mp, Mn = uMn.env.Mn, Vu = uV.env.Vu
  const xs = (z.columnas || []).map((c) => num(c.x)).sort((a, b) => a - b)
  const claro = xs.length > 1 ? Math.max(...xs.slice(1).map((x, i) => x - xs[i])) : L
  const fI = calcFlexion({ fc, fy, b: bw, h: H, r: rInf, MuTm: Math.max(Mp, 1e-6), varNum: arm.inf.num, varCount: arm.inf.n })
  const fS = calcFlexion({ fc, fy, b: bw, h: H, r: rSup, MuTm: Math.max(Mn, 1e-6), varNum: arm.sup.num, varCount: arm.sup.n })
  const lecho = (f, Mu, a, nombre, d) => {
    const okMR = !f.error && f.MRT >= Mu - 1e-9
    const okMin = !f.error && f.AsTotal >= f.AsMin - 1e-9
    const okMax = !f.error && f.AsTotal <= f.AsMax + 1e-9
    const okB = !f.error && f.bMin <= bw + 1e-9
    return {
      ok: okMR && okMin && okMax && okB,
      pasos: f.error ? [paso(nombre, 'Mu', '', f.error, '', { ok: false })] : [
        paso(`Momento último (${nombre})`, 'Mu', '', Mu, 't·m'),
        paso('Peralte útil', 'd = H − r − ⌀e − db/2', `= ${f1(H)} − ${f1(H - d)}`, d, 'cm'),
        paso('Acero requerido', 'As = ρ b d ≥ As,mín', `ρ = ${f3(f.rhoCalc)}`, Math.max(f.AsCalc, f.AsMin), 'cm²'),
        paso('Armado', `${a.n}#${a.num}`, `= ${a.n} × ${f2(f.vr.area)}`, f.AsTotal, 'cm²', { ok: okMin && okMax, lim: `${f2(f.AsMin)} ≤ As ≤ ${f2(f.AsMax)}` }),
        paso('Momento resistente', 'MR = FR As fy (d − a/2)', `a = ${f2(f.a)} cm`, f.MRT, 't·m', { ok: okMR, lim: `≥ Mu = ${f2(Mu)}` }),
        ...(!okB ? [paso('Ancho mínimo', 'b ≥ 2r + (2n − 1) db', '', f.bMin, 'cm', { ok: false, lim: `bw = ${f1(bw)}` })] : []),
      ],
      MR: f.error ? 0 : f.MRT,
    }
  }
  const LI = lecho(fI, Mp, arm.inf, 'abajo, bajo columnas', dInf)
  const LS = lecho(fS, Mn, arm.sup, 'arriba, entre columnas', dSup)
  checks.push(check('flexionInf', 'Contratrabe abajo (M+)', Mp, LI.MR, 't·m', { grupo: 'Contratrabe', ok: LI.ok, nota: `${arm.inf.n}#${arm.inf.num}` }))
  checks.push(check('flexionSup', 'Contratrabe arriba (M−)', Mn, LS.MR, 't·m', { grupo: 'Contratrabe', ok: LS.ok, nota: `${arm.sup.n}#${arm.sup.num}` }))
  const pD = []
  for (const k of ult) {
    const et = ult.length > 1 ? ` (${k.c.id})` : ''
    pD.push(paso(`Resultante última${et}`, 'Ru = ΣPu + 0.9 W', `+ ${f2(Wu)}`, k.P.R, 't'))
    pD.push(paso('Presión lineal última', 'w(x) = Ru/L (1 + 12 e (x − L/2)/L²)', `e = ${f3(k.P.e)} m`, `${f2(k.P.w(0))} a ${f2(k.P.w(L))}`, 't/m'))
    pD.push(paso('La que dobla la contratrabe', 'w(x) − 0.9 W / L', `− ${f2(Wu / L)}`, `${f2(k.P.wNeto(0))} a ${f2(k.P.wNeto(L))}`, 't/m'))
  }
  pD.push(paso('Momento máximo abajo (bajo columnas)', 'M+ en la cara de la columna', `a ${f2(uMp.env.xMp)} m`, Mp, 't·m'))
  pD.push(paso('Momento máximo arriba (entre columnas)', 'M−', `a ${f2(uMn.env.xMn)} m`, Mn, 't·m'))
  pD.push(paso('Cortante máximo a d de la cara', 'Vu', `a ${f2(uV.env.xV)} m`, Vu, 't'))
  secciones.push({ titulo: 'Contratrabe: presión y diagramas (cargas últimas)', pasos: pD })
  secciones.push({ titulo: 'Contratrabe: flexión', pasos: [...LI.pasos, ...LS.pasos] })

  // cortante con estribos (motor de trabes) a la separación capturada
  const AsU = Math.min(fI.AsTotal || 0, fS.AsTotal || 0)
  const cc = calcCortante({ fc, fy, b: bw, h: H, r: Math.max(rInf, rSup), L: claro, VuTon: Vu, AsUsada: AsU, varEstNum: arm.est.num, nramas: arm.est.ramas, conCompresion: false })
  const Av = arm.est.ramas * ve.area
  const VsR = (0.75 * Av * fy * cc.d) / arm.est.s / 1000
  const VR = cc.Vcr + VsR
  const okSmax = arm.est.s <= cc.SmaxGeom + 1e-6
  const okV = VR >= Vu - 1e-9 && !cc.seccionInsuficiente && okSmax
  checks.push(check('cortanteCT', 'Contratrabe cortante', Vu, VR, 't', { grupo: 'Contratrabe', ok: okV, nota: `E#${arm.est.num} @ ${arm.est.s}` }))
  secciones.push({
    titulo: 'Contratrabe: cortante',
    pasos: [
      paso('Cortante último a d de la cara', 'Vu', '', Vu, 't'),
      paso('Resistencia del concreto', `VcR (${cc.ecVcr})`, `ρ = ${f3(cc.rho)}`, cc.Vcr, 't'),
      paso('Estribos', `E#${arm.est.num}, ${arm.est.ramas} ramas @ ${arm.est.s} cm`, `VsR = FR Av fy d / s = 0.75 × ${f2(Av)} × ${fy} × ${f1(cc.d)} / ${arm.est.s}`, VsR, 't'),
      paso('Resistencia total', 'VR = VcR + VsR', `= ${f2(cc.Vcr)} + ${f2(VsR)}`, VR, 't', { ok: VR >= Vu, lim: `≥ Vu = ${f2(Vu)}` }),
      paso('Separación máxima', 's ≤ s,máx', `${arm.est.s} ≤ ${f1(cc.SmaxGeom)}`, okSmax ? 'cumple' : 'no cumple', '', { ok: okSmax }),
      ...(cc.seccionInsuficiente ? [paso('Sección', 'Vu ≤ VcR + 2.2 FR √f′c b d', '', 'insuficiente: sube H o bw', '', { ok: false })] : []),
    ],
  })

  // ── aleros ──
  const a = Math.max(0, (B - bw / 100) / 2)
  const va = varilla(arm.alero.num)
  const dA = h - r - va.diam / 2
  // el alero: la presión bajo él menos su propio peso y el del relleno encima
  const qdA = 0.9 * (GC * h / 100 + gs * Math.max(0, Df - h / 100))
  const quMax = Math.max(0, Math.max(...ult.map((k) => k.P.wmax)) / B - qdA)
  const MuA = (quMax * a * a) / 2
  const VuA = quMax * Math.max(0, a - dA / 100)
  const FA = flexion({ Mu: MuA, b: 100, d: dA, h, fc, fy, nombre: 'del alero, por metro' })
  const pA = revisaParrilla({ arm: arm.alero, As: FA.As, porMetro: true, sMin: C.sMin, sMax: C.sMax, nombre: 'del alero' })
  const VA = cortante1D({ Vu: VuA, b: 100, d: dA, h, fc, nombre: 'del alero a d de la contratrabe' })
  const AA = anclaje({ num: arm.alero.num, s: arm.alero.s, disponible: a * 100 - r, fc, fy, r, AsReq: FA.AsReq, AsProv: pA.As })
  checks.push(check('flexionAlero', 'Alero flexión', FA.As, pA.As, 'cm²/m', { grupo: 'Aleros', ok: !FA.insuficiente && pA.ok, nota: txtArm(arm.alero) }))
  checks.push(check('cortanteAlero', 'Alero cortante', VA.Vu, VA.VcR, 't', { grupo: 'Aleros' }))
  checks.push(check('anclajeAlero', 'Alero anclaje', AA.recto ? AA.Ld : AA.Ldh, AA.disponible, 'cm', { grupo: 'Aleros', ok: AA.ok, nota: AA.recto ? 'recta' : AA.gancho ? 'con gancho' : 'no se desarrolla' }))
  const AsL = 0.0018 * (B * 100 - bw) * h
  const pL = parrilla({ num: arm.long.num, s: arm.long.s, W: Math.max(1, B * 100 - bw), r })
  const okL = pL.As >= AsL - 1e-6
  checks.push(check('temperatura', 'Losa longitudinal', AsL, pL.As, 'cm²', { grupo: 'Aleros', ok: okL, nota: `${pL.n}#${arm.long.num}` }))
  secciones.push({
    titulo: 'Aleros (por metro)',
    pasos: [
      paso('Vuelo del alero', 'a = (B − bw)/2', `= (${f2(B)} − ${f2(bw / 100)})/2`, a, 'm'),
      paso('Reacción última máxima', 'qu = wu,máx / B', '', quMax, 't/m²'),
      paso('Momento en la cara de la contratrabe', 'Mu = qu a²/2', `= ${f2(quMax)} × ${f2(a)}²/2`, MuA, 't·m/m'),
      ...FA.pasos, ...pA.pasos, ...VA.pasos, ...AA.pasos,
      paso('Longitudinal de la losa (temperatura)', 'As,t = 0.0018 (B − bw) h', '', AsL, 'cm²'),
      paso('Longitudinales', `#${arm.long.num} @ ${arm.long.s}`, `${pL.n} varillas`, pL.As, 'cm²', { ok: okL, lim: `≥ ${f2(AsL)}` }),
    ],
  })
  checks.push(check('peralte', 'Peralte de la losa', C.hMin, h, 'cm', { grupo: 'Detallado', nota: `h ≥ ${C.hMin} cm` }))

  const nE = Math.ceil(L * 100 / arm.est.s) + 1
  const perE = 2 * (bw - 2 * r) / 100 + 2 * (H - 2 * r) / 100 + 0.2
  const nA = Math.floor((L * 100 - 2 * r) / arm.alero.s) + 1
  const cant = {
    concreto: L * (B * h + bw * (H - h) / 100) / 100,
    plantilla: L * B * C.plantilla / 100,
    acero: (arm.inf.n * kgm(vi) + arm.sup.n * kgm(vs)) * (L + 0.6) + nE * perE * kgm(ve) + nA * (B - 2 * r / 100) * kgm(va) + pL.n * L * kgm(pL.v),
    excavacion: L * B * (num(S.Df) + C.plantilla / 100),
  }
  const ok = checks.every((c) => c.ok)
  return {
    tipo: 'contratrabe', ok, checks, secciones, avisos, cant,
    datos: {
      L, B, h, bw, H, a, dInf, dSup, claro, Mp, Mn, Vu, q: sG.q, qe: sG.qe, W,
      diag: uMp.dg, diagN: uMn.dg, presion: { w0: uMp.P.wNeto(0), wL: uMp.P.wNeto(L), e: uMp.P.e }, gancho: AA.gancho,
      AsA: FA.As, AsReqA: FA.AsReq, AsL, arm, fI, fS, cc,
    },
    resumen: `Zapata corrida con contratrabe de ${f2(L)} × ${f2(B)} m, losa de ${f1(h)} cm, contratrabe ${f1(bw)} × ${f1(H)} cm `
      + `con ${arm.inf.n}#${arm.inf.num} abajo, ${arm.sup.n}#${arm.sup.num} arriba y E#${arm.est.num} @ ${arm.est.s}; aleros ${txtArm(arm.alero)}`,
  }
}

/** Voladizos que ponen la resultante de servicio en el centro de la zapata */
export function centrarResultante(z) {
  const cols = z.columnas || []
  if (!cols.length) return null
  const C = CRITERIOS
  const serv = combinacionesContratrabe(cols, C, num(z.geo.H, 60) / 100).servicio[0].cargas
  const R = serv.reduce((s, c) => s + c.P, 0)
  if (R <= 0) return null
  const x1 = Math.min(...serv.map((c) => c.x)), xn = Math.max(...serv.map((c) => c.x))
  const span = xn - x1
  const xg = serv.reduce((s, c) => s + c.P * (c.x - x1) + c.M, 0) / R    // desde la primera columna
  let a = x1, b = num(z.geo.L) - xn
  const cMin = Math.max(...cols.map((c) => num(c.c, 30))) / 200
  a = Math.max(a, cMin); b = Math.max(b, cMin)
  // L/2 = a + xg  →  b = a + 2 xg − span; si no alcanza, se estira el otro lado
  let bb = a + 2 * xg - span
  if (bb < cMin) { bb = cMin; a = span - 2 * xg + bb }
  a = arriba(a, 0.05); bb = arriba(bb, 0.05)
  const L = a + span + bb
  const dx = a - x1
  return { geo: { ...z.geo, L: Math.round(L * 100) / 100 }, columnas: cols.map((c) => ({ ...c, x: Math.round((num(c.x) + dx) * 1000) / 1000 })) }
}

export function proponerContratrabe(z, obra = {}) {
  const C = { ...CRITERIOS, ...(obra.criterios || {}) }
  let geo = { ...z.geo }
  const bw = num(geo.bw, 25)
  const r = num(z.mat?.r, 5), fc = num(z.mat?.fc, 250), fy = num(z.mat?.fy, 4200)
  let arm = { ...nuevaContratrabe().arm, ...(z.arm || {}) }
  const R0 = (g, a = arm) => revisarContratrabe({ ...z, geo: g, arm: a }, obra)
  const ok = (R, ids) => ids.every((id) => R.checks.find((c) => c.id === id).ok)
  const minB = Math.max(C.Bmin, arriba(bw / 100 + 0.4, 0.05))           // aleros de 20 cm o más
  // ancho por suelo y losa por los aleros, hasta que se estabilizan
  for (let v = 0; v < 8; v++) {
    let B = minB
    for (; B <= 6; B = Math.round((B + 0.05) * 100) / 100) if (ok(R0({ ...geo, B }), ['suelo'])) break
    let h = C.hMin
    for (; h <= 80; h += 5) {
      const R = R0({ ...geo, B, h })
      if (ok(R, ['cortanteAlero']) && !R.secciones.some((s) => s.pasos.some((p) => p.v === 'no alcanza'))) break
    }
    const estable = B === geo.B && h === geo.h
    geo = { ...geo, B, h }
    if (estable) break
  }
  // contratrabe: de los anchos de alma que se prueban, la sección con menos
  // concreto (bw × H) en la que caben las varillas y los estribos
  const cand = [4, 5, 6, 8]
  const eleg = (Mu, rEff, H, b) => {
    let mejor = null
    for (const n of cand) {
      const f = calcFlexion({ fc, fy, b, h: H, r: rEff, MuTm: Math.max(Mu, 1e-6), varNum: n, varCount: 2 })
      if (f.error) continue
      const req = Math.max(f.AsCalc, f.AsMin)
      const k = Math.max(2, Math.ceil(req / f.vr.area - 1e-9))
      if (k > corridasMax(b)) continue
      const g = calcFlexion({ fc, fy, b, h: H, r: rEff, MuTm: Math.max(Mu, 1e-6), varNum: n, varCount: k })
      if (g.error || !g.okMax || !g.okBmin || !g.okMR) continue
      if (!mejor || g.AsTotal < mejor.As - 1e-6) mejor = { num: n, n: k, As: g.AsTotal }
    }
    return mejor
  }
  const anchos = [...new Set([bw, 25, 30, 35, 40].filter((b) => b >= bw))]
  let sol = null
  for (const b of anchos) {
    const gB = { ...geo, bw: b, B: Math.max(num(geo.B), arriba(b / 100 + 0.4, 0.05)) }
    for (let H = Math.max(num(gB.h) + 25, 40); H <= 200; H += 5) {
      const R = R0({ ...gB, H })
      const rE = r + 0.95 + 1.6 / 2
      const ai = eleg(R.datos.Mp, rE, H, b), as = eleg(R.datos.Mn, rE, H, b)
      if (!ai || !as) continue
      const cc = calcCortante({ fc, fy, b, h: H, r: rE, L: R.datos.claro, VuTon: R.datos.Vu, AsUsada: Math.min(ai.As, as.As), varEstNum: 3, nramas: 2, conCompresion: false })
      if (cc.seccionInsuficiente || cc.Suso < 10) continue
      const s = Math.max(10, abajo(Math.min(cc.Suso, cc.SmaxGeom, C.sMax), 2.5))
      const a2 = { ...arm, inf: { num: ai.num, n: ai.n }, sup: { num: as.num, n: as.n }, est: { num: 3, ramas: 2, s } }
      if (!ok(R0({ ...gB, H }, a2), ['flexionInf', 'flexionSup', 'cortanteCT'])) continue
      if (!sol || b * H < sol.b * sol.H - 1e-9) sol = { b, H, arm: a2, geo: gB }
      break
    }
  }
  let H = num(geo.H, 60)
  if (sol) { geo = { ...sol.geo }; H = sol.H; arm = sol.arm }
  geo = { ...geo, H }
  // losa: aleros y longitudinales con el peralte de la varilla elegida
  const armaLosa = () => {
    const R = R0(geo)
    const a = R.datos.a
    const pa = proponerParrilla({ As: R.datos.AsA, porMetro: true, calibres: [3, ...C.calibres.filter((n) => n !== 3)], sMin: C.sMin, sMax: C.sMax, paso: C.paso, filtro: (n, s) => anclaje({ num: n, s, disponible: a * 100 - r, fc, fy, r, AsReq: R.datos.AsReqA, AsProv: (100 / s) * varilla(n).area }).ok })
    const pl = proponerParrilla({ As: R.datos.AsL, W: Math.max(1, geo.B * 100 - num(geo.bw, bw)), r, calibres: [3, 4, 5], sMin: C.sMin, sMax: C.sMax, paso: C.paso })
    arm = { ...arm, alero: pa ? { num: pa.num, s: pa.s } : arm.alero, long: pl ? { num: pl.num, s: pl.s } : arm.long }
    return !!pa
  }
  // cierre: se revisa todo con lo elegido; lo que falle mueve B, h o H
  const sube = (v) => Math.round((v + 0.05) * 100) / 100
  for (let i = 0; i < 40; i++) {
    const alcanza = armaLosa()
    const R = R0(geo)
    if (R.ok) break
    if (!ok(R, ['suelo']) && num(geo.B) < 6) { geo = { ...geo, B: sube(num(geo.B)) }; continue }
    if (!alcanza || !ok(R, ['flexionAlero', 'cortanteAlero', 'anclajeAlero', 'temperatura', 'peralte'])) {
      if (num(geo.h) >= 80) break
      geo = { ...geo, h: num(geo.h) + 5 }; continue
    }
    if (!ok(R, ['flexionInf', 'flexionSup', 'cortanteCT'])) {
      if (num(geo.H) >= 200) break
      const H2 = num(geo.H) + 5, b = num(geo.bw, bw), rE = r + 0.95 + 1.6 / 2
      const R2 = R0({ ...geo, H: H2 })
      const ai = eleg(R2.datos.Mp, rE, H2, b), as = eleg(R2.datos.Mn, rE, H2, b)
      geo = { ...geo, H: H2 }
      if (ai && as) arm = { ...arm, inf: { num: ai.num, n: ai.n }, sup: { num: as.num, n: as.n } }
      continue
    }
    break
  }
  return { geo, arm }
}
