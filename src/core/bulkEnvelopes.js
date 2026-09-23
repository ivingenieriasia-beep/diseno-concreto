// ══════════════════════════════════════════════════════════════
// Carga masiva de envolventes: los reportes de RAM guardados con el
// nombre de su sección (T-4.txt, C-1.txt…) se reparten solos entre las
// trabes y las columnas del proyecto, en vez de ir metiéndolos uno por uno.
// El archivo puede ser la envolvente por miembro o el reporte por
// estaciones; en el segundo caso la trabe queda lista también para el
// análisis longitudinal.
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

/** Índice clave → destino. Las trabes ganan si un nombre se repite en columnas. */
export function indiceDestinos({ trabes = [], columnas = [] } = {}) {
  const idx = new Map()
  columnas.forEach((c, i) => {
    const k = claveNombre(c.nombre)
    if (k && !idx.has(k)) idx.set(k, { tipo: 'columna', idx: i, nombre: c.nombre })
  })
  trabes.forEach((t, i) => {
    const k = claveNombre(t.nombre)
    if (k) idx.set(k, { tipo: 'trabe', idx: i, nombre: t.nombre })
  })
  return idx
}

/**
 * Reparte los archivos entre las secciones del proyecto.
 * @param archivos [{ nombre, texto }]
 * @param destinos { trabes, columnas }
 * @returns { asignados, sinDestino, ilegibles, repetidos }
 */
export function repartirEnvolventes(archivos, destinos = {}) {
  const idx = indiceDestinos(destinos)
  const asignados = []
  const sinDestino = []
  const ilegibles = []
  const repetidos = []
  const vistos = new Map()

  for (const a of archivos || []) {
    const k = claveNombre(a.nombre)
    const dest = idx.get(k)
    if (!dest) { sinDestino.push(a.nombre); continue }

    const texto = a.texto || ''
    let item = null
    if (dest.tipo === 'trabe' && (looksLikeActions(texto) || looksLikeStations(texto))) {
      const acc = looksLikeActions(texto) ? parseRamActions(texto) : null
      const P = acc?.members?.length ? acc : parseRamStations(texto)
      if (!P.members.length) { ilegibles.push({ archivo: a.nombre, motivo: P.warnings[0] || 'sin miembros' }); continue }
      item = {
        ...dest, archivo: a.nombre, formato: P.formato || 'estaciones',
        env: { archivo: a.nombre, combo: P.combo, unidades: P.unidades, invertir: false, points: P.points, fromStations: true },
        perfil: {
          archivo: a.nombre, combo: P.combo, unidades: P.unidades, formato: P.formato || 'estaciones',
          members: P.members, L: 0, Lpor: {}, invertir: false, minLen: 0.6, porElemento: true,
          conMaximos: P.conMaximos || 0,
        },
        miembros: P.members.length, puntos: P.points.length, combo: P.combo,
      }
    } else {
      const E = parseRamEnvelope(texto)
      if (!E.points.length) { ilegibles.push({ archivo: a.nombre, motivo: E.warnings[0] || 'no se reconoció el formato' }); continue }
      item = {
        ...dest, archivo: a.nombre, formato: 'miembros',
        env: dest.tipo === 'columna'
          ? { archivo: a.nombre, combo: E.combo, unidades: E.unidades, mapping: 'M33X', points: E.points }
          : { archivo: a.nombre, combo: E.combo, unidades: E.unidades, invertir: false, points: E.points },
        miembros: new Set(E.points.map((p) => p.member)).size, puntos: E.points.length, combo: E.combo,
      }
    }

    const antes = vistos.get(k)
    if (antes !== undefined) {
      repetidos.push({ nombre: dest.nombre, archivo: a.nombre, reemplaza: asignados[antes].archivo })
      asignados[antes] = item          // gana el último, como al arrastrar
    } else {
      vistos.set(k, asignados.length)
      asignados.push(item)
    }
  }
  return { asignados, sinDestino, ilegibles, repetidos }
}

/** Resumen de una línea para el aviso de la barra */
export function resumenReparto(r) {
  const nT = r.asignados.filter((a) => a.tipo === 'trabe').length
  const nC = r.asignados.filter((a) => a.tipo === 'columna').length
  const nAcc = r.asignados.filter((a) => a.formato === 'acciones').length
  const nEst = r.asignados.filter((a) => a.formato === 'estaciones').length
  const partes = []
  if (nT) partes.push(`${nT} trabe(s)`)
  if (nC) partes.push(`${nC} columna(s)`)
  let txt = partes.length ? `Envolventes cargadas en ${partes.join(' y ')}` : 'No se cargó ninguna envolvente'
  if (nAcc) txt += ` · ${nAcc} por puntos de inflexión (listas para Longitudinal, con su longitud)`
  if (nEst) txt += ` · ${nEst} por estaciones (rejilla fija)`
  if (r.repetidos.length) txt += ` · ${r.repetidos.length} repetida(s): quedó la última`
  if (r.sinDestino.length) txt += ` · sin sección que coincida: ${r.sinDestino.join(', ')}`
  if (r.ilegibles.length) txt += ` · no se pudieron leer: ${r.ilegibles.map((x) => x.archivo).join(', ')}`
  return txt
}
