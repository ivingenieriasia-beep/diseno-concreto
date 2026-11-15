// ══════════════════════════════════════════════════════════════
// Asentamientos con la cimentación como viga sobre resortes (3.13)
//
// Arma el modelo de vigaResortes.js con lo del proyecto: las corridas (con
// su CT) y las contratrabes que salieron de RAM, y sus ejes ligados; los ks
// del estrato o de la zona bajo cada punto; las cargas de servicio (CM + CV
// media, o la máxima donde falte y el ingeniero lo pidió) y U1 (fcm CM +
// fcv CV máxima, los factores de «Suelo y criterios»); las trabes de liga con
// los extremos que elige el ingeniero. Devuelve lo mismo que la corrida
// flexible (paneles, tramos, revisiones, memoria) más las vigas y las ligas
// con su deformada, su M y su V.
// ══════════════════════════════════════════════════════════════

import { paso, check, f1, f2, f3, num, GC, CRITERIOS, SUELO } from './comun'
import { ctDe, llevaCT } from './ct'
import { recLiga } from './liga'
import { EcNTC } from '../deflexiones'
import { MALLA, nuevoAsent, faltantes, franjasDe, estratoEn, wLinea, cvMedia, resistencias } from './asentamientos'
import { DS_VIGA, resolverVigas, rigidezLiga, mallaViga } from './vigaResortes'

const mm = (m) => m * 1000
const finito = (v) => v !== '' && v != null && Number.isFinite(Number(v))
const EXT = ['empotrada', 'articulada']
const txtExt = (e) => (e === 'empotrada' ? 'empotrada' : 'articulada')

/** La sección que da la rigidez de la viga: la CT de la corrida o la contratrabe (cm) */
export function seccionViga(z) {
  const m = z.mat || {}
  if (z.tipo === 'contratrabe') {
    const g = z.geo || {}, r = num(m.r, 5)
    const h = Math.max(num(g.H, 60), num(g.h, 20))
    return {
      nombre: `contratrabe ${f1(num(g.bw, 25))} × ${f1(h)}`, b: num(g.bw, 25), h,
      sup: { num: 5, n: 3, ...(z.arm?.sup || {}) }, inf: { num: 5, n: 3, ...(z.arm?.inf || {}) }, est: { num: 3, ramas: 2, s: 20, ...(z.arm?.est || {}) },
      r, rInf: r, fc: num(m.fc, 250), fy: num(m.fy, 4200),
    }
  }
  if (!llevaCT(z)) return null
  const ct = ctDe(z)
  return { nombre: `${ct.nombre} ${f1(num(ct.b))} × ${f1(num(ct.h))}`, b: num(ct.b), h: num(ct.h), sup: ct.sup, inf: ct.inf, est: ct.est, r: num(ct.r), rInf: num(ct.rInf), fc: num(m.fc, 250), fy: num(m.fy, 4200) }
}

/** La sección de una trabe de liga del proyecto (cm) */
export function seccionLiga(z) {
  const rec = recLiga(z.mat)
  return {
    nombre: `${z.nombre} ${f1(num(z.geo?.b, 15))} × ${f1(num(z.geo?.h, 30))}`, b: num(z.geo?.b, 15), h: num(z.geo?.h, 30),
    sup: z.arm?.sup || { num: 4, n: 2 }, inf: z.arm?.inf || { num: 4, n: 2 }, est: z.arm?.est || { num: 2.5, ramas: 2, s: 15 },
    r: rec.r, rInf: rec.rInf, fc: num(z.mat?.fc, 250), fy: num(z.mat?.fy, 4200),
  }
}

/** EI en t·m² de una sección en cm, con Ie = fI · Ig */
const EIde = (sec, fI) => (EcNTC(sec.fc) * fI * (sec.b * sec.h ** 3) / 12) / 1e7

/**
 * Las trabes de liga del modelo: cada tramo de las TL del proyecto que van
 * entre nudos de RAM, más las que el ingeniero agrega (de un nudo a otro nudo
 * o al eje de otra viga, con la sección de una TL del proyecto).
 */
export function ligasDelModelo(cimientos, a) {
  const out = []
  for (const z of cimientos.filter((x) => x.tipo === 'liga')) {
    const cs = [...(z.columnas || [])].filter((c) => c.nudo != null && c.nudo !== '').sort((p, q) => num(p.x) - num(q.x))
    for (let i = 0; i < cs.length - 1; i++) {
      const key = `${z.uid}:${i}`, e = a.extLigas?.[key] || {}
      out.push({ key, auto: true, nombre: cs.length > 2 ? `${z.nombre}, tramo ${i + 1}` : z.nombre, z, de: String(cs[i].nudo), hasta: { tipo: 'nudo', nudo: String(cs[i + 1].nudo) }, extA: e.a || '', extB: e.b || '' })
    }
  }
  for (const l of a.ligas || []) {
    out.push({ key: l.id, auto: false, nombre: l.nombre || l.id, z: cimientos.find((x) => x.tipo === 'liga' && x.uid === l.tl) || null, de: l.de != null ? String(l.de) : '', hasta: l.hasta || { tipo: 'nudo', nudo: '' }, extA: l.extA || '', extB: l.extB || '' })
  }
  return out
}

/** Lo que falta sólo en la viga sobre resortes */
export function faltantesViga(a, { franjas = [], ligas = [], cimientos = [] } = {}) {
  const out = []
  if (a.modelo && a.modelo !== 'winkler') out.push('La viga sobre resortes usa el modelo de Winkler: elige «Winkler (ks)» y captura el ks de cada estrato.')
  if (!['no', 'diseno', 'capturado'].includes(a.pesoViga)) out.push('Elige si la viga lleva el peso de la zapata y el relleno (no, el W de su diseño o uno capturado).')
  if (a.pesoViga === 'capturado') {
    const sin = cimientos.filter((z) => (z.tipo === 'corrida' || z.tipo === 'contratrabe') && !finito(a.wPeso?.[z.uid]))
    if (sin.length) out.push(`Falta el peso capturado (t/m) de ${sin.map((z) => z.nombre).join(', ')}.`)
  }
  const cuenta = new Map()
  for (const f of franjas) for (const p of f.apoyos) cuenta.set(p.nudo, (cuenta.get(p.nudo) || 0) + 1)
  if ([...cuenta.values()].some((n) => n > 1) && !['unidos', 'separados'].includes(a.cruces)) out.push('Hay nudos que están en dos vigas (cruces): elige si van unidos (bajan lo mismo) o separados.')
  for (const l of ligas) {
    if (!l.auto && !l.z) out.push(`${l.nombre}: elige su sección (una trabe de liga del proyecto).`)
    if (!l.auto && !l.de) out.push(`${l.nombre}: elige el nudo de donde sale.`)
    if (!l.auto && (l.hasta.tipo === 'eje' ? !l.hasta.cim : !l.hasta.nudo)) out.push(`${l.nombre}: elige a dónde llega (un nudo o el eje de otra viga).`)
    if (!EXT.includes(l.extA) || !EXT.includes(l.extB)) out.push(`${l.nombre}: elige cómo llega cada extremo (empotrada o articulada).`)
  }
  return out
}

/**
 * El cálculo con la viga sobre resortes. Mismos argumentos que
 * asentamientos(); `criterios` son los de la obra (fcm y fcv para U1) y
 * `suelo` el de la obra (γs y Df, para el peso del diseño).
 */
export function asentViga({ A, cimientos, cargas, asent, escenario = 'zonas', conCasoMedio = true, criterios = {}, suelo = {} }) {
  const a = { ...nuevoAsent(), ...(asent || {}) }
  const C = { ...CRITERIOS, ...(criterios || {}) }
  const corridas = cimientos.filter((z) => z.tipo === 'corrida')
  const vigasCim = cimientos.filter((z) => z.tipo === 'corrida' || z.tipo === 'contratrabe')
  const { franjas, sinPos } = A ? franjasDe(A, cimientos, cargas, { conContratrabes: true }) : { franjas: [], sinPos: vigasCim }
  const ligasM = ligasDelModelo(cimientos, a)
  const faltan = [
    ...faltantes(a, { conCasoMedio, corridas }).filter((t) => !/hundimiento diferencial/.test(t)),
    ...faltantesViga(a, { franjas, ligas: ligasM, cimientos: vigasCim }),
  ]
  if (!A) faltan.unshift('Falta el modelo de RAM sincronizado (las posiciones de los apoyos).')
  else if (!franjas.length) faltan.unshift('Ninguna corrida ni contratrabe tiene ejes con apoyos de RAM: créalas o lígalas desde «Desde RAM».')
  const vacio = { ok: false, metodo: 'viga', faltan, franjas, sinPos, ligasSin: [], paneles: [], tramos: [], efectos: [], vigas: [], ligas: [], checks: [], secciones: [] }
  if (faltan.length) return vacio

  const fI = Number(a.fInercia)
  const avisos = []
  // ── los extremos de cada liga ──
  const dondeNudo = (n) => { for (const f of franjas) { const p = f.apoyos.find((q) => q.nudo === n); if (p) return { f, s: p.s, x: p.x, y: p.y, nudo: n } } return null }
  const ligas = [], ligasSin = []
  for (const l of ligasM) {
    const A0 = dondeNudo(l.de)
    let B0 = null, porque = 'su otro extremo no está sobre una viga'
    if (l.hasta.tipo === 'eje') {
      const f = franjas.find((x) => x.z.uid === l.hasta.cim && x.k === Number(l.hasta.eje || 0))
      if (!f) porque = `el eje ${Number(l.hasta.eje || 0) + 1} de ${cimientos.find((z) => z.uid === l.hasta.cim)?.nombre || 'esa viga'} no tiene apoyos de RAM`
      if (f && A0) {
        const s = (A0.x - f.ini[0]) * f.u[0] + (A0.y - f.ini[1]) * f.u[1]
        const sc = Math.min(f.L, Math.max(0, s))
        if (Math.abs(sc - s) > 0.01) avisos.push(`${l.nombre}: el nudo ${l.de} no cae frente al eje de ${f.z.nombre}; la liga llega a su orilla.`)
        B0 = { f, s: sc, x: f.ini[0] + sc * f.u[0], y: f.ini[1] + sc * f.u[1], nudo: null }
      }
    } else B0 = dondeNudo(String(l.hasta.nudo))
    if (!A0 || !B0) { ligasSin.push(`${l.nombre} (${!A0 ? `el nudo ${l.de} no está sobre una viga` : porque})`); continue }
    const L = Math.hypot(B0.x - A0.x, B0.y - A0.y)
    if (L < 0.05) { ligasSin.push(`${l.nombre} (sus extremos caen en el mismo punto)`); continue }
    const sec = seccionLiga(l.z)
    const EI = EIde(sec, fI)
    const RL = rigidezLiga(EI, L, l.extA, l.extB)
    if (!(RL.k > 0)) avisos.push(`${l.nombre}: articulada en los dos extremos no transmite nada; no entra.`)
    ligas.push({ ...l, A: A0, B: B0, L, sec, EI, RL })
  }

  // ── la malla de cada viga, sus resortes y sus cargas ──
  const S0 = { ...SUELO, ...(suelo || {}) }
  const usaApoyos = a.carga !== 'w', usaW = a.carga !== 'apoyos'
  const cargado = new Set()
  const unidos = a.cruces === 'unidos'
  const vigas = franjas.map((f) => {
    const z = f.z
    const pts = [...f.apoyos.map((p) => p.s), ...ligas.flatMap((l) => [l.A, l.B].filter((e) => e.f === f).map((e) => e.s))]
    const ss = mallaViga(f.L, pts)
    const n = ss.length - 1
    const sec = seccionViga(z)
    if (!sec) avisos.push(`${z.nombre}: su muro es de concreto (sin CT); la viga no tiene sección que la haga rígida y se toma flexible (cada nudo por su cuenta).`)
    const EI = sec ? EIde(sec, fI) : 0
    // la línea (corrida) y el peso
    const wl = z.tipo === 'corrida' && usaW ? wLinea(z, a) : { CM: 0, CV: 0, cvMax: false }
    const wlU = z.tipo === 'corrida' && usaW ? { CM: num(z.cargas?.CM?.w), CV: num(z.cargas?.CV?.w) } : { CM: 0, CV: 0 }
    let wP = 0, txtP = ''
    if (a.pesoViga === 'capturado') { wP = Number(a.wPeso?.[z.uid]); txtP = 'capturado' }
    else if (a.pesoViga === 'diseno') {
      const S = { ...S0, ...(z.suelo || {}) }, gs = num(S.gs, 1.6), Df = num(S.Df, 1), B = f.B
      if (z.tipo === 'contratrabe') {
        const g = z.geo || {}, h = num(g.h, 20), bw = num(g.bw, 25), H = Math.max(num(g.H, 60), h)
        const hEq = (B * 100 * h + bw * (H - h)) / (B * 100)
        wP = B * (GC * hEq / 100 + gs * Math.max(0, Df - hEq / 100)); txtP = `B [γc hₑ + γs (Df − hₑ)] = ${f2(B)} × (${GC} × ${f2(hEq / 100)} + ${f2(gs)} × ${f2(Math.max(0, Df - hEq / 100))})`
      } else {
        const hm = num(z.geo?.h, 20) / 100
        wP = B * (GC * hm + gs * Math.max(0, Df - hm)); txtP = `B [γc h + γs (Df − h)] = ${f2(B)} × (${GC} × ${f2(hm)} + ${f2(gs)} × ${f2(Math.max(0, Df - hm))})`
      }
    }
    const nodos = ss.map((s, i) => {
      const trib = ((i < n ? ss[i + 1] - s : 0) + (i > 0 ? s - ss[i - 1] : 0)) / 2
      const x = f.ini[0] + s * f.u[0], y = f.ini[1] + s * f.u[1]
      const est = estratoEn(a, x, y, f, escenario)
      const ks = Number(est.ks)
      return { s, x, y, trib, est, ks, k: ks * f.B * trib, P: [(wl.CM + wl.CV + wP) * trib, (C.fcm * (wlU.CM + wP) + C.fcv * wlU.CV) * trib] }
    })
    const nodoEn = (s) => { let j = 0; for (let i = 1; i < ss.length; i++) if (Math.abs(ss[i] - s) < Math.abs(ss[j] - s)) j = i; return j }
    for (const p of f.apoyos) {
      p.iNodo = nodoEn(p.s)
      if (!(usaApoyos || z.tipo === 'contratrabe')) continue
      if (unidos && cargado.has(p.nudo)) continue
      cargado.add(p.nudo)
      const nd = nodos[p.iNodo]
      nd.P[0] += p.CM + cvMedia(p, a)
      nd.P[1] += C.fcm * p.CM + C.fcv * p.CV
      p.cargaS = p.CM + cvMedia(p, a); p.cargaU = C.fcm * p.CM + C.fcv * p.CV
    }
    return { f, sec, EI, flexible: !sec, nodos, nodoEn, wl, wlU, wP, txtP }
  })
  const iv = new Map(vigas.map((v, i) => [v.f, i]))
  const enlaces = [], usoE = []
  for (const l of ligas) {
    if (!(l.RL.k > 0)) continue
    const va = vigas[iv.get(l.A.f)], vb = vigas[iv.get(l.B.f)]
    l.iE = enlaces.length
    enlaces.push({ a: { v: iv.get(l.A.f), i: va.nodoEn(l.A.s) }, b: { v: iv.get(l.B.f), i: vb.nodoEn(l.B.s) }, k: l.RL.k })
    usoE.push(l)
  }
  if (unidos) {
    const prim = new Map()
    for (const v of vigas) for (const p of v.f.apoyos) {
      const q = prim.get(p.nudo)
      if (!q) prim.set(p.nudo, { v: iv.get(v.f), i: p.iNodo })
      else enlaces.push({ a: q, b: { v: iv.get(v.f), i: p.iNodo }, k: Infinity })
    }
  }
  let sol
  try { sol = resolverVigas(vigas.map((v) => ({ EI: v.EI, nodos: v.nodos })), enlaces, 2) }
  catch (e) { return { ...vacio, faltan: [e.message] } }

  // ── resultados de cada viga ──
  vigas.forEach((v, i) => {
    const r = sol.vigas[i]
    v.w = r.w[0]; v.wU = r.w[1]; v.M = r.M[1]; v.V = r.V[1]
    v.nodos.forEach((nd, j) => { nd.w = v.w[j]; nd.q = nd.ks * v.w[j] })
    for (const p of v.f.apoyos) p.d = v.w[p.iNodo]
    if (!v.flexible) {
      v.R = resistencias(v.sec)
      const jP = v.M.reduce((b, m, j) => (m > v.M[b] ? j : b), 0), jN = v.M.reduce((b, m, j) => (m < v.M[b] ? j : b), 0)
      const eV = v.V.reduce((b, x, j) => (Math.abs(x) > Math.abs(v.V[b]) ? j : b), 0)
      v.Mpos = Math.max(0, v.M[jP]); v.sMpos = v.nodos[jP].s
      v.Mneg = Math.max(0, -v.M[jN]); v.sMneg = v.nodos[jN].s
      v.Vmax = Math.abs(v.V[eV] || 0); v.sVmax = v.nodos[eV] ? (v.nodos[eV].s + v.nodos[Math.min(eV + 1, v.nodos.length - 1)].s) / 2 : 0
      v.uMpos = v.R.MRinf > 0 ? v.Mpos / v.R.MRinf : Infinity
      v.uMneg = v.R.MRsup > 0 ? v.Mneg / v.R.MRsup : Infinity
      v.uM = Math.max(v.uMpos, v.uMneg)
      v.uV = v.R.VR > 0 ? v.Vmax / v.R.VR : Infinity
      v.okM = v.uM <= 1 + 1e-9; v.okV = v.uV <= 1 + 1e-9
    }
  })
  for (const l of ligas) {
    if (!(l.RL.k > 0)) { l.S = l.U = { d: 0, F: 0, Ma: 0, Mb: 0 }; l.inactiva = true; continue }
    const e = sol.enlaces[l.iE]
    const de = (c) => ({ d: e.d[c], F: e.F[c], ...l.RL.M(e.d[c]) })
    l.S = de(0); l.U = de(1)
    l.R = resistencias(l.sec)
    const extremo = (M) => { const MR = M >= 0 ? l.R.MRinf : l.R.MRsup; return { M: Math.abs(M), MR, u: MR > 0 ? Math.abs(M) / MR : (Math.abs(M) > 0 ? Infinity : 0) } }
    const g = [extremo(l.U.Ma), extremo(l.U.Mb)].reduce((x, y) => (y.u > x.u ? y : x))
    l.uM = g.u; l.Mgov = g.M; l.MRgov = g.MR; l.Mmax = Math.max(Math.abs(l.U.Ma), Math.abs(l.U.Mb))
    l.Vmax = Math.abs(l.U.F)
    l.uV = l.R.VR > 0 ? l.Vmax / l.R.VR : Infinity
    l.okM = l.uM <= 1 + 1e-9; l.okV = l.uV <= 1 + 1e-9
  }

  // ── la malla de colores (MALLA m), el medio y la distorsión ──
  const paneles = []
  for (const v of vigas) {
    const f = v.f, nP = Math.max(1, Math.ceil(f.L / MALLA - 1e-9)), ds = f.L / nP
    f.ds = ds
    const en = (s) => {
      const ns = v.nodos
      let j = 1
      while (j < ns.length - 1 && ns[j].s < s) j++
      const p = ns[j - 1], q = ns[j], t = q.s > p.s ? (s - p.s) / (q.s - p.s) : 0
      return { d: p.w + (q.w - p.w) * t, q: p.q + (q.q - p.q) * t, est: t < 0.5 ? p.est : q.est }
    }
    for (let i = 0; i < nP; i++) {
      const s0 = i * ds, s1 = s0 + ds, sc = s0 + ds / 2, r = en(sc)
      paneles.push({ f, i, s0, s1, sc, ds, x: f.ini[0] + sc * f.u[0], y: f.ini[1] + sc * f.u[1], w: r.q * f.B, q: r.q, d: r.d, est: r.est })
    }
  }
  const todos = vigas.flatMap((v) => v.nodos)
  const medio = todos.reduce((s, nd) => s + nd.w * nd.trib, 0) / todos.reduce((s, nd) => s + nd.trib, 0)
  const dMax = Math.max(...todos.map((nd) => nd.w)), dMin = Math.min(...todos.map((nd) => nd.w))
  const limD = Number(a.limDist)
  const tramos = []
  for (const f of franjas) for (let i = 0; i < f.apoyos.length - 1; i++) {
    const p = f.apoyos[i], q = f.apoyos[i + 1], L = q.s - p.s, D = Math.abs(q.d - p.d)
    tramos.push({ f, p, q, L, D, dist: D / L, ok: D / L <= limD + 1e-12 })
  }

  // ── revisiones ──
  const rig = vigas.filter((v) => !v.flexible)
  const act = ligas.filter((l) => !l.inactiva)
  const peor = (arr, k) => arr.reduce((x, y) => (!x || y[k] > x[k] ? y : x), null)
  const peorT = peor(tramos, 'dist'), pvM = peor(rig, 'uM'), pvV = peor(rig, 'uV'), plM = peor(act, 'uM'), plV = peor(act, 'uV')
  const nomV = (v) => `${v.f.z.nombre}, eje ${v.f.k + 1}`
  const checks = [
    check('asentMedio', 'Asentamiento medio', mm(medio), Number(a.limMedio), 'mm', { grupo: 'Asentamientos (servicio)', nota: a.limMedioNota || 'tabla 3.1.1.2.2.3' }),
    ...(peorT ? [check('distorsion', 'Distorsión entre apoyos', peorT.dist, limD, '', { grupo: 'Asentamientos (servicio)', ok: tramos.every((t) => t.ok), nota: `rige ${peorT.p.nudo}–${peorT.q.nudo} de ${peorT.f.z.nombre}` })] : []),
    ...(pvM ? [check('vigaM', 'Flexión de la viga', pvM.uMpos >= pvM.uMneg ? pvM.Mpos : pvM.Mneg, pvM.uMpos >= pvM.uMneg ? pvM.R.MRinf : pvM.R.MRsup, 't·m', { grupo: 'Vigas sobre resortes (U1)', ok: rig.every((v) => v.okM), nota: `${nomV(pvM)} · ${pvM.uMpos >= pvM.uMneg ? 'tensión abajo' : 'tensión arriba'}` })] : []),
    ...(pvV ? [check('vigaV', 'Cortante de la viga', pvV.Vmax, pvV.R.VR, 't', { grupo: 'Vigas sobre resortes (U1)', ok: rig.every((v) => v.okV), nota: nomV(pvV) })] : []),
    ...(plM ? [check('ligaM', 'Flexión de la liga', plM.Mgov, plM.MRgov, 't·m', { grupo: 'Trabes de liga (U1)', ok: act.every((l) => l.okM), nota: plM.nombre })] : []),
    ...(plV ? [check('ligaV', 'Cortante de la liga', plV.Vmax, plV.R.VR, 't', { grupo: 'Trabes de liga (U1)', ok: act.every((l) => l.okV), nota: `${plV.nombre}: toma ${f2(Math.abs(plV.S.F))} t en servicio` })] : []),
  ]
  const secciones = memoriaViga({ a, C, escenario, franjas, vigas, ligas, medio, dMax, dMin, tramos, limD, sinPos, ligasSin, avisos, fI })
  return { ok: checks.every((c) => c.ok), metodo: 'viga', limD, faltan: [], franjas, sinPos, ligasSin, avisos, paneles, tramos, efectos: [], vigas, ligas, medio, dMax, dMin, checks, secciones, escenario }
}

/** Los tramos de una viga con el mismo ks, para la memoria */
function tramosKs(v) {
  const out = []
  for (const nd of v.nodos) {
    const u = out[out.length - 1]
    if (u && u.est === nd.est) u.s1 = nd.s
    else out.push({ est: nd.est, ks: nd.ks, s0: nd.s, s1: nd.s })
  }
  return out
}

function memoriaViga({ a, C, escenario, franjas, vigas, ligas, medio, dMax, dMin, tramos, limD, sinPos, ligasSin, avisos, fI }) {
  const s = []
  const nEl = vigas.reduce((t, v) => t + v.nodos.length - 1, 0)
  s.push({
    titulo: 'Datos y criterio',
    pasos: [
      paso('Cómo trabaja la cimentación', 'viga sobre resortes de Winkler', 'cada corrida (con su CT), contratrabe o eje ligado reparte la carga con su rigidez', '', ''),
      paso('Estrato de toda la obra', a.estratos.find((e) => e.id === a.base)?.nombre || a.base, `ks = ${f2(Number(a.estratos.find((e) => e.id === a.base)?.ks))} t/m³`, '', ''),
      ...(escenario === 'zonas' ? (a.zonas || []).map((z) => {
        const e = a.estratos.find((x) => x.id === z.estrato) || {}
        return paso(z.nombre || (z.tipo === 'rect' ? 'Zona' : 'Tramo'), z.tipo === 'rect' ? `x ${f2(Number(z.x0))} a ${f2(Number(z.x1))} · y ${f2(Number(z.y0))} a ${f2(Number(z.y1))} m` : `eje ${Number(z.eje) + 1} de ${franjas.find((f) => f.z.uid === z.cim)?.z.nombre || 'la viga'}`, `sobre ${e.nombre || e.id}: ks = ${f2(Number(e.ks))} t/m³`, '', '')
      }) : [paso('Escenario', 'todo sobre el estrato de la obra', 'las zonas no se usan', '', '')]),
      paso('Resorte de cada nudo', 'k = ks · B · (largo tributario)', `elementos de ${f3(DS_VIGA)} m o menos, ${nEl} en ${vigas.length} vigas`, '', ''),
      paso('Rigidez de la viga', `EI = Ec · ${f2(fI)} Ig`, 'sólo la CT de la corrida o la contratrabe (sección rectangular); Ec la de Deflexiones (14000 √f′c, clase 1); Ie/Ig del ingeniero', '', ''),
      paso('Servicio (asentamientos y distorsión)', 'CM + CV media', `NTC-Cimentaciones 2023, 3.2.1.1.1${a.cvMaxSiFalta ? ' · donde falta la media, la máxima (lo marcó el ingeniero)' : ''}`, '', ''),
      paso('Resistencia (M y V de vigas y ligas)', `U1 = ${f2(C.fcm)} CM + ${f2(C.fcv)} CV máxima`, 'los factores de «Suelo y criterios»', '', ''),
      paso('Carga de las corridas', a.carga === 'w' ? 'la w del diseño, pareja en todo el eje' : a.carga === 'apoyos' ? 'las reacciones de los apoyos, cada una en su nudo' : 'la w del diseño más las reacciones en su nudo', 'las contratrabes llevan siempre las reacciones de sus columnas', '', ''),
      paso('Peso de la zapata y el relleno', a.pesoViga === 'no' ? 'no se suma' : a.pesoViga === 'diseno' ? 'el W del diseño de cada cimiento' : 'capturado por el ingeniero', a.pesoViga === 'no' ? '' : `con ${f2(C.fcm)} en U1`, '', ''),
      ...(franjas.some((f) => franjas.some((g) => g !== f && g.apoyos.some((p) => f.apoyos.some((q) => q.nudo === p.nudo))))
        ? [paso('Cruces (un nudo en dos vigas)', a.cruces === 'unidos' ? 'unidos: las dos vigas bajan lo mismo ahí' : 'separados: cada viga por su cuenta', a.cruces === 'unidos' ? 'la reacción del nudo entra una vez' : 'la reacción del nudo entra en cada viga', '', '')] : []),
      paso('Trabes de liga', 'resorte vertical entre sus dos extremos', 'empotrada-empotrada k = 12 EI/L³; empotrada-articulada k = 3 EI/L³; sin apoyo en el suelo ni peso propio', '', ''),
      paso('Simplificaciones', 'la zapata y el muro no suman rigidez; sin torsión', 'el V máximo se toma en cualquier punto de la viga (también bajo los apoyos)', '', ''),
      ...avisos.map((t) => paso('Aviso', t, '', '', '')),
      ...(sinPos.length ? [paso('Sin posición en planta', sinPos.map((z) => z.nombre).join(', '), 'no tienen ejes con apoyos de RAM: no entran', '', '')] : []),
      ...(ligasSin.length ? [paso('Ligas que no entran', ligasSin.join(', '), '', '', '')] : []),
    ],
  })
  for (const v of vigas) {
    const f = v.f
    const cargasA = f.apoyos.filter((p) => p.cargaS != null)
    s.push({
      titulo: `${f.z.nombre}, eje ${f.k + 1} (nudos ${f.apoyos.map((p) => p.nudo).join(', ')})`,
      pasos: [
        paso('Viga', 'L · B', `${f2(f.L)} × ${f2(f.B)} m`, v.nodos.length - 1, 'elementos'),
        v.flexible
          ? paso('Sección', 'sin CT (muro de concreto)', 'se toma flexible: cada nudo por su cuenta', '', '')
          : paso('Sección', v.sec.nombre, `EI = ${Math.round(EcNTC(v.sec.fc))} kg/cm² × ${f2(fI)} × ${Math.round(v.sec.b * v.sec.h ** 3 / 12)} cm⁴`, v.EI, 't·m²'),
        ...tramosKs(v).map((t) => paso('Resortes', `de ${f2(t.s0)} a ${f2(t.s1)} m`, `${t.est.nombre || t.est.id}: ks · B = ${f2(t.ks)} × ${f2(f.B)}`, t.ks * f.B, 't/m²')),
        ...(f.z.tipo === 'corrida' && a.carga !== 'apoyos' ? [paso('w de la línea', 'servicio · U1', `${f2(v.wl.CM)} + ${f2(v.wl.CV)}${v.wl.cvMax ? ' (CV máxima)' : ''} · ${f2(C.fcm)} × ${f2(v.wlU.CM)} + ${f2(C.fcv)} × ${f2(v.wlU.CV)}`, v.wl.CM + v.wl.CV, 't/m')] : []),
        ...(v.wP ? [paso('Peso', v.txtP || 'capturado', '', v.wP, 't/m')] : []),
        ...cargasA.map((p) => paso(`Nudo ${p.nudo} a ${f2(p.s)} m`, 'P servicio · P U1', `${f2(p.CM)} + ${f2(cvMedia(p, a))}${p.CVmed == null ? ' (CV máx.)' : ''} · ${f2(C.fcm)} × ${f2(p.CM)} + ${f2(C.fcv)} × ${f2(p.CV)}`, p.cargaS, 't', { nota: `U1: ${f2(p.cargaU)} t` })),
        ...f.apoyos.map((p) => paso(`δ en el nudo ${p.nudo}`, 'servicio', '', mm(p.d), 'mm')),
        paso('Asentamientos de la viga', 'mínimo · máximo', `${f2(mm(Math.min(...v.w)))} · ${f2(mm(Math.max(...v.w)))}`, '', 'mm'),
        ...(v.flexible ? [] : [
          paso('Momento, tensión abajo', `M⁺ máx. (U1) a ${f2(v.sMpos)} m`, '', v.Mpos, 't·m', { ok: v.uMpos <= 1 + 1e-9, lim: `≤ MR abajo = ${f2(v.R.MRinf)}` }),
          paso('Momento, tensión arriba', `M⁻ máx. (U1) a ${f2(v.sMneg)} m`, '', v.Mneg, 't·m', { ok: v.uMneg <= 1 + 1e-9, lim: `≤ MR arriba = ${f2(v.R.MRsup)}` }),
          paso('Cortante', `V máx. (U1) a ${f2(v.sVmax)} m`, '', v.Vmax, 't', { ok: v.okV, lim: `≤ VR = ${f2(v.R.VR)}` }),
        ]),
      ],
    })
  }
  const Pm = vigas.flatMap((v) => v.nodos.map((nd) => ({ v, nd }))).reduce((x, y) => (y.nd.w > x.nd.w ? y : x))
  s.push({
    titulo: 'Asentamiento medio (NTC-Cimentaciones 2023, tabla 3.1.1.2.2.3)',
    pasos: [
      paso('Asentamiento de un punto', 'K w = f (viga sobre resortes)', 'el suelo bajo cada nudo empuja ks · w', '', ''),
      paso('El punto que más asienta', `${Pm.v.f.z.nombre}, eje ${Pm.v.f.k + 1}, a ${f2(Pm.nd.s)} m`, `q = ks · w = ${f2(Pm.nd.ks)} × ${f3(Pm.nd.w)}`, mm(Pm.nd.w), 'mm', { nota: `presión ${f2(Pm.nd.q)} t/m²` }),
      paso('Asentamientos', 'mínimo · máximo', `${f2(mm(dMin))} · ${f2(mm(dMax))}`, '', 'mm'),
      paso('Asentamiento medio', 'Σ w · (largo tributario) / Σ largo', '', mm(medio), 'mm', { ok: medio <= Number(a.limMedio) / 1000 + 1e-12, lim: `≤ ${f2(Number(a.limMedio))} mm${a.limMedioNota ? ` (${a.limMedioNota})` : ''}` }),
    ],
  })
  s.push({
    titulo: `Distorsión entre apoyos (NTC-Criterios y Acciones 2023, tabla 6.2.2.1: límite ${limD})`,
    pasos: tramos.map((t) => paso(`${t.f.z.nombre}, ${t.p.nudo}–${t.q.nudo}`, '|δb − δa| / L', `= |${f2(mm(t.q.d))} − ${f2(mm(t.p.d))}| mm / ${f2(t.L)} m`, t.dist, '', { ok: t.ok, lim: `≤ ${limD}` })),
  })
  if (ligas.length) {
    s.push({
      titulo: 'Trabes de liga (fuerza que toma cada una)',
      pasos: ligas.flatMap((l) => {
        const ends = `${l.A.nudo ? `nudo ${l.A.nudo}` : 'eje'} (${txtExt(l.extA)}) → ${l.B.nudo ? `nudo ${l.B.nudo}` : `eje de ${l.B.f.z.nombre} a ${f2(l.B.s)} m`} (${txtExt(l.extB)})`
        if (l.inactiva) return [paso(l.nombre, ends, 'articulada en los dos extremos: no transmite nada', '', '')]
        const kTxt = l.extA === 'empotrada' && l.extB === 'empotrada' ? '12 EI / L³' : '3 EI / L³'
        return [
          paso(l.nombre, ends, `${l.sec.nombre} · L = ${f2(l.L)} m · EI = ${f1(l.EI)} t·m²`, '', ''),
          paso('Rigidez vertical', `k = ${kTxt}`, `= ${kTxt.split(' ')[0]} × ${f1(l.EI)} / ${f2(l.L)}³`, l.RL.k, 't/m'),
          paso('Diferencial y fuerza (servicio)', 'F = k Δ', `= ${f1(l.RL.k)} × ${f3(mm(l.S.d))} mm`, Math.abs(l.S.F), 't'),
          paso('Fuerza (U1)', 'F = k Δ', `Δ = ${f3(mm(l.U.d))} mm`, Math.abs(l.U.F), 't', { ok: l.okV, lim: `≤ VR = ${f2(l.R.VR)}` }),
          paso('Momento en los extremos (U1)', l.extA === 'empotrada' && l.extB === 'empotrada' ? 'M = 6 EI Δ / L²' : 'M = 3 EI Δ / L² = F L', `extremo A ${f2(l.U.Ma)} · extremo B ${f2(l.U.Mb)} (+ tensión abajo)`, l.Mmax, 't·m', { ok: l.okM, lim: `MR abajo ${f2(l.R.MRinf)} · arriba ${f2(l.R.MRsup)}` }),
        ]
      }),
    })
  }
  s.push({
    titulo: 'Nota',
    pasos: [paso('Qué es', 'el M y el V de cada viga y liga con sus cargas U1 sobre los resortes', 'es otra hipótesis que la del diseño de la CT o la contratrabe (presión rígida): el ingeniero decide cómo se combinan', '', '')],
  })
  return s
}
