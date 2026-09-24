// ══════════════════════════════════════════════════════════════
// Cimentaciones desde las reacciones de RAM
//
// sincronizar.py guarda la reacción de cada nudo con apoyo en cada caso y
// combinación. Aquí se leen por CASO (muerta, viva, sismo) porque el suelo se
// revisa con cargas de servicio y el concreto con sus factores; con eso:
//   · una zapata aislada por apoyo o por grupo de apoyos (envolvente);
//   · las aisladas agrupadas en pocos tipos, del tamaño que pide cada apoyo
//     (programación dinámica: el menor volumen de concreto con k tipos);
//   · una corrida con la carga por metro de una fila de apoyos (muro);
//   · una contratrabe con las columnas de un eje.
// Carga sobre la zapata = reacción: P = reacción vertical (hacia arriba en
// el apoyo, hacia abajo en la zapata); los momentos pasan con signo contrario.
// ══════════════════════════════════════════════════════════════

import { detectUpAxis } from '../modelView'
import { nuevaAislada } from './aislada'
import { nuevaCorrida } from './corrida'
import { nuevaContratrabe } from './contratrabe'
import { SUELO, capacidadEfectiva, arriba, f2 } from './comun'

export const PAPELES = [
  { id: 'CM', t: 'muerta (CM)' },
  { id: 'CV', t: 'viva (CV)' },
  { id: 'S', t: 'sismo (S)' },
  { id: 'no', t: 'no usar' },
]

const LATERAL = /SISM|SEISM|QUAKE|EARTH|VIENTO|WIND|^S[XYZ]\b|^CS[XYZ]|^S[XYZ]\d|^E[XYZ]\b/i

/** Papel de fábrica de cada caso de carga (no combinaciones) */
export function papelesPorDefecto(casos) {
  const out = {}
  for (const c of casos || []) {
    const t = `${c.categoria || ''} ${c.id || ''} ${c.descripcion || ''}`.toUpperCase()
    if (LATERAL.test(t) || LATERAL.test(String(c.id))) out[c.id] = /VIENTO|WIND/.test(t) ? 'no' : 'S'
    else if (/DEAD|MUERT|PERMAN|PESO PROPIO|SELF|SOBREIMP/.test(t) || /^(CM|PP|D|DL|SD|SDL|CMA|CMS)\d*$/i.test(c.id)) out[c.id] = 'CM'
    else if (/LIVE|VIVA/.test(t) || /^(CV|L|LL|CVM)\d*$/i.test(c.id)) out[c.id] = /MEDIA|INSTANT|ACCID|^CVA/i.test(t) ? 'no' : 'CV'
    else out[c.id] = 'no'
  }
  return out
}

/** Los apoyos con su posición en planta (m) y lo que traen por caso */
export function apoyosDe(R) {
  const nodes = new Map(Object.entries(R?.model?.nodes || {}))
  const up = detectUpAxis(nodes)
  const plano = up === 'z' ? ['x', 'y'] : up === 'x' ? ['y', 'z'] : ['x', 'z']
  const casos = new Set((R?.casos || []).map((c) => String(c.id)))
  const apoyos = (R?.reacciones || []).map((r) => ({
    nudo: String(r.nudo), x: r[plano[0]], y: r[plano[1]], elev: r[up], por: r.por || {},
  }))
  const conCasos = apoyos.some((a) => Object.keys(a.por).some((k) => casos.has(k)))
  return { apoyos, up, plano, conCasos }
}

/** Las cargas de un apoyo sumadas por papel: { CM: {P, Mx, My}, CV, S } */
export function cargasDeApoyo(a, papeles, up = 'y') {
  const vert = up === 'z' ? 'fz' : up === 'x' ? 'fx' : 'fy'
  // momentos alrededor de los ejes de la planta de la zapata (x, y)
  const mX = up === 'z' ? 'mx' : up === 'x' ? 'my' : 'mx'
  const mY = up === 'z' ? 'my' : up === 'x' ? 'mz' : 'mz'
  const out = { CM: { P: 0, Mx: 0, My: 0 }, CV: { P: 0, Mx: 0, My: 0 }, S: { P: 0, Mx: 0, My: 0 } }
  const sismos = []
  for (const [caso, r] of Object.entries(a.por || {})) {
    const p = papeles[caso]
    if (!p || p === 'no') continue
    const c = { P: r[vert] || 0, Mx: -(r[mX] || 0), My: -(r[mY] || 0) }
    if (p === 'S') { sismos.push(c); continue }
    out[p].P += c.P; out[p].Mx += c.Mx; out[p].My += c.My
  }
  // varios sismos (x, z): el que más pesa en cada componente
  for (const s of sismos) {
    for (const k of ['P', 'Mx', 'My']) if (Math.abs(s[k]) > Math.abs(out.S[k])) out.S[k] = Math.abs(s[k])
  }
  return out
}

/** El sismo de un apoyo caso por caso, con su signo: { caso: { P, Mx, My } } */
export function sismosDeApoyo(a, papeles, up = 'y') {
  const vert = up === 'z' ? 'fz' : up === 'x' ? 'fx' : 'fy'
  const mX = up === 'x' ? 'my' : 'mx'
  const mY = up === 'z' ? 'my' : 'mz'
  const out = {}
  for (const [caso, r] of Object.entries(a.por || {})) {
    if (papeles[caso] === 'S') out[caso] = { P: r[vert] || 0, Mx: -(r[mX] || 0), My: -(r[mY] || 0) }
  }
  return out
}

/** Envolvente de varios apoyos: lo que pide el más cargado en cada renglón */
export function envolvente(lista) {
  const out = { CM: { P: 0, Mx: 0, My: 0 }, CV: { P: 0, Mx: 0, My: 0 }, S: { P: 0, Mx: 0, My: 0 } }
  // la P de muerta y viva van juntas: las del apoyo con más carga de servicio
  const peor = lista.reduce((a, b) => (b.CM.P + b.CV.P > a.CM.P + a.CV.P ? b : a), lista[0])
  if (!peor) return out
  out.CM.P = peor.CM.P; out.CV.P = peor.CV.P
  for (const c of lista) {
    for (const caso of ['CM', 'CV', 'S']) for (const k of ['Mx', 'My']) if (Math.abs(c[caso][k]) > Math.abs(out[caso][k])) out[caso][k] = c[caso][k]
    if (Math.abs(c.S.P) > Math.abs(out.S.P)) out.S.P = Math.abs(c.S.P)
  }
  const red = (v) => Math.round(v * 1000) / 1000
  for (const caso of ['CM', 'CV', 'S']) for (const k of ['P', 'Mx', 'My']) out[caso][k] = red(out[caso][k])
  return out
}

/** Lado que pide cada apoyo para el suelo (zapata cuadrada céntrica, h de tanteo) */
export function ladoRequerido(c, obra = {}, h = 30) {
  const S = { ...SUELO, ...(obra.suelo || {}) }
  const qe = capacidadEfectiva({ ...S, h }).qe
  const N = c.CM.P + c.CV.P
  if (N <= 0 || qe <= 0) return 0
  // con momentos: B tal que N / ((B − 2ex)(B − 2ey)) = qe
  const ex = Math.abs((c.CM.My + c.CV.My) / N), ey = Math.abs((c.CM.Mx + c.CV.Mx) / N)
  const a = 1, b = -2 * (ex + ey), cc = 4 * ex * ey - N / qe
  return (-b + Math.sqrt(b * b - 4 * a * cc)) / (2 * a)
}

/**
 * Agrupa lados requeridos en k tipos, cada uno del tamaño de su apoyo mayor,
 * con el menor volumen total (áreas × número de zapatas).
 * @returns grupos [{ desde, hasta, B, idx:[...] }] ordenados de mayor a menor
 */
export function agruparPorLado(lados, k) {
  const ord = lados.map((v, i) => ({ v: Math.max(v, 0), i })).sort((a, b) => a.v - b.v)
  const n = ord.length
  if (!n) return []
  k = Math.max(1, Math.min(k, n))
  const costo = (a, b) => (b - a + 1) * ord[b].v * ord[b].v
  const INF = Infinity
  const dp = Array.from({ length: k + 1 }, () => new Array(n).fill(INF))
  const corte = Array.from({ length: k + 1 }, () => new Array(n).fill(-1))
  for (let j = 0; j < n; j++) dp[1][j] = costo(0, j)
  for (let g = 2; g <= k; g++) {
    for (let j = g - 1; j < n; j++) {
      for (let s = g - 2; s < j; s++) {
        const v = dp[g - 1][s] + costo(s + 1, j)
        if (v < dp[g][j]) { dp[g][j] = v; corte[g][j] = s }
      }
    }
  }
  const grupos = []
  let j = n - 1
  for (let g = k; g >= 1; g--) {
    const s = g === 1 ? -1 : corte[g][j]
    grupos.push({ desde: ord[s + 1].v, hasta: ord[j].v, B: ord[j].v, idx: ord.slice(s + 1, j + 1).map((o) => o.i) })
    j = s
    if (j < 0) break
  }
  return grupos.sort((a, b) => b.B - a.B)
}

const resumenApoyos = (as) => (as.length <= 6 ? `nudo${as.length > 1 ? 's' : ''} ${as.map((a) => a.nudo).join(', ')}` : `${as.length} nudos (${as.slice(0, 4).map((a) => a.nudo).join(', ')}…)`)

/** Zapatas aisladas: una por grupo de apoyos, con la envolvente del grupo */
export function aisladasDesde(apoyos, papeles, up, { tipos = 3, obra = {}, archivo = '' } = {}) {
  const cargas = apoyos.map((a) => cargasDeApoyo(a, papeles, up))
  const lados = cargas.map((c) => ladoRequerido(c, obra))
  const grupos = agruparPorLado(lados, tipos)
  return grupos.map((g) => {
    const as = g.idx.map((i) => apoyos[i])
    const z = nuevaAislada()
    return {
      ...z,
      cargas: envolvente(g.idx.map((i) => cargas[i])),
      geo: { ...z.geo, B: Math.max(0.6, arriba(g.B, 0.05)), L: Math.max(0.6, arriba(g.B, 0.05)) },
      origen: { ram: { archivo, nudos: as.map((a) => a.nudo), resumen: `${resumenApoyos(as)} · lado pedido ${f2(g.desde)}–${f2(g.hasta)} m` } },
    }
  })
}

/** Eje principal de un conjunto de puntos en planta */
function eje(apoyos) {
  const n = apoyos.length
  const mx = apoyos.reduce((s, a) => s + a.x, 0) / n, my = apoyos.reduce((s, a) => s + a.y, 0) / n
  let sxx = 0, syy = 0, sxy = 0
  for (const a of apoyos) { sxx += (a.x - mx) ** 2; syy += (a.y - my) ** 2; sxy += (a.x - mx) * (a.y - my) }
  const th = 0.5 * Math.atan2(2 * sxy, sxx - syy)
  const u = [Math.cos(th), Math.sin(th)]
  const t = apoyos.map((a) => (a.x - mx) * u[0] + (a.y - my) * u[1])
  const d = apoyos.map((a) => Math.abs(-(a.x - mx) * u[1] + (a.y - my) * u[0]))
  return { u, t, fuera: Math.max(0, ...d) }
}

/** Zapata corrida: la suma de las reacciones de la fila entre su largo tributario */
export function corridaDesde(apoyos, papeles, up, { archivo = '' } = {}) {
  if (apoyos.length < 2) return null
  const E = eje(apoyos)
  const ts = [...E.t].sort((a, b) => a - b)
  const sep = (ts[ts.length - 1] - ts[0]) / (ts.length - 1)
  const L = ts[ts.length - 1] - ts[0] + sep
  const c = apoyos.map((a) => cargasDeApoyo(a, papeles, up))
  const sum = (caso) => c.reduce((s, x) => s + x[caso].P, 0) / L
  const z = nuevaCorrida()
  const red = (v) => Math.round(v * 1000) / 1000
  return {
    ...z,
    cargas: { CM: { w: red(sum('CM')), M: 0 }, CV: { w: red(sum('CV')), M: 0 }, S: { w: red(Math.max(0, ...c.map((x) => Math.abs(x.S.P))) / Math.max(sep, 0.5)), M: 0 } },
    geo: { ...z.geo, Lz: Math.round(L * 100) / 100 },
    origen: { ram: { archivo, nudos: apoyos.map((a) => a.nudo), resumen: `${resumenApoyos(apoyos)} · ${f2(L)} m de muro${E.fuera > 0.3 ? ` · ojo: hay nudos a ${f2(E.fuera)} m del eje` : ''}` } },
  }
}

/** Contratrabe: las columnas del eje, en su posición, con sus cargas */
export function contratrabeDesde(apoyos, papeles, up, { archivo = '', voladizo = 0.5 } = {}) {
  if (apoyos.length < 2) return null
  const E = eje(apoyos)
  const t0 = Math.min(...E.t)
  const orden = apoyos.map((a, i) => ({ a, t: E.t[i] - t0 })).sort((p, q) => p.t - q.t)
  const nrm = [-E.u[1], E.u[0]]
  const z = nuevaContratrabe()
  const red = (v) => Math.round(v * 1000) / 1000
  // el sismo del eje: el caso que más voltea a lo largo de la contratrabe, con su signo
  // (carga un extremo y descarga el otro; las combinaciones lo toman en los dos sentidos)
  const sis = orden.map(({ a }) => sismosDeApoyo(a, papeles, up))
  const tm = orden.reduce((s0, o) => s0 + o.t, 0) / orden.length
  const casosS = [...new Set(sis.flatMap((x) => Object.keys(x)))]
  let casoS = null, mejor = -1
  for (const k of casosS) {
    const v = Math.abs(orden.reduce((s0, o, i) => s0 + (sis[i][k]?.P || 0) * (o.t - tm), 0))
    if (v > mejor) { mejor = v; casoS = k }
  }
  const columnas = orden.map(({ a, t }, i) => {
    const c = cargasDeApoyo(a, papeles, up)
    // el momento que dobla la contratrabe en su plano: el que gira alrededor de la normal al eje
    const M = (m) => red(m.Mx * nrm[0] + m.My * nrm[1])
    const s0 = casoS ? sis[i][casoS] || { P: 0, Mx: 0, My: 0 } : { P: 0, Mx: 0, My: 0 }
    return { x: red(voladizo + t), c: 30, cb: 30, CM: { P: red(c.CM.P), M: M(c.CM) }, CV: { P: red(c.CV.P), M: M(c.CV) }, S: { P: red(s0.P), M: M(s0) }, nudo: a.nudo }
  })
  const L = red(voladizo * 2 + orden[orden.length - 1].t)
  return {
    ...z,
    geo: { ...z.geo, L },
    columnas,
    origen: { ram: { archivo, nudos: apoyos.map((a) => a.nudo), resumen: `${resumenApoyos(apoyos)} · eje de ${f2(orden[orden.length - 1].t)} m${casoS ? ` · sismo del eje: ${casoS}` : ''}${E.fuera > 0.3 ? ` · ojo: hay nudos a ${f2(E.fuera)} m del eje` : ''}` } },
  }
}

