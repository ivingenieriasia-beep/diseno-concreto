// ══════════════════════════════════════════════════════════════
// Datos del proyecto para la Memoria, sin volverlos a capturar
//
//   · de Pesos Unitarios: CM de losa (la de entrepiso que más pesa), CM de
//     muro (kg/m² del muro más pesado), CV de entrepiso y de azotea (la
//     máxima Wm de cada tipo de losa) y el área de los tableros;
//   · del modelo de RAM: niveles (elevaciones con trabes por encima del
//     desplante), altura de entrepiso (la más común) y un área aproximada
//     (rectángulo que envuelve las trabes de cada nivel).
// Lo que no se pueda deducir se deja como está.
// ══════════════════════════════════════════════════════════════

import { resumenLosa, resumenMuro, num } from './loads'
import { detectUpAxis } from './modelView'

const r1 = (v) => (Math.round(v * 10) / 10).toString()
const r2 = (v) => (Math.round(v * 100) / 100).toFixed(2)

export function datosDeCargas({ losas = [], muros = [], tableros = [] } = {}) {
  const out = {}, fuente = {}
  const L = losas.map((l) => ({ l, r: resumenLosa(l) }))
  const entre = L.filter(({ l }) => l.tipo !== 'azotea'), azo = L.filter(({ l }) => l.tipo === 'azotea')
  const max = (arr, f) => arr.reduce((m, x) => Math.max(m, f(x) || 0), 0)
  if (entre.length) {
    const cm = max(entre, (x) => x.r.cm), cv = max(entre, (x) => x.r.cv.Wm)
    if (cm > 0) { out.cmEntrepiso = r1(cm); fuente.cmEntrepiso = 'Pesos Unitarios' }
    if (cv > 0) { out.cvEntrepiso = r1(cv); fuente.cvEntrepiso = 'Pesos Unitarios' }
  } else if (L.length) {
    const cm = max(L, (x) => x.r.cm)
    if (cm > 0) { out.cmEntrepiso = r1(cm); fuente.cmEntrepiso = 'Pesos Unitarios' }
  }
  if (azo.length) {
    const cv = max(azo, (x) => x.r.cv.Wm)
    if (cv > 0) { out.cvAzotea = r1(cv); fuente.cvAzotea = 'Pesos Unitarios' }
  }
  const cmM = max(muros, (m) => resumenMuro(m).W)
  if (cmM > 0) { out.cmMuro = r1(cmM); fuente.cmMuro = 'Pesos Unitarios' }
  const area = tableros.reduce((s, t) => s + num(t.a1) * num(t.a2), 0)
  if (area > 0) { out.area = r1(area); fuente.area = 'tableros de Pesos Unitarios' }
  const niveles = new Set(tableros.map((t) => String(t.nivel || '').trim()).filter(Boolean))
  if (niveles.size) { out.niveles = String(niveles.size); fuente.niveles = 'tableros de Pesos Unitarios' }
  return { valores: out, fuente }
}

/** @param R resultado de parseModeloRam */
export function datosDeModelo(R) {
  const out = {}, fuente = {}
  const nodes = R?.model?.nodes || {}
  const rows = R?.model?.rows || []
  if (!rows.length) return { valores: out, fuente }
  const up = detectUpAxis(new Map(Object.entries(nodes)))
  const [ax, bx] = up === 'z' ? ['x', 'y'] : up === 'x' ? ['y', 'z'] : ['x', 'z']
  const q = (v) => Math.round(v / 0.05) * 0.05
  const porNivel = new Map()
  for (const r of rows) {
    const a = nodes[r.nj], b = nodes[r.nk]
    if (!a || !b) continue
    if (Math.abs(a[up] - b[up]) > 0.05) continue                // sólo horizontales
    const y = q((a[up] + b[up]) / 2)
    if (!porNivel.has(y)) porNivel.set(y, { x0: Infinity, x1: -Infinity, z0: Infinity, z1: -Infinity })
    const c = porNivel.get(y)
    for (const n of [a, b]) {
      c.x0 = Math.min(c.x0, n[ax]); c.x1 = Math.max(c.x1, n[ax]); c.z0 = Math.min(c.z0, n[bx]); c.z1 = Math.max(c.z1, n[bx])
    }
  }
  const apoyos = (R.reacciones || []).map((a) => a[up]).filter(Number.isFinite)
  const base = apoyos.length ? Math.min(...apoyos) : Math.min(...Object.values(nodes).map((n) => n[up]))
  const niveles = [...porNivel.keys()].filter((y) => y > base + 0.3).sort((a, b) => a - b)
  if (!niveles.length) return { valores: out, fuente }
  out.niveles = String(niveles.length); fuente.niveles = 'modelo de RAM'
  const alturas = niveles.map((y, i) => y - (i ? niveles[i - 1] : base))
  const cuenta = new Map()
  for (const h of alturas) { const k = r2(h); cuenta.set(k, (cuenta.get(k) || 0) + 1) }
  const hMas = [...cuenta.entries()].sort((a, b) => b[1] - a[1] || +b[0] - +a[0])[0]?.[0]
  if (hMas) { out.hEntrepiso = hMas; fuente.hEntrepiso = 'modelo de RAM' }
  const area = niveles.reduce((s, y) => { const c = porNivel.get(y); return s + Math.max(0, c.x1 - c.x0) * Math.max(0, c.z1 - c.z0) }, 0)
  if (area > 0) { out.area = r1(area); fuente.area = 'modelo de RAM (≈ rectángulo de cada nivel)' }
  return { valores: out, fuente }
}

/**
 * Junta las dos fuentes. Pesos Unitarios manda en cargas y área (es lo que
 * el ingeniero capturó); el modelo, en niveles y altura de entrepiso.
 */
export function prellenado(cargas, R) {
  const c = datosDeCargas(cargas), m = datosDeModelo(R)
  const valores = { ...c.valores }, fuente = { ...c.fuente }
  for (const k of ['niveles', 'hEntrepiso']) if (m.valores[k]) { valores[k] = m.valores[k]; fuente[k] = m.fuente[k] }
  if (!valores.area && m.valores.area) { valores.area = m.valores.area; fuente.area = m.fuente.area }
  return { valores, fuente }
}
