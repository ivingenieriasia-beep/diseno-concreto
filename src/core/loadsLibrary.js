// ══════════════════════════════════════════════════════════════
// Biblioteca de Pesos Unitarios
// Materiales, componentes y plantillas de losa/muro que sobreviven al
// proyecto: las de fábrica vienen del catálogo y las tuyas se guardan en
// localStorage. Al meter una plantilla en un proyecto se COPIA; a partir
// de ahí la copia es tuya y editarla no toca la plantilla.
// ══════════════════════════════════════════════════════════════

import {
  MATERIALES, COMPONENTES_DIRECTOS, PLANTILLAS_LOSA, PLANTILLAS_MURO,
} from './loadsCatalog'
import { MARCA } from './marca'

const LS_KEY = 'iv_loads_lib_v1'
export const LIB_VERSION = 1

const vacio = () => ({
  materiales: [],      // { nombre, gamma }
  componentes: [],     // { nombre, W }
  plantillasLosa: [],  // receta de losa completa
  plantillasMuro: [],
  ocultas: [],         // ids de fábrica que no quieres ver
})

let USER = vacio()
let listeners = []

export function onLibraryChange(fn) {
  listeners.push(fn)
  return () => { listeners = listeners.filter((f) => f !== fn) }
}
function notify() { listeners.forEach((fn) => fn(getLibrary())) }

function persist() {
  try { localStorage.setItem(LS_KEY, JSON.stringify({ version: LIB_VERSION, ...USER })) } catch { /* cuota — silencioso */ }
  notify()
}

/** Lee lo guardado. Se llama una vez al montar el módulo. */
export function initLoadsLibrary() {
  try {
    const raw = localStorage.getItem(LS_KEY)
    const p = raw ? JSON.parse(raw) : null
    USER = { ...vacio(), ...(p || {}) }
    for (const k of ['materiales', 'componentes', 'plantillasLosa', 'plantillasMuro', 'ocultas']) {
      if (!Array.isArray(USER[k])) USER[k] = []
    }
  } catch { USER = vacio() }
  notify()
  return getLibrary()
}

/** Sólo para las pruebas y el botón de "restablecer". */
export function resetLoadsLibrary() { USER = vacio(); persist() }

const marcar = (arr, origen) => arr.map((x) => ({ ...x, origen }))

/**
 * Biblioteca efectiva: fábrica + usuario, con las tuyas pisando a las de
 * fábrica del mismo nombre/id y sin las que hayas ocultado.
 */
export function getLibrary() {
  const ocultas = new Set(USER.ocultas)
  const porNombre = (fab, usr) => {
    const nombres = new Set(usr.map((x) => x.nombre))
    return [...fab.filter((x) => !nombres.has(x.nombre) && !ocultas.has(x.nombre)), ...usr]
  }
  const porId = (fab, usr) => {
    const ids = new Set(usr.map((x) => x.id))
    return [...fab.filter((x) => !ids.has(x.id) && !ocultas.has(x.id)), ...usr]
  }
  return {
    materiales: porNombre(marcar(MATERIALES, 'fabrica'), marcar(USER.materiales, 'usuario')),
    componentes: porNombre(marcar(COMPONENTES_DIRECTOS, 'fabrica'), marcar(USER.componentes, 'usuario')),
    plantillasLosa: porId(marcar(PLANTILLAS_LOSA, 'fabrica'), marcar(USER.plantillasLosa, 'usuario')),
    plantillasMuro: porId(marcar(PLANTILLAS_MURO, 'fabrica'), marcar(USER.plantillasMuro, 'usuario')),
    ocultas: [...USER.ocultas],
  }
}

export function getUserLibrary() { return USER }

// ── Altas y bajas ────────────────────────────────────────────

/** Un material con el mismo nombre sustituye al anterior (así se corrige un γ). */
export function guardarMaterial(mat) {
  const nombre = String(mat.nombre || '').trim()
  if (!nombre) return false
  USER.materiales = [...USER.materiales.filter((m) => m.nombre !== nombre), { nombre, gamma: Number(mat.gamma) || 0 }]
  persist()
  return true
}

export function guardarComponente(comp) {
  const nombre = String(comp.nombre || '').trim()
  if (!nombre) return false
  USER.componentes = [...USER.componentes.filter((c) => c.nombre !== nombre), { nombre, W: Number(comp.W) || 0 }]
  persist()
  return true
}

/** Guarda una losa del proyecto como plantilla reutilizable. */
export function guardarPlantillaLosa(losa, { id } = {}) {
  const pid = id || `usr-${slug(losa.nombre)}-${Date.now().toString(36)}`
  const plantilla = {
    id: pid,
    nombre: losa.nombre || 'Losa sin nombre',
    tipo: losa.tipo || 'entrepiso',
    uso: losa.cv?.uso || losa.uso || '',
    nota: losa.nota || '',
    capas: (losa.capas || []).map(limpiaCapa),
  }
  USER.plantillasLosa = [...USER.plantillasLosa.filter((p) => p.id !== pid), plantilla]
  persist()
  return plantilla
}

export function guardarPlantillaMuro(muro, { id } = {}) {
  const pid = id || `usr-muro-${slug(muro.nombre)}-${Date.now().toString(36)}`
  const plantilla = {
    id: pid,
    nombre: muro.nombre || 'Muro sin nombre',
    capas: (muro.capas || []).map(limpiaCapa),
    alturas: (muro.alturas || []).map((a) => ({ nombre: a.nombre || '', h: Number(a.h) || 0 })),
  }
  USER.plantillasMuro = [...USER.plantillasMuro.filter((p) => p.id !== pid), plantilla]
  persist()
  return plantilla
}

/** Quita un material: si es tuyo lo borra, si es de fábrica lo oculta. */
export function borrarMaterial(nombre) {
  const antes = USER.materiales.length
  USER.materiales = USER.materiales.filter((m) => m.nombre !== nombre)
  if (USER.materiales.length === antes && !USER.ocultas.includes(nombre)) USER.ocultas = [...USER.ocultas, nombre]
  persist()
}

/** Igual que borrarMaterial, para los componentes de peso directo. */
export function borrarComponente(nombre) {
  const antes = USER.componentes.length
  USER.componentes = USER.componentes.filter((c) => c.nombre !== nombre)
  if (USER.componentes.length === antes && !USER.ocultas.includes(nombre)) USER.ocultas = [...USER.ocultas, nombre]
  persist()
}

/** Borra una plantilla tuya; si es de fábrica sólo la oculta. */
export function borrarPlantilla(id) {
  const antes = USER.plantillasLosa.length + USER.plantillasMuro.length
  USER.plantillasLosa = USER.plantillasLosa.filter((p) => p.id !== id)
  USER.plantillasMuro = USER.plantillasMuro.filter((p) => p.id !== id)
  if (USER.plantillasLosa.length + USER.plantillasMuro.length === antes && !USER.ocultas.includes(id)) {
    USER.ocultas = [...USER.ocultas, id]
  }
  persist()
}

/** Vuelve a mostrar algo de fábrica que habías ocultado. */
export function restaurar(id) {
  USER.ocultas = USER.ocultas.filter((x) => x !== id)
  persist()
}

// ── Instanciar en el proyecto ────────────────────────────────

let seq = 0
export function nuevoId(pref = 'x') {
  seq += 1
  return `${pref}${Date.now().toString(36)}${seq.toString(36)}`
}

function limpiaCapa(c) {
  const base = { nombre: c.nombre || '', modo: c.modo || 'directo' }
  if (c.modo === 'espesor') return { ...base, t: numOr(c.t), gamma: numOr(c.gamma) }
  if (c.modo === 'lineal') return { ...base, long: numOr(c.long), pesoML: numOr(c.pesoML), area: numOr(c.area) }
  return { ...base, W: numOr(c.W), ...(c.t !== undefined ? { t: numOr(c.t) } : {}) }
}
const numOr = (v) => (v === '' || v === null || v === undefined ? '' : Number(v))

/** Copia de trabajo de una plantilla, con ids propios, lista para el proyecto. */
export function instanciarLosa(plantilla) {
  return {
    id: nuevoId('L'),
    nombre: plantilla.nombre,
    tipo: plantilla.tipo || 'entrepiso',
    nota: plantilla.nota || '',
    plantillaId: plantilla.id || null,
    capas: (plantilla.capas || []).map((c) => ({ ...limpiaCapa(c), id: nuevoId('c'), activa: true })),
    cv: { uso: plantilla.uso || 'Oficinas', wm: '', manual: false, W: '', Wa: '', Wm: '' },
  }
}

export function instanciarMuro(plantilla) {
  return {
    id: nuevoId('M'),
    nombre: plantilla.nombre,
    plantillaId: plantilla.id || null,
    capas: (plantilla.capas || []).map((c) => ({ ...limpiaCapa(c), id: nuevoId('c'), activa: true })),
    alturas: (plantilla.alturas || []).map((a) => ({ ...a, id: nuevoId('h') })),
  }
}

/** Duplica una losa del proyecto para probar una variante sin perder la original. */
export function duplicarLosa(losa, sufijo = '(variante)') {
  return {
    ...losa,
    id: nuevoId('L'),
    nombre: `${losa.nombre} ${sufijo}`.trim(),
    capas: (losa.capas || []).map((c) => ({ ...c, id: nuevoId('c') })),
    cv: { ...losa.cv },
  }
}

export function duplicarMuro(muro, sufijo = '(variante)') {
  return {
    ...muro,
    id: nuevoId('M'),
    nombre: `${muro.nombre} ${sufijo}`.trim(),
    capas: (muro.capas || []).map((c) => ({ ...c, id: nuevoId('c') })),
    alturas: (muro.alturas || []).map((a) => ({ ...a, id: nuevoId('h') })),
  }
}

export function losaVacia(nombre = 'Losa nueva') {
  return {
    id: nuevoId('L'), nombre, tipo: 'entrepiso', nota: '', plantillaId: null,
    capas: [], cv: { uso: 'Oficinas', wm: '', manual: false, W: '', Wa: '', Wm: '' },
  }
}

export function muroVacio(nombre = 'Muro nuevo') {
  return { id: nuevoId('M'), nombre, plantillaId: null, capas: [], alturas: [{ id: nuevoId('h'), nombre: 'Muro', h: 3 }] }
}

export function capaVacia(modo = 'espesor') {
  if (modo === 'espesor') return { id: nuevoId('c'), nombre: '', modo, t: '', gamma: '', activa: true }
  if (modo === 'lineal') return { id: nuevoId('c'), nombre: '', modo, long: '', pesoML: '', area: '', activa: true }
  return { id: nuevoId('c'), nombre: '', modo: 'directo', W: '', activa: true }
}

export function tableroVacio(nombre = 'Tablero 1') {
  return {
    id: nuevoId('T'), nombre, nivel: '', losaId: null, a1: '', a2: '',
    metodo: 'tributaria', direccion: 'auto', casoCV: 'Wm',
    muroId: null, muroH: '', muroLado: 'largo',
  }
}

function slug(s) {
  return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 32) || 'sin-nombre'
}

// ── Import / export ──────────────────────────────────────────

export function exportLibrary() {
  return JSON.stringify({ tipo: 'auxiliar-iv-biblioteca-cargas', version: LIB_VERSION, ...USER }, null, 2)
}

/**
 * Mete una biblioteca exportada. modo 'merge' (por omisión) conserva lo
 * que ya tienes y lo que llega pisa por id/nombre; 'replace' la sustituye.
 */
export function importLibrary(texto, { modo = 'merge' } = {}) {
  let data
  try { data = typeof texto === 'string' ? JSON.parse(texto) : texto } catch { return { ok: false, error: 'El archivo no es un JSON válido.' } }
  if (!data || typeof data !== 'object') return { ok: false, error: 'El archivo no tiene el formato esperado.' }
  if (data.tipo && data.tipo !== 'auxiliar-iv-biblioteca-cargas') {
    return { ok: false, error: `Ese .json no es una biblioteca de cargas de ${MARCA.app}.` }
  }
  const entra = { ...vacio(), ...data }
  const unirPorNombre = (a, b) => {
    const n = new Set(b.map((x) => x.nombre))
    return [...a.filter((x) => !n.has(x.nombre)), ...b]
  }
  const unirPorId = (a, b) => {
    const n = new Set(b.map((x) => x.id))
    return [...a.filter((x) => !n.has(x.id)), ...b]
  }
  if (modo === 'replace') {
    USER = {
      materiales: arr(entra.materiales), componentes: arr(entra.componentes),
      plantillasLosa: arr(entra.plantillasLosa), plantillasMuro: arr(entra.plantillasMuro),
      ocultas: arr(entra.ocultas),
    }
  } else {
    USER = {
      materiales: unirPorNombre(USER.materiales, arr(entra.materiales)),
      componentes: unirPorNombre(USER.componentes, arr(entra.componentes)),
      plantillasLosa: unirPorId(USER.plantillasLosa, arr(entra.plantillasLosa)),
      plantillasMuro: unirPorId(USER.plantillasMuro, arr(entra.plantillasMuro)),
      ocultas: [...new Set([...USER.ocultas, ...arr(entra.ocultas)])],
    }
  }
  persist()
  return {
    ok: true,
    contadas: {
      materiales: arr(entra.materiales).length, componentes: arr(entra.componentes).length,
      plantillasLosa: arr(entra.plantillasLosa).length, plantillasMuro: arr(entra.plantillasMuro).length,
    },
  }
}

const arr = (x) => (Array.isArray(x) ? x : [])
