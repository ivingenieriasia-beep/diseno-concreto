// ══════════════════════════════════════════════════════════════
// Agrupación de columnas: la misma idea que la de trabes, pero con
// flexocompresión.
//
//   1. Cada columna del modelo es un ELEMENTO: la columna completa, de la
//      cimentación a la azotea (misma sección en toda la altura), o cada
//      entrepiso por separado.
//   2. Su demanda son los puntos (P, Mx, My) SIMULTÁNEOS de cada combinación,
//      en el pie y en la cabeza (sincronizar.py los guarda así). Mx = |M33|
//      trabaja el peralte h, My = |M22| el ancho b, como en el módulo Columnas.
//   3. Cada sección del catálogo tiene su diagrama de interacción con un
//      armado de referencia (el que da una cuantía cercana al 2 %, que se
//      puede armar). El APROVECHAMIENTO de una columna en esa sección es qué
//      tanto habría que crecer su demanda —P y M juntos, en la misma
//      proporción— para tocar la frontera: 100 % = justo en el diagrama.
//   4. A partir de ahí es el mismo agrupador: sección mínima de cada columna,
//      clases, tres umbrales, acomodo manual. Cada grupo pasa por la Fase 1
//      (proponerColumna, el motor del módulo Columnas): armado y veredicto.
// ══════════════════════════════════════════════════════════════

import { analyzeColumn, checkPoint, bdLookup } from './columnCalculator'
import { arreglosColumna, proponerColumna } from './propuesta'
import { SECCIONES_RAM } from './catalogoRam'
import { memberKind, planAxes } from './modelView'
import { sectionDims } from './geometry'
import {
  UMBRALES, agrupar, seccionMinima, aprovechamiento, geometria, gira, flechasDeEjes, GIRO_RAM,
} from './agrupacion'

const RECUB = 3
const FC = 250
/** Cuantía del armado de referencia con que se dimensiona */
export const RHO_COL_DIM = 0.02

const area = (s) => s.b * s.h
const lado = (s) => Math.min(s.b, s.h)

/** Las columnas del catálogo, de menos a más concreto (a igual área, la más cuadrada) */
export const COLUMNAS_CATALOGO = SECCIONES_RAM
  .filter((s) => s.tipo === 'columna')
  .sort((a, b) => area(a) - area(b) || lado(b) - lado(a))

/** Las que se proponen de fábrica: lado menor de 20 cm o más (las otras son castillos) */
export const COLUMNAS_DE_FABRICA = COLUMNAS_CATALOGO.filter((s) => lado(s) >= 20).map((s) => s.nombre)

/** Las columnas del catálogo que se pueden proponer */
export function candidatasColumna(permitidas = COLUMNAS_DE_FABRICA) {
  const quiero = new Set(permitidas)
  return COLUMNAS_CATALOGO.filter((s) => quiero.has(s.nombre))
}

// ── El diagrama de cada sección ──────────────────────────────

/**
 * El armado con que se dimensiona: el arreglo perimetral (mismas reglas que
 * la Fase 1) con menos barras cuya cuantía quede entre 1.5 % y 2.5 %; si
 * ninguno cae ahí, el más cercano a RHO_COL_DIM. Es lo que se armaría.
 */
export function armadoDeReferencia(s) {
  const Ag = s.b * s.h
  const cals = lado(s) >= 20 ? ['4', '5', '6', '8'] : ['3', '4', '5', '6', '8']
  const todos = cals.flatMap((num) => arreglosColumna(s.b, s.h, RECUB, num))
  const rho = (c) => c.As / Ag
  const d = (c) => Math.abs(rho(c) - RHO_COL_DIM)
  const banda = todos.filter((c) => rho(c) >= 0.015 - 1e-9 && rho(c) <= 0.025 + 1e-9)
  if (banda.length) return [...banda].sort((a, b) => a.nBarras - b.nBarras || d(a) - d(b))[0]
  const enRango = todos.filter((c) => rho(c) >= 0.01 - 1e-9 && rho(c) <= 0.04 + 1e-9)
  return [...(enRango.length ? enRango : todos)].sort((a, b) => d(a) - d(b) || a.nBarras - b.nBarras)[0] || null
}

/** Texto de un armado: «8#5 (ρ 1.76 %)» */
export function textoArmado(arm, s) {
  if (!arm) return '—'
  const porCal = new Map()
  for (const L of arm.lechos) porCal.set(L.num, (porCal.get(L.num) || 0) + L.n)
  const barras = [...porCal].map(([num, n]) => `${n}#${num}`).join(' + ')
  const As = arm.lechos.reduce((t, L) => t + L.n * bdLookup(L.num).area, 0)
  return `${barras} (ρ ${((As / (s.b * s.h)) * 100).toFixed(2)} %)`
}

/** MR(P) de una curva en tabla, para no recorrerla en cada punto */
function tablaMR(curve, N = 240) {
  const Ps = curve.map((p) => p.P)
  const Pmin = Math.min(...Ps), Pmax = Math.max(...Ps)
  const MR = new Float64Array(N + 1)
  for (let i = 0; i <= N; i++) MR[i] = checkPoint(curve, Pmin + ((Pmax - Pmin) * i) / N, 0).MR
  return {
    Pmin, Pmax,
    /** −1 fuera del rango de P */
    at(P) {
      if (P < Pmin - 1e-9 || P > Pmax + 1e-9) return -1
      const t = Math.min(N, Math.max(0, ((P - Pmin) / (Pmax - Pmin || 1)) * N))
      const i = Math.min(N - 1, Math.floor(t))
      return MR[i] + (MR[i + 1] - MR[i]) * (t - i)
    },
  }
}

const DIAGRAMAS = new Map()

/** El diagrama de interacción de una sección con su armado de referencia (se calcula una vez) */
export function diagramaDe(s) {
  const k = `${s.b}|${s.h}`
  if (!DIAGRAMAS.has(k)) {
    const arm = armadoDeReferencia(s)
    const col = { b: s.b, h: s.h, r: RECUB, fc: FC, fy: 4200, nLechos: arm?.nh || 2, lechos: arm?.lechos || [] }
    const an = analyzeColumn(col)
    DIAGRAMAS.set(k, { arm, col, an, x: tablaMR(an.dirX.curve), y: tablaMR(an.dirY.curve), texto: textoArmado(arm, s) })
  }
  return DIAGRAMAS.get(k)
}

/**
 * Qué tanto usa un punto (P, Mx, My) el diagrama: 1/λ, con λ lo que hay que
 * multiplicar el punto para llegar a la frontera. El contorno es el mismo que
 * revisa el módulo Columnas: dentro del rango de P y (Mx/MRx)² + (My/MRy)² ≤ 1.
 */
export function usoPunto(D, p) {
  const { P, Mx, My } = p
  if (Math.abs(P) < 1e-9 && Mx < 1e-9 && My < 1e-9) return 0
  const dentro = (k) => {
    const q = k * P
    const mx = D.x.at(q), my = D.y.at(q)
    if (mx < 0 || my < 0) return false
    const a = mx > 1e-9 ? (k * Mx) / mx : (k * Mx > 1e-9 ? Infinity : 0)
    const b = my > 1e-9 ? (k * My) / my : (k * My > 1e-9 ? Infinity : 0)
    return a * a + b * b <= 1
  }
  let lo = 0, hi = 1
  if (dentro(1)) {
    lo = 1; hi = 2
    while (dentro(hi)) { lo = hi; hi *= 2; if (hi > 1e6) return 0 }
  }
  for (let i = 0; i < 34; i++) {
    const mid = (lo + hi) / 2
    if (dentro(mid)) lo = mid; else hi = mid
  }
  return lo > 0 ? 1 / lo : Infinity
}

/** El punto que manda de una columna en una sección, con su aprovechamiento */
export function criticoDe(e, s) {
  const D = diagramaDe(s)
  let mejor = null
  for (const p of e.puntos) {
    const u = usoPunto(D, p)
    if (!mejor || u > mejor.u) mejor = { ...p, u }
  }
  return mejor
}

// ── Qué hay en el modelo ─────────────────────────────────────

/** b × h de un grupo: las medidas reales de la tabla o, si no vinieron, las del nombre */
function medidasDeGrupo(g) {
  if (g?.medidas) return { b: g.medidas.b, h: g.medidas.h }
  const d = sectionDims(g?.seccion || '')
  return d ? { b: d.b, h: d.h } : { b: null, h: null }
}

/**
 * Las columnas de los grupos elegidos, como elementos: la columna completa
 * (`completa`) o un elemento por entrepiso, cortando donde llega una trabe.
 */
export function elementosColumna(R, nombres, { completa = true } = {}) {
  const G = geometria(R)
  const quiero = new Set(nombres)
  const grupos = (R.grupos || []).filter((g) => quiero.has(g.nombre))
  const mb = new Map()
  for (const g of grupos) for (const m of g.perfil.members) mb.set(String(m.id), m)
  const puntosDe = new Map()
  for (const g of grupos) {
    for (const p of g.points || []) {
      const k = String(p.member)
      if (!puntosDe.has(k)) puntosDe.set(k, [])
      puntosDe.get(k).push(p)
    }
  }
  const medidasDe = new Map((R.grupos || []).map((g) => [g.nombre, medidasDeGrupo(g)]))
  const nodoDe = (id) => G.nodes.get(id)
  const esVertical = (r) => {
    const a = nodoDe(r.nj), b = nodoDe(r.nk)
    return a && b && memberKind(a, b, G.up) === 'columna'
  }

  // nudos a los que llega algo horizontal: ahí empieza otro entrepiso
  const conTrabe = new Set()
  for (const r of G.rows) {
    const a = nodoDe(r.nj), b = nodoDe(r.nk)
    if (a && b && memberKind(a, b, G.up) === 'trabe') { conTrabe.add(r.nj); conTrabe.add(r.nk) }
  }
  const verticales = [...mb.keys()].map((id) => G.porId.get(id)).filter((r) => r && esVertical(r))
  const porNudo = new Map()
  for (const r of verticales) {
    for (const n of [r.nj, r.nk]) {
      if (!porNudo.has(n)) porNudo.set(n, [])
      porNudo.get(n).push(r)
    }
  }
  const alto = (r) => Math.min(nodoDe(r.nj)[G.up], nodoDe(r.nk)[G.up])
  const visto = new Set()
  const cadenas = []
  for (const r0 of [...verticales].sort((a, b) => alto(a) - alto(b) || (+a.member || 0) - (+b.member || 0))) {
    if (visto.has(r0.member)) continue
    const cad = [r0]
    visto.add(r0.member)
    // hacia arriba y hacia abajo, mientras el nudo tenga una sola continuación
    for (const sube of [true, false]) {
      let cur = sube ? cad[cad.length - 1] : cad[0]
      for (;;) {
        const a = nodoDe(cur.nj), b = nodoDe(cur.nk)
        const n = (a[G.up] > b[G.up]) === sube ? cur.nj : cur.nk
        if (!completa && conTrabe.has(n)) break
        const sig = (porNudo.get(n) || []).filter((x) => x !== cur && !visto.has(x.member))
        if (sig.length !== 1) break
        visto.add(sig[0].member)
        if (sube) cad.push(sig[0]); else cad.unshift(sig[0])
        cur = sig[0]
      }
    }
    cadenas.push(cad)
  }

  return cadenas.map((cad) => {
    const ids = cad.map((r) => String(r.member))
    const largo = (r) => { const a = nodoDe(r.nj), b = nodoDe(r.nk); return Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z) }
    const zs = cad.flatMap((r) => [nodoDe(r.nj)[G.up], nodoDe(r.nk)[G.up]])
    const crudos = ids.flatMap((id) => puntosDe.get(id) || [])
    const puntos = crudos.map((p) => ({
      P: p.P, Mx: Math.abs(p.m33 || 0), My: Math.abs(p.m22 || 0), member: String(p.member), tipo: p.tipo, id: p.id,
    }))
    // la sección de hoy: la de la mayoría de su altura
    const cuenta = new Map()
    for (const r of cad) {
      const m = mb.get(String(r.member))
      const k = `${m.grupo}|${m.seccion}`
      cuenta.set(k, (cuenta.get(k) || 0) + largo(r))
    }
    const [grupo, seccion] = [...cuenta].sort((a, b) => b[1] - a[1])[0][0].split('|')
    const med = medidasDe.get(grupo)
    const e = {
      id: ids[0], tipo: 'columna', miembros: ids,
      L: cad.reduce((s, r) => s + largo(r), 0),
      H: Math.max(...cad.map(largo)),
      zBot: Math.min(...zs), zTop: Math.max(...zs),
      puntos, crudos,
      Pu: Math.max(0, ...puntos.map((p) => p.P)),
      Mux: Math.max(0, ...puntos.map((p) => p.Mx)),
      Muy: Math.max(0, ...puntos.map((p) => p.My)),
      // sin M22 en todos sus puntos: un modelo.json de antes del script con fuerzas simultáneas
      sinM22: puntos.length > 0 && puntos.every((p) => p.tipo === 'Max' || p.tipo === 'Min'),
      hoy: { grupo, seccion, b: med?.b ?? null, h: med?.h ?? null },
    }
    e.uso = (s) => (e.puntos.length ? Math.max(...e.puntos.map((p) => usoPunto(diagramaDe(s), p))) : 0)
    return e
  })
}

/**
 * Todo de una vez, como proponerAgrupacion pero con columnas.
 * @returns { tipo:'columna', elementos, cands, hoy, natural, propuestas, sinM22, noVerticales }
 */
export function proponerColumnas(R, nombres, { permitidas = COLUMNAS_DE_FABRICA, completa = true } = {}) {
  const cands = candidatasColumna(permitidas)
  const els = elementosColumna(R, nombres, { completa })
  for (const e of els) e.minima = seccionMinima(e, cands)
  const quiero = new Set(nombres)
  const enGrupos = (R.grupos || []).filter((g) => quiero.has(g.nombre)).reduce((s, g) => s + g.n, 0)
  const enElementos = els.reduce((s, e) => s + e.miembros.length, 0)
  const hoyConcreto = els.reduce((s, e) => s + (e.hoy.b && e.hoy.h ? (e.L * e.hoy.b * e.hoy.h) / 1e4 : 0), 0)
  const op = { prefijo: 'C' }
  return {
    tipo: 'columna',
    elementos: els,
    cands,
    completa,
    noVerticales: enGrupos - enElementos,
    sinM22: els.some((e) => e.sinM22),
    hoy: { grupos: new Set(els.map((e) => e.hoy.grupo)).size, concreto: hoyConcreto },
    natural: agrupar(els, cands, Infinity, op),
    propuestas: UMBRALES.map((u) => ({ ...u, ...agrupar(els, cands, u.tau, op) })),
  }
}

// ── Verificar un grupo con la Fase 1 ─────────────────────────

/** kg de acero de una columna armada: longitudinal y estribos, por metro de altura */
function kgPorMetro(col) {
  const As = (col.lechos || []).reduce((s, L) => s + (+L.n || 0) * bdLookup(L.num).area, 0)
  const long = As * 0.785                                    // kg/m (7850 kg/m³)
  const est = bdLookup(col.estriboNum || '2.5').area
  const perimetro = 2 * (col.b + col.h - 4 * RECUB) + 20       // cm, con sus ganchos
  const sExt = +col.sepExt || 15, sCen = +col.sepCen || sExt
  const s = (sExt + sCen) / 2                                  // cm, promedio entre extremos y centro
  return long + ((100 / s) * perimetro * est * 0.785) / 100
}

/**
 * Arma el grupo como una columna del módulo Columnas, con TODOS los puntos de
 * sus miembros como envolvente, y le pide el armado a la Fase 1.
 * @returns { estado, texto, kg, motivos, avisos, patch, n } | null
 */
export function verificarColumnas(R, grupo) {
  const points = grupo.elems.flatMap((e) => e.crudos)
  if (!points.length || !grupo.sec) return null
  const H = Math.max(...grupo.elems.map((e) => e.H))
  const col = {
    nombre: grupo.nombre, b: grupo.sec.b, h: grupo.sec.h, r: RECUB, fc: FC, fy: 4200, estriboNum: '2.5',
    nLechos: 2, lechos: [], envelope: { points, mapping: 'M33X' },
  }
  const r = proponerColumna(col, { H })
  if (!r) return null
  const L = grupo.elems.reduce((s, e) => s + e.L, 0)
  const kg = r.patch?.lechos ? kgPorMetro({ ...col, ...r.patch }) * L : 0
  return { ...r, kg }
}

// ── La planta ────────────────────────────────────────────────

/**
 * Las columnas en planta: un cuadro por columna, sobre las trabes del nivel
 * (en gris, para ubicarse). Con `completa`, una sola planta; si no, una por
 * entrepiso (el de abajo de cada nivel de trabes).
 * Misma forma que planos() de las trabes, para usar el mismo dibujo.
 */
export function planosColumnas(R, elems, { giro = GIRO_RAM, completa = true, tol = 0.25 } = {}) {
  const G = geometria(R)
  const [h, k] = planAxes(G.up)
  const P = (n) => gira(n[h], n[k], giro)
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity
  const ver = (x, y) => { minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y) }

  // las trabes, por altura
  const trabes = []
  for (const r of G.rows) {
    const a = G.nodes.get(r.nj), b = G.nodes.get(r.nk)
    if (!a || !b || memberKind(a, b, G.up) !== 'trabe') continue
    const s = [...P(a), ...P(b)]
    trabes.push({ z: (a[G.up] + b[G.up]) / 2, s })
    ver(s[0], s[1]); ver(s[2], s[3])
  }
  const alturas = []
  for (const t of [...trabes].sort((a, b) => a.z - b.z)) {
    if (!alturas.some((v) => Math.abs(v - t.z) <= tol)) alturas.push(t.z)
  }

  const porId = new Map()
  for (const e of elems) {
    const r = G.porId.get(e.miembros[0])
    const a = r && G.nodes.get(r.nj)
    if (!a) continue
    const [x, y] = P(a)
    ver(x, y)
    porId.set(e.id, { segs: [[x, y, x, y]], punto: [x, y], cx: x, cy: y, z: e.zTop, caja: [x, y, x, y] })
  }

  const niveles = []
  if (completa) {
    const ids = [...porId.keys()]
    niveles.push({
      n: 1, v: Math.max(0, ...elems.map((e) => e.zTop)), ids, etiqueta: 'Toda la altura',
      titulo: `${ids.length} columna(s), de la base a la azotea`,
      contexto: dedupe(trabes.map((t) => t.s)),
    })
  } else {
    const zBotDe = new Map(elems.map((e) => [e.id, e.zBot]))
    for (const [id, g] of [...porId].sort((a, b) => a[1].z - b[1].z)) {
      let N = niveles.find((n) => Math.abs(n.v - g.z) <= tol)
      if (!N) niveles.push((N = { v: g.z, ids: [], bajo: zBotDe.get(id) }))
      N.ids.push(id)
      N.bajo = Math.min(N.bajo, zBotDe.get(id))
    }
    niveles.sort((a, b) => a.v - b.v)
    niveles.forEach((N, i) => {
      N.n = i + 1
      N.v = Math.round(N.v * 1000) / 1000
      N.etiqueta = `E${N.n}`
      N.titulo = `${G.up} ${N.bajo.toFixed(2)} → ${N.v.toFixed(2)} m`
      // las trabes que cargan esas columnas: las del nivel de arriba
      N.contexto = trabes.filter((t) => Math.abs(t.z - N.v) <= tol).map((t) => t.s)
      for (const id of N.ids) porId.get(id).nivel = N.n
    })
  }
  if (completa) for (const g of porId.values()) g.nivel = 1
  if (!Number.isFinite(minX)) { minX = 0; maxX = 1; minY = 0; maxY = 1 }
  return {
    up: G.up, ejes: [h, k], flechas: flechasDeEjes(giro), giro, niveles, porId, columnas: [],
    bounds: { minX, minY, maxX, maxY, w: Math.max(maxX - minX, 0.1), h: Math.max(maxY - minY, 0.1) },
  }
}

/** Un segmento por posición en planta (las trabes de varios niveles se enciman) */
function dedupe(segs) {
  const k = (s) => {
    const [a, b] = [[s[0], s[1]], [s[2], s[3]]].sort((p, q) => p[0] - q[0] || p[1] - q[1])
    return [...a, ...b].map((v) => v.toFixed(2)).join(',')
  }
  const m = new Map()
  for (const s of segs) m.set(k(s), s)
  return [...m.values()]
}

/** Para el diagrama: los puntos de unas columnas evaluados contra el de una sección */
export function nubeDe(elems, s) {
  const D = diagramaDe(s)
  return elems.flatMap((e) => e.puntos.map((p) => {
    const u = usoPunto(D, p)
    return { id: `${e.id}|${p.id}`, member: p.member, tipo: p.tipo, Pu: p.P, Mux: p.Mx, Muy: p.My, util: u, ok: u <= 1 + 1e-9, col: e.id }
  }))
}

export { aprovechamiento }
