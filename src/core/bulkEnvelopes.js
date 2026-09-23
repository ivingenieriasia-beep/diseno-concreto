// ══════════════════════════════════════════════════════════════
// Carga masiva: los reportes de RAM guardados con el nombre de su sección
// (T-4.txt, C-1.txt…) se reparten solos entre las trabes y las columnas del
// proyecto, en vez de ir metiéndolos uno por uno.
//
// Un mismo chip puede recibir DOS archivos y los necesita a los dos:
//   · el de esfuerzos a lo largo (acciones / estaciones) → el perfil, que dice
//     dónde cae cada momento;
//   · el de máximos por miembro → el pico exacto, que las estaciones impresas
//     casi siempre se saltan.
// Por eso el reparto acumula por destino en vez de quedarse con el último.
//
// Si los archivos vienen de una carpeta (COLUMNAS / LONGITUDINAL / MAXIMOS),
// el nombre de la carpeta sirve de desempate cuando una trabe y una columna se
// llaman igual.
// ══════════════════════════════════════════════════════════════

import { parseRamEnvelope } from './ramParser'
import { parseRamStations, looksLikeStations } from './longitudinal'
import { parseRamActions, looksLikeActions } from './ramActions'

/** "T-2A.txt" → "t2a": casa el archivo con el chip pese a guiones, espacios y mayúsculas */
export function claveNombre(s) {
  return String(s || '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/\.[^.]+$/, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
}

/** ¿La carpeta dice que esto es de columnas? (COLUMNAS, Columnas, columnas…) */
export const carpetaDeColumnas = (c) => /^col/i.test(String(c || '').normalize('NFD').replace(/[̀-ͯ]/g, '').trim())

/**
 * Índice clave → destinos posibles. Se guardan los dos (trabe y columna) para
 * que el tipo de reporte y la carpeta decidan cuál gana.
 */
export function indiceDestinos({ trabes = [], columnas = [] } = {}) {
  const idx = new Map()
  const put = (k, d) => {
    if (!k) return
    const e = idx.get(k) || {}
    if (!e[d.tipo]) e[d.tipo] = d
    idx.set(k, e)
  }
  columnas.forEach((c, i) => put(claveNombre(c.nombre), { tipo: 'columna', idx: i, nombre: c.nombre }))
  trabes.forEach((t, i) => put(claveNombre(t.nombre), { tipo: 'trabe', idx: i, nombre: t.nombre }))
  return idx
}

/** Qué trae el archivo, por su contenido */
function leer(texto) {
  if (looksLikeActions(texto)) {
    const P = parseRamActions(texto)
    if (P.members.length) return { clase: 'largo', P }
  }
  if (looksLikeStations(texto)) {
    const P = parseRamStations(texto)
    if (P.members.length) return { clase: 'largo', P }
  }
  const E = parseRamEnvelope(texto)
  if (E.points.length) return { clase: 'maximos', P: E }
  return { clase: null, P: null }
}

/**
 * Reparte los archivos entre las secciones del proyecto.
 * @param archivos [{ nombre, texto, carpeta? }]
 * @param destinos { trabes, columnas }
 * @returns { asignados, sinDestino, ilegibles, repetidos }
 *   asignados: [{ tipo, idx, nombre, perfil?, env?, archivos:{largo?, maximos?}, … }]
 */
export function repartirEnvolventes(archivos, destinos = {}) {
  const idx = indiceDestinos(destinos)
  const porDestino = new Map()
  const sinDestino = []
  const ilegibles = []
  const repetidos = []

  for (const a of archivos || []) {
    const k = claveNombre(a.nombre)
    const posibles = idx.get(k)
    if (!posibles) { sinDestino.push(a.nombre); continue }

    const { clase, P } = leer(a.texto || '')
    if (!clase) { ilegibles.push({ archivo: a.nombre, motivo: 'no se reconoció el formato' }); continue }

    // Trabe o columna: manda la carpeta si lo dice; si no, el tipo de reporte
    // (un reporte a lo largo sólo tiene sentido en una trabe).
    const quiere = carpetaDeColumnas(a.carpeta) ? 'columna' : clase === 'largo' ? 'trabe' : null
    const dest = (quiere && posibles[quiere]) || posibles.trabe || posibles.columna
    if (!dest) { sinDestino.push(a.nombre); continue }

    const key = `${dest.tipo}:${dest.idx}`
    const item = porDestino.get(key) || { ...dest, archivos: {}, formatos: [] }

    if (clase === 'largo' && dest.tipo === 'trabe') {
      if (item.archivos.largo) repetidos.push({ nombre: dest.nombre, archivo: a.nombre, reemplaza: item.archivos.largo })
      item.archivos.largo = a.nombre
      item.formato = P.formato || 'estaciones'
      item.miembros = P.members.length
      item.puntos = P.points.length
      item.combo = P.combo
      item.perfil = {
        archivo: a.nombre, combo: P.combo, unidades: P.unidades, formato: P.formato || 'estaciones',
        members: P.members, L: 0, Lpor: {}, invertir: false, minLen: 0.6, porElemento: true,
        conMaximos: P.conMaximos || 0,
      }
      // envolvente provisional sacada de estas mismas estaciones: sólo si no
      // hay (ni va a haber) una del reporte de máximos, que es la exacta
      item.envDeEstaciones = { archivo: a.nombre, combo: P.combo, unidades: P.unidades, invertir: false, points: P.points, fromStations: true }
    } else {
      if (item.archivos.maximos) repetidos.push({ nombre: dest.nombre, archivo: a.nombre, reemplaza: item.archivos.maximos })
      item.archivos.maximos = a.nombre
      item.formato = item.formato || 'miembros'
      item.miembrosEnv = new Set(P.points.map((p) => p.member)).size
      item.combo = item.combo || P.combo
      item.env = dest.tipo === 'columna'
        ? { archivo: a.nombre, combo: P.combo, unidades: P.unidades, mapping: 'M33X', points: P.points }
        : { archivo: a.nombre, combo: P.combo, unidades: P.unidades, invertir: false, points: P.points }
    }
    porDestino.set(key, item)
  }

  const asignados = []
  for (const item of porDestino.values()) {
    // la envolvente exacta gana; si no vino, se usa la de las estaciones
    if (!item.env && item.envDeEstaciones) item.env = item.envDeEstaciones
    delete item.envDeEstaciones
    item.exacta = !!item.archivos.maximos
    asignados.push(item)
  }
  return { asignados, sinDestino, ilegibles, repetidos }
}

/** Resumen de una línea para el aviso de la barra */
export function resumenReparto(r) {
  const nT = r.asignados.filter((a) => a.tipo === 'trabe').length
  const nC = r.asignados.filter((a) => a.tipo === 'columna').length
  const nAcc = r.asignados.filter((a) => a.formato === 'acciones').length
  const nEst = r.asignados.filter((a) => a.formato === 'estaciones').length
  const conPerfil = r.asignados.filter((a) => a.perfil)
  const sinMax = conPerfil.filter((a) => !a.exacta)
  const partes = []
  if (nT) partes.push(`${nT} trabe(s)`)
  if (nC) partes.push(`${nC} columna(s)`)
  let txt = partes.length ? `Reportes cargados en ${partes.join(' y ')}` : 'No se cargó ningún reporte'
  if (nAcc) txt += ` · ${nAcc} por puntos de inflexión (con su longitud)`
  if (nEst) txt += ` · ${nEst} por estaciones (rejilla fija)`
  if (conPerfil.length && !sinMax.length) txt += ' · todas con su máximo exacto'
  else if (sinMax.length) txt += ` · SIN máximos exactos: ${sinMax.map((a) => a.nombre).join(', ')} (el pico saldrá de las estaciones impresas)`
  if (r.repetidos.length) txt += ` · ${r.repetidos.length} repetida(s): quedó la última`
  if (r.sinDestino.length) txt += ` · sin sección que coincida: ${r.sinDestino.join(', ')}`
  if (r.ilegibles.length) txt += ` · no se pudieron leer: ${r.ilegibles.map((x) => x.archivo).join(', ')}`
  return txt
}
