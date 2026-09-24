// ══════════════════════════════════════════════════════════════
// La contratrabe de liga de cada zapata (CT)
//
// Todas las zapatas llevan la suya a la altura del tope del dado, con el
// lecho alto al nivel del terreno: liga la zapata con las vecinas, donde se
// une con las contratrabes de liga independientes (TL). La de la oficina es
// la CT-1: 15 × 30 con 4 varillas #4 (2 arriba y 2 abajo), estribos #2.5 @ 15
// y recubrimiento de 3 cm arriba y 5 abajo. Se revisa con lo que le toca:
//   · zapata aislada: la fuerza de liga (10 % de la Pu, en tensión y en
//     compresión), el N·e si es de lindero o de esquina con liga, su peso y el
//     muro que cargue en el claro libre a la zapata vecina — con el mismo motor
//     que la contratrabe de liga independiente;
//   · zapata corrida bajo muro de mampostería: es la dala de desplante del
//     muro (NTC-Mampostería, dalas): al menos tan ancha como el muro,
//     As ≥ 0.2 f′c t² / fy con 3 varillas o más, y estribos con
//     Asc ≥ 1000 s / (fy hc) a no más de 1.5 t ni 20 cm.
// Si las solicitaciones piden otra, ⚡ Proponer la diseña (y deja de ser CT-1).
// ══════════════════════════════════════════════════════════════

import { MAT, paso, check, f1, f2, num, varilla, kgm } from './comun'
import { revisarLiga, proponerLiga } from './liga'

export const CT1 = Object.freeze({
  nombre: 'CT-1', b: 15, h: 30, r: 3, rInf: 5,
  sup: Object.freeze({ num: 4, n: 2 }), inf: Object.freeze({ num: 4, n: 2 }), est: Object.freeze({ num: 2.5, ramas: 2, s: 15 }),
  Ln: 4, w: 0,                          // claro libre a la zapata vecina (m) y muro sobre la CT (t/m, servicio)
})

export const nuevaCT = () => JSON.parse(JSON.stringify(CT1))

/** ¿Este cimiento lleva CT propia? Las zapatas; la corrida, si su muro es de mampostería */
export const llevaCT = (z) => z?.tipo === 'aislada' || (z?.tipo === 'corrida' && z.geo?.muro !== 'concreto')

/** La CT del cimiento con lo que falte de la CT-1 (los proyectos de antes no la traen) */
export function ctDe(z) {
  const c = z?.ct || {}
  return {
    ...CT1, ...c,
    sup: { ...CT1.sup, ...(c.sup || {}) }, inf: { ...CT1.inf, ...(c.inf || {}) }, est: { ...CT1.est, ...(c.est || {}) },
  }
}

const mismo = (a, b) => a.num === b.num && (a.n ?? a.s) === (b.n ?? b.s) && (a.ramas ?? 2) === (b.ramas ?? 2) && (a.s ?? 0) === (b.s ?? 0)
/** ¿Es la CT-1 de la oficina tal cual? */
export const esCT1 = (ct) => num(ct.b) === CT1.b && num(ct.h) === CT1.h && mismo(ct.sup, CT1.sup) && mismo(ct.inf, CT1.inf) && mismo(ct.est, CT1.est)

const fmtS = (s) => (Number.isInteger(s) ? `${s}` : `${s}`)
/** «4#4» si arriba y abajo son iguales; si no, «2#5 arr. + 2#4 ab.» */
export const txtVarillasCT = (ct) => (ct.sup.num === ct.inf.num
  ? `${ct.sup.n + ct.inf.n}#${ct.sup.num}`
  : `${ct.sup.n}#${ct.sup.num} arr. + ${ct.inf.n}#${ct.inf.num} ab.`)
/** «CT-1 15 × 30 · 4#4 · E#2.5 @ 15» */
export const txtCT = (ct) => `${ct.nombre} ${f1c(ct.b)} × ${f1c(ct.h)} · ${txtVarillasCT(ct)} · E#${ct.est.num} @ ${fmtS(ct.est.s)}`
const f1c = (v) => (Number.isInteger(+v) ? `${+v}` : (+v).toFixed(1))

/** Por metro de CT: concreto (m³/m) y acero (kg/m) */
export function cantidadCT(ct) {
  const vs = varilla(ct.sup.num), vi = varilla(ct.inf.num), ve = varilla(ct.est.num)
  const perim = (2 * (ct.b + ct.h) - 4 * (ct.r + ct.rInf) / 2 * 2) / 100 + 0.2
  return {
    concreto: (ct.b * ct.h) / 1e4,
    acero: (ct.sup.n * kgm(vs) + ct.inf.n * kgm(vi)) * 1.05 + (100 / ct.est.s) * perim * kgm(ve) * (ct.est.ramas / 2),
  }
}

function cabecera(ct, extra = []) {
  const q = cantidadCT(ct)
  return [
    paso('Sección', `${ct.nombre}${esCT1(ct) ? ' (la de la oficina)' : ''}`, `b × h = ${f1(ct.b)} × ${f1(ct.h)} · recubrimiento ${f1(ct.r)} arriba, ${f1(ct.rInf)} abajo`, txtVarillasCT(ct), '', { nota: `estribos E#${ct.est.num} @ ${ct.est.s} cm, lecho alto al nivel del terreno` }),
    ...extra,
    paso('Por metro de CT', 'concreto · acero', `${f2(q.concreto * 1000 / 1000)} m³/m`, q.acero, 'kg/m'),
  ]
}

const adaptar = (c, ct) => ({ ...c, id: `ct-${c.id}`, grupo: `Contratrabe de liga ${ct.nombre}` })

/**
 * La CT de una zapata aislada: una liga de un claro con la carga de su columna.
 * @param Pu  carga última máxima de la columna (t)
 * @param Me  N·e de la zapata excéntrica con liga (t·m), 0 si es céntrica
 * @param c   ancho de la columna a lo largo de la CT (cm)
 */
export function revisarCTAislada(z, obra = {}, { Pu = 0, Me = 0, c = 30 } = {}) {
  const ct = ctDe(z)
  const m = { ...MAT, ...(z.mat || {}) }
  const L = num(ct.Ln, 4) + c / 100
  const zl = {
    tipo: 'liga', geo: { b: ct.b, h: ct.h },
    columnas: [{ x: 0, c, Pu, Me }, { x: L, c, Pu, Me: 0 }],
    cargas: { CM: { w: num(ct.w) }, CV: { w: 0 } },
    arm: { sup: ct.sup, inf: ct.inf, est: ct.est },
    mat: { fc: m.fc, fy: m.fy, r: ct.r, rInf: ct.rInf },
  }
  const R = revisarLiga(zl, obra)
  const pasos = cabecera(ct, [
    paso('Claro libre a la zapata vecina', 'Ln', 'donde se une con la contratrabe de liga que sigue', num(ct.Ln, 4), 'm'),
    ...(num(ct.w) > 0 ? [paso('Muro sobre la CT', 'w (servicio)', '', num(ct.w), 't/m')] : []),
  ])
  for (const s of R.secciones) {
    for (const p of s.pasos) pasos.push(p.t === 'Tramo 1' ? { ...p, t: 'Claro de la CT' } : p)
  }
  const malos = R.checks.filter((k) => !k.ok)
  const avisos = []
  if (malos.length) {
    avisos.push(Me > 1e-6
      ? `La contratrabe de liga ${ct.nombre} no alcanza con el N·e de la zapata (${f2(Me)} t·m): ⚡ Proponer la diseña. Si ni así, conviene zapata combinada o contratrabe corrida con la columna vecina.`
      : `La contratrabe de liga ${ct.nombre} no alcanza (${malos.map((k) => k.titulo.toLowerCase()).join(', ')}): ⚡ Proponer la diseña.`)
  }
  return {
    ct, avisos, checks: R.checks.map((c2) => adaptar(c2, ct)),
    seccion: { titulo: `Contratrabe de liga ${ct.nombre}: ${f1c(ct.b)} × ${f1c(ct.h)}, ${txtVarillasCT(ct)}, E#${ct.est.num} @ ${ct.est.s}`, pasos },
    datos: { ...ct, T: R.datos?.T, Mneg: R.datos?.Mneg, Mpos: R.datos?.Mpos },
  }
}

/**
 * La CT de una zapata corrida bajo muro de mampostería: la dala de desplante.
 * @param t  espesor del muro (cm)
 */
export function revisarCTMuro(z, obra = {}, { t = 15 } = {}) {
  const ct = ctDe(z)
  const m = { ...MAT, ...(z.mat || {}) }
  const fc = num(m.fc, 250), fy = num(m.fy, 4200)
  const vs = varilla(ct.sup.num), vi = varilla(ct.inf.num), ve = varilla(ct.est.num)
  const n = ct.sup.n + ct.inf.n
  const As = ct.sup.n * vs.area + ct.inf.n * vi.area
  const AsMin = (0.2 * fc * t * t) / fy
  const hc = ct.h
  const AscMin = (1000 * ct.est.s) / (fy * hc)
  const sMax = Math.min(1.5 * t, 20)
  const g = `Contratrabe de liga ${ct.nombre}`
  const checks = [
    check('ct-ancho', 'Ancho de la CT', t, ct.b, 'cm', { grupo: g, nota: `muro de ${f1(t)} cm` }),
    check('ct-long', 'Refuerzo longitudinal', AsMin, As, 'cm²', { grupo: g, ok: As >= AsMin - 1e-9 && n >= 3, nota: `${txtVarillasCT(ct)} (≥ 3 varillas)` }),
    check('ct-est', 'Estribos', AscMin, ve.area, 'cm²', { grupo: g, ok: ve.area >= AscMin - 1e-9 && ct.est.s <= sMax + 1e-9, nota: `E#${ct.est.num} @ ${ct.est.s} (s ≤ ${f1(sMax)})` }),
    check('ct-seccion', 'Sección mínima (CT-1)', CT1.h, Math.min(ct.h, (ct.b / CT1.b) * CT1.h), 'cm', { grupo: g, ok: ct.b >= CT1.b && ct.h >= CT1.h, nota: `${f1(ct.b)} × ${f1(ct.h)} ≥ ${CT1.b} × ${CT1.h}` }),
  ].map((k) => (k.id === 'ct-seccion' && k.ok ? { ...k, u: 0, sinU: true } : k))
  const pasos = cabecera(ct, [
    paso('Función', 'dala de desplante del muro de mampostería', 'NTC-Mampostería, castillos y dalas', 'a la altura del terreno', ''),
    paso('Ancho', 'b ≥ t (espesor del muro)', `t = ${f1(t)}`, ct.b, 'cm', { ok: ct.b >= t - 1e-9, lim: `≥ ${f1(t)}` }),
    paso('Refuerzo longitudinal mínimo', 'As ≥ 0.2 f′c t² / fy, con 3 varillas o más', `= 0.2 × ${fc} × ${f1(t)}² / ${fy}`, AsMin, 'cm²'),
    paso('Refuerzo longitudinal', txtVarillasCT(ct), `${n} varillas`, As, 'cm²', { ok: As >= AsMin - 1e-9 && n >= 3, lim: `≥ ${f2(AsMin)}` }),
    paso('Estribo mínimo', 'Asc ≥ 1000 s / (fy hc)', `= 1000 × ${ct.est.s} / (${fy} × ${f1(hc)})`, AscMin, 'cm²'),
    paso('Estribos', `E#${ct.est.num} @ ${ct.est.s}`, `s ≤ 1.5 t ≤ 20 cm = ${f1(sMax)}`, ve.area, 'cm²', { ok: ve.area >= AscMin - 1e-9 && ct.est.s <= sMax + 1e-9, lim: `≥ ${f2(AscMin)}` }),
    paso('Sección mínima', 'la CT-1 de la oficina', `${f1(ct.b)} × ${f1(ct.h)}`, ct.b >= CT1.b && ct.h >= CT1.h ? 'cumple' : 'no cumple', '', { ok: ct.b >= CT1.b && ct.h >= CT1.h, lim: `≥ ${CT1.b} × ${CT1.h}` }),
  ])
  return {
    ct, checks,
    avisos: checks.some((k) => !k.ok) ? [`La contratrabe de liga ${ct.nombre} no cumple como dala de desplante del muro: ⚡ Proponer la diseña.`] : [],
    seccion: { titulo: `Contratrabe de liga ${ct.nombre}: ${f1c(ct.b)} × ${f1c(ct.h)}, ${txtVarillasCT(ct)}, E#${ct.est.num} @ ${ct.est.s}`, pasos },
    datos: { ...ct },
  }
}

/** La CT de un cimiento, si lleva (null si no) */
export function revisarCT(z, obra, datos) {
  if (!llevaCT(z)) return null
  return z.tipo === 'corrida' ? revisarCTMuro(z, obra, datos) : revisarCTAislada(z, obra, datos)
}

/**
 * ⚡ Proponer la CT: la CT-1 si alcanza; si no, la más chica que pasa (se
 * llama CT-2 mientras nadie le ponga otro nombre).
 */
export function proponerCT(z, obra, datos) {
  if (!llevaCT(z)) return z.ct
  const actual = ctDe(z)
  const conCT = (ct) => ({ ...z, ct })
  const base = { ...nuevaCT(), Ln: actual.Ln, w: actual.w }
  const pasa = (ct) => revisarCT(conCT(ct), obra, datos).checks.every((c) => c.ok)
  if (pasa(base)) return { ...base, nombre: CT1.nombre }
  const nombre = actual.nombre && actual.nombre !== CT1.nombre ? actual.nombre : 'CT-2'
  if (z.tipo === 'corrida') {
    const t = num(datos?.t, 15)
    for (const b of [15, 20, 25, 30, 35, 40].filter((x) => x >= t)) {
      for (const [ns, ni, nb] of [[2, 2, 4], [2, 2, 5], [3, 3, 4], [3, 3, 5], [3, 3, 6]]) {
        const ct = { ...base, nombre, b, sup: { num: nb, n: ns }, inf: { num: nb, n: ni } }
        for (const est of [{ num: 2.5, ramas: 2, s: 15 }, { num: 2.5, ramas: 2, s: 12.5 }, { num: 3, ramas: 2, s: 15 }]) if (pasa({ ...ct, est })) return { ...ct, est }
      }
    }
    return { ...base, nombre, b: Math.max(base.b, Math.ceil(t / 5) * 5) }
  }
  // aislada: el mismo buscador de la liga independiente, sobre su claro
  const m = { ...MAT, ...(z.mat || {}) }
  const c = num(datos?.c, 30)
  const zl = {
    tipo: 'liga', geo: { b: base.b, h: base.h }, columnas: [{ x: 0, c, Pu: num(datos?.Pu), Me: num(datos?.Me) }, { x: num(base.Ln, 4) + c / 100, c, Pu: num(datos?.Pu), Me: 0 }],
    cargas: { CM: { w: num(base.w) }, CV: { w: 0 } }, mat: { fc: m.fc, fy: m.fy, r: base.r, rInf: base.rInf },
  }
  const p = proponerLiga(zl, obra)
  if (!p?.arm) return { ...base, nombre, b: p?.geo?.b ?? base.b, h: p?.geo?.h ?? base.h }
  return { ...base, nombre, b: p.geo.b, h: p.geo.h, sup: p.arm.sup, inf: p.arm.inf, est: p.arm.est }
}
