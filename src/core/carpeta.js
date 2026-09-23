// ══════════════════════════════════════════════════════════════
// La carpeta de la obra: PROCESO\Auxiliar IV
//
//   Auxiliar IV\
//   ├─ proyecto.json        el proyecto de la app (Guardar)
//   ├─ modelo.json          lo escribe sincronizar.py
//   ├─ sincronizar.py       lo genera la app, con esta ruta dentro
//   ├─ 1 Agrupación\        aplicar_agrupacion y sus «Deshacer»
//   ├─ 2 Salidas\
//   │   ├─ Memoria\         memoria .docx, verificación PDF
//   │   ├─ Planos\          DXF, SVG, alzados
//   │   └─ Double Check\    .dcheck
//   └─ 3 Respaldos\         proyecto y modelo anteriores, fechados
//
// Es la misma carpeta que se elige para sincronizar. Con permiso de
// escritura la app deja cada archivo en su lugar; sin él (o sin carpeta),
// se descarga como siempre. El árbol lo crea también crear-proyectoiv.bat.
// ══════════════════════════════════════════════════════════════

import { permisoDe } from './ramSync'

export const SUB = {
  raiz: [],
  agrupacion: ['1 Agrupación'],
  memoria: ['2 Salidas', 'Memoria'],
  planos: ['2 Salidas', 'Planos'],
  dcheck: ['2 Salidas', 'Double Check'],
  respaldos: ['3 Respaldos'],
}
export const ARBOL = [['1 Agrupación'], ['2 Salidas'], ['2 Salidas', 'Memoria'], ['2 Salidas', 'Planos'], ['2 Salidas', 'Double Check'], ['3 Respaldos']]
export const ARCHIVO_PROYECTO = 'proyecto.json'
export const RESPALDOS_MAX = 30

// ── La carpeta del proyecto abierto ──────────────────────────
let activa = null                       // { handle, ruta }
const oyentes = new Set()
export const carpetaActiva = () => activa
export function setCarpetaActiva(handle, ruta = '') {
  activa = handle ? { handle, ruta } : null
  for (const f of oyentes) f(activa)
}
export function onCarpetaActiva(f) { oyentes.add(f); return () => oyentes.delete(f) }

const dos = (n) => String(n).padStart(2, '0')
/** «2026-09-23 1530»: se ordena bien por nombre */
export const sello = (d = new Date()) => `${d.getFullYear()}-${dos(d.getMonth() + 1)}-${dos(d.getDate())} ${dos(d.getHours())}${dos(d.getMinutes())}`

/** Ruta legible dentro de la carpeta: «Auxiliar IV\2 Salidas\Planos\x.dxf» */
export const rutaLegible = (handle, partes, nombre) => [handle?.name || 'Auxiliar IV', ...partes, nombre].filter(Boolean).join('\\')

async function dirDe(handle, partes, crear = true) {
  let h = handle
  for (const p of partes) h = await h.getDirectoryHandle(p, { create: crear })
  return h
}

/** Crea las subcarpetas que falten (no toca nada de lo que haya) */
export async function asegurarArbol(handle) {
  for (const p of ARBOL) await dirDe(handle, p, true)
}

export async function escribir(handle, partes, nombre, contenido) {
  const dir = await dirDe(handle, partes, true)
  const fh = await dir.getFileHandle(nombre, { create: true })
  const w = await fh.createWritable()
  await w.write(contenido)
  await w.close()
}

export async function leerTexto(handle, partes, nombre) {
  try {
    const dir = await dirDe(handle, partes, false)
    const fh = await dir.getFileHandle(nombre)
    return await (await fh.getFile()).text()
  } catch { return null }
}

/** Deja sólo los `maximo` más recientes que empiezan con `prefijo` */
export async function podar(handle, partes, prefijo, maximo = RESPALDOS_MAX) {
  try {
    const dir = await dirDe(handle, partes, false)
    const nombres = []
    for await (const e of dir.values()) if (e.kind === 'file' && e.name.startsWith(prefijo)) nombres.push(e.name)
    nombres.sort().reverse()
    for (const n of nombres.slice(maximo)) await dir.removeEntry(n)
  } catch { /* la poda nunca estorba */ }
}

export function descargar(contenido, nombre, mime = 'application/octet-stream') {
  const blob = contenido instanceof Blob ? contenido : new Blob([contenido], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = nombre
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1500)
}

/** ¿Se puede escribir ya en la carpeta? `pedir` sólo dentro de un clic */
export async function puedeEscribir(pedir = true) {
  if (!activa?.handle) return false
  return (await permisoDe(activa.handle, pedir, 'readwrite')) === 'granted'
}

/**
 * Un archivo de la obra: en su lugar de la carpeta si está conectada y deja
 * escribir; si no, se descarga.
 * @param sub  'raiz' | 'agrupacion' | 'memoria' | 'planos' | 'dcheck' | 'respaldos'
 * @returns {{ donde: 'carpeta'|'descarga', ruta: string }}
 */
export async function guardarSalida(nombre, contenido, { sub = 'raiz', mime = 'application/octet-stream' } = {}) {
  if (activa?.handle) {
    try {
      if (await puedeEscribir(true)) {
        await escribir(activa.handle, SUB[sub] || [], nombre, contenido)
        return { donde: 'carpeta', ruta: rutaLegible(activa.handle, SUB[sub] || [], nombre) }
      }
    } catch (e) { console.warn('No se pudo escribir en la carpeta:', e) }
  }
  descargar(contenido, nombre, mime)
  return { donde: 'descarga', ruta: nombre }
}

/** Texto para el aviso: dónde quedó */
export const dondeQuedo = (r) => (r.donde === 'carpeta' ? `guardado en ${r.ruta}` : `descargado (${r.ruta})`)

/**
 * Guarda el proyecto como proyecto.json. Antes respalda el que había en
 * 3 Respaldos, y si ése era de otra obra pregunta antes de pisarlo.
 * @returns {{ donde, ruta, cancelado? }}
 */
export async function guardarProyecto(data, nombreDescarga, { confirmar = (t) => window.confirm(t) } = {}) {
  const texto = JSON.stringify(data, null, 2)
  if (activa?.handle) {
    try {
      if (await puedeEscribir(true)) {
        const h = activa.handle
        const previo = await leerTexto(h, [], ARCHIVO_PROYECTO)
        if (previo) {
          let otro = ''
          try { otro = JSON.parse(previo)?.projectName || '' } catch { /* uno roto también se respalda */ }
          const este = data?.projectName || ''
          if (otro && este && otro.trim().toLowerCase() !== este.trim().toLowerCase()
            && !confirmar(`La carpeta ya tiene el proyecto «${otro}» y vas a guardar «${este}» encima. Se respalda, pero ¿seguro?`)) {
            return { donde: 'carpeta', ruta: rutaLegible(h, [], ARCHIVO_PROYECTO), cancelado: true }
          }
          if (previo !== texto) {
            await escribir(h, SUB.respaldos, `proyecto ${sello()}.json`, previo)
            await podar(h, SUB.respaldos, 'proyecto ')
          }
        }
        await escribir(h, [], ARCHIVO_PROYECTO, texto)
        return { donde: 'carpeta', ruta: rutaLegible(h, [], ARCHIVO_PROYECTO) }
      }
    } catch (e) { console.warn('No se pudo guardar en la carpeta:', e) }
  }
  descargar(texto, nombreDescarga, 'application/json')
  return { donde: 'descarga', ruta: nombreDescarga }
}

/** El modelo.json que se va a reemplazar, a 3 Respaldos con la fecha en que entró */
export async function respaldarModelo(textoAnterior, at = Date.now()) {
  if (!activa?.handle || !textoAnterior) return null
  try {
    if (!(await puedeEscribir(false))) return null
    const nombre = `modelo ${sello(new Date(at))}.json`
    await escribir(activa.handle, SUB.respaldos, nombre, textoAnterior)
    await podar(activa.handle, SUB.respaldos, 'modelo ')
    return rutaLegible(activa.handle, SUB.respaldos, nombre)
  } catch { return null }
}
