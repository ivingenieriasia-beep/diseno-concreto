// ══════════════════════════════════════════════════════════════
// Catálogo de los reportes de RAM Elements que la app sabe leer: qué pedir,
// con qué parámetros, qué llena cada uno y cómo se reconoce. Es a la vez el
// manual que se ve en el centro de carga y la tabla que clasifica lo que se
// suelta ahí.
// ══════════════════════════════════════════════════════════════

import { looksLikeStations } from './longitudinal'
import { looksLikeActions } from './ramActions'
import { splitGeometryReport, parseMemberGeometry, parseNodeText } from './geometry'

/** ¿Es el reporte de máximos por miembro (Max/Min sin estaciones)? */
export function looksLikeMaximos(text) {
  const t = String(text || '')
  if (looksLikeActions(t) || looksLikeStations(t)) return false
  return /M[aá]ximos esfuerzos/i.test(t) || (/^\s*(Max|Min)\s+[-+]?\d/m.test(t) && /MIEMBRO/i.test(t))
}

/** ¿Es el reporte de geometría (Nudos y/o Miembros)? */
export function looksLikeGeometria(text) {
  const t = String(text || '')
  if (looksLikeActions(t) || looksLikeStations(t) || looksLikeMaximos(t)) return false
  const secs = splitGeometryReport(t)
  if (secs.has('nudos') || secs.has('miembros')) return true
  return parseMemberGeometry(t).rows.length > 0 || parseNodeText(t).size > 0
}

export const REPORTES = [
  {
    id: 'acciones',
    titulo: 'Esfuerzos a lo largo del elemento',
    preferido: true,
    reporte: 'Esfuerzos en puntos de importancia + puntos de inflexión',
    donde: 'Imprimir análisis → Miembros',
    casillas: ['Esfuerzos en puntos de importancia + puntos de inflexión'],
    parametros: [
      'Condiciones de carga: marca las combinaciones que quieras envolver (CD, CS…). La app envuelve todas las que traiga el archivo.',
      'Agrupar por: Elementos',
    ],
    llena: 'El módulo Longitudinal: bastones puntuales con su longitud, estribos por claro y los alzados.',
    ventaja: 'Sus estaciones caen en los picos y en los puntos de inflexión, y trae la distancia en metros: la longitud de cada miembro sale sola.',
    aviso: 'Aun así sus estaciones son una MUESTRA: el pico real casi siempre cae entre dos y lo impreso se queda corto (en un modelo real, hasta un 12 %). Marca también «Máximos esfuerzos» en la misma impresión — se guarda en el mismo .txt — para que la app diseñe con el pico exacto.',
    destino: 'Cada trabe, por el nombre del archivo (T-5.txt → chip T-5).',
    formatos: '.txt',
    detecta: looksLikeActions,
  },
  {
    id: 'estaciones',
    titulo: 'Esfuerzos a lo largo (alternativa)',
    reporte: 'Envolvente de esfuerzos en puntos fijos',
    donde: 'Imprimir análisis → Miembros',
    casillas: ['Envolvente de esfuerzos en puntos fijos'],
    parametros: [
      'Nro. estaciones a imprimir: 20 o más.',
      'Condiciones de carga: las combinaciones a envolver.',
    ],
    llena: 'Lo mismo que el anterior, si no tienes aquél.',
    aviso: 'Es una rejilla fija: con pocas estaciones se salta el pico (con 10 llegó a fallar por 49 %). Acompáñalo siempre de «Máximos esfuerzos» para que la app pueda corregirlo.',
    destino: 'Cada trabe, por el nombre del archivo.',
    formatos: '.txt',
    detecta: looksLikeStations,
  },
  {
    id: 'maximos',
    titulo: 'Máximos por miembro',
    reporte: 'Máximos esfuerzos',
    donde: 'Imprimir análisis → Miembros',
    casillas: ['Máximos esfuerzos'],
    parametros: ['Condiciones de carga: las mismas combinaciones que el reporte a lo largo.'],
    llena: 'La revisión de la sección (pestaña Cálculo) y la de columnas (P, Mx, My). Y el pico exacto del análisis a lo largo: sin él, el momento de diseño sale de las estaciones impresas y se queda corto.',
    ventaja: 'Es el único que trae el máximo exacto de cada miembro, el mismo que RAM rotula en la pantalla. Imprimelo junto con el reporte a lo largo, en la misma impresión.',
    destino: 'Cada trabe o columna, por el nombre del archivo (C-1.txt → columna C-1).',
    formatos: '.txt',
    detecta: looksLikeMaximos,
  },
  {
    id: 'geometria',
    titulo: 'Geometría del modelo',
    reporte: 'Datos de Geometría (Nudos + Miembros)',
    donde: 'Imprimir datos → Datos de geometría',
    casillas: ['Nudos', 'Miembros'],
    parametros: ['Un solo archivo con las dos tablas.'],
    llena: 'La longitud de cada miembro, la unión de tramos colineales en elementos completos y el visor del modelo.',
    destino: 'Todo el proyecto: se carga una vez y la usan todas las trabes.',
    formatos: '.txt (o el .xlsx de nudos + el .txt de miembros)',
    detecta: looksLikeGeometria,
  },
]

export const getReporte = (id) => REPORTES.find((r) => r.id === id) || null

/**
 * Clasifica un archivo por su contenido (el nombre sólo decide a qué sección
 * va, no qué es).
 * @returns id del reporte, o null si no se reconoce
 */
export function clasificarReporte(texto, nombre = '') {
  if (/\.xlsx$/i.test(nombre)) return 'geometria'
  for (const r of REPORTES) {
    try { if (r.detecta(texto)) return r.id } catch { /* sigue */ }
  }
  return null
}

/** Resumen de un lote de archivos: qué es cada uno, antes de cargarlos */
export function clasificarLote(archivos) {
  const out = { acciones: [], estaciones: [], maximos: [], geometria: [], desconocidos: [] }
  for (const a of archivos || []) {
    const id = clasificarReporte(a.texto, a.nombre)
    if (id) out[id].push(a.nombre); else out.desconocidos.push(a.nombre)
  }
  return out
}
