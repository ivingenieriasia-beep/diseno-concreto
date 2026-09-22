// ══════════════════════════════════════════════════════════════
// Pesos unitarios y bajada de cargas
//
// Una losa es una lista de capas; cada capa aporta kg/m² de una de
// tres maneras:
//   · espesor  W = t · γ                 (losa de concreto, relleno, yeso…)
//   · directo  W = W                     (impermeabilizante, vigueta, lámina…)
//   · lineal   W = (long · peso/m) / área (largueros y contraventeos de cubierta)
// La suma de las capas activas es la carga muerta; la carga viva sale del
// catálogo por uso (W media · Wa instantánea · Wm máxima).
//
// Con la carga por m² y las dos dimensiones de un tablero se obtiene la
// carga lineal que se captura en RAM sobre las trabes de cada lado.
// ══════════════════════════════════════════════════════════════

import { buscarCargaViva } from './loadsCatalog'

/** Número tolerante: acepta strings de los campos y devuelve 0 si no es número. */
export function num(v) {
  if (v === '' || v === null || v === undefined) return 0
  const n = typeof v === 'number' ? v : parseFloat(String(v).replace(',', '.'))
  return Number.isFinite(n) ? n : 0
}

// ── Capas ────────────────────────────────────────────────────

/** Peso de una capa en kg/m². Una capa desactivada pesa 0 pero se conserva. */
export function pesoCapa(capa) {
  if (!capa || capa.activa === false) return 0
  switch (capa.modo) {
    case 'espesor': return num(capa.t) * num(capa.gamma)
    case 'lineal': {
      const area = num(capa.area)
      if (area <= 0) return 0
      return (num(capa.long) * num(capa.pesoML)) / area
    }
    case 'directo':
    default: return num(capa.W)
  }
}

/** Texto de la operación de la capa, para la tabla y la revisión a mano. */
export function formulaCapa(capa) {
  if (!capa) return ''
  switch (capa.modo) {
    case 'espesor': return `${num(capa.t)} m × ${num(capa.gamma)} kg/m³`
    case 'lineal': return `${num(capa.long)} m × ${num(capa.pesoML)} kg/m ÷ ${num(capa.area)} m²`
    case 'directo':
    default: return 'peso directo'
  }
}

/** Carga muerta de la losa: total en kg/m² y el desglose capa por capa. */
export function cargaMuerta(capas = []) {
  const detalle = capas.map((c) => ({ ...c, Wcalc: pesoCapa(c), formula: formulaCapa(c) }))
  const total = detalle.reduce((a, c) => a + c.Wcalc, 0)
  return { total, detalle }
}

// ── Carga viva ───────────────────────────────────────────────

/**
 * Resuelve la carga viva de una losa.
 * cv = { uso, wm, W, Wa, Wm, manual }
 *   · manual: true  → se usan los tres valores capturados a mano
 *   · uso con Wm libre (comercios, fábricas, bodegas) → W = 0.8·Wm, Wa = 0.9·Wm
 *     con el Wm que se capture en cv.wm
 */
export function cargaViva(cv = {}) {
  if (cv.manual) {
    return { W: num(cv.W), Wa: num(cv.Wa), Wm: num(cv.Wm), uso: cv.uso || 'Manual', libre: false, manual: true, nota: '' }
  }
  const base = buscarCargaViva(cv.uso)
  if (!base) return { W: 0, Wa: 0, Wm: 0, uso: cv.uso || '', libre: false, manual: false, nota: '', faltante: true }
  if (base.WmLibre) {
    const Wm = cv.wm === '' || cv.wm === undefined || cv.wm === null ? num(base.WmSugerido) : num(cv.wm)
    return {
      W: base.factorW * Wm, Wa: base.factorWa * Wm, Wm,
      uso: base.uso, libre: true, manual: false, nota: base.nota,
    }
  }
  return { W: base.W, Wa: base.Wa, Wm: base.Wm, uso: base.uso, libre: false, manual: false, nota: base.nota }
}

/** Resumen completo de una losa: carga muerta, carga viva y suma por caso. */
export function resumenLosa(losa = {}) {
  const cm = cargaMuerta(losa.capas || [])
  const cv = cargaViva(losa.cv || {})
  return {
    cm: cm.total,
    capas: cm.detalle,
    cv,
    total: { W: cm.total + cv.W, Wa: cm.total + cv.Wa, Wm: cm.total + cv.Wm },
  }
}

// ── Muros y pretiles ─────────────────────────────────────────

/** Muro: kg/m² del ensamble y kg/m para cada altura declarada. */
export function resumenMuro(muro = {}) {
  const cm = cargaMuerta(muro.capas || [])
  const alturas = (muro.alturas || []).map((a) => ({
    ...a, wML: cm.total * num(a.h),
  }))
  return { W: cm.total, capas: cm.detalle, alturas }
}

/** Carga lineal (kg/m) de un muro de altura h. */
export function cargaLinealMuro(muro, h) {
  return cargaMuerta(muro?.capas || []).total * num(h)
}

// ── Reparto por tablero ──────────────────────────────────────

export const METODOS = {
  tributaria: {
    id: 'tributaria',
    nombre: 'Área tributaria',
    resumen: 'Carga uniforme equivalente al área tributaria a 45° (la del libro de Excel).',
  },
  equivalente: {
    id: 'equivalente',
    nombre: 'Equivalente por momento',
    resumen: 'Carga uniforme que produce el mismo momento que la carga triangular o trapezoidal.',
  },
}

export const DIRECCIONES = {
  auto: 'Automática (m > 0.5 → dos direcciones)',
  dos: 'Forzar dos direcciones',
  una: 'Forzar una dirección',
}

/**
 * Reparte una presión w (kg/m²) sobre los dos lados de un tablero.
 *
 * a1/a2 se ordenan solos: el corto manda. m = corto / largo.
 *
 * Dos direcciones (m > 0.5):
 *   · área tributaria   → corto = w·a1/4      largo = (w·a1/4)·(2 − m)
 *   · equiv. por momento→ corto = w·a1/3      largo = (w·a1/3)·(3 − m²)/2
 * Una dirección (m ≤ 0.5): la losa se apoya en el lado largo y
 *   corto = 0, largo = w·a1/2, con los dos métodos.
 *
 * @returns {{corto:number, largo:number, m:number, wCorto:number, wLargo:number, dosDirecciones:boolean}}
 */
export function repartoTablero({ a1, a2, w, metodo = 'tributaria', direccion = 'auto' } = {}) {
  const l1 = num(a1), l2 = num(a2)
  const corto = Math.min(l1, l2)
  const largo = Math.max(l1, l2)
  const W = num(w)
  const m = largo > 0 ? corto / largo : 0
  const dosDirecciones = direccion === 'dos' ? true : direccion === 'una' ? false : m > 0.5

  if (corto <= 0 || largo <= 0) return { corto, largo, m, wCorto: 0, wLargo: 0, dosDirecciones }

  if (!dosDirecciones) {
    // Losa en una dirección: todo el peso baja a las dos trabes largas.
    return { corto, largo, m, wCorto: 0, wLargo: (W * corto) / 2, dosDirecciones }
  }
  if (metodo === 'equivalente') {
    const base = (W * corto) / 3
    return { corto, largo, m, wCorto: base, wLargo: base * ((3 - m * m) / 2), dosDirecciones }
  }
  const base = (W * corto) / 4
  return { corto, largo, m, wCorto: base, wLargo: base * (2 - m), dosDirecciones }
}

// ── Tableros del proyecto ────────────────────────────────────

/** Etiqueta del caso de carga viva. */
export const CASOS_CV = {
  W: 'CV media (W)',
  Wa: 'CV instantánea (Wa)',
  Wm: 'CV máxima (Wm)',
}

/**
 * Analiza un tablero contra su losa (y su muro de borde, si lo tiene).
 * Devuelve una entrada por caso de carga: la carga muerta de la losa,
 * la carga viva elegida y, aparte, el muro que se apoye en algún borde.
 */
export function analizarTablero(tablero = {}, losa = null, muro = null) {
  const res = losa ? resumenLosa(losa) : null
  const casoCV = tablero.casoCV || 'Wm'
  const opciones = { a1: tablero.a1, a2: tablero.a2, metodo: tablero.metodo || 'tributaria', direccion: tablero.direccion || 'auto' }
  const geo = repartoTablero({ ...opciones, w: 0 })

  const casos = []
  if (res) {
    casos.push({ clave: 'CM', etiqueta: 'CM (losa)', w: res.cm, ...repartoTablero({ ...opciones, w: res.cm }) })
    casos.push({ clave: 'CV', etiqueta: CASOS_CV[casoCV], w: res.cv[casoCV], ...repartoTablero({ ...opciones, w: res.cv[casoCV] }) })
  }

  // El muro no se reparte por área: es una carga lineal sobre el borde donde va.
  let muroCaso = null
  if (muro && tablero.muroH) {
    const wML = cargaLinealMuro(muro, tablero.muroH)
    const lado = tablero.muroLado || 'largo'
    muroCaso = {
      clave: 'CM-muro', etiqueta: `CM muro (${muro.nombre})`, w: wML, lado,
      corto: geo.corto, largo: geo.largo, m: geo.m, dosDirecciones: geo.dosDirecciones,
      wCorto: lado === 'corto' || lado === 'ambos' ? wML : 0,
      wLargo: lado === 'largo' || lado === 'ambos' ? wML : 0,
    }
    casos.push(muroCaso)
  }

  return {
    tablero, losa, muro, resumen: res,
    corto: geo.corto, largo: geo.largo, m: geo.m, dosDirecciones: geo.dosDirecciones,
    casos,
    // Suma de todo lo que baja a cada lado, útil para un vistazo rápido
    totalCorto: casos.reduce((a, c) => a + c.wCorto, 0),
    totalLargo: casos.reduce((a, c) => a + c.wLargo, 0),
  }
}

// ── Salida para RAM ──────────────────────────────────────────

export const UNIDADES = {
  kg: { id: 'kg', factor: 1, sufijo: 'kg/m' },
  ton: { id: 'ton', factor: 0.001, sufijo: 't/m' },
}

/** Una fila por tablero y caso de carga, lista para la tabla y el CSV. */
export function filasRam(tableros = [], losas = [], muros = [], { unidad = 'kg' } = {}) {
  const f = UNIDADES[unidad]?.factor ?? 1
  const filas = []
  for (const t of tableros) {
    const losa = losas.find((l) => l.id === t.losaId) || null
    const muro = muros.find((m) => m.id === t.muroId) || null
    const a = analizarTablero(t, losa, muro)
    for (const c of a.casos) {
      filas.push({
        tablero: t.nombre || '',
        losa: losa?.nombre || '—',
        nivel: t.nivel || '',
        caso: c.etiqueta,
        a1: a.corto, a2: a.largo,
        m: a.m,
        direccion: a.dosDirecciones ? '2 direcciones' : '1 dirección',
        metodo: METODOS[t.metodo || 'tributaria'].nombre,
        w: c.clave === 'CM-muro' ? c.w * f : c.w,   // el muro ya viene en kg/m
        unidadW: c.clave === 'CM-muro' ? UNIDADES[unidad].sufijo : 'kg/m²',
        wCorto: c.wCorto * f,
        wLargo: c.wLargo * f,
      })
    }
  }
  return filas
}

const CSV_COLS = [
  ['tablero', 'Tablero'], ['nivel', 'Nivel'], ['losa', 'Losa'], ['caso', 'Caso'],
  ['a1', 'a1 corto (m)'], ['a2', 'a2 largo (m)'], ['m', 'm = a1/a2'],
  ['direccion', 'Dirección'], ['metodo', 'Método'],
  ['w', 'w'], ['wCorto', 'WLC lado corto'], ['wLargo', 'WLL lado largo'],
]

function celdaCSV(v, sep) {
  const s = typeof v === 'number' ? (Math.round(v * 1000) / 1000).toString() : String(v ?? '')
  return s.includes(sep) || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s
}

/** CSV (o TSV, para pegar directo en una hoja) de las filas de RAM. */
export function tablaRamCSV(filas, { sep = ',', unidad = 'kg' } = {}) {
  const suf = UNIDADES[unidad]?.sufijo || 'kg/m'
  const enc = CSV_COLS.map(([k, t]) => (k === 'wCorto' || k === 'wLargo' ? `${t} (${suf})` : t))
  const lineas = [enc.join(sep)]
  for (const f of filas) lineas.push(CSV_COLS.map(([k]) => celdaCSV(f[k], sep)).join(sep))
  return lineas.join('\n')
}
