// ══════════════════════════════════════════════════════════════
// Agrupación: de un modelo sin agrupar (todo 15×20 para iterar, o sin
// descripciones) a unas pocas T con su sección.
//
//   1. Las trabes continuas se encadenan en ELEMENTOS, aunque hoy sus tramos
//      lleven descripciones distintas: una trabe es una sola sección.
//   2. A cada elemento su demanda (Mu+, Mu−, Vu, con los picos exactos de la
//      API) y su SECCIÓN MÍNIMA: la de menos concreto del catálogo que da el
//      momento con una cuantía cómoda y el cortante con estribos que se
//      pueden armar.
//   3. Los elementos con la misma sección mínima forman una CLASE. De la más
//      grande a la más chica, una clase sube a la sección del grupo de arriba
//      si cabe y si su elemento más pesado la aprovecharía al menos al
//      umbral. Tres umbrales, tres propuestas: más bajo, menos grupos.
//   4. Cada grupo pasa por el motor de la Fase 1: armado, acero y veredicto.
//
// Las demandas son las del análisis con las secciones de HOY. Cambiar las
// secciones cambia las rigideces y con ellas los momentos: esto es la
// primera iteración, no la última. Aplicar, reanalizar y volver a agrupar.
// ══════════════════════════════════════════════════════════════

import { chainMembers, sectionDims } from './geometry'
import { buildElement, memberProfile } from './longitudinal'
import { calcCortante, beta1 } from './sectionCalculator'
import { memberKind, detectUpAxis, planAxes } from './modelView'
import { SECCIONES_RAM } from './catalogoRam'
import { proponerTrabe } from './propuesta'

/** Tres propuestas, de pocos grupos a ajustada */
export const UMBRALES = [
  { id: 'pocos', nombre: 'Pocos grupos', tau: 0.5 },
  { id: 'equilibrada', nombre: 'Equilibrada', tau: 0.65 },
  { id: 'ajustada', nombre: 'Ajustada', tau: 0.8 },
]

// Para DIMENSIONAR (no para armar: el armado lo da la Fase 1):
//   flexión con ρ = ½ ρbal — con eso una trabe se arma cómoda y es dúctil;
//   cortante con estribos #2.5 de dos ramas a no menos de 8 cm, el límite
//   por debajo del cual la propuesta de la Fase 1 ya avisa de que falta peralte.
const RHO_DIM = 0.5
const S_MIN = 8
const RECUB = 3

const area = (s) => s.b * s.h

/** Las vigas del catálogo que se pueden proponer, de menos a más concreto */
export function candidatas(anchos = [15, 20, 25]) {
  return SECCIONES_RAM
    .filter((s) => s.tipo === 'viga' && anchos.includes(s.b))
    .sort((a, b) => area(a) - area(b) || b.h - a.h)       // a igual área, la más peraltada
}

/** Lo que una sección da para dimensionar: MR y Vr, en t·m y t */
export function capacidad(b, h, { fc = 250, fy = 4200, r = RECUB, L = 5 } = {}) {
  const d = h - r
  const fcr = 0.85 * fc
  const rhoBal = (beta1(fc) * fcr / fy) * (6000 / (6000 + fy))
  const As = RHO_DIM * rhoBal * b * d
  const a = (As * fy) / (fcr * b)
  const MR = (0.9 * As * fy * (d - a / 2)) / 1e5
  const c = calcCortante({ fc, fy, b, h, r, L, VuTon: 0.0001, AsUsada: As, varEstNum: 2.5, nramas: 2 })
  let Vs = (c.FR * c.Av * fy * c.d) / S_MIN
  // Si el acero de cortante pasa de 1.1·√f'c·b·d (con FR), la separación
  // máxima baja a d/4 — la misma regla que aplica la calculadora. En una
  // sección de poco peralte d/4 queda por debajo de S_MIN: más cortante que
  // ése ya no se arma con estribos cómodos, pide peralte.
  if (c.d / 4 < S_MIN) Vs = Math.min(Vs, c.FR * 1.1 * Math.sqrt(fc) * b * c.d)
  const Vr = Math.min((c.VcrKg + Vs) / 1000, c.VaMax)
  return { MR, Vr }
}

// El acomodo manual lo recalcula en cada clic: se guarda por elemento
const USOS = new WeakMap()

/** Qué tanto usaría el elemento esa sección: 1 = justo */
export function aprovechamiento(e, s) {
  let m = USOS.get(e)
  if (!m) USOS.set(e, (m = new Map()))
  const k = `${s.b}|${s.h}`
  if (!m.has(k)) {
    const c = capacidad(s.b, s.h, { L: e.L })
    m.set(k, Math.max(e.Mu / c.MR, e.Vu / c.Vr))
  }
  return m.get(k)
}

/** La sección de menos concreto que le basta al elemento */
export function seccionMinima(e, cands) {
  for (const s of cands) if (aprovechamiento(e, s) <= 1 + 1e-9) return { sec: s, fuera: false }
  // nada alcanza: la que menos se pasa, y marcada
  const mejor = [...cands].sort((a, b) => aprovechamiento(e, a) - aprovechamiento(e, b))[0]
  return { sec: mejor, fuera: true }
}

// ── Qué hay hoy en el modelo ─────────────────────────────────

/** b × h de un grupo: las medidas reales de la tabla o, si no vinieron, las del nombre */
function medidasDeGrupo(g) {
  if (g?.medidas) return { b: g.medidas.b, h: g.medidas.h }
  const d = sectionDims(g?.seccion || '')
  return d ? { b: d.b, h: d.h } : { b: null, h: null }
}

function geometria(R) {
  const nodes = new Map(Object.entries(R.model?.nodes || {}))
  const rows = R.model?.rows || []
  return { nodes, rows, up: detectUpAxis(nodes), porId: new Map(rows.map((r) => [String(r.member), r])) }
}

/**
 * Los grupos de hoy (descripciones de RAM), para escoger cuáles agrupar.
 * Se sugieren las trabes de 15 cm o más: las nervaduras y las columnas no.
 * @returns [{ nombre, n, seccion, b, h, tipo, sugerido }]
 */
export function inventario(R) {
  const G = geometria(R)
  return (R.grupos || []).map((g) => {
    const tipos = { trabe: 0, columna: 0, otro: 0 }
    for (const m of g.perfil.members) {
      const r = G.porId.get(String(m.id))
      const a = r && G.nodes.get(r.nj), b = r && G.nodes.get(r.nk)
      const k = a && b ? memberKind(a, b, G.up) : 'otro'
      tipos[k === 'trabe' || k === 'columna' ? k : 'otro']++
    }
    const tipo = tipos.trabe >= tipos.columna && tipos.trabe >= tipos.otro ? 'trabe' : tipos.columna >= tipos.otro ? 'columna' : 'otro'
    const { b, h } = medidasDeGrupo(g)
    return { nombre: g.nombre, n: g.n, seccion: g.seccion, b, h, tipo, sugerido: tipo === 'trabe' && !(b !== null && b < 15) }
  })
}

/**
 * Los elementos (trabes continuas) de los grupos elegidos, con su demanda.
 * Sólo miembros horizontales, aunque un grupo mezcle.
 */
export function elementos(R, nombres) {
  const G = geometria(R)
  const quiero = new Set(nombres)
  const miembros = (R.grupos || []).filter((g) => quiero.has(g.nombre)).flatMap((g) => g.perfil.members)
  const horiz = miembros.filter((m) => {
    const r = G.porId.get(String(m.id))
    const a = r && G.nodes.get(r.nj), b = r && G.nodes.get(r.nk)
    return a && b && memberKind(a, b, G.up) === 'trabe'
  })
  const porId = new Map(horiz.map((m) => [String(m.id), m]))
  const medidasDe = new Map((R.grupos || []).map((g) => [g.nombre, medidasDeGrupo(g)]))
  return chainMembers(G.rows, G.nodes, horiz.map((m) => m.id)).map((ch) => {
    const el = buildElement(ch, porId)
    const p = memberProfile(el, el.Lreport, false, { ajustar: true })
    // la sección de hoy: la de la mayoría de sus tramos
    const cuenta = new Map()
    for (const m of ch.members) {
      const mb = porId.get(String(m.id))
      const k = `${mb.grupo}|${mb.seccion}`
      cuenta.set(k, (cuenta.get(k) || 0) + m.L)
    }
    const [grupo, seccion] = [...cuenta].sort((a, b) => b[1] - a[1])[0][0].split('|')
    const med = medidasDe.get(grupo)
    return {
      id: String(ch.id), miembros: ch.members.map((m) => String(m.id)), L: ch.L,
      MuP: p.muPmax, MuN: p.muNmax, Mu: Math.max(p.muPmax, p.muNmax), Vu: p.vuMax,
      hoy: { grupo, seccion, b: med?.b ?? null, h: med?.h ?? null },
    }
  })
}

// ── Agrupar ──────────────────────────────────────────────────

/**
 * @param elems  de elementos()
 * @param tau    umbral de aprovechamiento para que una clase suba de sección
 * @returns { grupos:[{ nombre, sec, elems, clases, uMin, uMax, L, concreto, miembros }], ... }
 */
export function agrupar(elems, cands, tau) {
  const clases = new Map()
  for (const e of elems) {
    const k = e.minima.sec.nombre
    if (!clases.has(k)) clases.set(k, { sec: e.minima.sec, elems: [], fuera: false })
    const cl = clases.get(k)
    cl.elems.push(e)
    if (e.minima.fuera) cl.fuera = true
  }
  const orden = [...clases.values()].sort((a, b) => area(b.sec) - area(a.sec) || b.sec.h - a.sec.h)

  const grupos = []
  let G = null
  for (const cl of orden) {
    if (G && !cl.fuera && !G.fuera) {
      const us = cl.elems.map((e) => aprovechamiento(e, G.sec))
      const cabe = us.every((u) => u <= 1 + 1e-9)
      const cerca = Math.max(...us) >= tau
      if (cabe && cerca) {
        G.elems.push(...cl.elems)
        G.clases.push(cl.sec.nombre)
        continue
      }
    }
    G = { sec: cl.sec, elems: [...cl.elems], clases: [cl.sec.nombre], fuera: cl.fuera }
    grupos.push(G)
  }

  grupos.forEach((g, i) => {
    g.nombre = `T${i + 1}`
    const us = g.elems.map((e) => aprovechamiento(e, g.sec))
    g.uMin = Math.min(...us)
    g.uMax = Math.max(...us)
    g.L = g.elems.reduce((s, e) => s + e.L, 0)
    g.concreto = (g.L * g.sec.b * g.sec.h) / 1e4
    g.miembros = g.elems.flatMap((e) => e.miembros)
  })
  return {
    tau, grupos,
    concreto: grupos.reduce((s, g) => s + g.concreto, 0),
    fuera: grupos.filter((g) => g.fuera).reduce((s, g) => s + g.elems.length, 0),
  }
}

/**
 * Todo de una vez: elementos, secciones mínimas y las tres propuestas.
 * @returns { elementos, hoy:{ grupos, concreto }, natural, propuestas:[…] }
 */
export function proponerAgrupacion(R, nombres, { anchos = [15, 20, 25] } = {}) {
  const cands = candidatas(anchos)
  const els = elementos(R, nombres)
  for (const e of els) e.minima = seccionMinima(e, cands)
  // los miembros de esos grupos que no son horizontales (rampas, apoyos inclinados…) no se tocan
  const quiero = new Set(nombres)
  const enGrupos = (R.grupos || []).filter((g) => quiero.has(g.nombre)).reduce((s, g) => s + g.n, 0)
  const enElementos = els.reduce((s, e) => s + e.miembros.length, 0)
  const hoyConcreto = els.reduce((s, e) => s + (e.hoy.b && e.hoy.h ? (e.L * e.hoy.b * e.hoy.h) / 1e4 : 0), 0)
  return {
    elementos: els,
    cands,
    noHorizontales: enGrupos - enElementos,
    hoy: { grupos: new Set(els.map((e) => e.hoy.grupo)).size, concreto: hoyConcreto },
    // sin juntar nada: una T por cada sección mínima distinta (el mínimo concreto posible)
    natural: agrupar(els, cands, Infinity),
    propuestas: UMBRALES.map((u) => ({ ...u, ...agrupar(els, cands, u.tau) })),
  }
}

// ── Verificar cada grupo con el motor de la Fase 1 ───────────

/** Los miembros y puntos de envolvente de unos ids, sacados del modelo */
function perfilDe(R, ids) {
  const quiero = new Set(ids.map(String))
  const members = [], points = []
  for (const g of R.grupos || []) {
    for (const m of g.perfil.members) if (quiero.has(String(m.id))) members.push(m)
    for (const p of g.points || []) if (quiero.has(String(p.member))) points.push(p)
  }
  return { members, points }
}

/**
 * Arma la T propuesta como si ya existiera y le pide el armado a la Fase 1.
 * @returns { estado, texto, kg, motivos, avisos } | null
 */
export function verificarGrupo(R, grupo) {
  const { members, points } = perfilDe(R, grupo.miembros)
  if (!members.length) return null
  const t = {
    nombre: grupo.nombre, ancho: grupo.sec.b, peralte: grupo.sec.h, recub: RECUB, fc: 250,
    calInf: '3', cantInf: 2, calSup: '3', cantSup: 2,
    calBastonInf: '3', cantBastonInf: 0, calBastonSup: '3', cantBastonSup: 0,
    cantBastonPuntInf: 0, cantBastonPuntSup: 0,
    calEst: '2.5', sepLcuarto: 8, sepRest: 16,
    calc: { fy: 4200, nramas: 2, varEstNum: null, SL4: null, SLresto: null },
    perfil: {
      archivo: 'agrupación', combo: '', formato: 'ram-api', members,
      L: 0, Lpor: {}, invertir: false, minLen: 0.6, porElemento: true, conMaximos: members.length,
    },
    envelope: { points, invertir: false },
  }
  return proponerTrabe(t, R.model)
}

// ── Acomodo manual ───────────────────────────────────────────
// El ingeniero acomoda las trabes a su criterio, partiendo de una propuesta
// o de cero. Mismo resultado que una propuesta, así que la verificación y el
// aplicar_agrupacion.py son los mismos.
//
//   manual = {
//     base:   de qué propuesta partió (texto),
//     grupos: [{ id, nombre, sec, c }]   sec: nombre del catálogo, o null =
//             automática (la de menos concreto que les basta a todas); c: color
//     de:     { idDelElemento → idDelGrupo }   (lo que no está, sin asignar)
//   }

/** Todas las vigas del catálogo, para fijar una sección a mano */
export const VIGAS_CATALOGO = SECCIONES_RAM
  .filter((s) => s.tipo === 'viga')
  .sort((a, b) => a.b - b.b || a.h - b.h)

/** La sección de menos concreto que les basta a todas; si ninguna, la que menos se pasa */
export function seccionDeGrupo(elems, cands) {
  for (const s of cands) if (elems.every((e) => aprovechamiento(e, s) <= 1 + 1e-9)) return { sec: s, fuera: false }
  const peor = (s) => Math.max(...elems.map((e) => aprovechamiento(e, s)))
  return { sec: [...cands].sort((a, b) => peor(a) - peor(b))[0] || null, fuera: true }
}

/** Un acomodo a partir de una propuesta: mismos grupos, secciones automáticas */
export function manualDesde(P) {
  const grupos = P.grupos.map((g, i) => ({ id: `g${i + 1}`, nombre: g.nombre, sec: null, c: i }))
  const de = {}
  P.grupos.forEach((g, i) => { for (const e of g.elems) de[e.id] = `g${i + 1}` })
  return { base: P.nombre, grupos, de }
}

/** Un acomodo vacío: todas las trabes sin asignar */
export const manualVacio = () => ({ base: 'cero', grupos: [], de: {} })

/** El siguiente id y el primer color libre para un grupo nuevo */
export function grupoNuevo(manual, nombre) {
  let n = 1
  while (manual.grupos.some((g) => g.id === `g${n}`)) n++
  const usados = new Set(manual.grupos.map((g) => g.c))
  let c = 0
  while (usados.has(c)) c++
  if (!nombre) {
    let t = 1
    while (manual.grupos.some((g) => g.nombre === `T${t}`)) t++
    nombre = `T${t}`
  }
  return { id: `g${n}`, nombre, sec: null, c }
}

/**
 * El acomodo, con la misma forma que una propuesta.
 * @returns { id:'manual', nombre, grupos (sólo los que tienen trabes), todos, sueltos, concreto }
 */
export function armarManual(elems, cands, manual) {
  const porGrupo = new Map(manual.grupos.map((g) => [g.id, []]))
  const sueltos = []
  for (const e of elems) {
    const gid = manual.de[e.id]
    if (gid && porGrupo.has(gid)) porGrupo.get(gid).push(e)
    else sueltos.push(e)
  }
  const todos = manual.grupos.map((g) => {
    const es = porGrupo.get(g.id)
    const fija = g.sec ? VIGAS_CATALOGO.find((s) => s.nombre === g.sec) || null : null
    const base = { id: g.id, nombre: g.nombre, c: g.c, auto: !fija, elems: es }
    if (!es.length) {
      return { ...base, sec: fija, vacio: true, us: [], uMin: 0, uMax: 0, L: 0, concreto: 0, miembros: [], fuera: false }
    }
    let sec = fija, fuera = false
    if (!fija) ({ sec, fuera } = seccionDeGrupo(es, cands))
    const us = es.map((e) => (sec ? aprovechamiento(e, sec) : Infinity))
    if (fija) fuera = us.some((u) => u > 1 + 1e-9)
    const L = es.reduce((s, e) => s + e.L, 0)
    return {
      ...base, sec, fuera, vacio: false, us,
      uMin: Math.min(...us), uMax: Math.max(...us), L,
      concreto: sec ? (L * sec.b * sec.h) / 1e4 : 0,
      miembros: es.flatMap((e) => e.miembros),
    }
  })
  const grupos = todos.filter((g) => !g.vacio)
  return {
    id: 'manual', nombre: 'Manual', base: manual.base,
    grupos, todos, sueltos,
    concreto: grupos.reduce((s, g) => s + g.concreto, 0),
  }
}

/** T1…Tn de la sección más grande a la más chica (como las propuestas); los vacíos al final */
export function renumerar(manual, armado) {
  const info = new Map(armado.todos.map((g) => [g.id, g]))
  const orden = [...manual.grupos].sort((a, b) => {
    const A = info.get(a.id), B = info.get(b.id)
    if (A.vacio !== B.vacio) return A.vacio ? 1 : -1
    const sa = A.sec ? area(A.sec) : 0, sb = B.sec ? area(B.sec) : 0
    return sb - sa || (B.sec?.h || 0) - (A.sec?.h || 0) || B.L - A.L
  })
  return { ...manual, grupos: orden.map((g, i) => ({ ...g, nombre: `T${i + 1}` })) }
}

/**
 * Lo que impide aplicar un acomodo: nombres vacíos o repetidos, o que ya
 * usa en el modelo un grupo que no se está agrupando (se mezclarían).
 */
export function problemasDeNombres(grupos, ocupados = []) {
  const out = []
  const vistos = new Map()
  const fuera = new Set(ocupados.map((n) => n.trim().toUpperCase()))
  for (const g of grupos) {
    const n = (g.nombre || '').trim()
    if (!n) { out.push('Hay un grupo sin nombre.'); continue }
    const k = n.toUpperCase()
    if (vistos.has(k)) out.push(`«${n}» está dos veces.`)
    else vistos.set(k, true)
    if (fuera.has(k)) out.push(`«${n}» ya existe en el modelo en un grupo que no se está agrupando.`)
  }
  return [...new Set(out)]
}

// ── Las plantas, para ver y acomodar ─────────────────────────

/**
 * Geometría en planta de cada elemento, por nivel. Coordenadas de dibujo
 * (y hacia abajo): x = primer eje horizontal; el segundo hacia abajo, como
 * se ve desde arriba con Y vertical (zAbajo), o hacia arriba.
 * @returns { up, ejes, niveles:[{ v, n, ids }], porId: Map id → { segs, z, nivel, caja, cx, cy }, columnas, bounds }
 */
export function planos(R, elems, { tol = 0.05, zAbajo = true } = {}) {
  const G = geometria(R)
  const [h, k] = planAxes(G.up)
  const sk = zAbajo ? 1 : -1
  const porId = new Map()
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity
  const ver = (x, y) => { minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y) }
  for (const e of elems) {
    const segs = []
    let zs = 0, nz = 0, cx = 0, cy = 0, lt = 0
    for (const id of e.miembros) {
      const r = G.porId.get(String(id))
      const a = r && G.nodes.get(r.nj), b = r && G.nodes.get(r.nk)
      if (!a || !b) continue
      const s = [a[h], sk * a[k], b[h], sk * b[k]]
      segs.push(s)
      ver(s[0], s[1]); ver(s[2], s[3])
      zs += a[G.up] + b[G.up]; nz += 2
      const l = Math.hypot(s[2] - s[0], s[3] - s[1]) || 1e-6
      cx += ((s[0] + s[2]) / 2) * l; cy += ((s[1] + s[3]) / 2) * l; lt += l
    }
    if (!segs.length) continue
    const xs = segs.flatMap((s) => [s[0], s[2]]), ys = segs.flatMap((s) => [s[1], s[3]])
    porId.set(e.id, {
      segs, z: zs / nz, cx: cx / lt, cy: cy / lt,
      caja: [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)],
    })
  }
  // niveles: las alturas de las trabes, juntando las que están a menos de tol
  const niveles = []
  for (const [id, g] of [...porId].sort((a, b) => a[1].z - b[1].z)) {
    let N = niveles.find((n) => Math.abs(n.v - g.z) <= tol)
    if (!N) niveles.push((N = { v: g.z, ids: [] }))
    N.ids.push(id)
  }
  niveles.forEach((N, i) => {
    N.n = i + 1
    N.v = Math.round(N.v * 1000) / 1000
    for (const id of N.ids) porId.get(id).nivel = N.n
  })
  // columnas, para ubicarse: un punto en cada nivel que tocan
  const columnas = []
  for (const r of G.rows) {
    const a = G.nodes.get(r.nj), b = G.nodes.get(r.nk)
    if (!a || !b || memberKind(a, b, G.up) !== 'columna') continue
    const z1 = Math.min(a[G.up], b[G.up]), z2 = Math.max(a[G.up], b[G.up])
    for (const N of niveles) {
      if (N.v < z1 - 0.25 || N.v > z2 + 0.25) continue
      columnas.push({ nivel: N.n, x: a[h], y: sk * a[k] })
    }
  }
  if (!porId.size) { minX = 0; maxX = 1; minY = 0; maxY = 1 }
  return {
    up: G.up, ejes: [h, k], zAbajo, niveles, porId, columnas,
    bounds: { minX, minY, maxX, maxY, w: Math.max(maxX - minX, 0.1), h: Math.max(maxY - minY, 0.1) },
  }
}

/** Las trabes que caen en el mismo lugar en planta, en los otros niveles (la misma trabe en N1, N2, N3…) */
export function mismasEnOtrosNiveles(geo, ids, { tol = 0.1 } = {}) {
  const out = new Set(ids)
  for (const id of ids) {
    const g = geo.porId.get(id)
    if (!g) continue
    for (const [otro, o] of geo.porId) {
      if (out.has(otro)) continue
      if (o.caja.every((v, i) => Math.abs(v - g.caja[i]) <= tol)) out.add(otro)
    }
  }
  return out
}
