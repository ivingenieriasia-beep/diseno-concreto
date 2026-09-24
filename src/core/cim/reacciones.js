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
// Carga sobre la zapata: la reacción al revés. P = reacción vertical; los
// momentos y cortantes se pasan a los ejes de la zapata (x, y = el plano del
// modelo) con N·e = ŵ × M (ŵ el eje vertical, M el momento de la reacción):
// así la resultante se corre hacia donde empuja la columna, sea cual sea el
// eje vertical del modelo. El cortante de la columna también llega a la base.
// ══════════════════════════════════════════════════════════════

import { detectUpAxis } from '../modelView'
import { sectionDims } from '../geometry'
import { nuevaAislada, combinaciones } from './aislada'
import { nuevaCorrida } from './corrida'
import { nuevaContratrabe } from './contratrabe'
import { SUELO, CRITERIOS, GC, arriba, f2 } from './comun'

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

const EJE = { x: 0, y: 1, z: 2 }
const cruz = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]

/**
 * Una reacción de RAM ({fx…mz} sobre la estructura) como carga sobre la zapata,
 * en sus ejes: P hacia abajo; My corre la resultante en +x y Mx en +y (la
 * convención de la zapata aislada); Vx, Vy la fuerza horizontal que la columna
 * le pasa. Se comprueba con el sismo: si el edificio se empuja hacia +X, la
 * resultante de la zapata se va a +X y su cortante también.
 */
export function aZapata(r, up = 'y', plano = ['x', 'z']) {
  const f = [r.fx || 0, r.fy || 0, r.fz || 0], m = [r.mx || 0, r.my || 0, r.mz || 0]
  const w = EJE[up], u = EJE[plano[0]], v = EJE[plano[1]]
  const ew = [0, 0, 0]; ew[w] = 1
  const Ne = cruz(ew, m)
  return { P: f[w], Mx: Ne[v], My: Ne[u], Vx: -f[u], Vy: -f[v] }
}

/** La columna que llega a cada nudo con apoyo: su sección (b × h, cm) */
function columnasDeApoyos(R, nudos) {
  const rows = R?.model?.rows || []
  const secc = R?.secciones || {}
  const out = new Map()
  for (const n of nudos) {
    const row = rows.find((r) => r.nj === n || r.nk === n)
    if (!row) continue
    const med = secc[row.seccion] || Object.entries(secc).find(([k]) => k.replace(/\s+/g, '').toUpperCase() === row.seccion.replace(/\s+/g, '').toUpperCase())?.[1]
    const d = med ? { b: med.b, h: med.h } : sectionDims(row.seccion)
    if (d?.b > 0 && d?.h > 0) out.set(n, { c1: d.b, c2: d.h, seccion: row.seccion })
  }
  return out
}

/** Los apoyos con su posición en planta (m), su columna y lo que traen por caso */
export function apoyosDe(R) {
  const nodes = new Map(Object.entries(R?.model?.nodes || {}))
  const up = detectUpAxis(nodes)
  const plano = up === 'z' ? ['x', 'y'] : up === 'x' ? ['y', 'z'] : ['x', 'z']
  const casos = new Set((R?.casos || []).map((c) => String(c.id)))
  const cols = columnasDeApoyos(R, (R?.reacciones || []).map((r) => String(r.nudo)))
  const apoyos = (R?.reacciones || []).map((r) => ({
    nudo: String(r.nudo), x: r[plano[0]], y: r[plano[1]], elev: r[up], por: r.por || {},
    col: cols.get(String(r.nudo)) || null,
  }))
  const conCasos = apoyos.some((a) => Object.keys(a.por).some((k) => casos.has(k)))
  return { apoyos, up, plano, conCasos }
}

const VACIA = () => ({ P: 0, Mx: 0, My: 0, Vx: 0, Vy: 0 })
const COMP = ['P', 'Mx', 'My', 'Vx', 'Vy']
const planoDe = (up) => (up === 'z' ? ['x', 'y'] : up === 'x' ? ['y', 'z'] : ['x', 'z'])

/** Las cargas de un apoyo sumadas por papel: { CM: {P, Mx, My, Vx, Vy}, CV, S } */
export function cargasDeApoyo(a, papeles, up = 'y') {
  const out = { CM: VACIA(), CV: VACIA(), S: VACIA() }
  for (const [caso, r] of Object.entries(a.por || {})) {
    const p = papeles[caso]
    if (!p || p === 'no') continue
    const c = aZapata(r, up, planoDe(up))
    if (p === 'S') {
      // varios sismos (x, z): el que más pesa en cada componente; su sentido
      // lo ponen las combinaciones (el desfavorable)
      for (const k of COMP) if (Math.abs(c[k]) > Math.abs(out.S[k])) out.S[k] = Math.abs(c[k])
      continue
    }
    for (const k of COMP) out[p][k] += c[k]
  }
  return out
}

/** El sismo de un apoyo caso por caso, con su signo: { caso: { P, Mx, My, Vx, Vy } } */
export function sismosDeApoyo(a, papeles, up = 'y') {
  const out = {}
  for (const [caso, r] of Object.entries(a.por || {})) {
    if (papeles[caso] === 'S') out[caso] = aZapata(r, up, planoDe(up))
  }
  return out
}

/** Envolvente de varios apoyos: lo que pide el más cargado en cada renglón */
export function envolvente(lista) {
  const out = { CM: VACIA(), CV: VACIA(), S: VACIA() }
  // la P de muerta y viva van juntas: las del apoyo con más carga de servicio
  const peor = lista.reduce((a, b) => (b.CM.P + b.CV.P > a.CM.P + a.CV.P ? b : a), lista[0])
  if (!peor) return out
  out.CM.P = peor.CM.P; out.CV.P = peor.CV.P
  for (const c of lista) {
    for (const caso of ['CM', 'CV', 'S']) for (const k of ['Mx', 'My', 'Vx', 'Vy']) if (Math.abs(c[caso][k] || 0) > Math.abs(out[caso][k])) out[caso][k] = c[caso][k] || 0
    if (Math.abs(c.S.P) > Math.abs(out.S.P)) out.S.P = Math.abs(c.S.P)
  }
  const red = (v) => Math.round(v * 1000) / 1000
  for (const caso of ['CM', 'CV', 'S']) for (const k of COMP) out[caso][k] = red(out[caso][k])
  return out
}

/**
 * Lado que pide cada apoyo para el suelo: la zapata cuadrada céntrica más
 * chica (a cada 5 cm, h de tanteo) que pasa todas sus combinaciones de
 * servicio, con el peso de la zapata y el relleno, el cortante de la columna y
 * el sismo en los dos sentidos (el que descarga manda en las de orilla).
 */
export function ladoRequerido(c, obra = {}, h = 35) {
  const S = { ...SUELO, ...(obra.suelo || {}) }, C = { ...CRITERIOS, ...(obra.criterios || {}) }
  const hm = h / 100, qadm = Number(S.qadm), gs = Number(S.gs ?? 1.6), Df = Number(S.Df ?? 1)
  const wA = GC * hm + gs * Math.max(0, Df - hm)
  if (!(qadm > wA)) return 0
  const cmb = combinaciones(c, C, hm).servicio
  if (!(cmb[0].P > 0)) return 0
  const pasa = (B) => cmb.every((k) => {
    const Nt = k.P + B * B * wA
    if (!(Nt > 0)) return false
    const Bx = B - 2 * Math.abs(k.My / Nt), By = B - 2 * Math.abs(k.Mx / Nt)
    return Bx > 0 && By > 0 && Nt / (Bx * By) <= k.k * qadm + 1e-9
  })
  let B = 0.6
  while (B < 10 && !pasa(B)) B = Math.round((B + 0.05) * 100) / 100
  return B
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

const redondea3 = (c) => Object.fromEntries(Object.entries(c).map(([k, v]) => [k, Object.fromEntries(Object.entries(v).map(([j, x]) => [j, Math.round(x * 1000) / 1000]))]))

const resumenApoyos = (as) => (as.length <= 6 ? `nudo${as.length > 1 ? 's' : ''} ${as.map((a) => a.nudo).join(', ')}` : `${as.length} nudos (${as.slice(0, 4).map((a) => a.nudo).join(', ')}…)`)

/** Zapatas aisladas: una por grupo de apoyos, con la envolvente del grupo */
export function aisladasDesde(apoyos, papeles, up, { tipos = 3, obra = {}, archivo = '' } = {}) {
  const cargas = apoyos.map((a) => cargasDeApoyo(a, papeles, up))
  const lados = cargas.map((c) => ladoRequerido(c, obra))
  const grupos = agruparPorLado(lados, tipos)
  return grupos.map((g) => {
    const as = g.idx.map((i) => apoyos[i])
    const z = nuevaAislada()
    // la columna más chica del grupo: rige penetración, aplastamiento y volado
    const cols = as.map((a) => a.col).filter(Boolean)
    const c1 = cols.length ? Math.min(...cols.map((c) => c.c1)) : z.geo.c1
    const c2 = cols.length ? Math.min(...cols.map((c) => c.c2)) : z.geo.c2
    return {
      ...z,
      cargas: envolvente(g.idx.map((i) => cargas[i])),
      // y la zapata se revisa también con las de cada apoyo
      apoyos: g.idx.map((i) => ({ nudo: apoyos[i].nudo, cargas: redondea3(cargas[i]) })),
      geo: { ...z.geo, c1, c2, B: Math.max(0.6, arriba(g.B, 0.05)), L: Math.max(0.6, arriba(g.B, 0.05)) },
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
  const z = nuevaContratrabe()
  const red = (v) => Math.round(v * 1000) / 1000
  // lo que dobla la contratrabe en su plano: el momento que corre la resultante
  // a lo largo del eje, y el cortante en esa dirección
  const aEje = (m) => ({ P: m.P, M: (m.My || 0) * E.u[0] + (m.Mx || 0) * E.u[1], V: (m.Vx || 0) * E.u[0] + (m.Vy || 0) * E.u[1] })
  // el sismo del eje: el caso que más voltea a lo largo de la contratrabe (sus P
  // cargando un extremo y descargando el otro, más los momentos de las
  // columnas), con su signo; las combinaciones lo toman en los dos sentidos
  const sis = orden.map(({ a }) => sismosDeApoyo(a, papeles, up))
  const tm = orden.reduce((s0, o) => s0 + o.t, 0) / orden.length
  const casosS = [...new Set(sis.flatMap((x) => Object.keys(x)))]
  let casoS = null, mejor = -1
  for (const k of casosS) {
    const v = Math.abs(orden.reduce((s0, o, i) => {
      const q = sis[i][k] ? aEje(sis[i][k]) : { P: 0, M: 0 }
      return s0 + q.P * (o.t - tm) + q.M
    }, 0))
    if (v > mejor) { mejor = v; casoS = k }
  }
  const columnas = orden.map(({ a, t }, i) => {
    const c = cargasDeApoyo(a, papeles, up)
    const cm = aEje(c.CM), cv = aEje(c.CV)
    const s0 = casoS && sis[i][casoS] ? aEje(sis[i][casoS]) : { P: 0, M: 0, V: 0 }
    const col = a.col || { c1: 30, c2: 30 }
    // el lado de la columna a lo largo del eje
    const ladoEje = Math.abs(E.u[0]) >= Math.abs(E.u[1]) ? col.c1 : col.c2, ladoOtro = ladoEje === col.c1 ? col.c2 : col.c1
    const r3 = (q) => ({ P: red(q.P), M: red(q.M), V: red(q.V) })
    return { x: red(voladizo + t), c: ladoEje, cb: ladoOtro, CM: r3(cm), CV: r3(cv), S: r3(s0), nudo: a.nudo }
  })
  const L = red(voladizo * 2 + orden[orden.length - 1].t)
  return {
    ...z,
    geo: { ...z.geo, L },
    columnas,
    origen: { ram: { archivo, nudos: apoyos.map((a) => a.nudo), resumen: `${resumenApoyos(apoyos)} · eje de ${f2(orden[orden.length - 1].t)} m${casoS ? ` · sismo del eje: ${casoS}` : ''}${E.fuera > 0.3 ? ` · ojo: hay nudos a ${f2(E.fuera)} m del eje` : ''}` } },
  }
}

