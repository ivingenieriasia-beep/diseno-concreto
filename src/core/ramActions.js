// ══════════════════════════════════════════════════════════════
// Reporte de RAM "Acciones discriminadas y puntos de inflexión en miembros".
// Es el mejor insumo para el análisis a lo largo:
//   · las estaciones no son una rejilla fija, sino los puntos que importan
//     (extremos, cambios de cortante y puntos de inflexión), así que el pico
//     real sí aparece — el de "Envolvente de esfuerzos" se lo puede saltar;
//   · trae la distancia a J en metros, así que la longitud del miembro sale
//     del propio reporte y no hay que capturarla;
//   · trae un bloque por combinación, y aquí se envuelven todas.
//
// Formato por miembro:
//   MIEMBRO 22
//                                 Plano 1-2         Plano 1-3
//   Estado Dist a J Axial Cortante V2 M33 Cortante V3 M22 Torsión
//   Estación  [m]   [Ton]  [Ton] [Ton*m]  [Ton] [Ton*m] [Ton*m]
//   ------------------------------------------------------------
//   CD=1.3CM+1.5CV
//   0%      0.000  -0.004 -3.002   0.031 -0.024   0.009  0.160
//   15%     1.402  -0.004 -3.221  -4.331 -0.024   0.042  0.160
//   …
//
// Un mismo .txt puede traer varios reportes seguidos (acciones, envolvente
// por estaciones y máximos por miembro): cada uno se lee en su sección y con
// su propio orden de columnas.
// ══════════════════════════════════════════════════════════════

const NUM = /[-+]?\d+(?:[.,]\d+)?/g
const num = (s) => parseFloat(String(s).replace(',', '.'))
const CAMPOS = ['axial', 'v2', 'm33', 'v3', 'm22', 'tors']

/**
 * ¿El texto trae el reporte de acciones discriminadas? Si está, es el que
 * manda sobre los otros: es el único que garantiza el pico real.
 */
export function looksLikeActions(text) {
  const t = String(text || '')
  return /Acciones discriminadas/i.test(t) || (/Dist\s*a\s*J/i.test(t) && /^\s*\d+%\s+[-+]?\d/m.test(t))
}

/** Valor de una serie (x, v) en x, con sus saltos: devuelve {max, min} */
function evalSerie(filas, x) {
  const n = filas.length
  if (!n) return null
  const enX = filas.filter((f) => Math.abs(f.x - x) < 1e-9)   // dos filas en la misma x = salto
  if (enX.length) return { max: Math.max(...enX.map((f) => f.v)), min: Math.min(...enX.map((f) => f.v)) }
  if (x <= filas[0].x) return { max: filas[0].v, min: filas[0].v }
  if (x >= filas[n - 1].x) return { max: filas[n - 1].v, min: filas[n - 1].v }
  for (let i = 0; i < n - 1; i++) {
    const a = filas[i], b = filas[i + 1]
    if (x >= a.x && x <= b.x) {
      if (b.x === a.x) return { max: Math.max(a.v, b.v), min: Math.min(a.v, b.v) }
      const v = a.v + ((x - a.x) / (b.x - a.x)) * (b.v - a.v)
      return { max: v, min: v }
    }
  }
  return { max: filas[n - 1].v, min: filas[n - 1].v }
}

/**
 * @returns { members, points, combos, combo, unidades, archivo, warnings, formato }
 * members: [{ id, Lreport, stations:[{raw, pos, axial/v2/v3/tors/m22/m33:{max,min}}], combos, repMax, repMin }]
 */
export function parseRamActions(text) {
  const lines = String(text || '').replace(/^﻿/, '').replace(/^﻿/, '').split(/\r?\n/)
  const porId = new Map()
  const warnings = []
  let unidades = '', archivo = ''
  let cur = null, combo = null
  let seccion = 'acciones'

  const ver = (id) => {
    if (!porId.has(id)) porId.set(id, { id, porCombo: new Map(), repMax: null, repMin: null })
    return porId.get(id)
  }

  for (const raw of lines) {
    const line = raw.trim()
    if (!line || /^-{3,}$/.test(line)) continue
    let m
    if ((m = /^Sistema de unidades\s*:\s*(.+)$/i.exec(line))) { unidades = m[1].trim(); continue }
    if ((m = /^Nombre del archivo\s*:\s*(.+)$/i.exec(line))) { archivo = m[1].trim(); continue }
    if (/^Acciones discriminadas/i.test(line)) { seccion = 'acciones'; cur = null; continue }
    if (/^M[aá]ximos esfuerzos/i.test(line)) { seccion = 'maximos'; cur = null; continue }
    if (/^Envolvente de esfuerzos/i.test(line)) { if (seccion !== 'maximos') seccion = 'envolvente'; cur = null; continue }
    if ((m = /^MIEMBRO\s+(\S+)/i.exec(line))) { cur = ver(m[1]); combo = null; continue }
    if (!cur) continue
    if (/^(Estado|Estaci[oó]n|Plano|Nota)\b/i.test(line) || /^\[/.test(line)) continue

    if (seccion === 'acciones') {
      if (/^[A-Za-z][^\s]*\s*=/.test(line)) {          // "CD=1.3CM+1.5CV"
        combo = line
        if (!cur.porCombo.has(combo)) cur.porCombo.set(combo, [])
        continue
      }
      if ((m = /^(\d+(?:[.,]\d+)?)%\s+(.*)$/.exec(line))) {
        const vals = [...m[2].matchAll(NUM)].map((x) => num(x[0]))
        if (vals.length < 7) { warnings.push(`Miembro ${cur.id}: fila con ${vals.length} valores; se esperaban 7.`); continue }
        if (combo === null) { combo = '(sin nombre)'; cur.porCombo.set(combo, []) }
        cur.porCombo.get(combo).push({ x: vals[0], axial: vals[1], v2: vals[2], m33: vals[3], v3: vals[4], m22: vals[5], tors: vals[6] })
      }
      continue
    }

    // "Máximos esfuerzos en miembros": Max/Min sin estación, en el otro orden
    // de columnas (Axial · V2 · V3 · Torsión · M22 · M33)
    if (seccion === 'maximos' && (m = /^(Max|Min)\b(.*)$/i.exec(line))) {
      const vals = [...m[2].matchAll(NUM)].map((x) => num(x[0]))
      if (vals.length >= 6) {
        const fila = { axial: vals[0], v2: vals[1], v3: vals[2], tors: vals[3], m22: vals[4], m33: vals[5] }
        if (/max/i.test(m[1])) cur.repMax = fila; else cur.repMin = fila
      }
    }
  }

  // ── Envolvente de todas las combinaciones, estación por estación ──
  const members = []
  for (const c of porId.values()) {
    const bloques = [...c.porCombo.entries()].filter(([, f]) => f.length >= 2)
    if (!bloques.length) continue
    const xs = [...new Set(bloques.flatMap(([, f]) => f.map((r) => +r.x.toFixed(4))))].sort((a, b) => a - b)
    const L = xs[xs.length - 1] || 0
    const stations = xs.map((x) => {
      const st = { raw: x, pos: L > 0 ? x / L : 0 }
      for (const k of CAMPOS) {
        let mx = -Infinity, mn = Infinity
        for (const [, filas] of bloques) {
          const e = evalSerie(filas.map((r) => ({ x: r.x, v: r[k] })), x)
          if (!e) continue
          mx = Math.max(mx, e.max); mn = Math.min(mn, e.min)
        }
        st[k] = { max: mx === -Infinity ? 0 : mx, min: mn === Infinity ? 0 : mn }
      }
      return st
    })
    members.push({ id: c.id, Lreport: L > 0 ? L : null, stations, combos: bloques.map(([n]) => n), repMax: c.repMax, repMin: c.repMin })
  }

  const combos = [...new Set(members.flatMap((mb) => mb.combos))]
  if (!members.length) warnings.push('No se encontraron miembros con estaciones. Exporta en RAM «Acciones discriminadas y puntos de inflexión en miembros».')

  // Envolvente por miembro (Max/Min) para la revisión de sección
  const points = []
  for (const mb of members) {
    const agg = (k, f) => f(...mb.stations.map((s) => s[k].max), ...mb.stations.map((s) => s[k].min))
    const mx = {}, mn = {}
    for (const k of CAMPOS) {
      mx[k] = agg(k, Math.max); mn[k] = agg(k, Math.min)
      if (mb.repMax && mb.repMin) {                       // el bloque de máximos, si vino, también cuenta
        mx[k] = Math.max(mx[k], mb.repMax[k], mb.repMin[k])
        mn[k] = Math.min(mn[k], mb.repMax[k], mb.repMin[k])
      }
    }
    points.push({ id: `${mb.id}-Max`, member: mb.id, tipo: 'Max', ...mx, P: -mx.axial, combo: combos.join(' / ') })
    points.push({ id: `${mb.id}-Min`, member: mb.id, tipo: 'Min', ...mn, P: -mn.axial, combo: combos.join(' / ') })
  }

  // ¿Vino además el bloque «Máximos esfuerzos en miembros»? Es el único que
  // trae el pico exacto: las estaciones impresas son una muestra y casi siempre
  // se quedan cortas (en un modelo real, hasta un 12 %).
  const conMaximos = members.filter((mb) => mb.repMax && mb.repMin).length

  return { members, points, combos, combo: combos.join(' / '), unidades, archivo, warnings, formato: 'acciones', conMaximos }
}
