// ══════════════════════════════════════════════════════════════
// Planta de cimentación: los cimientos que salieron de los apoyos de RAM,
// dibujados en planta (m del modelo), con la utilización de cada apoyo con
// su propia reacción y lo que pasa de un lindero marcado.
// ══════════════════════════════════════════════════════════════

import { revisarCim, estadoCim } from './index'
import { centroColumna } from './aislada'
import { num } from './comun'
import { LADOS, lineaLindero, cargasEnEjes } from './reacciones'
import { APLICAR } from './ejes'

/**
 * Los cimientos que salieron de estos apoyos, en planta (m del modelo): cada
 * aislada en cada uno de sus apoyos (con la reacción de ese apoyo), y las
 * corridas y contratrabes como franjas sobre su eje.
 */
export function cimentacionEnPlanta(A, cimientos, cargas, obra, cont, linderos = {}) {
  const idx = new Map(A.apoyos.map((a, i) => [a.nudo, i]))
  // ¿algún vértice pasa del lindero? (1 cm de tolerancia)
  const invade = (poly) => LADOS.filter((l) => linderos[l]).filter((l) => {
    const v = lineaLindero(cont, l), k = l[0] === 'x' ? 0 : 1
    return poly.some((p) => (l.endsWith('min') ? p[k] < v - 0.01 : p[k] > v + 0.01))
  })
  const items = [], porNudo = new Map()
  const anota = (n, it) => { if (!porNudo.has(n)) porNudo.set(n, []); porNudo.get(n).push(it) }
  for (const z of cimientos) {
    const nudos = (z.origen?.ram?.nudos || []).map(String).filter((n) => idx.has(n))
    if (!nudos.length) continue
    if (z.tipo === 'aislada') {
      const B = num(z.geo.B, 1), L = num(z.geo.cuadrada ? z.geo.B : z.geo.L, 1)
      const { xc, yc } = centroColumna({ ...z.geo, L })
      for (const n of nudos) {
        const i = idx.get(n), a = A.apoyos[i]
        // en los ejes de su zapata (las de lindero y esquina vienen giradas)
        const T = (z.apoyos || []).find((x) => String(x.nudo) === n)?.T || [1, 0, 0, 1]
        // con la reacción de hoy de este apoyo: si el modelo cambió, se nota aquí
        const R = revisarCim({ ...z, cargas: cargasEnEjes(cargas[i], T), apoyos: [] }, obra)
        const { u } = estadoCim(R)
        // del local al de la planta: T es ortogonal, su inversa es su transpuesta
        const aPlanta = ([lx, ly]) => [a.x + T[0] * lx + T[2] * ly, a.y + T[1] * lx + T[3] * ly]
        const poly = [[-xc - B / 2, -yc - L / 2], [-xc + B / 2, -yc - L / 2], [-xc + B / 2, -yc + L / 2], [-xc - B / 2, -yc + L / 2]].map(aPlanta)
        const it = { z, n, u, ok: R.ok, rige: R.checks.filter((c) => !c.ok).map((c) => c.titulo.toLowerCase()), poly, invade: invade(poly) }
        items.push(it); anota(n, it)
      }
    } else if (z.tipo === 'corrida' || z.tipo === 'contratrabe' || z.tipo === 'liga') {
      // el eje del diseño y los que se le agregaron, cada uno con su revisión
      const o = z.origen?.ram || {}
      const ejes = [{ nudos: o.nudos, ini: o.ini, v0: o.v0, v1: o.v1, lindero: o.lindero }, ...(z.ejes || [])]
      ejes.forEach((e, k) => {
        const ns = (e.nudos || []).map(String).filter((n) => idx.has(n))
        if (!ns.length) return
        const zE = k === 0 ? { ...z, ejes: [] } : APLICAR[z.tipo](z, e)
        const it = franja(zE, e, ns, A, idx, obra)
        if (!it) return
        it.z = z; it.eje = k; it.invade = z.tipo === 'liga' ? [] : invade(it.poly)
        items.push(it)
        // la liga no apoya en el suelo: no es el cimiento de nadie
        if (z.tipo !== 'liga') for (const n of ns) anota(n, it)
      })
    }
  }
  return { items, porNudo }
}


/** Una franja en planta: corrida, contratrabe o liga sobre los apoyos de un eje */
function franja(z, e, nudos, A, idx, obra) {
  const pts = nudos.map((n) => A.apoyos[idx.get(n)])
  // el eje: de los dos apoyos más lejanos
  let p = pts[0], q = pts[pts.length - 1], dMax = -1
  for (const s of pts) for (const t of pts) { const d = Math.hypot(t.x - s.x, t.y - s.y); if (d > dMax) { dMax = d; p = s; q = t } }
  const largo = Math.max(dMax, 1e-6)
  let u = [(q.x - p.x) / largo, (q.y - p.y) / largo]
  let ini, L
  const porColumnas = () => {
    const cs = (z.columnas || []).filter((c) => c.nudo != null && idx.has(String(c.nudo)))
    if (cs.length < 2) return false
    const c0 = cs[0], cN = cs[cs.length - 1]
    const a0 = A.apoyos[idx.get(String(c0.nudo))], aN = A.apoyos[idx.get(String(cN.nudo))]
    const d = Math.hypot(aN.x - a0.x, aN.y - a0.y) || 1
    u = [(aN.x - a0.x) / d, (aN.y - a0.y) / d]
    if (z.tipo === 'liga') {
      // de paño a paño de las columnas de las orillas
      const x0 = num(c0.x) - num(c0.c, 30) / 200, x1 = num(cN.x) + num(cN.c, 30) / 200
      ini = [a0.x + (x0 - num(c0.x)) * u[0], a0.y + (x0 - num(c0.x)) * u[1]]
      L = x1 - x0
    } else ini = [a0.x - num(c0.x) * u[0], a0.y - num(c0.x) * u[1]]
    return true
  }
  if (z.tipo === 'contratrabe') {
    L = num(z.geo.L, largo)
    if (!porColumnas()) ini = [p.x - (L - largo) / 2 * u[0], p.y - (L - largo) / 2 * u[1]]
  } else if (z.tipo === 'liga') {
    if (!porColumnas()) { L = largo; ini = [p.x, p.y] }
  } else {
    L = num(z.geo.Lz, largo)
    const a0 = e.ini != null && idx.has(String(e.ini)) ? A.apoyos[idx.get(String(e.ini))] : null
    if (a0 && Number.isFinite(e.v0)) {
      // del primer apoyo, su volado hacia atrás
      const lejos = pts.reduce((m, t) => (Math.hypot(t.x - a0.x, t.y - a0.y) > Math.hypot(m.x - a0.x, m.y - a0.y) ? t : m), a0)
      const d = Math.hypot(lejos.x - a0.x, lejos.y - a0.y) || 1
      u = [(lejos.x - a0.x) / d, (lejos.y - a0.y) / d]
      ini = [a0.x - e.v0 * u[0], a0.y - e.v0 * u[1]]
    } else {
      const m = [(p.x + q.x) / 2, (p.y + q.y) / 2]
      ini = [m[0] - (L / 2) * u[0], m[1] - (L / 2) * u[1]]
    }
  }
  const B = z.tipo === 'liga' ? num(z.geo.b, 20) / 100 : num(z.geo.B, 1)
  const fin = [ini[0] + L * u[0], ini[1] + L * u[1]]
  let poly
  if (z.tipo === 'corrida' && z.geo.pos === 'lindero' && e.lindero) {
    // muro a la orilla: la cara de afuera en el lindero y la zapata hacia adentro
    const lado = e.lindero
    const n = lado === 'x-min' ? [1, 0] : lado === 'x-max' ? [-1, 0] : lado === 'y-min' ? [0, 1] : [0, -1]
    const t = num(z.geo.t, 15) / 100
    const off = (pp, d) => [pp[0] + n[0] * d, pp[1] + n[1] * d]
    poly = [off(ini, -t / 2), off(fin, -t / 2), off(fin, B - t / 2), off(ini, B - t / 2)]
  } else {
    const nv = [-u[1] * B / 2, u[0] * B / 2]
    poly = [[ini[0] + nv[0], ini[1] + nv[1]], [fin[0] + nv[0], fin[1] + nv[1]], [fin[0] - nv[0], fin[1] - nv[1]], [ini[0] - nv[0], ini[1] - nv[1]]]
  }
  const R = revisarCim(z, obra)
  const { u: ut } = estadoCim(R)
  return {
    nudos, u: ut, ok: R.ok, rige: R.checks.filter((c) => !c.ok).map((c) => c.titulo.toLowerCase()),
    franja: true, liga: z.tipo === 'liga', poly, linea: [ini, fin],
  }
}
