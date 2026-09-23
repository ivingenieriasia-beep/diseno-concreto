// ══════════════════════════════════════════════════════════════
// Deflexiones de trabes (NTC-Concreto y NTC-Criterios y Acciones).
//
// RAM da, en cada trabe y por CASO de carga, el desplazamiento vertical y el
// momento a lo largo del miembro (sincronizar.py, bloque «deflexiones»). Aquí:
//
//   1. Las trabes continuas se parten en TRAMOS entre apoyos: nudos con
//      columna o con apoyo, y los extremos que se conectan a algo. Un extremo
//      libre hace del tramo un voladizo.
//   2. La flecha de un tramo es relativa a la cuerda entre sus apoyos (en un
//      voladizo, relativa a su apoyo): lo que se acorta una columna no es
//      flecha de la trabe.
//   3. RAM analiza con la inercia bruta (o con su factor). La inmediata se
//      corrige con la inercia efectiva de la sección agrietada con su ARMADO:
//          Ie = (Mag/Ma)³·Ig + [1 − (Mag/Ma)³]·Iag ≤ Ig,   Mag = ff·Ig/(h/2)
//      en tramos continuos Ie = (Ie1 + Ie2 + 2·Ie3)/4 (extremos y centro), y
//          δi = δRAM · IRAM / Ie
//   4. Diferida = inmediata de la carga sostenida × 2/(1 + 50ρ') (clase 1;
//      4/(1 + 50ρ') clase 2), ρ' promedio (ρ'1 + ρ'2 + 2ρ'3)/4.
//   5. Límites: L/240 + 0.5 cm con todo (inmediata + diferida) y, si hay
//      elementos no estructurales que se puedan dañar, L/480 + 0.3 cm con lo
//      que ocurre después de colocarlos (inmediata de la viva + diferida).
//      En voladizos, el doble.
//
// Supuestos: el módulo de elasticidad de RAM es el de la NTC para el f'c de
// la sección (el del catálogo), y el acero de la sección del proyecto es el
// que tiene la trabe en los extremos (corridas + bastones puntuales arriba)
// y al centro (corridas + puntuales abajo).
// ══════════════════════════════════════════════════════════════

import { chainMembers, sectionDims } from './geometry'
import { memberKind, detectUpAxis } from './modelView'
import { claveNombre } from './bulkEnvelopes'
import { VARILLAS } from './sectionCalculator'
import { CAL_TO_NUM } from './constants'

export const ES = 2.04e6                               // kg/cm²
export const claseDe = (fc) => (fc >= 250 ? 1 : 2)
export const EcNTC = (fc) => (claseDe(fc) === 1 ? 14000 : 8000) * Math.sqrt(fc)   // kg/cm², agregado calizo
export const ffNTC = (fc) => (claseDe(fc) === 1 ? 2 : 1.4) * Math.sqrt(fc)         // módulo de rotura, kg/cm²

/** Papel de cada caso en la revisión: muerta, viva, viva media (sostenida) o no se usa */
export const ROLES = [
  { id: 'muerta', nombre: 'muerta' },
  { id: 'viva', nombre: 'viva' },
  { id: 'viva-media', nombre: 'viva media' },
  { id: 'no', nombre: 'no usar' },
]

export function rolesPorDefecto(casos) {
  const out = {}
  for (const c of casos || []) {
    const t = `${c.categoria || ''} ${c.id || ''} ${c.descripcion || ''}`.toUpperCase()
    if (/DEAD|MUERT|PERMAN|PESO PROPIO|SELF/.test(t) || /^(CM|PP|D|DL|SD|SDL)$/i.test(c.id)) out[c.id] = 'muerta'
    else if (/LIVE|VIVA/.test(t) || /^(CV|L|LL)\d*$/i.test(c.id)) {
      if (/MEDIA|MEAN|SOSTEN/.test(t)) out[c.id] = 'viva-media'
      else if (/ACCID|INSTANT/.test(t) || /^CVA/i.test(c.id)) out[c.id] = 'no'
      else out[c.id] = 'viva'
    } else out[c.id] = 'no'
  }
  return out
}

// ── Tramos ───────────────────────────────────────────────────

function geometria(R) {
  const nodes = new Map(Object.entries(R.model?.nodes || {}))
  const rows = R.model?.rows || []
  const up = detectUpAxis(nodes)
  const conex = new Map()
  for (const r of rows) {
    const a = nodes.get(r.nj), b = nodes.get(r.nk)
    if (!a || !b) continue
    const kind = memberKind(a, b, up)
    for (const n of [r.nj, r.nk]) {
      if (!conex.has(n)) conex.set(n, [])
      conex.get(n).push({ member: String(r.member), kind })
    }
  }
  return { nodes, rows, up, conex }
}

/**
 * Los tramos de todas las trabes con flechas, cada uno con sus perfiles por caso.
 * @returns [{ id, elem, grupo, seccion, nivel, L, tipo:'interior'|'voladizo', miembros, s:[m], dy:{caso:[cm]}, m:{caso:[t·m]}, ig }]
 */
export function tramosDeFlecha(R) {
  const F = R.flechas
  if (!F) return []
  const G = geometria(R)
  const fila = new Map(G.rows.map((x) => [x.member, x]))
  const ids = Object.keys(F.miembros).filter((id) => {
    const r = fila.get(id)
    const a = r && G.nodes.get(r.nj), b = r && G.nodes.get(r.nk)
    return a && b && memberKind(a, b, G.up) === 'trabe'
  })
  const casos = [...new Set(Object.values(F.miembros).flatMap((m) => Object.keys(m.dy)))]
  const tramos = []
  for (const ch of chainMembers(G.rows, G.nodes, ids)) {
    const enCadena = new Set(ch.members.map((m) => String(m.id)))
    const pos = [0, ...ch.members.map((m) => m.x0 + m.L)]
    const esApoyo = ch.nodes.map((n, k) => {
      const nd = G.nodes.get(n)
      const otros = (G.conex.get(n) || []).filter((c) => !enCadena.has(c.member))
      if (nd?.apoyo) return true
      if (otros.some((c) => c.kind === 'columna')) return true
      // los extremos se apoyan en lo que les llegue (otra trabe, un muro…); los interiores no
      return (k === 0 || k === ch.nodes.length - 1) && otros.length > 0
    })
    const iApoyos = esApoyo.map((a, k) => (a ? k : -1)).filter((k) => k >= 0)
    if (!iApoyos.length) continue
    const partes = []
    if (iApoyos[0] > 0) partes.push({ a: 0, b: iApoyos[0], tipo: 'voladizo', libre: 'a' })
    for (let j = 0; j + 1 < iApoyos.length; j++) partes.push({ a: iApoyos[j], b: iApoyos[j + 1], tipo: 'interior' })
    const ult = iApoyos[iApoyos.length - 1]
    if (ult < ch.nodes.length - 1) partes.push({ a: ult, b: ch.nodes.length - 1, tipo: 'voladizo', libre: 'b' })

    partes.forEach((p, k) => {
      const s0 = pos[p.a], s1 = pos[p.b]
      const mbs = ch.members.slice(p.a, p.b)
      // puntos (s, dy y m por caso) de sus miembros, en el sentido de la cadena
      const pts = []
      for (const m of mbs) {
        const f = F.miembros[String(m.id)]
        if (!f) continue
        f.x.forEach((x, i) => {
          const s = m.x0 + (m.reversed ? m.L - x : x)
          const dy = {}, mm = {}
          for (const c of casos) { dy[c] = f.dy[c]?.[i] ?? 0; mm[c] = f.m?.[c]?.[i] ?? 0 }
          pts.push({ s, dy, m: mm })
        })
      }
      pts.sort((u, v) => u.s - v.s)
      const junt = []
      for (const q of pts) {
        const prev = junt[junt.length - 1]
        if (prev && Math.abs(prev.s - q.s) < 1e-4) continue
        junt.push(q)
      }
      if (junt.length < 2) return
      const cuenta = new Map()
      for (const m of mbs) {
        const g = F.miembros[String(m.id)]?.grupo
        if (g) cuenta.set(g, (cuenta.get(g) || 0) + m.L)
      }
      const grupo = [...cuenta].sort((u, v) => v[1] - u[1])[0]?.[0] || ''
      const secc = F.miembros[String(mbs[0].id)]?.seccion || ''
      const igs = mbs.map((m) => F.miembros[String(m.id)]?.ig ?? 1)
      const n0 = G.nodes.get(ch.nodes[p.a])
      tramos.push({
        id: partes.length > 1 ? `${ch.id} · ${k + 1}/${partes.length}` : String(ch.id),
        elem: String(ch.id), grupo, seccion: secc, nivel: n0 ? n0[G.up] : 0,
        L: s1 - s0, tipo: p.tipo, libre: p.libre || null,
        miembros: mbs.map((m) => String(m.id)),
        s: junt.map((q) => q.s - s0),
        dy: Object.fromEntries(casos.map((c) => [c, junt.map((q) => q.dy[c])])),
        m: Object.fromEntries(casos.map((c) => [c, junt.map((q) => q.m[c])])),
        ig: igs.reduce((u, v) => u + v, 0) / igs.length,
      })
    })
  }
  return tramos
}

/** Perfil de una combinación de casos: Σ coef · serie */
const combinar = (series, coefs, n) => {
  const out = new Array(n).fill(0)
  for (const [c, k] of Object.entries(coefs)) {
    if (!k || !series[c]) continue
    for (let i = 0; i < n; i++) out[i] += k * series[c][i]
  }
  return out
}

/** Flecha (positiva hacia abajo) relativa a la cuerda de los apoyos, o al apoyo en un voladizo */
export function flechaRelativa(t, dy) {
  const n = dy.length, L = t.L
  let max = 0, xMax = 0
  for (let i = 0; i < n; i++) {
    let ref
    if (t.tipo === 'voladizo') ref = t.libre === 'a' ? dy[n - 1] : dy[0]
    else ref = dy[0] + (dy[n - 1] - dy[0]) * (L > 0 ? t.s[i] / L : 0)
    const d = -(dy[i] - ref)
    if (d > max) { max = d; xMax = t.s[i] }
  }
  return { max, x: xMax }
}

/** Momentos de servicio que mandan en la inercia efectiva: centro (+) y extremos (−) */
function momentosDe(t, m) {
  const n = m.length
  if (t.tipo === 'voladizo') {
    const iA = t.libre === 'a' ? n - 1 : 0
    return { pos: 0, negI: Math.max(0, -m[iA]), negJ: 0 }
  }
  let pos = 0
  for (let i = 0; i < n; i++) if (t.s[i] > 0.15 * t.L && t.s[i] < 0.85 * t.L) pos = Math.max(pos, m[i])
  return { pos, negI: Math.max(0, -m[0]), negJ: Math.max(0, -m[n - 1]) }
}

// ── La sección ───────────────────────────────────────────────

const areaDe = (cal) => (VARILLAS.find((v) => v.num === (CAL_TO_NUM[cal] || +cal)) || VARILLAS[2]).area

/** Acero de la sección del proyecto: abajo al centro, arriba en los apoyos, y el de compresión de cada zona */
export function aceroDe(t) {
  const nI = Math.max(0, +t.cantInf || 0), nS = Math.max(0, +t.cantSup || 0)
  const kI = Math.min(+t.cantBastonInf || 0, nI || Infinity), kS = Math.min(+t.cantBastonSup || 0, nS || Infinity)
  const corrInf = nI * areaDe(t.calInf) + kI * areaDe(t.calBastonInf || t.calInf)
  const corrSup = nS * areaDe(t.calSup) + kS * areaDe(t.calBastonSup || t.calSup)
  const puntInf = (+t.cantBastonPuntInf || 0) * areaDe(t.calBastonInf || t.calInf)
  const puntSup = (+t.cantBastonPuntSup || 0) * areaDe(t.calBastonSup || t.calSup)
  return {
    centro: { As: corrInf + puntInf, Asc: corrSup },    // tensión abajo, compresión arriba
    apoyo: { As: corrSup + puntSup, Asc: corrInf },     // tensión arriba, compresión abajo
  }
}

/** Inercia de la sección agrietada transformada, con acero de compresión (cm⁴) */
export function inerciaAgrietada({ b, d, dc, As, Asc, n }) {
  // b·c²/2 + (n−1)·Asc·(c − dc) = n·As·(d − c)
  const A = b / 2, B = (n - 1) * Asc + n * As, C = -((n - 1) * Asc * dc + n * As * d)
  const c = (-B + Math.sqrt(B * B - 4 * A * C)) / (2 * A)
  return (b * c ** 3) / 3 + (n - 1) * Asc * (c - dc) ** 2 + n * As * (d - c) ** 2
}

/** Inercia efectiva (Branson) para un momento de servicio Ma, en t·m */
export function inerciaEfectiva({ Ig, Iag, Mag, Ma }) {
  if (!(Ma > Mag) || !(Iag > 0)) return Ig
  const r = (Mag / Ma) ** 3
  return Math.min(Ig, r * Ig + (1 - r) * Iag)
}

// ── Revisar un tramo ─────────────────────────────────────────

/**
 * @param t      un tramo de tramosDeFlecha
 * @param sec    la sección del proyecto (armado) o null
 * @param med    las medidas con que RAM lo analizó { b, h } (cm)
 * @param opts   { roles, fSost, post }
 */
export function revisarTramo(t, sec, med, { roles = {}, fSost = 0.4, post = true } = {}) {
  const n = t.s.length
  const coef = (rol) => Object.fromEntries(Object.entries(roles).filter(([, r]) => r === rol).map(([c]) => [c, 1]))
  const cm = coef('muerta'), cv = coef('viva'), cvm = coef('viva-media')
  const hayMedia = Object.keys(cvm).length > 0
  // total: muerta + viva máxima (si el modelo sólo trae la media, con ésa)
  const tot = { ...cm }; for (const c of Object.keys(Object.keys(cv).length ? cv : cvm)) tot[c] = (tot[c] || 0) + 1
  const sost = { ...cm }
  if (hayMedia) for (const c of Object.keys(cvm)) sost[c] = (sost[c] || 0) + 1
  else for (const c of Object.keys(cv)) sost[c] = (sost[c] || 0) + fSost

  const carga = (k) => ({ dy: combinar(t.dy, k, n), m: combinar(t.m, k, n) })
  const niveles = { cm: carga(cm), sost: carga(sost), tot: carga(tot) }
  const elastico = Object.fromEntries(Object.entries(niveles).map(([k, v]) => [k, flechaRelativa(t, v.dy).max]))
  const Lcm = t.L * 100
  const f = t.tipo === 'voladizo' ? 2 : 1
  const lim = { total: f * (Lcm / 240 + 0.5), post: f * (Lcm / 480 + 0.3) }

  // lo que RAM tomó como inercia
  const bR = med?.b ?? sec?.ancho, hR = med?.h ?? sec?.peralte
  const Iram = bR && hR ? ((bR * hR ** 3) / 12) * (t.ig || 1) : null
  const base = { tramo: t, lim, elastico, Lcm }

  if (!sec || !(+sec.ancho > 0) || !(+sec.peralte > 0)) {
    // sin armado no hay inercia agrietada: sólo la elástica de RAM, que se queda corta
    const total = elastico.tot
    return { ...base, sinArmado: true, total, post: elastico.tot - elastico.cm, u: { total: total / lim.total, post: (elastico.tot - elastico.cm) / lim.post }, estado: 'sin-armado' }
  }

  const b = +sec.ancho, h = +sec.peralte, r = +sec.recub || 3, fc = +sec.fc || 250
  const d = h - r
  const Ec = EcNTC(fc), nMod = ES / Ec
  const Ig = (b * h ** 3) / 12
  const Mag = (ffNTC(fc) * Ig) / (h / 2) / 1e5                    // t·m
  const acero = aceroDe(sec)
  const IagC = inerciaAgrietada({ b, d, dc: r, As: acero.centro.As, Asc: acero.centro.Asc, n: nMod })
  const IagA = inerciaAgrietada({ b, d, dc: r, As: acero.apoyo.As, Asc: acero.apoyo.Asc, n: nMod })

  const IeDe = (Ma) => {
    const e3 = inerciaEfectiva({ Ig, Iag: IagC, Mag, Ma: Ma.pos })
    const e1 = inerciaEfectiva({ Ig, Iag: IagA, Mag, Ma: Ma.negI })
    const e2 = inerciaEfectiva({ Ig, Iag: IagA, Mag, Ma: Ma.negJ })
    if (t.tipo === 'voladizo') return e1
    return (e1 + e2 + 2 * e3) / 4
  }
  const Ma = Object.fromEntries(Object.entries(niveles).map(([k, v]) => [k, momentosDe(t, v.m)]))
  const Ie = Object.fromEntries(Object.entries(Ma).map(([k, v]) => [k, IeDe(v)]))
  const Iref = Iram || Ig
  const inmediata = Object.fromEntries(Object.keys(niveles).map((k) => [k, elastico[k] * (Iref / Ie[k])]))

  const rhoC = acero.centro.Asc / (b * d), rhoA = acero.apoyo.Asc / (b * d)
  const rhoP = t.tipo === 'voladizo' ? rhoA : (2 * rhoA + 2 * rhoC) / 4
  const lambda = (claseDe(fc) === 1 ? 2 : 4) / (1 + 50 * rhoP)
  const diferida = lambda * inmediata.sost
  const total = inmediata.tot + diferida
  const postV = inmediata.tot - inmediata.cm + diferida
  const u = { total: total / lim.total, post: postV / lim.post }
  const estado = u.total <= 1 + 1e-9 && (!post || u.post <= 1 + 1e-9) ? 'ok' : 'no'
  return {
    ...base, sinArmado: false, estado, u, total, post: postV, diferida, lambda, rhoP, inmediata,
    Ie, Ig, Iram: Iref, Iag: { centro: IagC, apoyo: IagA }, Mag, Ma, fc, Ec, acero,
  }
}

/**
 * Todos los tramos del modelo, revisados con la sección del proyecto que les toca.
 * @param secciones  las trabes del proyecto (con su armado)
 */
export function revisarModelo(R, secciones, opts = {}) {
  const porClave = new Map((secciones || []).map((t) => [claveNombre(t.nombre), t]))
  const medidas = new Map((R.grupos || []).map((g) => [g.nombre, g.medidas || sectionDims(g.seccion || '') || null]))
  return tramosDeFlecha(R).map((t) => revisarTramo(t, porClave.get(claveNombre(t.grupo)) || null, medidas.get(t.grupo), opts))
}
