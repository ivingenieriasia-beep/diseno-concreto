// ══════════════════════════════════════════════════════════════
// Asentamientos de la cimentación (3.12)
//
// Las corridas que salieron de RAM (y sus ejes ligados) se parten en paneles
// de MALLA m a lo largo de su eje, con todo su ancho B. Cada panel lleva la
// presión de servicio q = w / B (CM + CV media, NTC-Cimentaciones 2023,
// 3.2.1.1.1) y el asentamiento sale de uno de dos modelos que elige el
// ingeniero:
//   · elástico (E, ν): semiespacio homogéneo, superposición de rectángulos
//     flexibles con la fórmula de la esquina (Timoshenko y Goodier);
//   · Winkler (ks): δ = q / ks, cada panel por su cuenta.
// Con eso se revisa el asentamiento medio (tabla 3.1.1.2.2.3 de la
// NTC-Cimentaciones 2023), la distorsión entre apoyos (tabla 6.2.2.1 de la
// NTC-Criterios y Acciones 2023, el límite lo elige el ingeniero) y el
// momento y el cortante que el diferencial induce en la CT de cada corrida y
// en las contratrabes de liga: M = 6 EI Δ / L², V = 12 EI Δ / L³
// (empotrada-empotrada, EI agrietado).
//
// Ningún dato del suelo tiene valor de fábrica: sin datos no se calcula y se
// dice qué falta. Lo que es criterio del ingeniero (el factor de la inercia
// agrietada, el factor de carga del hundimiento, de dónde sale la carga de
// cada franja) también se captura.
//
// Simplificaciones que se dicen en la memoria:
//   · la corrida es flexible: su rigidez y la de la CT no reparten la carga;
//   · el semiespacio no tiene capas: con zonas, cada punto usa el E y ν del
//     estrato bajo él;
//   · los asentamientos se calculan sobre el eje de la corrida.
// ══════════════════════════════════════════════════════════════

import { paso, check, f1, f2, f3, num, varilla } from './comun'
import { ctDe, llevaCT } from './ct'
import { recLiga } from './liga'
import { calcFlexion, calcCortante } from '../sectionCalculator'
import { EcNTC } from '../deflexiones'
import { asentViga } from './asentViga'

/** Largo de cada panel de la malla, m (se ajusta para que el eje se parta parejo) */
export const MALLA = 0.25

/** Los límites de distorsión de la tabla 6.2.2.1 entre los que elige el ingeniero */
export const DISTORSIONES = [0.001, 0.0015, 0.002, 0.0025, 0.003]

/** Datos de fábrica: vacíos a propósito (ningún valor por omisión) */
export const nuevoAsent = () => ({
  modelo: '', estratos: [{ id: 'E1', nombre: 'Estrato 1', E: '', nu: '', ks: '' }], base: 'E1', zonas: [],
  limMedio: '', limMedioNota: '', limDist: '', carga: '', cvMaxSiFalta: false, wCVmed: {}, fInercia: '', fcAsent: '',
  // 3.13: cómo trabaja la cimentación ('' o 'flexible': la de la 3.12; 'viga': sobre resortes)
  metodo: '', pesoViga: '', wPeso: {}, cruces: '', ligas: [], extLigas: {},
})

const finito = (v) => v !== '' && v != null && Number.isFinite(Number(v))
const pos = (v) => finito(v) && Number(v) > 0
const mm = (m) => m * 1000

/** Lo que falta para calcular; vacío = se puede */
export function faltantes(asent = {}, { conCasoMedio = true, corridas = [] } = {}) {
  const a = { ...nuevoAsent(), ...asent }
  const out = []
  if (!a.modelo) out.push('Elige el modelo del suelo: elástico (E, ν) o Winkler (ks).')
  const usados = new Set([a.base, ...a.zonas.map((z) => z.estrato)])
  for (const e of a.estratos.filter((x) => usados.has(x.id))) {
    if (a.modelo === 'elastico') {
      if (!pos(e.E)) out.push(`${e.nombre || e.id}: falta E (t/m²).`)
      if (!(finito(e.nu) && Number(e.nu) >= 0 && Number(e.nu) < 0.5)) out.push(`${e.nombre || e.id}: falta ν (0 ≤ ν < 0.5).`)
    } else if (a.modelo === 'winkler' && !pos(e.ks)) out.push(`${e.nombre || e.id}: falta ks (t/m³).`)
  }
  if (!a.estratos.some((x) => x.id === a.base)) out.push('Elige el estrato de toda la obra.')
  for (const z of a.zonas) {
    if (!a.estratos.some((x) => x.id === z.estrato)) out.push(`${z.nombre || 'Zona'}: elige su estrato.`)
    if (z.tipo === 'rect' && !(['x0', 'x1', 'y0', 'y1'].every((k) => finito(z[k])) && Number(z.x1) > Number(z.x0) && Number(z.y1) > Number(z.y0))) out.push(`${z.nombre || 'Zona'}: faltan sus límites (x0 < x1, y0 < y1).`)
    if (z.tipo === 'eje' && !z.cim) out.push(`${z.nombre || 'Tramo'}: elige la corrida y su eje.`)
  }
  if (!pos(a.limMedio)) out.push('Falta el asentamiento medio permisible (tabla 3.1.1.2.2.3 de la NTC-Cimentaciones 2023), mm.')
  if (!(finito(a.limDist) && Number(a.limDist) >= 0.001 - 1e-12 && Number(a.limDist) <= 0.003 + 1e-12)) out.push('Elige el límite de distorsión (tabla 6.2.2.1 de la NTC-Criterios y Acciones 2023, de 0.001 a 0.003).')
  if (!['w', 'apoyos', 'suma'].includes(a.carga)) out.push('Elige qué carga lleva cada franja: la w del diseño, las reacciones de los apoyos o las dos sumadas.')
  if (a.carga && a.carga !== 'apoyos') {
    const sinW = corridas.filter((z) => !finito(a.wCVmed?.[z.uid]))
    if (sinW.length && !a.cvMaxSiFalta) out.push(`Falta la w de CV media de ${sinW.map((z) => z.nombre).join(', ')} (o marca «usar la CV máxima donde falte la media»).`)
  }
  if (a.carga && a.carga !== 'w' && !conCasoMedio && !a.cvMaxSiFalta) out.push('Ningún caso de RAM tiene el papel «viva media (asentamientos)»: asígnalo en «Desde RAM» o marca «usar la CV máxima donde falte la media».')
  if (!pos(a.fInercia) || Number(a.fInercia) > 1) out.push('Falta el factor de la inercia agrietada de la CT y las ligas (Ie = f · Ig, 0 < f ≤ 1).')
  if (!pos(a.fcAsent)) out.push('Falta el factor de carga del hundimiento diferencial (M y V inducidos).')
  return out
}

// ── el semiespacio elástico ────────────────────────────────────
/** Esquina de un rectángulo a × b cargado (flexible), sin (1 − ν²) q / E */
export function esquina(a, b) {
  if (a <= 0 || b <= 0) return 0
  const r = Math.hypot(a, b)
  return (a * Math.log((b + r) / a) + b * Math.log((a + r) / b)) / Math.PI
}
const G = (X, Y) => Math.sign(X) * Math.sign(Y) * esquina(Math.abs(X), Math.abs(Y))
/**
 * Factor de influencia de un rectángulo [x1, x2] × [y1, y2] (coordenadas
 * relativas al punto): δ = q (1 − ν²) / E · S
 */
export function influencia(x1, x2, y1, y2) {
  return G(x2, y2) - G(x1, y2) - G(x2, y1) + G(x1, y1)
}

// ── las franjas ────────────────────────────────────────────────
/**
 * Las corridas y sus ejes con posición en planta (los que salieron de los
 * apoyos de RAM), cada apoyo con su reacción de hoy y su largo tributario.
 * @param cargas  por apoyo de A: { CM, CV, CVmed } (P en t; CVmed null si ningún caso tiene ese papel)
 */
export function franjasDe(A, cimientos, cargas, { conContratrabes = false } = {}) {
  const idx = new Map(A.apoyos.map((a, i) => [a.nudo, i]))
  const out = [], sinPos = []
  for (const z of cimientos.filter((x) => x.tipo === 'corrida' || (conContratrabes && x.tipo === 'contratrabe'))) {
    const o = z.origen?.ram || {}
    const ejes = z.tipo === 'contratrabe'
      ? [{ nudos: o.nudos, ...volados(z.columnas, z.geo?.L), k: 0 }, ...(z.ejes || []).map((e, i) => ({ nudos: e.nudos, ...volados(e.columnas || z.columnas, e.L ?? z.geo?.L), k: i + 1 }))]
      : [{ nudos: o.nudos, v0: o.v0, v1: o.v1, k: 0 }, ...(z.ejes || []).map((e, i) => ({ ...e, k: i + 1 }))]
    let alguno = false
    for (const e of ejes) {
      const ns = (e.nudos || []).map(String).filter((n) => idx.has(n))
      if (ns.length < 2) continue
      alguno = true
      const pts = ns.map((n) => ({ n, a: A.apoyos[idx.get(n)], c: cargas[idx.get(n)] }))
      // el eje: de los dos apoyos más lejanos
      let p = pts[0], q = pts[1], dMax = -1
      for (const s of pts) for (const t of pts) { const d = Math.hypot(t.a.x - s.a.x, t.a.y - s.a.y); if (d > dMax) { dMax = d; p = s; q = t } }
      const u = [(q.a.x - p.a.x) / dMax, (q.a.y - p.a.y) / dMax]
      const orden = pts.map((s) => ({ ...s, t: (s.a.x - p.a.x) * u[0] + (s.a.y - p.a.y) * u[1] })).sort((x, y) => x.t - y.t)
      const v0 = Number.isFinite(e.v0) ? e.v0 : 0.5, v1 = Number.isFinite(e.v1) ? e.v1 : 0.5
      const t0 = orden[0].t
      const ini = [p.a.x + (t0 - v0) * u[0], p.a.y + (t0 - v0) * u[1]]
      const L = orden[orden.length - 1].t - t0 + v0 + v1
      const apoyos = orden.map((s, i) => {
        const atras = i === 0 ? v0 : (s.t - orden[i - 1].t) / 2
        const adelante = i === orden.length - 1 ? v1 : (orden[i + 1].t - s.t) / 2
        return { nudo: s.n, s: s.t - t0 + v0, Lt: atras + adelante, x: s.a.x, y: s.a.y, CM: num(s.c?.CM), CV: num(s.c?.CV), CVmed: s.c?.CVmed ?? null }
      })
      out.push({ z, k: e.k, ini, u, n: [-u[1], u[0]], L, B: num(z.geo?.B, 0.6), apoyos })
    }
    if (!alguno) sinPos.push(z)
  }
  return { franjas: out, sinPos }
}

/** Los volados de una contratrabe: de su orilla a la primera y a la última columna con nudo */
function volados(columnas, L) {
  const xs = (columnas || []).filter((c) => c.nudo != null).map((c) => num(c.x))
  if (!xs.length) return {}
  return { v0: Math.max(0, Math.min(...xs)), v1: Math.max(0, num(L) - Math.max(...xs)) }
}

/** La w CV media de la línea de una corrida: capturada o, si el ingeniero lo pidió, la CV máxima */
export function wLinea(z, a) {
  const med = a.wCVmed?.[z.uid]
  const cm = num(z.cargas?.CM?.w)
  if (finito(med)) return { CM: cm, CV: Number(med), cvMax: false }
  return { CM: cm, CV: num(z.cargas?.CV?.w), cvMax: true }
}

/** El estrato de un punto (con el escenario «zonas»; si no, el de toda la obra) */
export function estratoEn(a, x, y, f, escenario = 'zonas') {
  let id = a.base
  if (escenario === 'zonas') {
    for (const z of a.zonas || []) {
      if (z.tipo === 'rect' && x >= Number(z.x0) - 1e-9 && x <= Number(z.x1) + 1e-9 && y >= Number(z.y0) - 1e-9 && y <= Number(z.y1) + 1e-9) id = z.estrato
      if (z.tipo === 'eje' && f && z.cim === f.z.uid && Number(z.eje) === f.k) id = z.estrato
    }
  }
  return a.estratos.find((e) => e.id === id) || a.estratos[0]
}

/**
 * El cálculo completo. @returns { ok, faltan, paneles, franjas, tramos,
 * efectos, medio, checks, secciones } — si falta algo, `faltan` lo dice y no
 * hay números.
 */
export function asentamientos({ A, cimientos, cargas, asent, escenario = 'zonas', conCasoMedio = true, criterios = {}, suelo = {} }) {
  const a = { ...nuevoAsent(), ...(asent || {}) }
  if (a.metodo === 'viga') return asentViga({ A, cimientos, cargas, asent: a, escenario, conCasoMedio, criterios, suelo })
  const corridas = cimientos.filter((z) => z.tipo === 'corrida')
  const { franjas, sinPos } = A ? franjasDe(A, cimientos, cargas) : { franjas: [], sinPos: corridas }
  const faltan = faltantes(a, { conCasoMedio, corridas })
  if (!A) faltan.unshift('Falta el modelo de RAM sincronizado (las posiciones de los apoyos).')
  else if (!franjas.length) faltan.unshift('Ninguna corrida tiene ejes con apoyos de RAM: créalas o lígalas desde «Desde RAM».')
  if (faltan.length) return { ok: false, faltan, franjas, sinPos, paneles: [], tramos: [], efectos: [], checks: [], secciones: [] }

  // ── paneles con su carga ──
  const paneles = []
  const usaApoyos = a.carga !== 'w', usaW = a.carga !== 'apoyos'
  for (const f of franjas) {
    const wl = usaW ? wLinea(f.z, a) : { CM: 0, CV: 0, cvMax: false }
    f.wLinea = wl
    const n = Math.max(1, Math.ceil(f.L / MALLA - 1e-9))
    const ds = f.L / n
    f.ds = ds
    for (let i = 0; i < n; i++) {
      const s0 = i * ds, s1 = s0 + ds, sc = s0 + ds / 2
      let w = wl.CM + wl.CV
      if (usaApoyos) for (const p of f.apoyos) {
        // la reacción repartida en su tributario: lo que de él cae en este panel
        const ov = Math.max(0, Math.min(s1, segFin(f, p)) - Math.max(s0, segIni(f, p)))
        if (ov > 0) w += (p.CM + cvMedia(p, a)) / p.Lt * (ov / ds)
      }
      const x = f.ini[0] + sc * f.u[0], y = f.ini[1] + sc * f.u[1]
      paneles.push({ f, i, s0, s1, sc, ds, x, y, w, q: w / f.B, est: estratoEn(a, x, y, f, escenario) })
    }
  }

  // ── asentamientos ──
  for (const P of paneles) {
    if (a.modelo === 'winkler') { P.d = P.q / Number(P.est.ks); continue }
    let S = 0
    for (const Q of paneles) {
      const dx = (P.x - Q.x) * Q.f.u[0] + (P.y - Q.y) * Q.f.u[1]
      const dy = (P.x - Q.x) * Q.f.n[0] + (P.y - Q.y) * Q.f.n[1]
      S += Q.q * influencia(-Q.ds / 2 - dx, Q.ds / 2 - dx, -Q.f.B / 2 - dy, Q.f.B / 2 - dy)
    }
    const nu = Number(P.est.nu), E = Number(P.est.E)
    P.S = S
    P.d = (1 - nu * nu) / E * S
  }
  const dEn = (f, s) => {
    const ps = paneles.filter((P) => P.f === f)
    if (s <= ps[0].sc) return ps[0].d
    for (let i = 1; i < ps.length; i++) if (s <= ps[i].sc) return ps[i - 1].d + (ps[i].d - ps[i - 1].d) * (s - ps[i - 1].sc) / (ps[i].sc - ps[i - 1].sc)
    return ps[ps.length - 1].d
  }
  for (const f of franjas) for (const p of f.apoyos) p.d = dEn(f, p.s)

  // ── asentamiento medio ──
  const sumL = paneles.reduce((s, P) => s + P.ds, 0)
  const medio = paneles.reduce((s, P) => s + P.d * P.ds, 0) / sumL
  const dMax = Math.max(...paneles.map((P) => P.d)), dMin = Math.min(...paneles.map((P) => P.d))
  const limM = Number(a.limMedio) / 1000

  // ── distorsión entre apoyos ──
  const limD = Number(a.limDist)
  const tramos = []
  for (const f of franjas) for (let i = 0; i < f.apoyos.length - 1; i++) {
    const p = f.apoyos[i], q = f.apoyos[i + 1]
    const L = q.s - p.s
    const D = Math.abs(q.d - p.d)
    tramos.push({ f, p, q, L, D, dist: D / L, ok: D / L <= limD + 1e-12 })
  }

  // ── efecto en la CT de cada corrida y en las ligas ──
  const fI = Number(a.fInercia), FC = Number(a.fcAsent)
  const efectos = []
  for (const t of tramos) {
    if (!llevaCT(t.f.z)) continue
    const ct = ctDe(t.f.z)
    const m = { ...(t.f.z.mat || {}) }
    efectos.push(efectoViga({ que: `${ct.nombre} de ${t.f.z.nombre}`, tramo: t, L: t.L, D: t.D, sec: { b: ct.b, h: ct.h, sup: ct.sup, inf: ct.inf, est: ct.est, r: ct.r, rInf: ct.rInf, fc: num(m.fc, 250), fy: num(m.fy, 4200) }, fI, FC }))
  }
  const dNudo = new Map()
  for (const f of franjas) for (const p of f.apoyos) if (!dNudo.has(p.nudo)) dNudo.set(p.nudo, p.d)
  const ligasSin = []
  for (const z of cimientos.filter((x) => x.tipo === 'liga')) {
    const rec = recLiga(z.mat)
    for (const { c0, c1, eje, nEjes, i } of tramosLiga(z)) {
      // con un solo eje, los mismos textos de la 3.12
      const zE = nEjes > 1 ? `${z.nombre}, eje ${eje + 1}` : z.nombre
      const d0 = dNudo.get(String(c0.nudo)), d1 = dNudo.get(String(c1.nudo))
      if (d0 == null || d1 == null) { ligasSin.push(`${zE} (nudos ${c0.nudo} y ${c1.nudo})`); continue }
      const L = num(c1.x) - num(c0.x)
      efectos.push(efectoViga({ que: `${zE}, tramo ${i + 1}`, tramo: { p: { nudo: String(c0.nudo), d: d0 }, q: { nudo: String(c1.nudo), d: d1 } }, L, D: Math.abs(d1 - d0), sec: { b: num(z.geo?.b, 15), h: num(z.geo?.h, 30), sup: z.arm?.sup || { num: 4, n: 2 }, inf: z.arm?.inf || { num: 4, n: 2 }, est: z.arm?.est || { num: 2.5, ramas: 2, s: 15 }, r: rec.r, rInf: rec.rInf, fc: num(z.mat?.fc, 250), fy: num(z.mat?.fy, 4200) }, fI, FC }))
    }
  }

  // ── revisiones y memoria ──
  const peorT = tramos.reduce((x, y) => (!x || y.dist > x.dist ? y : x), null)
  const peorM = efectos.reduce((x, y) => (!x || y.uM > x.uM ? y : x), null)
  const peorV = efectos.reduce((x, y) => (!x || y.uV > x.uV ? y : x), null)
  const checks = [
    check('asentMedio', 'Asentamiento medio', mm(medio), Number(a.limMedio), 'mm', { grupo: 'Asentamientos', nota: a.limMedioNota || 'tabla 3.1.1.2.2.3' }),
    ...(peorT ? [check('distorsion', 'Distorsión entre apoyos', peorT.dist, limD, '', { grupo: 'Asentamientos', ok: tramos.every((t) => t.ok), nota: `rige ${peorT.p.nudo}–${peorT.q.nudo} de ${peorT.f.z.nombre}` })] : []),
    ...(peorM ? [check('asentM', 'Momento inducido', peorM.M, peorM.MR, 't·m', { grupo: 'Efecto en CT y ligas', ok: efectos.every((e) => e.okM), nota: peorM.que })] : []),
    ...(peorV ? [check('asentV', 'Cortante inducido', peorV.V, peorV.VR, 't', { grupo: 'Efecto en CT y ligas', ok: efectos.every((e) => e.okV), nota: peorV.que })] : []),
  ]
  const secciones = memoria({ a, escenario, franjas, paneles, medio, dMax, dMin, limM, tramos, limD, efectos, sinPos, ligasSin, fI, FC })
  return { ok: checks.every((c) => c.ok), faltan: [], franjas, sinPos, ligasSin, paneles, tramos, efectos, medio, dMax, dMin, checks, secciones, escenario }
}

/**
 * Los tramos de una trabe de liga entre nudos de RAM: los del eje del diseño
 * y los de cada eje ligado con «＋ en este eje» (3.13.1: antes sólo entraba
 * el primer eje). El eje 1 conserva la clave de la 3.13 (`uid:i`); los demás,
 * `uid:e<k>:i`.
 */
export function tramosLiga(z) {
  const ejes = [z.columnas || [], ...(z.ejes || []).map((e) => e.columnas || [])]
  const out = []
  ejes.forEach((cols, k) => {
    const cs = [...cols].filter((c) => c.nudo != null && c.nudo !== '').sort((p, q) => num(p.x) - num(q.x))
    for (let i = 0; i < cs.length - 1; i++) {
      const nombre = [z.nombre, ejes.length > 1 ? `eje ${k + 1}` : '', cs.length > 2 ? `tramo ${i + 1}` : ''].filter(Boolean).join(', ')
      out.push({ key: k === 0 ? `${z.uid}:${i}` : `${z.uid}:e${k}:${i}`, eje: k, nEjes: ejes.length, i, c0: cs[i], c1: cs[i + 1], nombre })
    }
  })
  return out
}

const segIni = (f, p) => p.s - (p === f.apoyos[0] ? p.s : (p.s - f.apoyos[f.apoyos.indexOf(p) - 1].s) / 2)
const segFin = (f, p) => { const i = f.apoyos.indexOf(p); return i === f.apoyos.length - 1 ? f.L : p.s + (f.apoyos[i + 1].s - p.s) / 2 }
/** La CV media de un apoyo: el caso «viva media» o, si el ingeniero lo pidió, la máxima */
export const cvMedia = (p, a) => (p.CVmed != null ? p.CVmed : a.cvMaxSiFalta ? p.CV : 0)

/** MR y VR de una sección rectangular con sus dos lechos y estribos (igual que la liga) */
export function resistencias({ b, h, sup, inf, est, r, rInf, fc, fy }) {
  const ve = varilla(est.num), vs = varilla(sup.num), vi = varilla(inf.num)
  const rS = r + ve.diam + vs.diam / 2, rI = rInf + ve.diam + vi.diam / 2
  const fS = calcFlexion({ fc, fy, b, h, r: rS, MuTm: 1e-6, varNum: sup.num, varCount: sup.n })
  const fI = calcFlexion({ fc, fy, b, h, r: rI, MuTm: 1e-6, varNum: inf.num, varCount: inf.n })
  const cc = calcCortante({ fc, fy, b, h, r: Math.max(rS, rI), L: 1, VuTon: 1e-6, AsUsada: Math.min(sup.n * vs.area, inf.n * vi.area), varEstNum: est.num, nramas: est.ramas, conCompresion: false })
  const Av = est.ramas * ve.area
  const VR = cc.Vcr + (0.75 * Av * fy * cc.d) / est.s / 1000
  return { MRsup: fS.error ? 0 : fS.MRT, MRinf: fI.error ? 0 : fI.MRT, VR, Vcr: cc.Vcr, d: cc.d }
}

/**
 * Lo que un diferencial Δ entre los extremos de una viga empotrada-empotrada
 * de claro L le induce: M = 6 EI Δ / L² (en los dos extremos, uno con tensión
 * arriba y el otro abajo) y V = 12 EI Δ / L³, por el factor de carga.
 */
export function efectoViga({ que, tramo, L, D, sec, fI, FC }) {
  const Ec = EcNTC(sec.fc)                                  // kg/cm²
  const Ig = (sec.b * sec.h ** 3) / 12                      // cm⁴
  const EI = Ec * fI * Ig                                   // kg·cm²
  const Lc = L * 100, Dc = D * 100
  const M = FC * 6 * EI * Dc / (Lc * Lc) / 1e5              // t·m
  const V = FC * 12 * EI * Dc / (Lc ** 3) / 1000            // t
  const R = resistencias(sec)
  const MR = Math.min(R.MRsup, R.MRinf)
  return { que, tramo, L, D, Ec, Ig, EI, M, V, MR, MRsup: R.MRsup, MRinf: R.MRinf, VR: R.VR, uM: MR > 0 ? M / MR : Infinity, uV: R.VR > 0 ? V / R.VR : Infinity, okM: M <= MR + 1e-9, okV: V <= R.VR + 1e-9, sec }
}

function memoria({ a, escenario, franjas, paneles, medio, dMax, dMin, limM, tramos, limD, efectos, sinPos, ligasSin, fI, FC }) {
  const s = []
  const modelo = a.modelo === 'elastico' ? 'elástico (semiespacio homogéneo, E y ν)' : 'Winkler (módulo de reacción ks)'
  const est = (e) => (a.modelo === 'elastico' ? `E = ${f2(Number(e.E))} t/m² · ν = ${f2(Number(e.nu))}` : `ks = ${f2(Number(e.ks))} t/m³`)
  s.push({
    titulo: 'Datos y criterio',
    pasos: [
      paso('Modelo del suelo', modelo, 'lo eligió el ingeniero', '', ''),
      paso('Estrato de toda la obra', a.estratos.find((e) => e.id === a.base)?.nombre || a.base, est(a.estratos.find((e) => e.id === a.base) || {}), '', ''),
      ...(escenario === 'zonas' ? (a.zonas || []).map((z) => {
        const e = a.estratos.find((x) => x.id === z.estrato) || {}
        return paso(z.nombre || (z.tipo === 'rect' ? 'Zona' : 'Tramo'), z.tipo === 'rect' ? `x ${f2(Number(z.x0))} a ${f2(Number(z.x1))} · y ${f2(Number(z.y0))} a ${f2(Number(z.y1))} m` : `eje ${Number(z.eje) + 1} de ${franjas.find((f) => f.z.uid === z.cim)?.z.nombre || 'la corrida'}`, `sobre ${e.nombre || e.id}: ${est(e)}`, '', '')
      }) : [paso('Escenario', 'todo sobre el estrato de la obra', 'las zonas no se usan', '', '')]),
      paso('Presión de servicio', 'q = (wCM + wCV media) / B', 'NTC-Cimentaciones 2023, 3.2.1.1.1: CV media', a.carga === 'w' ? 'w del diseño' : a.carga === 'apoyos' ? 'reacciones de los apoyos' : 'w del diseño + reacciones', ''),
      ...(a.carga !== 'w' ? [paso('Reacción de cada apoyo', 'w = (P CM + P CV media) / Lt', 'Lt: la mitad del claro a cada vecino, o el volado en la orilla', '', '')] : []),
      ...(a.cvMaxSiFalta ? [paso('CV media', 'donde falta, la CV máxima', 'del lado seguro; lo marcó el ingeniero', '', '')] : []),
      paso('Malla', `paneles de ≈ ${f2(MALLA)} m a lo largo de cada eje, con todo el ancho B`, `${paneles.length} paneles en ${franjas.length} ejes`, '', ''),
      paso('Simplificaciones', 'corrida flexible; asentamiento sobre su eje', a.modelo === 'elastico' ? 'semiespacio sin capas: con zonas, cada punto usa el E y ν del estrato bajo él' : 'cada panel asienta por su cuenta (sin interacción)', '', ''),
      ...(sinPos.length ? [paso('Sin posición en planta', sinPos.map((z) => z.nombre).join(', '), 'no tienen ejes con apoyos de RAM: no entran', '', '')] : []),
    ],
  })
  for (const f of franjas) {
    const ps = paneles.filter((P) => P.f === f)
    s.push({
      titulo: `${f.z.nombre}, eje ${f.k + 1} (nudos ${f.apoyos.map((p) => p.nudo).join(', ')})`,
      pasos: [
        paso('Franja', 'L · B', `${f2(f.L)} × ${f2(f.B)} m`, ps.length, 'paneles'),
        ...(a.carga !== 'apoyos' ? [paso('w de la línea', 'wCM + wCV media', `= ${f2(f.wLinea.CM)} + ${f2(f.wLinea.CV)}${f.wLinea.cvMax ? ' (CV máxima)' : ''}`, f.wLinea.CM + f.wLinea.CV, 't/m')] : []),
        ...(a.carga !== 'w' ? f.apoyos.map((p) => paso(`Nudo ${p.nudo}`, '(P CM + P CV media) / Lt', `= (${f2(p.CM)} + ${f2(cvMedia(p, a))}) / ${f2(p.Lt)}`, (p.CM + cvMedia(p, a)) / p.Lt, 't/m', { nota: p.CVmed == null ? 'CV máxima' : '' })) : []),
        paso('Presión de servicio', 'q = w / B', `de ${f2(Math.min(...ps.map((P) => P.q)))} a ${f2(Math.max(...ps.map((P) => P.q)))}`, Math.max(...ps.map((P) => P.q)), 't/m²'),
        ...f.apoyos.map((p) => paso(`δ en el nudo ${p.nudo}`, a.modelo === 'elastico' ? 'δ = (1 − ν²)/E · Σ q I' : 'δ = q / ks', '', mm(p.d), 'mm')),
      ],
    })
  }
  const Pm = paneles.reduce((x, y) => (y.d > x.d ? y : x))
  s.push({
    titulo: 'Asentamiento medio (NTC-Cimentaciones 2023, tabla 3.1.1.2.2.3)',
    pasos: [
      a.modelo === 'elastico'
        ? paso('Asentamiento de un punto', 'δ = (1 − ν²)/E · Σ q_i I_i', `I_i: rectángulo flexible con la fórmula de la esquina, (1/π)[a ln((b + r)/a) + b ln((a + r)/b)]`, '', '')
        : paso('Asentamiento de un punto', 'δ = q / ks', '', '', ''),
      a.modelo === 'elastico'
        ? paso('El punto que más asienta', `${Pm.f.z.nombre}, eje ${Pm.f.k + 1}, a ${f2(Pm.sc)} m`, `= (1 − ${f2(Number(Pm.est.nu))}²) / ${f2(Number(Pm.est.E))} × ${f3(Pm.S)}`, mm(Pm.d), 'mm')
        : paso('El punto que más asienta', `${Pm.f.z.nombre}, eje ${Pm.f.k + 1}, a ${f2(Pm.sc)} m`, `= ${f2(Pm.q)} / ${f2(Number(Pm.est.ks))}`, mm(Pm.d), 'mm'),
      paso('Asentamientos', 'mínimo · máximo', `${f2(mm(dMin))} · ${f2(mm(dMax))}`, '', 'mm'),
      paso('Asentamiento medio', 'Σ δ ds / Σ ds (todos los paneles)', '', mm(medio), 'mm', { ok: medio <= limM + 1e-12, lim: `≤ ${f2(Number(a.limMedio))} mm${a.limMedioNota ? ` (${a.limMedioNota})` : ''}` }),
    ],
  })
  s.push({
    titulo: `Distorsión entre apoyos (NTC-Criterios y Acciones 2023, tabla 6.2.2.1: límite ${limD})`,
    pasos: tramos.map((t) => paso(`${t.f.z.nombre}, ${t.p.nudo}–${t.q.nudo}`, '|δb − δa| / L', `= |${f2(mm(t.q.d))} − ${f2(mm(t.p.d))}| mm / ${f2(t.L)} m`, t.dist, '', { ok: t.ok, lim: `≤ ${limD}` })),
  })
  s.push({
    titulo: 'Efecto del diferencial en la CT y las ligas (empotrada-empotrada, EI agrietado)',
    pasos: [
      paso('Rigidez', `EI = Ec · ${f2(fI)} Ig (Ie/Ig del ingeniero)`, `Ec: la de Deflexiones (NTC-Concreto, 14000 √f′c clase 1) · factor de carga ${f2(FC)}`, '', ''),
      ...efectos.flatMap((e) => [
        paso(e.que, `Δ = ${f2(mm(e.D))} mm · L = ${f2(e.L)} m`, `Ec = ${Math.round(e.Ec)} kg/cm² · Ig = ${Math.round(e.Ig)} cm⁴`, '', ''),
        paso('Momento inducido', `M = ${f2(FC)} × 6 EI Δ / L²`, `= ${f2(FC)} × 6 × ${(e.EI / 1e9).toFixed(3)}e9 × ${f3(e.D * 100)} / ${f1(e.L * 100)}²`, e.M, 't·m', { ok: e.okM, lim: `≤ MR = ${f2(e.MR)} (el menor de arriba ${f2(e.MRsup)} y abajo ${f2(e.MRinf)})` }),
        paso('Cortante inducido', `V = ${f2(FC)} × 12 EI Δ / L³`, '', e.V, 't', { ok: e.okV, lim: `≤ VR = ${f2(e.VR)}` }),
      ]),
      ...(ligasSin.length ? [paso('Ligas sin asentamiento en sus apoyos', ligasSin.join(', '), 'sus nudos no están sobre una corrida con malla', '', '')] : []),
      paso('Nota', 'es sólo el efecto del diferencial', 'no se suma a la flexión por gravedad: eso lo decide el ingeniero', '', ''),
    ],
  })
  return s
}

/** Color de un asentamiento entre dMin y dMax (azul poco, rojo mucho) */
export function colorDe(d, dMin, dMax) {
  const t = dMax > dMin + 1e-15 ? Math.min(1, Math.max(0, (d - dMin) / (dMax - dMin))) : 0.5
  const pal = [[49, 97, 168], [62, 160, 170], [130, 190, 110], [232, 180, 60], [198, 60, 40]]
  const x = t * (pal.length - 1), i = Math.min(pal.length - 2, Math.floor(x)), r = x - i
  const c = pal[i].map((v, j) => Math.round(v + (pal[i + 1][j] - v) * r))
  return `rgb(${c[0]},${c[1]},${c[2]})`
}
