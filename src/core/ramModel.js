// ══════════════════════════════════════════════════════════════
// Lector del modelo.json que escribe el script de RAM (scripts/ram/sincronizar.py).
//
// Sustituye a los tres reportes de texto: trae la geometría, los esfuerzos a
// lo largo de cada miembro y las reacciones de los apoyos, en un solo archivo
// y con el pico exacto de cada miembro guardado aparte.
//
// Aquí sólo se traduce a las formas que ya consumen los módulos:
//   · model   → { rows, nodes }        como el reporte «Datos de Geometría»
//   · perfil  → { members, … }         como «Acciones discriminadas»
//   · points  → envolvente por miembro como «Máximos esfuerzos»
// Así el resto de la app no se entera de por dónde entraron los datos.
//
// Los miembros vienen agrupados por `description` del modelo (T2, T2A, T5,
// C1…), que es la etiqueta que el propio RAM lleva. Por eso ya no hace falta
// casar nombres de archivo ni repartir miembros entre trabes parecidas.
// ══════════════════════════════════════════════════════════════

import { claveNombre } from './bulkEnvelopes'
import { sectionDims } from './geometry'

/** Orden de los números de cada estación, tal como los escribe el script */
const CAMPOS = ['x', 'm33min', 'm33max', 'v2min', 'v2max', 'axmin', 'axmax']

/** ¿Este texto (o este objeto) es el modelo.json de la app? */
export function looksLikeModeloRam(x) {
  if (!x) return false
  if (typeof x === 'object') return String(x.formato || '').startsWith('auxiliar-iv')
  return /"formato"\s*:\s*"auxiliar-iv/.test(String(x).slice(0, 4000))
}

const num = (v) => (typeof v === 'number' && isFinite(v) ? v : 0)

/** Los miembros sin descripción en RAM caen aquí (el script usa el mismo nombre) */
export const SIN_NOMBRE = '(sin nombre)'

/**
 * @param entrada  el texto del .json o el objeto ya parseado
 * @param archivo  nombre para mostrar
 * @returns {{ ok, warnings, modelo, combos, envueltas, model, grupos, reacciones }}
 *   grupos: [{ nombre, clave, n, perfil, points }]
 */
export function parseModeloRam(entrada, archivo = 'modelo.json') {
  const warnings = []
  let d = entrada
  if (typeof entrada === 'string') {
    try { d = JSON.parse(entrada) } catch (e) { return vacio(`No se pudo leer el .json: ${e.message}`) }
  }
  if (!looksLikeModeloRam(d)) return vacio('Ese .json no lo escribió el script de RAM de Auxiliar IV.')
  if (!Array.isArray(d.miembros) || !d.miembros.length) return vacio('El archivo no trae miembros.')

  // El script podría cambiar el orden de los números de una estación; si lo
  // hace, se respeta lo que diga el propio archivo.
  const campos = Array.isArray(d.campos_est) && d.campos_est.length ? d.campos_est : CAMPOS
  const iOf = {}
  campos.forEach((c, i) => { iOf[c] = i })
  for (const c of ['x', 'm33min', 'm33max', 'v2min', 'v2max']) {
    if (iOf[c] === undefined) return vacio(`El archivo no dice dónde viene «${c}».`)
  }

  const unidades = String(d.modelo?.unidades || '')
  if (unidades && !/TON/i.test(unidades)) {
    warnings.push(`El modelo está en ${unidades}; la app trabaja en Ton-m y no convierte.`)
  }
  const envueltas = Array.isArray(d.envueltas) ? d.envueltas.map(String) : []
  const combo = envueltas.join(' / ')

  // ── Geometría, común a todo el proyecto ──────────────────
  const nodes = {}
  for (const [id, n] of Object.entries(d.nudos || {})) {
    nodes[id] = { x: num(n.x), y: num(n.y), z: num(n.z) }
  }
  const rows = d.miembros.map((m) => ({
    member: String(m.id), nj: String(m.ni), nk: String(m.nj), seccion: String(m.seccion || ''),
  }))
  const model = { archivo, rows, nodes }

  // ── Un perfil por grupo ──────────────────────────────────
  const porGrupo = new Map()
  for (const m of d.miembros) {
    const g = String(m.grupo || SIN_NOMBRE)
    if (!porGrupo.has(g)) porGrupo.set(g, [])
    porGrupo.get(g).push(m)
  }

  // Las medidas REALES de cada sección, leídas por el script de las tablas de
  // RAM. El nombre puede mentir («RCBEAM 20X25» estaba dada de alta 25×20) y
  // RAM analiza con la tabla, así que manda la tabla.
  const medidas = new Map(Object.entries(d.secciones || {}).map(([k, v]) => [normalSeccion(k), v]))
  const medidasDe = (sec) => medidas.get(normalSeccion(sec)) || null

  const grupos = []
  for (const [nombre, lista] of porGrupo) {
    const members = []
    const points = []
    for (const m of lista) {
      const L = num(m.L)
      const est = Array.isArray(m.est) ? m.est : []
      if (!est.length || L <= 0) { warnings.push(`Miembro ${m.id}: sin estaciones o sin longitud.`); continue }
      const stations = est.map((e) => {
        const x = num(e[iOf.x])
        const par = (lo, hi) => ({ min: num(e[iOf[lo]]), max: num(e[iOf[hi]]) })
        return {
          raw: x, pos: L > 0 ? x / L : 0,
          m33: par('m33min', 'm33max'),
          v2: par('v2min', 'v2max'),
          axial: iOf.axmin !== undefined ? par('axmin', 'axmax') : { min: 0, max: 0 },
          v3: { min: 0, max: 0 }, m22: { min: 0, max: 0 }, tors: { min: 0, max: 0 },
        }
      })

      // El pico exacto, que el script afinó alrededor del extremo. Entra con la
      // misma forma que el bloque «Máximos esfuerzos» de un reporte impreso,
      // así que el análisis lo trata como máximo EXACTO y no como muestra.
      const mx = m.max || {}
      const v2 = Math.abs(num(mx.v2))
      const repMax = { axial: num(mx.axp), v2, v3: 0, tors: 0, m22: 0, m33: num(mx.m33p) }
      const repMin = { axial: num(mx.axn), v2: -v2, v3: 0, tors: 0, m22: 0, m33: num(mx.m33n) }

      members.push({
        id: String(m.id), Lreport: L, stations, combos: envueltas, repMax, repMin,
        seccion: String(m.seccion || ''), grupo: nombre,
      })
      points.push({ id: `${m.id}-Max`, member: String(m.id), tipo: 'Max', ...repMax, P: -repMax.axial, combo })
      points.push({ id: `${m.id}-Min`, member: String(m.id), tipo: 'Min', ...repMin, P: -repMin.axial, combo })
    }
    if (!members.length) continue
    // la sección que usa el grupo: la de la mayoría (y se avisa si mezcla)
    const cuenta = new Map()
    for (const mb of members) cuenta.set(mb.seccion, (cuenta.get(mb.seccion) || 0) + 1)
    const seccion = [...cuenta].sort((a, b) => b[1] - a[1])[0][0]
    if (cuenta.size > 1) {
      warnings.push(`${nombre} mezcla ${cuenta.size} secciones (${[...cuenta].map(([k, n]) => `${k} ×${n}`).join(', ')}); se toma ${seccion}.`)
    }
    const med = medidasDe(seccion)
    const contradice = contradiceNombre(seccion, med)
    if (contradice) {
      warnings.push(`${nombre}: la sección «${seccion}» se llama ${contradice.dice} pero en RAM está dada de alta como ${med.b}×${med.h} (b×h), y así la analizó. Se diseña con ${med.b}×${med.h}.`)
    }
    grupos.push({
      nombre, clave: claveNombre(nombre), n: members.length,
      seccion, medidas: med, contradice,
      perfil: {
        archivo, combo, unidades, formato: 'ram-api',
        members, L: 0, Lpor: {}, invertir: false, minLen: 0.6, porElemento: true,
        conMaximos: members.length,
      },
      points,
    })
  }
  grupos.sort((a, b) => b.n - a.n)

  // ── Reacciones (cimentación) ─────────────────────────────
  const reacciones = (d.reacciones || []).map((r) => ({
    nudo: String(r.nudo), x: num(r.x), y: num(r.y), z: num(r.z),
    por: Object.fromEntries(Object.entries(r.por || {}).map(([c, v]) => [c, {
      fx: num(v[0]), fy: num(v[1]), fz: num(v[2]), mx: num(v[3]), my: num(v[4]), mz: num(v[5]),
    }])),
  }))

  const saltados = d.saltados || {}
  const nSalt = (saltados.sin_longitud?.length || 0) + (saltados.sin_resultados?.length || 0)
  if (nSalt) warnings.push(`El script dejó fuera ${nSalt} miembro(s) del modelo; revisa su salida.`)

  return {
    ok: true, warnings, archivo,
    modelo: d.modelo || {}, combos: d.combinaciones || [], casos: d.casos || [], envueltas,
    model, grupos, reacciones,
    conMedidas: medidas.size > 0,
  }
}

function vacio(motivo) {
  return { ok: false, warnings: [motivo], grupos: [], model: null, reacciones: [], envueltas: [] }
}

/** Resumen de una línea para la barra de avisos */
export function resumenModeloRam(r) {
  if (!r.ok) return r.warnings[0] || 'No se pudo leer el modelo'
  const nM = r.grupos.reduce((s, g) => s + g.n, 0)
  return `${r.archivo}: ${r.grupos.length} grupo(s) · ${nM} miembros · ${Object.keys(r.model.nodes).length} nudos`
    + `${r.envueltas.length ? ` · ${r.envueltas.join(' / ')}` : ''}`
    + `${r.reacciones.length ? ` · ${r.reacciones.length} apoyos` : ''}`
    + ' · picos exactos de la API de RAM'
}

/**
 * Reparte los grupos del modelo entre las secciones del proyecto, por nombre
 * ('T5' → el chip 'T-5'). Devuelve también los que no encontraron chip, que es
 * lo que hay que ofrecer crear.
 */
export function repartirModelo(r, { trabes = [], columnas = [] } = {}) {
  const idxT = new Map(trabes.map((t, i) => [claveNombre(t.nombre), i]))
  const idxC = new Map(columnas.map((c, i) => [claveNombre(c.nombre), i]))
  const asignados = []
  const sinChip = []
  for (const g of r.grupos || []) {
    if (idxT.has(g.clave)) asignados.push({ tipo: 'trabe', idx: idxT.get(g.clave), grupo: g })
    else if (idxC.has(g.clave)) asignados.push({ tipo: 'columna', idx: idxC.get(g.clave), grupo: g })
    else sinChip.push(g)
  }
  return { asignados, sinChip }
}

/**
 * Qué sección crearía este grupo si el proyecto todavía no la tiene.
 * El modelo ya sabe casi todo: cómo se llama ('T5' → el chip 'T-5'), de qué
 * tamaño es ('RcBeam 20x25' → 20×25) y si es trabe o columna.
 * @returns { nombre, ancho, peralte, esColumna, seccion }
 */
export function seccionSugerida(grupo) {
  const crudo = String(grupo?.nombre || '').trim()
  // 'T5' → 'T-5' · 'T2A' → 'T-2A' · 'C1' → 'C-1' · 'N1' → 'N-1'
  const m = /^([A-Za-z]+)[\s-]*(.+)$/.exec(crudo)
  const nombre = m ? `${m[1].toUpperCase()}-${m[2].toUpperCase()}` : crudo
  const seccion = String(grupo?.seccion || '')
  // Las medidas de la tabla de RAM mandan; el nombre sólo si no las hay
  const med = grupo?.medidas || null
  const d = med ? { b: med.b, h: med.h } : sectionDims(seccion)
  // La etiqueta de RAM no siempre dice «COL», así que el nombre también cuenta
  const esColumna = med?.tipo ? med.tipo === 'columna' : (/col/i.test(seccion) || /^c\d/i.test(String(grupo?.clave || '')))
  return {
    nombre, seccion, esColumna,
    ancho: d ? d.b : null,
    peralte: d ? d.h : null,
    fuente: med ? med.fuente : (d ? 'el nombre' : null),
    contradice: grupo?.contradice || null,
  }
}

/** 'COL  25 X 10' y 'col 25 x 10' son la misma sección para RAM */
export const normalSeccion = (s) => String(s || '').split(/\s+/).filter(Boolean).join(' ').toLowerCase()

/**
 * ¿El nombre dice otras medidas que la tabla? «RcBeam 20x25» con b = 25 y
 * h = 20 → { dice: '20×25', invertida: true }.
 */
export function contradiceNombre(seccion, med) {
  if (!med) return null
  const nums = String(seccion || '').match(/\d+(?:\.\d+)?/g)
  if (!nums || nums.length < 2) return null
  const [n1, n2] = nums.slice(-2).map(Number)
  if (n1 === +med.b && n2 === +med.h) return null
  return { dice: `${n1}×${n2}`, invertida: n1 === +med.h && n2 === +med.b }
}
