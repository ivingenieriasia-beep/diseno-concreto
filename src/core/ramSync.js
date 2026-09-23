// ══════════════════════════════════════════════════════════════
// Sincronizar con RAM: la carpeta de reportes se elige UNA vez y el
// navegador la recuerda entre sesiones (File System Access API). A partir de
// ahí, cada vez que el script de RAM reescribe los .txt, sincronizar es un
// clic: la app vuelve a leer la carpeta, ve qué archivos cambiaron y los
// reparte entre los chips.
//
// El permiso sobre la carpeta lo concede el usuario y se puede revocar; por
// eso todo pasa por `permisoDe`, que vuelve a pedirlo desde el clic (un gesto
// del usuario, que es lo que exige el navegador).
//
// En un navegador sin esta API (Firefox, Safari) queda el camino de siempre:
// elegir la carpeta con <input webkitdirectory>, que no se puede recordar.
// ══════════════════════════════════════════════════════════════

const DB = 'iv_fs'
const STORE = 'handles'
const DATOS = 'datos'
const CLAVE = 'carpeta_ram'
const CLAVE_MODELO = 'modelo_ram'
const META = 'iv_ram_sync_v1'

/** ¿El navegador puede recordar la carpeta? (Chrome/Edge sí; Firefox/Safari no) */
export const puedeRecordar = () => typeof window !== 'undefined' && typeof window.showDirectoryPicker === 'function'

// ── IndexedDB mínima: los handles no caben en localStorage (no son JSON) ──
function abrirDB() {
  return new Promise((res, rej) => {
    if (typeof indexedDB === 'undefined') return rej(new Error('sin indexedDB'))
    const req = indexedDB.open(DB, 2)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE)
      if (!db.objectStoreNames.contains(DATOS)) db.createObjectStore(DATOS)
    }
    req.onsuccess = () => res(req.result)
    req.onerror = () => rej(req.error)
  })
}

async function idb(modo, fn, store = STORE) {
  const db = await abrirDB()
  try {
    return await new Promise((res, rej) => {
      const tx = db.transaction(store, modo)
      const req = fn(tx.objectStore(store))
      req.onsuccess = () => res(req.result)
      req.onerror = () => rej(req.error)
    })
  } finally { db.close() }
}

// ── El modelo de RAM ──────────────────────────────────────────
// Casi un mega de estaciones no cabe en localStorage junto con el proyecto
// (el autoguardado tiene ~5 MB para todo), así que vive aquí. Se guarda tal
// cual lo escribió el script: si mañana la app lee un campo más, está.
/** Se dispara cuando entra un modelo sincronizado nuevo */
export const EVENTO_MODELO = 'auxiv:modelo'

export async function guardarModelo(datos, archivo = '') {
  try {
    await idb('readwrite', (s) => s.put({ archivo, at: Date.now(), datos }, CLAVE_MODELO), DATOS)
    // los módulos abiertos (Agrupación, Deflexiones) se ponen al día solos
    if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent(EVENTO_MODELO, { detail: { archivo } }))
    return true
  } catch { return false }
}

export async function modeloGuardado() {
  try { return (await idb('readonly', (s) => s.get(CLAVE_MODELO), DATOS)) || null } catch { return null }
}

export async function olvidarModelo() {
  try { await idb('readwrite', (s) => s.delete(CLAVE_MODELO), DATOS) } catch { /* da igual */ }
}

export async function guardarCarpeta(handle) {
  try { await idb('readwrite', (s) => s.put(handle, CLAVE)); return true } catch { return false }
}

export async function carpetaGuardada() {
  try { return (await idb('readonly', (s) => s.get(CLAVE))) || null } catch { return null }
}

export async function olvidarCarpeta() {
  try { await idb('readwrite', (s) => s.delete(CLAVE)) } catch { /* da igual */ }
  try { localStorage.removeItem(META) } catch { /* da igual */ }
}

/**
 * Permiso de lectura sobre la carpeta. `pedir` sólo puede ir en true dentro de
 * un gesto del usuario (el clic en Sincronizar), que es cuando el navegador
 * deja mostrar el diálogo.
 * @returns 'granted' | 'prompt' | 'denied'
 */
export async function permisoDe(handle, pedir = false) {
  if (!handle?.queryPermission) return 'granted'          // navegador viejo: que lo intente
  try {
    const q = await handle.queryPermission({ mode: 'read' })
    if (q === 'granted' || !pedir) return q
    return await handle.requestPermission({ mode: 'read' })
  } catch { return 'denied' }
}

/** Pide la carpeta al usuario y la recuerda */
export async function elegirCarpeta() {
  const handle = await window.showDirectoryPicker({ id: 'reportes-ram', mode: 'read' })
  await guardarCarpeta(handle)
  return handle
}

const LEIBLE = /\.(json|txt|csv|xlsx)$/i

/**
 * Recorre la carpeta y sus subcarpetas (COLUMNAS / LONGITUDINAL / MAXIMOS…).
 * @returns [{ nombre, carpeta, file }] con la forma que espera el centro de carga
 */
export async function recorrerCarpeta(dir, { profundidad = 4 } = {}) {
  const out = []
  const bajar = async (h, carpeta, nivel) => {
    if (nivel > profundidad) return
    for await (const entry of h.values()) {
      if (entry.kind === 'directory') { await bajar(entry, entry.name, nivel + 1); continue }
      if (!LEIBLE.test(entry.name)) continue
      try { out.push({ nombre: entry.name, carpeta, file: await entry.getFile() }) } catch { /* archivo en la nube */ }
    }
  }
  await bajar(dir, '', 0)
  return out
}

// ── Qué cambió desde la última sincronización ────────────────
/** @returns { carpeta, at, archivos: { "CARPETA/nombre": lastModified } } */
export function ultimaSync() {
  try { return JSON.parse(localStorage.getItem(META) || 'null') } catch { return null }
}

export function guardarSync(carpeta, archivos) {
  const mapa = {}
  for (const a of archivos) mapa[`${a.carpeta}/${a.nombre}`] = a.file?.lastModified || 0
  try { localStorage.setItem(META, JSON.stringify({ carpeta, at: Date.now(), archivos: mapa })) } catch { /* da igual */ }
}

/**
 * Compara contra la última sincronización: lo que RAM acaba de reescribir
 * tiene una fecha mayor.
 * @returns { nuevos, actualizados, iguales, primera }
 */
export function cambios(archivos, previa = ultimaSync()) {
  const antes = previa?.archivos || null
  if (!antes) return { nuevos: archivos.map((a) => a.nombre), actualizados: [], iguales: [], primera: true }
  const nuevos = [], actualizados = [], iguales = []
  for (const a of archivos) {
    const k = `${a.carpeta}/${a.nombre}`
    const t = a.file?.lastModified || 0
    if (!(k in antes)) nuevos.push(a.nombre)
    else if (t > (antes[k] || 0)) actualizados.push(a.nombre)
    else iguales.push(a.nombre)
  }
  return { nuevos, actualizados, iguales, primera: false }
}

/** "hace 4 min" / "hace 2 h" / "ayer" */
export function hace(ts) {
  if (!ts) return ''
  const s = Math.max(0, Math.round((Date.now() - ts) / 1000))
  if (s < 60) return 'hace un momento'
  const m = Math.round(s / 60)
  if (m < 60) return `hace ${m} min`
  const h = Math.round(m / 60)
  if (h < 24) return `hace ${h} h`
  const d = Math.round(h / 24)
  return d === 1 ? 'ayer' : `hace ${d} días`
}

/** Resumen de una línea de lo que trajo la sincronización */
export function resumenSync(c, total) {
  if (c.primera) return `${total} archivo(s) leídos de la carpeta`
  const frescos = c.nuevos.length + c.actualizados.length
  if (!frescos) return `Sin cambios: los ${total} archivos siguen igual que la última vez`
  const partes = []
  if (c.actualizados.length) partes.push(`${c.actualizados.length} actualizado(s)`)
  if (c.nuevos.length) partes.push(`${c.nuevos.length} nuevo(s)`)
  return `${partes.join(' y ')} de ${total}: ${[...c.actualizados, ...c.nuevos].slice(0, 8).join(', ')}${frescos > 8 ? ` … (+${frescos - 8})` : ''}`
}
