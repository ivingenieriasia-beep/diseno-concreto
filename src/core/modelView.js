// ══════════════════════════════════════════════════════════════
// Reconstrucción del modelo de RAM a partir de nudos y miembros.
// Sirve para ver en pantalla lo mismo que entendió la app: qué miembros
// leyó, cómo los encadenó en elementos y en qué estado quedó cada uno.
// Todo en metros; la proyección devuelve coordenadas de dibujo (y hacia
// abajo, como en SVG) y el componente sólo las escala.
// ══════════════════════════════════════════════════════════════

const EJES = ['x', 'y', 'z']
const r3 = (v) => Math.round(v * 1000) / 1000

/**
 * Eje vertical del modelo: el que toma pocos valores distintos (los
 * niveles del edificio) frente a los dos que se reparten en planta.
 * RAM Elements usa Y por omisión; ante empate se queda con Y.
 */
export function detectUpAxis(nodes) {
  const set = { x: new Set(), y: new Set(), z: new Set() }
  for (const n of nodes.values()) for (const e of EJES) set[e].add(Math.round(n[e] * 100))
  const n = nodes.size || 1
  let best = 'y', bestScore = Infinity
  for (const e of ['y', 'x', 'z']) {
    const score = set[e].size / n
    if (score < bestScore - 1e-9) { best = e; bestScore = score }
  }
  return best
}

/** Los dos ejes en planta, en orden de dibujo (horizontal, vertical) */
export function planAxes(up) {
  return EJES.filter((e) => e !== up)
}

/** Niveles del modelo: valores del eje vertical con cuántos nudos tienen */
export function levels(nodes, up, { tol = 0.05 } = {}) {
  const acc = []
  for (const nd of nodes.values()) {
    const v = nd[up]
    const hit = acc.find((a) => Math.abs(a.v - v) <= tol)
    if (hit) { hit.n++; hit.sum += v; hit.v = hit.sum / hit.n } else acc.push({ v, sum: v, n: 1 })
  }
  return acc.map((a) => ({ v: r3(a.v), n: a.n })).sort((a, b) => a.v - b.v)
}

/** Tipo del miembro según su dirección: columna, trabe (horizontal) o diagonal */
export function memberKind(a, b, up, { tol = 0.1 } = {}) {
  const dv = Math.abs(b[up] - a[up])
  const [h, k] = planAxes(up)
  const dh = Math.hypot(b[h] - a[h], b[k] - a[k])
  if (dh <= tol && dv > tol) return 'columna'
  if (dv <= tol && dh > tol) return 'trabe'
  if (dh <= tol && dv <= tol) return 'nulo'
  return 'diagonal'
}

const COS30 = Math.cos(Math.PI / 6), SIN30 = 0.5

/** Punto 3D → punto de dibujo (x derecha, y abajo) según la vista */
export function projectPoint(n, vista, up) {
  const [h, k] = planAxes(up)
  const H = n[h], K = n[k], V = n[up]
  switch (vista) {
    // desde arriba y sin espejo, como la vista de RAM: Z a la izquierda, X hacia abajo
    case 'planta': return [-K, H]
    case 'frente': return [H, -V]
    case 'lado': return [K, -V]
    default: return [(H - K) * COS30, (H + K) * SIN30 - V] // isométrica
  }
}

/**
 * Proyecta el modelo completo.
 * @param nodes  Map id → {x,y,z} en m
 * @param rows   filas del reporte de miembros
 * @param opts   { vista, up, nivel (valor del eje vertical o null), tolNivel }
 * @returns { segs:[{id, seccion, kind, x1,y1,x2,y2, len}], bounds, up, nNodos }
 */
export function projectModel(nodes, rows, { vista = 'iso', up, nivel = null, tolNivel = 0.25 } = {}) {
  const U = up || detectUpAxis(nodes)
  const segs = []
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity
  const ver = (p) => { minX = Math.min(minX, p[0]); maxX = Math.max(maxX, p[0]); minY = Math.min(minY, p[1]); maxY = Math.max(maxY, p[1]) }
  for (const r of rows) {
    const a = nodes.get(r.nj), b = nodes.get(r.nk)
    if (!a || !b) continue
    if (nivel !== null && !tocaNivel(a, b, U, nivel, tolNivel)) continue
    const p = projectPoint(a, vista, U), q = projectPoint(b, vista, U)
    ver(p); ver(q)
    segs.push({
      id: String(r.member), seccion: r.seccion, descripcion: r.descripcion,
      kind: memberKind(a, b, U), nj: r.nj, nk: r.nk,
      x1: r3(p[0]), y1: r3(p[1]), x2: r3(q[0]), y2: r3(q[1]),
      len: r3(Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z)),
    })
  }
  if (!segs.length) return { segs, bounds: { minX: 0, maxX: 1, minY: 0, maxY: 1, w: 1, h: 1 }, up: U, nNodos: 0 }
  return {
    segs, up: U, nNodos: nodes.size,
    bounds: { minX, maxX, minY, maxY, w: Math.max(maxX - minX, 0.001), h: Math.max(maxY - minY, 0.001) },
  }
}

/** ¿El miembro vive en ese nivel? (horizontal en él, o columna que lo toca) */
function tocaNivel(a, b, up, nivel, tol) {
  const va = a[up], vb = b[up]
  return Math.abs(va - nivel) <= tol || Math.abs(vb - nivel) <= tol
}

/** miembro → elemento (cadena) al que pertenece */
export function memberToChain(chains) {
  const m = new Map()
  for (const c of chains || []) for (const mb of c.members) m.set(String(mb.id), c.id)
  return m
}

/** Resumen del modelo leído: para decirle al usuario qué entendió la app */
export function modelStats(nodes, rows, up) {
  const U = up || detectUpAxis(nodes)
  const porTipo = { columna: 0, trabe: 0, diagonal: 0, nulo: 0 }
  const porSeccion = new Map()
  let sinNudos = 0
  for (const r of rows) {
    const a = nodes.get(r.nj), b = nodes.get(r.nk)
    if (!a || !b) { sinNudos++; continue }
    porTipo[memberKind(a, b, U)]++
    porSeccion.set(r.seccion, (porSeccion.get(r.seccion) || 0) + 1)
  }
  return {
    up: U, nNodos: nodes.size, nMiembros: rows.length, sinNudos, porTipo,
    secciones: [...porSeccion.entries()].sort((a, b) => b[1] - a[1]),
    niveles: levels(nodes, U),
  }
}
