// ══════════════════════════════════════════════════════════════
// Muro de contención de concreto en voladizo — hoja «Muro Contención»
//
// Pantalla con la cara del relleno vertical y la del frente inclinada (tc
// arriba, tb abajo), base de espesor hz con punta y talón, dentellón opcional.
// Empuje de Rankine sobre el plano vertical que pasa por el talón (con relleno
// inclinado β y sobrecarga q), pasivo opcional frente a la punta.
//   Estabilidad con cargas de servicio: volteo (FS ≥ 2), deslizamiento (FS ≥
//   1.5), resultante en el tercio medio y qmáx ≤ qadm.
//   Concreto con cargas factorizadas: empuje × 1.5 (hoja), pesos × 1.3,
//   sobrecarga × 1.5. Pantalla con varillas corridas más bastones intercalados
//   que se cortan donde las corridas ya alcanzan; talón y punta como voladizos.
// Correcciones sobre la hoja: la punta se diseñaba con la presión de servicio
// y tomaba la longitud de desarrollo como presión; el talón restaba qmín; la
// revisión de separaciones de bastones pedía lo contrario. Coordenadas: x desde
// la punta hacia el talón, y desde el fondo de la base. Todo por metro de muro.
// ══════════════════════════════════════════════════════════════

import {
  CRITERIOS, SUELO, MAT, GC, paso, check, f1, f2, f3, arriba, num,
  flexion, revisaParrilla, proponerParrilla, cortante1D, anclaje, varilla, txtArm, kgm, momentoResistente,
} from './comun'
import { rankine } from './suelo'

export function nuevaContencion(nombre = 'MC-1') {
  return {
    tipo: 'contencion', nombre,
    geo: { H: 3.0, tc: 0.2, tb: 0.3, punta: 0.6, talon: 1.3, hz: 0.35, hk: 0, bk: 0.3, Df: 0.8, beta: 0, q: 1.0, pasivo: true, Lz: 10 },
    arm: {
      pv: { num: 5, s: 25 }, bast: { num: 5, s: 25, on: true },
      pe: { num: 3, s: 30 }, ph: { num: 3, s: 30 },
      ts: { num: 4, s: 20 }, pi: { num: 4, s: 20 }, pl: { num: 3, s: 20 },
    },
    mat: { ...MAT }, suelo: {},
  }
}

const rad = (g) => (g * Math.PI) / 180

/** Geometría y fuerzas por metro */
export function fuerzasMuro(z, obra = {}) {
  const S = { ...SUELO, ...(obra.suelo || {}), ...(z.suelo || {}) }
  const g = z.geo
  const H = num(g.H, 3), tc = num(g.tc, 0.2), tb = Math.max(num(g.tb, 0.3), tc), p = num(g.punta, 0.5), tal = num(g.talon, 1.2)
  const hz = num(g.hz, 0.35), hk = Math.max(0, num(g.hk, 0)), bk = num(g.bk, 0.3), Df = num(g.Df, 0.8)
  const beta = Math.max(0, Math.min(num(g.beta, 0), num(S.phi) - 1)), q = Math.max(0, num(g.q, 0))
  const B = p + tb + tal, Hs = H - hz
  const gs = num(S.gs, 1.6)
  const { Ka } = rankine(num(S.phi, 30), beta)
  const Kp = rankine(num(S.phiB ?? S.phi, 30)).Kp
  const Ha = H + tal * Math.tan(rad(beta))
  const cb = Math.cos(rad(beta)), sb = Math.sin(rad(beta))
  const Pa = 0.5 * gs * Ka * Ha * Ha
  const Pq = Ka * q * Ha
  const xb = p + tb                                           // cara del relleno
  const W = [
    { id: 'Base', W: GC * B * hz, x: B / 2 },
    { id: 'Pantalla (rectángulo)', W: GC * tc * Hs, x: xb - tc / 2 },
    { id: 'Pantalla (triángulo)', W: GC * (tb - tc) * Hs / 2, x: p + (2 * (tb - tc)) / 3 },
    { id: 'Relleno sobre el talón', W: gs * tal * Hs, x: xb + tal / 2 },
  ]
  if (beta > 0) W.push({ id: 'Cuña del talud', W: gs * tal * tal * Math.tan(rad(beta)) / 2, x: xb + (2 * tal) / 3 })
  if (hk > 0) W.push({ id: 'Dentellón', W: GC * bk * hk, x: p + bk / 2 })
  const Wq = q * tal, xq = xb + tal / 2
  const D = Df + hk
  const gsB = num(S.gsB, gs)                                  // suelo de apoyo (pasivo)
  const Pp = z.geo.pasivo === false ? 0 : 0.5 * gsB * Kp * D * D + 2 * num(S.c) * Math.sqrt(Kp) * D
  return { S, H, tc, tb, p, tal, hz, hk, bk, Df, beta, q, B, Hs, gs, Ka, Kp, Ha, cb, sb, Pa, Pq, W, Wq, xq, xb, D, Pp }
}

/** Presión del suelo bajo la base (lineal, sin tensión) para N con resultante a xr de la punta */
function presionBase(N, xr, B) {
  const e = B / 2 - xr
  if (Math.abs(e) <= B / 6 + 1e-9) {
    const q1 = (N / B) * (1 + (6 * e) / B), q2 = (N / B) * (1 - (6 * e) / B)
    return { e, qmax: q1, qmin: q2, q: (x) => q1 + (q2 - q1) * (x / B), contacto: B }
  }
  const a = Math.max(1e-6, 3 * xr)
  const qm = (2 * N) / a
  return { e, qmax: qm, qmin: 0, q: (x) => (x < a ? qm * (1 - x / a) : 0), contacto: a }
}

/** Integral numérica simple de f en [a, b] */
const integra = (f, a, b, n = 200) => {
  if (b <= a) return 0
  const h = (b - a) / n
  let s = 0.5 * (f(a) + f(b))
  for (let i = 1; i < n; i++) s += f(a + i * h)
  return s * h
}

export function revisarContencion(z, obra = {}) {
  const C = { ...CRITERIOS, ...(obra.criterios || {}) }
  const m = { ...MAT, ...(z.mat || {}) }
  const fc = num(m.fc, 250), fy = num(m.fy, 4200), r = num(m.r, 5)
  const F = fuerzasMuro(z, obra)
  const { S, H, tc, tb, p, tal, hz, B, Hs, gs, Ka, Kp, Ha, cb, sb, Pa, Pq, W, Wq, xq, xb, D, Pp, beta, q } = F
  const A0 = nuevaContencion().arm
  const arm = Object.fromEntries(Object.keys(A0).map((k) => [k, { ...A0[k], ...(z.arm?.[k] || {}) }]))
  const checks = [], secciones = [], avisos = []

  // ── estabilidad (servicio) ──
  const Pah = Pa * cb, Pav = Pa * sb, Pqh = Pq * cb, Pqv = Pq * sb
  const SW = W.reduce((s, w) => s + w.W, 0)
  const Mr = W.reduce((s, w) => s + w.W * w.x, 0) + (Pav + Pqv) * B
  const Mv = Pah * Ha / 3 + Pqh * Ha / 2
  const FSv = Mv > 0 ? Mr / Mv : Infinity
  const N = SW + Pav + Pqv
  const mu = Math.tan(rad((2 / 3) * num(S.phiB ?? S.phi, 30)))
  const Fr = N * mu + (2 / 3) * num(S.c) * B + Pp
  const Fh = Pah + Pqh
  const FSd = Fh > 0 ? Fr / Fh : Infinity
  const N2 = N + Wq
  const xr = (Mr + Wq * xq - Mv) / N2
  const pb = presionBase(N2, xr, B)
  checks.push(check('volteo', 'Volteo', C.fsVolteo, FSv, 'FS', { grupo: 'Estabilidad', nota: `FS = ${f2(FSv)}` }))
  checks.push(check('deslizamiento', 'Deslizamiento', C.fsDesl, FSd, 'FS', { grupo: 'Estabilidad', nota: `FS = ${f2(FSd)}` }))
  checks.push(check('excentricidad', 'Resultante en el tercio medio', Math.abs(pb.e), B / 6, 'm', { grupo: 'Estabilidad', nota: `e = ${f3(pb.e)}` }))
  checks.push(check('suelo', 'Presión máxima', pb.qmax, num(S.qadm), 't/m²', { grupo: 'Estabilidad' }))
  secciones.push({
    titulo: 'Empujes (por metro de muro)',
    pasos: [
      paso('Coeficiente activo', beta > 0 ? 'Ka = cos β (cos β − √(cos²β − cos²φ)) / (cos β + √(…))' : 'Ka = tan²(45 − φ/2)', `φ = ${f1(num(S.phi))}°${beta > 0 ? `, β = ${f1(beta)}°` : ''}`, Ka, ''),
      paso('Altura del empuje', 'Ha = H + talón · tan β', `= ${f2(H)} + ${f2(tal)} × tan ${f1(beta)}°`, Ha, 'm'),
      paso('Empuje activo', 'Pa = ½ γ Ka Ha²', `= ½ × ${f2(gs)} × ${f3(Ka)} × ${f2(Ha)}²`, Pa, 't'),
      ...(q > 0 ? [paso('Empuje de la sobrecarga', 'Pq = Ka q Ha', `= ${f3(Ka)} × ${f2(q)} × ${f2(Ha)}`, Pq, 't')] : []),
      ...(Pp > 0 ? [paso('Empuje pasivo frente a la punta', 'Pp = ½ γ Kp D² + 2c √Kp D', `Kp = ${f3(Kp)}, D = Df + dentellón = ${f2(D)} m`, Pp, 't')] : []),
    ],
  })
  secciones.push({
    titulo: 'Pesos y momentos respecto a la punta',
    pasos: [
      ...W.map((w) => paso(w.id, 'W · x', `${f3(w.W)} t × ${f3(w.x)} m`, w.W * w.x, 't·m')),
      ...(Pav > 0 ? [paso('Componente vertical del empuje', 'Pa sen β · B', '', (Pav + Pqv) * B, 't·m')] : []),
      paso('Suma de pesos', 'ΣW', '', SW, 't'),
      paso('Momento resistente', 'Mr = Σ W x', '', Mr, 't·m'),
      paso('Momento de volteo', 'Mv = Pa cos β · Ha/3 + Pq cos β · Ha/2', '', Mv, 't·m'),
    ],
  })
  secciones.push({
    titulo: 'Estabilidad',
    pasos: [
      paso('Volteo', 'FS = Mr / Mv', `= ${f2(Mr)} / ${f2(Mv)}`, FSv, '', { ok: FSv >= C.fsVolteo, lim: `≥ ${C.fsVolteo}` }),
      paso('Fricción en la base', 'μ = tan(⅔ φ)', `φ = ${f1(num(S.phiB ?? S.phi))}°`, mu, ''),
      paso('Fuerza resistente', 'FR = N μ + ⅔ c B + Pp', `= ${f2(N)} × ${f3(mu)} + ⅔ × ${f2(num(S.c))} × ${f2(B)} + ${f2(Pp)}`, Fr, 't'),
      paso('Deslizamiento', 'FS = FR / ΣH', `= ${f2(Fr)} / ${f2(Fh)}`, FSd, '', { ok: FSd >= C.fsDesl, lim: `≥ ${C.fsDesl}` }),
      paso('Posición de la resultante', 'x = (Mr + Wq xq − Mv) / N', `= (${f2(Mr)} + ${f2(Wq * xq)} − ${f2(Mv)}) / ${f2(N2)}`, xr, 'm'),
      paso('Excentricidad', 'e = B/2 − x', `= ${f2(B / 2)} − ${f3(xr)}`, pb.e, 'm', { ok: Math.abs(pb.e) <= B / 6 + 1e-9, lim: `≤ B/6 = ${f3(B / 6)}` }),
      paso('Presiones', Math.abs(pb.e) <= B / 6 ? 'q = N/B (1 ± 6e/B)' : 'q = 2N / (3x)', `mín ${f2(pb.qmin)}`, pb.qmax, 't/m²', { ok: pb.qmax <= num(S.qadm), lim: `≤ qadm = ${f2(num(S.qadm))}` }),
    ],
  })

  // ── concreto (factorizado) ──
  const FCe = C.fcEmpuje
  const Nu = C.fcm * SW + C.fcv * Wq + FCe * (Pav + Pqv)
  const Mru = C.fcm * W.reduce((s, w) => s + w.W * w.x, 0) + C.fcv * Wq * xq + FCe * (Pav + Pqv) * B
  const Mvu = FCe * Mv
  const pu = presionBase(Nu, (Mru - Mvu) / Nu, B)

  // pantalla
  const vPv = varilla(arm.pv.num)
  const tz = (zz) => tc + (tb - tc) * (zz / Hs)                // espesor a la profundidad zz
  const dz = (zz) => tz(zz) * 100 - r - vPv.diam / 2
  const Vz = (zz) => FCe * (0.5 * Ka * gs * zz * zz + Ka * q * zz) * cb
  const Mz = (zz) => FCe * (Ka * gs * zz ** 3 / 6 + Ka * q * zz * zz / 2) * cb
  const dB = dz(Hs)
  const MuP = Mz(Hs), VuP = Vz(Math.max(0, Hs - dB / 100))
  const FP = flexion({ Mu: MuP, b: 100, d: dB, h: tb * 100, fc, fy, nombre: 'en la base de la pantalla' })
  const asCorr = (100 / arm.pv.s) * vPv.area
  const vB = varilla(arm.bast.num)
  const asBast = arm.bast.on ? (100 / arm.bast.s) * vB.area : 0
  const AsP = asCorr + asBast
  const okPs = arm.pv.s <= C.sMax + 1e-6 && (!arm.bast.on || arm.bast.s <= C.sMax + 1e-6)
  const okP = !FP.insuficiente && AsP >= FP.As - 1e-6 && okPs
  const VP = cortante1D({ Vu: VuP, b: 100, d: dB, h: tb * 100, fc, nombre: 'a d de la base de la pantalla' })
  checks.push(check('pantallaM', 'Pantalla flexión', FP.As, AsP, 'cm²/m', { grupo: 'Pantalla', ok: okP, nota: `${txtArm(arm.pv)}${arm.bast.on ? ` + bastones ${txtArm(arm.bast)}` : ''}` }))
  checks.push(check('pantallaV', 'Pantalla cortante', VP.Vu, VP.VcR, 't', { grupo: 'Pantalla' }))
  // corte de bastones: altura donde las corridas solas ya alcanzan
  let hCorte = 0, Lb = 0
  if (arm.bast.on) {
    let zc = Hs
    for (let zz = 0; zz <= Hs + 1e-9; zz += Hs / 400) {
      if (Mz(zz) > momentoResistente({ As: asCorr, b: 100, d: dz(zz), fc, fy })) { zc = zz; break }
    }
    hCorte = Math.max(0, Hs - zc)
    const Ld = anclaje({ num: arm.bast.num, s: arm.bast.s, disponible: 0, fc, fy, r }).Ld
    Lb = arriba(Math.max(hCorte + Math.max(dB, 12 * vB.diam) / 100, Ld / 100), 0.05)
    Lb = Math.min(Lb, Hs)
  }
  const anc = anclaje({ num: arm.pv.num, s: arm.pv.s, disponible: hz * 100 - r - 2 * varilla(arm.pi.num).diam, fc, fy, r, AsReq: FP.AsReq, AsProv: AsP })
  checks.push(check('pantallaAnc', 'Pantalla anclaje en la base', anc.Ldh, anc.disponible, 'cm', { grupo: 'Pantalla', ok: anc.ok, nota: 'con gancho a 90°' }))
  const tMed = (tc + tb) / 2 * 100
  const AsTempP = 0.0018 * 100 * tMed
  const asPh = (100 / arm.ph.s) * varilla(arm.ph.num).area, asPe = (100 / arm.pe.s) * varilla(arm.pe.num).area
  const okT = asPh >= AsTempP / 2 - 1e-6 && asPe >= AsTempP / 2 - 1e-6 && arm.ph.s <= C.sMax + 1e-6 && arm.pe.s <= C.sMax + 1e-6
  checks.push(check('pantallaT', 'Pantalla temperatura', AsTempP / 2, Math.min(asPh, asPe), 'cm²/m', { grupo: 'Pantalla', ok: okT, nota: `H ${txtArm(arm.ph)} · ext ${txtArm(arm.pe)}` }))
  secciones.push({
    titulo: 'Pantalla (empuje × ' + FCe + ')',
    pasos: [
      paso('Altura de la pantalla', 'Hs = H − hz', `= ${f2(H)} − ${f2(hz)}`, Hs, 'm'),
      paso('Momento en la base', 'Mu = FC (Ka γ Hs³/6 + Ka q Hs²/2)', `= ${FCe} (${f3(Ka)} × ${f2(gs)} × ${f2(Hs)}³/6 + ${f3(Ka)} × ${f2(q)} × ${f2(Hs)}²/2)`, MuP, 't·m'),
      ...FP.pasos.slice(1),
      paso('Acero colocado', arm.bast.on ? 'corridas + bastones intercalados' : 'corridas', `${f2(asCorr)}${arm.bast.on ? ` + ${f2(asBast)}` : ''}`, AsP, 'cm²/m', { ok: AsP >= FP.As - 1e-6, lim: `≥ ${f2(FP.As)}` }),
      ...(arm.bast.on ? [
        paso('Corte teórico de los bastones', 'donde Mu(z) = MR de las corridas', '', hCorte, 'm', { nota: 'desde la base' }),
        paso('Largo de los bastones', 'corte + máx(d, 12db), ≥ Ld', '', Lb, 'm'),
      ] : []),
      ...VP.pasos,
      ...anc.pasos,
      paso('Temperatura (por cara)', 'As = 0.0018 · 100 · t̄ / 2', `t̄ = ${f1(tMed)} cm`, AsTempP / 2, 'cm²/m'),
      paso('Horizontales y vertical exterior', `${txtArm(arm.ph)} · ${txtArm(arm.pe)}`, '', Math.min(asPh, asPe), 'cm²/m', { ok: okT, lim: `≥ ${f2(AsTempP / 2)}` }),
    ],
  })

  // talón (cara del relleno) y punta (cara del frente)
  const vTs = varilla(arm.ts.num), vPi = varilla(arm.pi.num)
  const dT = hz * 100 - r - vTs.diam / 2, dPu = hz * 100 - r - vPi.diam / 2
  const tanb = Math.tan(rad(beta))
  const abajoTal = (x) => C.fcm * (gs * (Hs + (x - xb) * tanb) + GC * hz) + C.fcv * q
  const netoT = (x) => abajoTal(x) - pu.q(x)
  const MuT = Math.max(0, integra((x) => netoT(x) * (x - xb), xb, B))
  const VuT = Math.abs(integra(netoT, xb, B))
  const netoP = (x) => pu.q(x) - C.fcm * GC * hz
  const MuPu = Math.max(0, integra((x) => netoP(x) * (p - x), 0, p))
  const VuPu = Math.max(0, integra(netoP, 0, Math.max(0, p - dPu / 100)))
  const FT = flexion({ Mu: MuT, b: 100, d: dT, h: hz * 100, fc, fy, nombre: 'del talón (arriba)' })
  const FPu = flexion({ Mu: MuPu, b: 100, d: dPu, h: hz * 100, fc, fy, nombre: 'de la punta (abajo)' })
  const pT = revisaParrilla({ arm: arm.ts, As: FT.As, porMetro: true, sMin: C.sMin, sMax: C.sMax, nombre: 'superior del talón' })
  const pPu = revisaParrilla({ arm: arm.pi, As: FPu.As, porMetro: true, sMin: C.sMin, sMax: C.sMax, nombre: 'inferior de la punta' })
  const VT = cortante1D({ Vu: VuT, b: 100, d: dT, h: hz * 100, fc, nombre: 'del talón en la cara' })
  const VPu = cortante1D({ Vu: VuPu, b: 100, d: dPu, h: hz * 100, fc, nombre: 'de la punta a d de la cara' })
  checks.push(check('talonM', 'Talón flexión', FT.As, pT.As, 'cm²/m', { grupo: 'Base', ok: !FT.insuficiente && pT.ok, nota: txtArm(arm.ts) }))
  checks.push(check('talonV', 'Talón cortante', VT.Vu, VT.VcR, 't', { grupo: 'Base' }))
  checks.push(check('puntaM', 'Punta flexión', FPu.As, pPu.As, 'cm²/m', { grupo: 'Base', ok: !FPu.insuficiente && pPu.ok, nota: txtArm(arm.pi) }))
  checks.push(check('puntaV', 'Punta cortante', VPu.Vu, VPu.VcR, 't', { grupo: 'Base' }))
  const AsTB = 0.0018 * 100 * hz * 100
  const asPl = (100 / arm.pl.s) * varilla(arm.pl.num).area
  const okPl = asPl >= AsTB / 2 - 1e-6 && arm.pl.s <= C.sMax + 1e-6
  checks.push(check('baseT', 'Base longitudinal', AsTB / 2, asPl, 'cm²/m', { grupo: 'Base', ok: okPl, nota: `${txtArm(arm.pl)} por cara` }))
  secciones.push({
    titulo: 'Presión última bajo la base',
    pasos: [
      paso('Carga vertical última', `Nu = ${C.fcm} ΣW + ${C.fcv} q·talón + ${FCe} Pa sen β`, '', Nu, 't'),
      paso('Momento de volteo último', `${FCe} Mv`, '', Mvu, 't·m'),
      paso('Presiones últimas', 'lineales, sin tensión', `punta ${f2(pu.q(0))} · talón ${f2(pu.q(B))}`, pu.qmax, 't/m²'),
    ],
  })
  secciones.push({ titulo: 'Talón', pasos: [paso('Momento en la cara del relleno', 'Mu = ∫ (pesos × 1.3 + q × 1.5 − qu) x dx', '', MuT, 't·m'), ...FT.pasos.slice(1), ...pT.pasos, ...VT.pasos] })
  secciones.push({ titulo: 'Punta', pasos: [paso('Momento en la cara del frente', 'Mu = ∫ (qu − 1.3 γc hz) x dx', '', MuPu, 't·m'), ...FPu.pasos.slice(1), ...pPu.pasos, ...VPu.pasos, paso('Longitudinal de la base (por cara)', 'As = 0.0018 · 100 · hz / 2', '', AsTB / 2, 'cm²/m', { ok: okPl, lim: `${txtArm(arm.pl)} = ${f2(asPl)}` })] })

  const Lz = num(z.geo.Lz, 1)
  const kg = (a, largo) => (100 / a.s) * largo * kgm(varilla(a.num))
  const cant = {
    concreto: (B * hz + (tc + tb) / 2 * Hs + F.bk * F.hk) * Lz,
    plantilla: B * C.plantilla / 100 * Lz,
    acero: Lz * (kg(arm.pv, Hs + 0.5) + (arm.bast.on ? kg(arm.bast, Lb + 0.4) : 0) + kg(arm.pe, Hs + 0.3) + 2 * kg(arm.ph, 1) * Hs
      + kg(arm.ts, B) + kg(arm.pi, B) + 2 * kg(arm.pl, 1) * B),
    excavacion: (B + 0.6) * (H + 0.1) * Lz,
  }
  const ok = checks.every((c) => c.ok)
  return {
    tipo: 'contencion', ok, checks, secciones, avisos, cant,
    datos: { ...F, FSv, FSd, pb, pu, MuP, AsP, hCorte, Lb, FP, FT, FPu, arm, N2, xr, AsTempP, AsTB },
    resumen: `Muro de contención de ${f2(H)} m: pantalla ${f0t(tc)}–${f0t(tb)} cm con ${txtArm(arm.pv)}${arm.bast.on ? ` + bastones ${txtArm(arm.bast)} de ${f2(Lb)} m` : ''}, `
      + `base de ${f2(B)} × ${f0t(hz)} cm (punta ${f2(p)}, talón ${f2(tal)}), talón ${txtArm(arm.ts)} arriba y punta ${txtArm(arm.pi)} abajo`,
  }
}
const f0t = (m) => (m * 100).toFixed(0)

export function proponerContencion(z, obra = {}) {
  const C = { ...CRITERIOS, ...(obra.criterios || {}) }
  const H = num(z.geo.H, 3)
  let geo = { ...z.geo }
  let arm = { ...nuevaContencion().arm, ...(z.arm || {}) }
  const R0 = (g, a = arm) => revisarContencion({ ...z, geo: g, arm: a }, obra)
  const pasa = (R, ids) => ids.every((id) => R.checks.find((c) => c.id === id).ok)
  // pantalla y base proporcionadas, luego se ensancha la base hasta que es estable
  let tc = Math.max(0.2, num(geo.tc, 0.2)), tb = Math.max(tc, arriba(H / 12, 0.05)), hz = Math.max(0.25, arriba(H / 12, 0.05))
  for (let v = 0; v < 8; v++) {
    const fr = 0.3
    let B = Math.max(1.0, arriba(0.4 * H, 0.05)), g = null, hk = 0
    for (; B <= 2 * H + 1; B = Math.round((B + 0.05) * 100) / 100) {
      const punta = Math.max(0.3, arriba(fr * B, 0.05)), talon = Math.max(0.3, Math.round((B - punta - tb) * 100) / 100)
      g = { ...geo, tc, tb, hz, punta, talon, hk: 0 }
      const R = R0(g)
      if (pasa(R, ['volteo', 'excentricidad', 'suelo'])) {
        if (pasa(R, ['deslizamiento'])) break
        // dentellón antes que una base enorme
        for (hk = 0.3; hk <= 0.9; hk += 0.1) if (pasa(R0({ ...g, hk }), ['deslizamiento'])) break
        if (hk <= 0.9) { g = { ...g, hk: Math.round(hk * 10) / 10, bk: Math.max(0.3, tb) }; break }
      }
    }
    // espesores: pantalla por cortante y flexión; base por talón y punta
    let tb2 = tb
    for (; tb2 <= 1.2; tb2 = Math.round((tb2 + 0.05) * 100) / 100) {
      const R = R0({ ...g, tb: tb2, talon: Math.max(0.3, Math.round((g.punta + g.talon + tb - g.punta - tb2) * 100) / 100) })
      if (pasa(R, ['pantallaV']) && !R.datos.FP.insuficiente && R.datos.FP.As <= 0.5 * R.datos.FP.AsMax) break
    }
    let hz2 = 0.25
    for (; hz2 <= 1.2; hz2 = Math.round((hz2 + 0.05) * 100) / 100) {
      const R = R0({ ...g, hz: hz2 })
      if (pasa(R, ['talonV', 'puntaV']) && !R.datos.FT.insuficiente && !R.datos.FPu.insuficiente) break
    }
    const estable = tb2 === tb && hz2 === hz && g.punta === geo.punta && g.talon === geo.talon
    const talon = Math.max(0.3, Math.round((g.talon + tb - tb2) * 100) / 100)
    geo = { ...g, tb: tb2, hz: hz2, talon }
    tb = tb2; hz = hz2
    if (estable) break
  }
  // armados
  const par = (As, cal = [4, 5, 6, 8], extra = {}) => proponerParrilla({ As, porMetro: true, calibres: cal, sMin: C.sMin, sMax: C.sMax, paso: C.paso, ...extra })
  const armar = (g) => {
    const R = R0(g)
    // pantalla: en muros altos van corridas + bastones intercalados del mismo #,
    // cada juego a la doble separación; en los bajos, sólo corridas
    const AsP = R.datos.FP.As
    let pv = null, bast = { ...arm.bast, on: false }
    if (num(g.H) >= 2.5) {
      let mejor = null
      for (const n of [4, 5, 6, 8]) {
        const s2 = Math.min(C.sMax, Math.floor((200 * varilla(n).area) / AsP / C.paso + 1e-6) * C.paso)
        if (s2 < 2 * C.sMin) continue
        const As2 = (200 / s2) * varilla(n).area
        if (!mejor || As2 < mejor.As - 1e-6 || (Math.abs(As2 - mejor.As) < 1e-6 && n > mejor.num)) mejor = { num: n, s: s2, As: As2 }
      }
      if (mejor && AsP > (100 / C.sMax) * varilla(5).area) { pv = { num: mejor.num, s: mejor.s }; bast = { num: mejor.num, s: mejor.s, on: true } }
    }
    if (!pv) { const sola = par(AsP); pv = sola ? { num: sola.num, s: sola.s } : arm.pv }
    const ts = par(R.datos.FT.As), pi = par(R.datos.FPu.As)
    const tMed = (num(g.tc) + num(g.tb)) / 2 * 100
    const ph = par(0.0009 * 100 * tMed, [3, 4]), pe = par(0.0009 * 100 * tMed, [3, 4]), pl = par(0.0009 * 100 * num(g.hz) * 100, [3, 4])
    return {
      pv, bast,
      pe: pe ? { num: pe.num, s: pe.s } : arm.pe, ph: ph ? { num: ph.num, s: ph.s } : arm.ph,
      ts: ts ? { num: ts.num, s: ts.s } : arm.ts, pi: pi ? { num: pi.num, s: pi.s } : arm.pi, pl: pl ? { num: pl.num, s: pl.s } : arm.pl,
    }
  }
  // con varillas más gruesas el peralte útil baja: se cierra la separación
  const cierra = (k, id) => {
    for (let i = 0; i < 12 && !pasa(R0(geo, arm), [id]) && arm[k].s - C.paso >= C.sMin; i++) {
      arm = { ...arm, [k]: { ...arm[k], s: arm[k].s - C.paso } }
      if (k === 'pv' && arm.bast.on) arm = { ...arm, bast: { ...arm.bast, s: arm.pv.s } }
    }
  }
  const ESTABILIDAD = ['volteo', 'deslizamiento', 'excentricidad', 'suelo']
  for (let vuelta = 0; vuelta < 40; vuelta++) {
    arm = armar(geo)
    // la base tiene que alojar el gancho de la pantalla
    for (let i = 0; i < 16 && !pasa(R0(geo, arm), ['pantallaAnc']) && num(geo.hz) < 1.2; i++) {
      geo = { ...geo, hz: Math.round((num(geo.hz) + 0.05) * 100) / 100 }
      arm = armar(geo)
    }
    cierra('pv', 'pantallaM'); cierra('ts', 'talonM'); cierra('pi', 'puntaM')
    // una base más gruesa pesa más: si el suelo o la estabilidad ya no pasan,
    // se ensancha la base (30 % de punta, como arriba) y se vuelve a armar
    if (pasa(R0(geo, arm), ESTABILIDAD) || num(geo.punta) + num(geo.tb) + num(geo.talon) > 2 * H + 1) break
    const B = Math.round((num(geo.punta) + num(geo.tb) + num(geo.talon) + 0.05) * 100) / 100
    const punta = Math.max(0.3, arriba(0.3 * B, 0.05))
    geo = { ...geo, punta, talon: Math.max(0.3, Math.round((B - punta - num(geo.tb)) * 100) / 100) }
  }
  return { geo, arm }
}
