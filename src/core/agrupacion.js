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
import { memberKind, detectUpAxis } from './modelView'
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

/** Qué tanto usaría el elemento esa sección: 1 = justo */
export function aprovechamiento(e, s) {
  const c = capacidad(s.b, s.h, { L: e.L })
  return Math.max(e.Mu / c.MR, e.Vu / c.Vr)
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
