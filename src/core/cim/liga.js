// ══════════════════════════════════════════════════════════════
// Contratrabe de liga: une las zapatas por arriba, a la altura del tope del
// dado, para ligar la estructura. No lleva zapata: no apoya en el suelo.
//
// Lo que carga (práctica de la oficina; el modelo de RAM no la trae):
//   · una fuerza axial, en tensión y en compresión, de una fracción de la Pu
//     de la columna más cargada que liga (10 % de fábrica, ACI 18.13.3);
//   · el momento N·e de las zapatas excéntricas (de lindero o de esquina)
//     que se apoyan en ella, como viga de equilibrio: máximo en la columna
//     de la orilla y cero en el apoyo siguiente;
//   · su peso y el de un muro, si lo lleva, como viga continua (wL²/10);
// su sección no baja de la CT-1 de la oficina (15 × 30; con el criterio del
// ACI 18.13.3.3 encendido, tampoco del claro libre/20, sin pasar de 45 cm) ni
// sus estribos de d/2 y 30 cm. Recubrimiento de 3 cm a los lados y arriba y de
// 5 cm abajo, contra el suelo. Se diseña con los motores de trabes de la app.
// ══════════════════════════════════════════════════════════════

import { calcFlexion, calcCortante } from '../sectionCalculator'
import { corridasMax } from '../propuesta'
import { CRITERIOS, MAT, paso, check, f1, f2, f3, num, varilla, abajo, arriba, kgm, GC } from './comun'

export const FRAC_LIGA = 0.10

/** Sección mínima de la oficina: la CT-1 */
export const LIGA_MIN = { b: 15, h: 30 }
/** Recubrimiento de la liga: 3 cm a los lados y arriba, 5 cm abajo (contra el suelo) */
export const R_LIGA = { r: 3, rInf: 5 }

export function nuevaLiga(nombre = 'TL-1') {
  return {
    tipo: 'liga', nombre,
    geo: { b: 15, h: 30, dado: 60 },          // la CT-1; dado: altura del dado bajo la liga (dibujo), cm
    columnas: [{ x: 0, c: 30, Pu: 45, Me: 4 }, { x: 5.5, c: 30, Pu: 70, Me: 0 }],
    cargas: { CM: { w: 0 }, CV: { w: 0 } },    // muro u otra carga sobre la liga, t/m de servicio
    arm: { sup: { num: 4, n: 2 }, inf: { num: 4, n: 2 }, est: { num: 2.5, ramas: 2, s: 15 } },
    mat: { ...MAT, ...R_LIGA },
  }
}

/** Recubrimientos de una liga: arriba y a los lados (r) y abajo (rInf) */
export const recLiga = (m = {}) => ({ r: num(m.r, R_LIGA.r), rInf: num(m.rInf, Math.max(num(m.r, R_LIGA.r), R_LIGA.rInf)) })

const cols = (z) => [...(z.columnas || [])].map((c) => ({ ...c, x: num(c.x), c: num(c.c, 30), Pu: num(c.Pu), Me: num(c.Me) })).sort((a, b) => a.x - b.x)

/** Los tramos de la liga con sus fuerzas últimas */
export function tramosLiga(z, C = CRITERIOS) {
  const g = z.geo, cs = cols(z)
  const b = num(g.b, 20), h = num(g.h, 40)
  const peso = (b * h) / 1e4 * GC
  const wu = C.fcm * (num(z.cargas?.CM?.w) + peso) + C.fcv * num(z.cargas?.CV?.w)
  const frac = num(C.fLiga, FRAC_LIGA)
  const n = cs.length
  // el momento de una zapata excéntrica se lo llevan los tramos que llegan a
  // su apoyo: todo si es la orilla, la mitad a cada lado si es interior
  const parte = (i) => (i === 0 || i === n - 1 ? 1 : 0.5)
  const tramos = []
  for (let i = 0; i < n - 1; i++) {
    const a = cs[i], c = cs[i + 1]
    const L = c.x - a.x, Ln = Math.max(0.1, L - (a.c + c.c) / 200)
    const Mi = a.Me * parte(i), Mj = c.Me * parte(i + 1)
    const Mg = (wu * Ln * Ln) / 10
    tramos.push({
      i, L, Ln, Mi, Mj, Mg,
      Mneg: Math.max(Mi, Mj) + Mg,             // tensión arriba, en los apoyos
      Mpos: Mg,                                // tensión abajo, al centro
      Vu: 1.15 * wu * Ln / 2 + Math.abs(Mi - Mj) / L,
      T: frac * Math.max(a.Pu, c.Pu),
    })
  }
  return { tramos, wu, peso, frac, cs }
}

export function revisarLiga(z, obra = {}) {
  const C = { ...CRITERIOS, ...(obra.criterios || {}) }
  const g = z.geo, m = { ...MAT, ...(z.mat || {}) }
  const b = num(g.b, 15), h = num(g.h, 30), fc = num(m.fc, 250), fy = num(m.fy, 4200)
  const { r, rInf } = recLiga(z.mat)
  const arm = {
    sup: { num: 4, n: 2, ...(z.arm?.sup || {}) }, inf: { num: 4, n: 2, ...(z.arm?.inf || {}) },
    est: { num: 3, ramas: 2, s: 15, ...(z.arm?.est || {}) },
  }
  const checks = [], secciones = [], avisos = []
  const { tramos, wu, peso, frac, cs } = tramosLiga(z, C)
  if (cs.length < 2) {
    return { tipo: 'liga', ok: false, checks: [check('apoyos', 'Apoyos', 2, cs.length, '', { ok: false })], secciones, avisos: ['La liga necesita al menos dos apoyos.'], cant: {}, datos: null, resumen: 'Contratrabe de liga sin apoyos' }
  }
  const gov = (k) => tramos.reduce((a, t) => (t[k] > a[k] ? t : a))
  const tN = gov('Mneg'), tP = gov('Mpos'), tV = gov('Vu'), tT = gov('T')
  const LnMax = Math.max(...tramos.map((t) => t.Ln))
  const ve = varilla(arm.est.num), vs = varilla(arm.sup.num), vi = varilla(arm.inf.num)
  const rS = r + ve.diam + vs.diam / 2, rI = rInf + ve.diam + vi.diam / 2

  secciones.push({
    titulo: 'Cargas de la liga',
    pasos: [
      paso('Peso propio', 'γc b h', `= ${GC} × ${f2(b / 100)} × ${f2(h / 100)}`, peso, 't/m'),
      paso('Carga última repartida', `wu = ${C.fcm} (wCM + peso) + ${C.fcv} wCV`, `= ${C.fcm} (${f2(num(z.cargas?.CM?.w))} + ${f2(peso)}) + ${C.fcv} × ${f2(num(z.cargas?.CV?.w))}`, wu, 't/m'),
      paso('Fuerza de liga', `T = ${f2(frac)} Pu (la columna más cargada del tramo)`, 'en tensión y en compresión', tT.T, 't', { nota: 'ACI 18.13.3: amarra las zapatas ante el sismo' }),
    ],
  })
  secciones.push({
    titulo: 'Tramos (cargas últimas)',
    pasos: tramos.flatMap((t) => [
      paso(`Tramo ${t.i + 1}`, 'claro · claro libre', `${f2(t.L)} · ${f2(t.Ln)}`, t.Ln, 'm'),
      ...(t.Mi + t.Mj > 1e-9 ? [paso('Momento de la zapata excéntrica', 'N·e en el apoyo (viga de equilibrio)', `${f2(t.Mi)} · ${f2(t.Mj)}`, Math.max(t.Mi, t.Mj), 't·m')] : []),
      paso('Momentos', 'M− = N·e + wu Ln²/10 · M+ = wu Ln²/10', `M− = ${f2(t.Mneg)} · M+ = ${f2(t.Mpos)}`, '', 't·m'),
      paso('Cortante', 'Vu = 1.15 wu Ln/2 + |ΔN·e|/L', '', t.Vu, 't'),
    ]),
  })

  // flexión
  const fS = calcFlexion({ fc, fy, b, h, r: rS, MuTm: Math.max(tN.Mneg, 1e-6), varNum: arm.sup.num, varCount: arm.sup.n })
  const fI = calcFlexion({ fc, fy, b, h, r: rI, MuTm: Math.max(tP.Mpos, 1e-6), varNum: arm.inf.num, varCount: arm.inf.n })
  // el ancho que piden las varillas, con el recubrimiento de los lados
  const bLat = (a) => { const v = varilla(a.num); return 2 * (r + ve.diam + v.diam / 2) + (2 * a.n - 1) * v.diam }
  const lecho = (f, Mu, a, nombre, id, titulo) => {
    const ok = !f.error && f.MRT >= Mu - 1e-9 && f.AsTotal >= f.AsMin - 1e-9 && f.AsTotal <= f.AsMax + 1e-9 && bLat(a) <= b + 1e-9
    checks.push(check(id, titulo, Mu, f.error ? 0 : f.MRT, 't·m', { grupo: 'Flexión', ok, nota: `${a.n}#${a.num}` }))
    return f.error ? [paso(nombre, 'Mu', '', f.error, '', { ok: false })] : [
      paso(`Momento último (${nombre})`, 'Mu', '', Mu, 't·m'),
      paso('Acero requerido', 'As = ρ b d ≥ As,mín', `ρ = ${f3(f.rhoCalc)}`, Math.max(f.AsCalc, f.AsMin), 'cm²'),
      paso('Armado', `${a.n}#${a.num}`, `= ${a.n} × ${f2(f.vr.area)}`, f.AsTotal, 'cm²', { ok: f.AsTotal >= f.AsMin - 1e-9 && f.AsTotal <= f.AsMax + 1e-9, lim: `${f2(f.AsMin)} ≤ As ≤ ${f2(f.AsMax)}` }),
      paso('Momento resistente', 'MR = FR As fy (d − a/2)', `a = ${f2(f.a)} cm`, f.MRT, 't·m', { ok: f.MRT >= Mu - 1e-9, lim: `≥ Mu = ${f2(Mu)}` }),
    ]
  }
  secciones.push({ titulo: 'Flexión', pasos: [...lecho(fS, tN.Mneg, arm.sup, 'arriba, en los apoyos', 'flexionSup', 'Liga arriba (M−)'), ...lecho(fI, tP.Mpos, arm.inf, 'abajo, al centro', 'flexionInf', 'Liga abajo (M+)')] })

  // tensión y compresión: el acero que sobra de la flexión toma la tensión
  const AsS = arm.sup.n * vs.area, AsI = arm.inf.n * vi.area
  const AsFlex = (f) => (f.error ? Infinity : Math.max(f.AsCalc, 0))
  const AsLibre = Math.max(0, AsS - AsFlex(fS)) + Math.max(0, AsI - AsFlex(fI))
  const AsT = (tT.T * 1000) / (0.9 * fy)
  checks.push(check('tension', 'Tensión de liga', AsT, AsLibre, 'cm²', { grupo: 'Axial', nota: `T = ${f2(tT.T)} t` }))
  const Ag = b * h, As = AsS + AsI
  const PR = (0.7 * (0.85 * fc * (Ag - As) + fy * As)) / 1000
  checks.push(check('compresion', 'Compresión de liga', tT.T, PR, 't', { grupo: 'Axial' }))
  secciones.push({
    titulo: 'Tensión y compresión',
    pasos: [
      paso('Acero para la tensión', 'As,T = T / (FR fy)', `= ${f2(tT.T)} × 1000 / (0.9 × ${fy})`, AsT, 'cm²'),
      paso('Acero que no pide la flexión', 'As − As,flexión (arriba + abajo)', `= (${f2(AsS)} − ${f2(AsFlex(fS))}) + (${f2(AsI)} − ${f2(AsFlex(fI))})`, AsLibre, 'cm²', { ok: AsLibre >= AsT - 1e-9, lim: `≥ ${f2(AsT)}` }),
      paso('Compresión resistente', 'PR = 0.7 [0.85 f′c (Ag − As) + fy As]', `Ag = ${f1(Ag)} · As = ${f2(As)}`, PR, 't', { ok: PR >= tT.T, lim: `≥ T = ${f2(tT.T)}` }),
    ],
  })

  // cortante con estribos cerrados
  const cc = calcCortante({ fc, fy, b, h, r: Math.max(rS, rI), L: LnMax, VuTon: tV.Vu, AsUsada: Math.min(AsS, AsI), varEstNum: arm.est.num, nramas: arm.est.ramas, conCompresion: false })
  const Av = arm.est.ramas * ve.area
  const VR = cc.Vcr + (0.75 * Av * fy * cc.d) / arm.est.s / 1000
  // como viga (lleva el N·e de una zapata excéntrica o el concreto solo no
  // alcanza el cortante): s ≤ d/2 ≤ 30 cm; como liga (tensor, trabaja como
  // una dala): s ≤ 1.5 b ≤ 20 cm, el límite de las dalas de la NTC-Mampostería
  const comoViga = tV.Vu > cc.Vcr + 1e-9 || tramos.some((t) => t.Mi + t.Mj > 1e-9)
  const sMax = comoViga ? Math.min(cc.d / 2, 30, cc.SmaxGeom) : Math.min(1.5 * b, 20)
  const okS = arm.est.s <= sMax + 1e-6
  checks.push(check('cortante', 'Cortante', tV.Vu, VR, 't', { grupo: 'Cortante', ok: VR >= tV.Vu - 1e-9 && !cc.seccionInsuficiente && okS, nota: `E#${arm.est.num} @ ${arm.est.s}` }))
  secciones.push({
    titulo: 'Cortante',
    pasos: [
      paso('Cortante último', 'Vu', `tramo ${tV.i + 1}`, tV.Vu, 't'),
      paso('Del concreto', 'VcR (NTC, como en trabes)', cc.ecVcr, cc.Vcr, 't'),
      paso('Estribos', `E#${arm.est.num} de ${arm.est.ramas} ramas @ ${arm.est.s}`, `Vs = 0.75 Av fy d / s`, VR - cc.Vcr, 't'),
      paso('Resistente', 'VR = VcR + Vs', '', VR, 't', { ok: VR >= tV.Vu - 1e-9, lim: `≥ Vu = ${f2(tV.Vu)}` }),
      comoViga
        ? paso('Separación máxima', 'como viga (N·e o Vu > VcR): s ≤ d/2 ≤ 30 cm', `d = ${f1(cc.d)}`, sMax, 'cm', { ok: okS, lim: `s = ${arm.est.s}` })
        : paso('Separación máxima', 'como liga (tensor, Vu ≤ VcR): s ≤ 1.5 b ≤ 20 cm', `b = ${f1(b)} (NTC-Mampostería, dalas)`, sMax, 'cm', { ok: okS, lim: `s = ${arm.est.s}` }),
    ],
  })

  // sección mínima: la CT-1 de la oficina; con el criterio del ACI 18.13.3.3
  // (zonas de alta sismicidad), además el lado menor ≥ claro libre/20 ≤ 45 cm
  const aci = !!C.ligaAci
  const lado = aci ? Math.max(LIGA_MIN.b, Math.min(arriba((LnMax * 100) / 20, 1), 45)) : LIGA_MIN.b
  const okSec = Math.min(b, h) >= lado - 1e-9 && b >= LIGA_MIN.b - 1e-9 && h >= LIGA_MIN.h - 1e-9
  // (la CT-1 ES el mínimo: su «100 %» no es estar justo, así que no cuenta como aprovechamiento)
  const cSec = check('seccion', 'Sección mínima', aci ? lado : LIGA_MIN.h, aci ? Math.min(b, h) : h, 'cm', { grupo: 'Detallado', ok: okSec, nota: aci ? `CT-1 y claro libre ${f2(LnMax)} m / 20 (ACI)` : `la CT-1: ${LIGA_MIN.b} × ${LIGA_MIN.h}` })
  checks.push(okSec ? { ...cSec, u: 0, sinU: true } : cSec)
  secciones.push({
    titulo: 'Sección mínima',
    pasos: [
      paso('La de la oficina', `CT-1: b ≥ ${LIGA_MIN.b}, h ≥ ${LIGA_MIN.h} cm`, `b × h = ${f1(b)} × ${f1(h)}`, b >= LIGA_MIN.b - 1e-9 && h >= LIGA_MIN.h - 1e-9 ? 'cumple' : 'no cumple', '', { ok: b >= LIGA_MIN.b - 1e-9 && h >= LIGA_MIN.h - 1e-9 }),
      ...(aci ? [paso('ACI 18.13.3.3', 'lado menor ≥ Ln/20 ≤ 45 cm', `Ln = ${f2(LnMax)} m`, lado, 'cm', { ok: Math.min(b, h) >= lado - 1e-9, lim: `lado menor = ${f1(Math.min(b, h))}` })] : []),
    ],
  })

  const Ltot = cs[cs.length - 1].x - cs[0].x + (cs[0].c + cs[cs.length - 1].c) / 200
  const perim = 2 * (b + h - 2 * r - r - rInf) / 100 + 0.2
  const cant = {
    concreto: (b * h) / 1e4 * Ltot,
    acero: (arm.sup.n * kgm(vs) + arm.inf.n * kgm(vi)) * (Ltot + 0.6) + Math.ceil(Ltot * 100 / arm.est.s) * perim * kgm(ve),
    excavacion: 0,
  }
  const ok = checks.every((c) => c.ok)
  return {
    tipo: 'liga', ok, checks, secciones, avisos, cant,
    datos: { b, h, dado: num(g.dado, 60), cs, tramos, arm, Mneg: tN.Mneg, Mpos: tP.Mpos, Vu: tV.Vu, T: tT.T, LnMax, Ltot, rS, rI, r, rInf, q: null },
    resumen: `Contratrabe de liga de ${f1(b)} × ${f1(h)} cm sobre ${cs.length} apoyos: ${arm.sup.n}#${arm.sup.num} arriba, ${arm.inf.n}#${arm.inf.num} abajo y E#${arm.est.num} @ ${arm.est.s}; tensión y compresión de ${f2(tT.T)} t`,
  }
}

/**
 * La CT-1 (15 × 30, 4#4, E#2.5 @ 15) si alcanza; si no, la sección más chica
 * (b × h, a cada 5 cm) con lecho de al menos 2 varillas que pasa todo:
 * flexión, la tensión con el acero que sobra, cortante y el lado mínimo.
 */
export function proponerLiga(z, obra = {}) {
  const C = { ...CRITERIOS, ...(obra.criterios || {}) }
  const m = { ...MAT, ...(z.mat || {}) }
  const fc = num(m.fc, 250), fy = num(m.fy, 4200)
  const { r, rInf } = recLiga(z.mat)
  const { tramos } = tramosLiga(z, C)
  if (!tramos.length) return {}
  const ct1 = { geo: { ...z.geo, b: LIGA_MIN.b, h: LIGA_MIN.h }, arm: { sup: { num: 4, n: 2 }, inf: { num: 4, n: 2 }, est: { num: 2.5, ramas: 2, s: 15 } } }
  if (revisarLiga({ ...z, ...ct1 }, obra).ok) return ct1
  const LnMax = Math.max(...tramos.map((t) => t.Ln))
  const lado = C.ligaAci ? Math.max(LIGA_MIN.b, Math.min(arriba((LnMax * 100) / 20, 5), 45)) : LIGA_MIN.b
  const cands = []
  for (let b = lado; b <= 45; b += 5) for (let h = Math.max(b, LIGA_MIN.h); h <= 120; h += 5) cands.push([b, h])
  cands.sort((p, q) => p[0] * p[1] - q[0] * q[1] || p[1] - q[1])
  const lechos = (b) => {
    const out = []
    for (const num_ of [4, 5, 6, 8]) for (let n = 2; n <= corridasMax(b); n++) out.push({ num: num_, n, As: n * varilla(num_).area })
    return out.sort((p, q) => p.As - q.As)
  }
  for (const [b, h] of cands) {
    const zz = { ...z, geo: { ...z.geo, b, h } }
    const { tramos: tr } = tramosLiga(zz, C)
    const Mn = Math.max(...tr.map((t) => t.Mneg)), Mp = Math.max(...tr.map((t) => t.Mpos)), T = Math.max(...tr.map((t) => t.T))
    const AsT = (T * 1000) / (0.9 * fy)
    const rE = Math.max(r, rInf) + 0.95 + 1.6 / 2
    const req = (Mu) => { const f = calcFlexion({ fc, fy, b, h, r: rE, MuTm: Math.max(Mu, 1e-6), varNum: 4, varCount: 2 }); return f.error ? null : { calc: f.AsCalc, min: f.AsMin } }
    const qs = req(Mn), qi = req(Mp)
    if (!qs || !qi) continue
    // cada lecho: su flexión (≥ mínimo) y la mitad de la tensión
    const sup = lechos(b).find((l) => l.As >= Math.max(qs.calc + AsT / 2, qs.min))
    const inf = lechos(b).find((l) => l.As >= Math.max(qi.calc + AsT / 2, qi.min))
    if (!sup || !inf) continue
    const d = h - rE
    for (const e of [2.5, 3]) {
      for (const s of [30, 27.5, 25, 22.5, 20, 17.5, 15, 12.5, 10].filter((x) => x <= Math.min(d / 2, 30) + 1e-9)) {
        const arm = { sup: { num: sup.num, n: sup.n }, inf: { num: inf.num, n: inf.n }, est: { num: e, ramas: 2, s } }
        if (revisarLiga({ ...zz, arm }, obra).ok) return { geo: zz.geo, arm }
      }
    }
  }
  return { geo: { ...z.geo, b: lado, h: Math.max(lado, LIGA_MIN.h, abajo(LnMax * 100 / 10, 5)) } }
}
