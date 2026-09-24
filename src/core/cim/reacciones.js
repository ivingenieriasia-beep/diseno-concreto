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
import { nuevaAislada, combinaciones, centroColumna } from './aislada'
import { nuevaLiga } from './liga'
import { nuevaCorrida } from './corrida'
import { nuevaContratrabe } from './contratrabe'
import { SUELO, CRITERIOS, GC, arriba, f2, num } from './comun'

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

// ── Linderos ─────────────────────────────────────────────────
// Los lados de la planta que son colindancia se marcan en la planta
// ('x-min', 'x-max', 'y-min', 'y-max', en los ejes de la zapata). Un apoyo
// sobre un lado marcado lleva zapata de lindero; sobre dos, de esquina. Cada
// una se diseña en sus propios ejes, con el lindero del lado −x (y −y en la
// esquina): sus cargas se giran o reflejan a esos ejes con la matriz T
// (e_local = T e_global) y el mismo tipo sirve en los cuatro lados.

export const LADOS = ['x-min', 'x-max', 'y-min', 'y-max']
const TOL_LADO = 0.3                                          // m: un apoyo está «sobre» el lado

/** El rectángulo que envuelve los apoyos (centros de columna), m */
export function contorno(apoyos) {
  const xs = apoyos.map((a) => a.x), ys = apoyos.map((a) => a.y)
  const mitad = (eje, lado) => {
    // media columna de los apoyos de ese lado: el paño exterior es el lindero
    const v = lado === 'min' ? Math.min(...(eje === 'x' ? xs : ys)) : Math.max(...(eje === 'x' ? xs : ys))
    const en = apoyos.filter((a) => Math.abs((eje === 'x' ? a.x : a.y) - v) <= TOL_LADO)
    return Math.max(0.1, ...en.map((a) => ((eje === 'x' ? a.col?.c1 : a.col?.c2) || 30) / 200))
  }
  return {
    xmin: Math.min(...xs), xmax: Math.max(...xs), ymin: Math.min(...ys), ymax: Math.max(...ys),
    paño: { 'x-min': mitad('x', 'min'), 'x-max': mitad('x', 'max'), 'y-min': mitad('y', 'min'), 'y-max': mitad('y', 'max') },
  }
}

/** Dónde está la línea de un lindero (el paño exterior de las columnas de ese lado) */
export function lineaLindero(cont, lado) {
  const d = cont.paño[lado]
  return lado === 'x-min' ? cont.xmin - d : lado === 'x-max' ? cont.xmax + d : lado === 'y-min' ? cont.ymin - d : cont.ymax + d
}

const T0 = [1, 0, 0, 1]
const mul = (A, B) => [A[0] * B[0] + A[1] * B[2], A[0] * B[1] + A[1] * B[3], A[2] * B[0] + A[3] * B[2], A[2] * B[1] + A[3] * B[3]]
/**
 * Condición de un apoyo con los lados marcados: clase (centro, lindero,
 * esquina), la posición de su columna en la zapata (px, py) y T.
 */
export function condicionApoyo(a, cont, linderos = {}) {
  const en = (l) => linderos[l] && Math.abs((l[0] === 'x' ? a.x : a.y) - (l.endsWith('min') ? (l[0] === 'x' ? cont.xmin : cont.ymin) : (l[0] === 'x' ? cont.xmax : cont.ymax))) <= TOL_LADO
  const x = en('x-min') ? 'min' : en('x-max') ? 'max' : null
  const y = en('y-min') ? 'min' : en('y-max') ? 'max' : null
  if (x && y) {
    // esquina: se refleja lo que haga falta para que quede en (−x, −y)
    let T = T0
    if (x === 'max') T = mul([-1, 0, 0, 1], T)
    if (y === 'max') T = mul([1, 0, 0, -1], T)
    return { clase: 'esquina', lados: [`x-${x}`, `y-${y}`], px: 'min', py: 'min', T, gira: false }
  }
  if (x) return { clase: 'lindero', lados: [`x-${x}`], px: 'min', py: 'centro', T: x === 'max' ? [-1, 0, 0, 1] : T0, gira: false }
  // lindero en y: se gira un cuarto de vuelta para que quede del lado −x
  if (y) return { clase: 'lindero', lados: [`y-${y}`], px: 'min', py: 'centro', T: y === 'min' ? [0, 1, -1, 0] : [0, -1, 1, 0], gira: true }
  return { clase: 'centro', lados: [], px: 'centro', py: 'centro', T: T0, gira: false }
}

/** Las cargas de un apoyo en los ejes de su zapata (e_local = T e_global) */
export function cargasEnEjes(c, T = T0) {
  if (T.every((v, i) => v === T0[i])) return c
  const gira = (q, abs) => {
    // (My, Mx) y (Vx, Vy) son vectores en planta (x, y)
    const ex = T[0] * q.My + T[1] * q.Mx, ey = T[2] * q.My + T[3] * q.Mx
    const vx = T[0] * q.Vx + T[1] * q.Vy, vy = T[2] * q.Vx + T[3] * q.Vy
    const f = abs ? Math.abs : (v) => v
    return { P: q.P, My: f(ex), Mx: f(ey), Vx: f(vx), Vy: f(vy) }
  }
  return { CM: gira(c.CM, false), CV: gira(c.CV, false), S: gira(c.S, true) }
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

const CLASES = { centro: 'céntrica', lindero: 'de lindero', esquina: 'de esquina' }

/**
 * Los tipos de zapata aislada para unos apoyos: cada condición (céntrica, de
 * lindero, de esquina) se agrupa aparte, en hasta `tipos` tipos, con las
 * cargas ya en los ejes de su zapata.
 * @returns [{ clase, desde, hasta, B, idx: [...] }] (idx en `apoyos`)
 */
export function tiposDeZapata(apoyos, papeles, up, { tipos = 3, obra = {}, linderos = {}, cont = null } = {}) {
  const C = cont || contorno(apoyos)
  const conds = apoyos.map((a) => condicionApoyo(a, C, linderos))
  const cargas = apoyos.map((a, i) => cargasEnEjes(cargasDeApoyo(a, papeles, up), conds[i].T))
  const out = []
  for (const clase of ['centro', 'lindero', 'esquina']) {
    const idx = apoyos.map((_, i) => i).filter((i) => conds[i].clase === clase)
    if (!idx.length) continue
    const lados = idx.map((i) => ladoRequerido(cargas[i], obra))
    for (const g of agruparPorLado(lados, tipos)) out.push({ ...g, clase, idx: g.idx.map((k) => idx[k]) })
  }
  return { grupos: out, conds, cargas }
}

/** Zapatas aisladas: una por tipo, con la envolvente del tipo y la revisión de cada apoyo */
export function aisladasDesde(apoyos, papeles, up, { tipos = 3, obra = {}, archivo = '', linderos = {}, cont = null } = {}) {
  const { grupos, conds, cargas } = tiposDeZapata(apoyos, papeles, up, { tipos, obra, linderos, cont })
  return grupos.map((g) => {
    const as = g.idx.map((i) => apoyos[i])
    const z = nuevaAislada()
    const cd = conds[g.idx[0]]
    // la columna más chica del grupo (en los ejes de su zapata): rige
    // penetración, aplastamiento y volado
    const cols = g.idx.map((i) => (apoyos[i].col ? (conds[i].gira ? { c1: apoyos[i].col.c2, c2: apoyos[i].col.c1 } : apoyos[i].col) : null)).filter(Boolean)
    const c1 = cols.length ? Math.min(...cols.map((c) => c.c1)) : z.geo.c1
    const c2 = cols.length ? Math.min(...cols.map((c) => c.c2)) : z.geo.c2
    return {
      ...z,
      cargas: envolvente(g.idx.map((i) => cargas[i])),
      // y la zapata se revisa también con las de cada apoyo, cada una en sus ejes
      apoyos: g.idx.map((i) => ({ nudo: apoyos[i].nudo, cargas: cargas[i], T: conds[i].T })),
      geo: { ...z.geo, c1, c2, px: cd.px, py: cd.py, liga: true, B: Math.max(0.6, arriba(g.B, 0.05)), L: Math.max(0.6, arriba(g.B, 0.05)) },
      origen: { ram: { archivo, nudos: as.map((a) => a.nudo), resumen: `${CLASES[g.clase]} · ${resumenApoyos(as)} · lado pedido ${f2(g.desde)}–${f2(g.hasta)} m` } },
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
/** El lado marcado sobre el que caen todos estos apoyos, si hay uno */
function ladoComun(apoyos, linderos, cont) {
  if (!cont) return null
  const ls = apoyos.map((a) => condicionApoyo(a, cont, linderos).lados)
  return LADOS.find((l) => ls.every((x) => x.includes(l))) || null
}

/**
 * Volado en cada extremo de un cimiento sobre un eje: medio metro, o media
 * columna si ese extremo cae sobre un lindero marcado (que no sea el del eje):
 * así termina al ras de la colindancia.
 */
function volados(ini, fin, lado, linderos, cont, vol = 0.5) {
  const alRas = (a) => cont && condicionApoyo(a, cont, linderos).lados.some((l) => l !== lado)
  const media = (a) => Math.max(a.col?.c1 || 30, a.col?.c2 || 30) / 200
  return [alRas(ini) ? media(ini) : vol, alRas(fin) ? media(fin) : vol]
}

export function corridaDesde(apoyos, papeles, up, { archivo = '', linderos = {}, cont = null } = {}) {
  if (apoyos.length < 2) return null
  const E = eje(apoyos)
  const lado = ladoComun(apoyos, linderos, cont)
  const orden = apoyos.map((a, i) => ({ a, t: E.t[i] })).sort((p, q) => p.t - q.t)
  const span = orden[orden.length - 1].t - orden[0].t
  const sep = span / (orden.length - 1)
  const [v0, v1] = volados(orden[0].a, orden[orden.length - 1].a, lado, linderos, cont)
  const L = span + v0 + v1
  const c = apoyos.map((a) => cargasDeApoyo(a, papeles, up))
  const sum = (caso) => c.reduce((s, x) => s + x[caso].P, 0) / L
  const z = nuevaCorrida()
  const red = (v) => Math.round(v * 1000) / 1000
  return {
    ...z,
    cargas: { CM: { w: red(sum('CM')), M: 0 }, CV: { w: red(sum('CV')), M: 0 }, S: { w: red(Math.max(0, ...c.map((x) => Math.abs(x.S.P))) / Math.max(sep, 0.5)), M: 0 } },
    // sobre un lindero: el muro va a la orilla y la zapata crece hacia adentro
    geo: { ...z.geo, Lz: Math.round(L * 100) / 100, ...(lado ? { pos: 'lindero', liga: true } : {}) },
    origen: { ram: { archivo, nudos: apoyos.map((a) => a.nudo), lindero: lado, ini: orden[0].a.nudo, v0, v1, resumen: `${lado ? 'de lindero · ' : ''}${resumenApoyos(apoyos)} · ${f2(L)} m de muro${E.fuera > 0.3 ? ` · ojo: hay nudos a ${f2(E.fuera)} m del eje` : ''}` } },
  }
}

/** Contratrabe: las columnas del eje, en su posición, con sus cargas */
export function contratrabeDesde(apoyos, papeles, up, { archivo = '', voladizo = 0.5, linderos = {}, cont = null } = {}) {
  if (apoyos.length < 2) return null
  const E = eje(apoyos)
  const lado = ladoComun(apoyos, linderos, cont)
  const t0 = Math.min(...E.t)
  const orden = apoyos.map((a, i) => ({ a, t: E.t[i] - t0 })).sort((p, q) => p.t - q.t)
  const [v0, v1] = volados(orden[0].a, orden[orden.length - 1].a, lado, linderos, cont, voladizo)
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
    return { x: red(v0 + t), c: ladoEje, cb: ladoOtro, CM: r3(cm), CV: r3(cv), S: r3(s0), nudo: a.nudo }
  })
  const L = red(v0 + v1 + orden[orden.length - 1].t)
  return {
    ...z,
    geo: { ...z.geo, L },
    columnas,
    origen: { ram: { archivo, nudos: apoyos.map((a) => a.nudo), lindero: lado, resumen: `${lado ? 'sobre el lindero (se diseña centrada: revisa que el alero no pase al colindante) · ' : ''}${resumenApoyos(apoyos)} · eje de ${f2(orden[orden.length - 1].t)} m${casoS ? ` · sismo del eje: ${casoS}` : ''}${E.fuera > 0.3 ? ` · ojo: hay nudos a ${f2(E.fuera)} m del eje` : ''}` } },
  }
}


/** La carga última más grande de un apoyo (gravitacional o con sismo) */
export function puDeApoyo(c, C = CRITERIOS) {
  return Math.max(C.fcm * c.CM.P + C.fcv * c.CV.P, C.facc * (c.CM.P + c.CV.P + Math.abs(c.S.P)))
}

/**
 * Contratrabe de liga sobre los apoyos de un eje: une las zapatas a la altura
 * del dado. Cada apoyo con su Pu y, si su zapata es de lindero o de esquina
 * con trabe de liga, el momento N·e que la liga le quita, a lo largo del eje.
 */
export function ligaDesde(apoyos, papeles, up, { archivo = '', cimientos = [], obra = {} } = {}) {
  if (apoyos.length < 2) return null
  const C = { ...CRITERIOS, ...(obra.criterios || {}) }
  const E = eje(apoyos)
  const t0 = Math.min(...E.t)
  const orden = apoyos.map((a, i) => ({ a, t: E.t[i] - t0 })).sort((p, q) => p.t - q.t)
  const red = (v) => Math.round(v * 1000) / 1000
  const columnas = orden.map(({ a, t }) => {
    const c = cargasDeApoyo(a, papeles, up)
    const Pu = puDeApoyo(c, C)
    // la zapata de este apoyo, si la hay y está excéntrica con liga
    let Me = 0
    const zap = cimientos.find((z) => z.tipo === 'aislada' && (z.origen?.ram?.nudos || []).map(String).includes(a.nudo))
    if (zap && zap.geo?.liga) {
      const T = (zap.apoyos || []).find((x) => String(x.nudo) === a.nudo)?.T || [1, 0, 0, 1]
      const L = num(zap.geo.cuadrada ? zap.geo.B : zap.geo.L, 1)
      const { xc, yc } = centroColumna({ ...zap.geo, L })
      // de la columna al centro de la zapata, en planta (T ortogonal: su inversa es su transpuesta)
      const eg = [T[0] * -xc + T[2] * -yc, T[1] * -xc + T[3] * -yc]
      Me = Pu * Math.abs(eg[0] * E.u[0] + eg[1] * E.u[1])
    }
    const col = a.col || { c1: 30, c2: 30 }
    const lado = Math.abs(E.u[0]) >= Math.abs(E.u[1]) ? col.c1 : col.c2
    return { x: red(t), c: lado, Pu: red(Pu), Me: red(Me), nudo: a.nudo }
  })
  const z = nuevaLiga()
  const conMe = columnas.filter((c) => c.Me > 0).length
  return {
    ...z,
    columnas,
    origen: { ram: { archivo, nudos: apoyos.map((a) => a.nudo), resumen: `liga · ${resumenApoyos(apoyos)} · eje de ${f2(orden[orden.length - 1].t)} m${conMe ? ` · ${conMe} zapata(s) excéntrica(s) se ligan aquí` : ''}${E.fuera > 0.3 ? ` · ojo: hay nudos a ${f2(E.fuera)} m del eje` : ''}` } },
  }
}

/**
 * Lo que un eje más le aporta a un diseño que ya existe (corrida,
 * contratrabe o liga): sus cargas, sus columnas, su largo, su condición.
 */
export function ejeDesde(tipo, apoyos, papeles, up, op = {}) {
  if (tipo === 'corrida') {
    const z = corridaDesde(apoyos, papeles, up, op)
    return z && { nudos: z.origen.ram.nudos, cargas: z.cargas, Lz: z.geo.Lz, pos: z.geo.pos, ini: z.origen.ram.ini, v0: z.origen.ram.v0, v1: z.origen.ram.v1, lindero: z.origen.ram.lindero }
  }
  if (tipo === 'contratrabe') {
    const z = contratrabeDesde(apoyos, papeles, up, op)
    return z && { nudos: z.origen.ram.nudos, columnas: z.columnas, L: z.geo.L, lindero: z.origen.ram.lindero }
  }
  if (tipo === 'liga') {
    const z = ligaDesde(apoyos, papeles, up, op)
    return z && { nudos: z.origen.ram.nudos, columnas: z.columnas }
  }
  return null
}
