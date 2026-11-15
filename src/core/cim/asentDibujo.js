// ══════════════════════════════════════════════════════════════
// Dibujo de los asentamientos (3.12): planta con la malla, el mapa de color
// en mm, la deformada exagerada y la distorsión de cada tramo; o la misma
// malla en 3D (isométrica) hundida. Un solo SVG para la pantalla, la memoria
// PDF, la imagen y el DXF (en planta, a escala real: 1 px = 1 cm).
// ══════════════════════════════════════════════════════════════

import { gira, GIRO_RAM } from '../agrupacion'
import { colorDe } from './asentamientos'

const n2 = (v) => (Math.round(v * 100) / 100).toString()
const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const fmm = (m) => (m * 1000).toFixed(2)
const OK = '#1a7a5e', MAL = '#c62828', TINTA = '#1a1814', TENUE = '#8a837a'

/** La escala de la deformada: el asentamiento máximo se ve como el 12 % de la planta, por `exag` */
export function factorDeformada(res, exag = 1) {
  const pts = res.paneles.map((P) => [P.x, P.y])
  const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1])
  const tam = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys), 1)
  return res.dMax > 0 ? (exag * 0.12 * tam) / res.dMax : 0
}

/**
 * @param vista  'planta' | '3d'
 * @param exag   multiplica la deformada automática
 * @param dxf    planta a escala real (1 px = 1 cm del modelo), para svgToDxf
 * @returns { inner, W, H, k, E } — E: metros de dibujo por metro de asentamiento
 */
export function dibujoAsent(res, { vista = 'planta', exag = 1, W = 960, H = 640, dxf = false, zonas = [] } = {}) {
  if (!res?.paneles?.length) return null
  const E = factorDeformada(res, exag)
  const out = []
  const g = (x, y) => gira(x, y, GIRO_RAM)
  const iso = vista === '3d' && !dxf
  const c30 = Math.cos(Math.PI / 6), s30 = Math.sin(Math.PI / 6)
  // del modelo (m) a la proyección (m), antes de escalar
  const pr = (x, y, d = 0) => {
    const [a, b] = g(x, y)
    return iso ? [(a - b) * c30, (a + b) * s30 + d * E] : [a, b]
  }
  // las esquinas de cada panel; en 3D con el asentamiento de cada orilla
  const dOrilla = (P, lado) => {
    const ps = res.paneles.filter((Q) => Q.f === P.f)
    const j = ps.indexOf(P) + lado
    return j < 0 || j >= ps.length ? P.d : (P.d + ps[j].d) / 2
  }
  const esquinas = (P, def = true) => {
    const f = P.f, B = f.B / 2
    const at = (s, t) => [f.ini[0] + s * f.u[0] + t * f.n[0], f.ini[1] + s * f.u[1] + t * f.n[1]]
    const d0 = def ? dOrilla(P, -1) : 0, d1 = def ? dOrilla(P, 1) : 0
    return [[...at(P.s0, -B), d0], [...at(P.s1, -B), d1], [...at(P.s1, B), d1], [...at(P.s0, B), d0]]
  }
  const todos = res.paneles.flatMap((P) => [...esquinas(P, false), ...(iso ? esquinas(P) : [])]).map(([x, y, d]) => pr(x, y, d || 0))
  if (!iso) for (const P of res.paneles) { const q = deformado(P, E); todos.push(pr(q[0], q[1])) }
  const xs = todos.map((p) => p[0]), ys = todos.map((p) => p[1])
  const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys)
  const M = dxf ? 120 : 46
  let k
  if (dxf) { k = 100; W = (x1 - x0) * k + 2 * M; H = (y1 - y0) * k + 2 * M + 90 } else k = Math.min((W - 2 * M) / Math.max(x1 - x0, 0.5), (H - 2 * M - 40) / Math.max(y1 - y0, 0.5))
  const ox = M + ((W - 2 * M) - (x1 - x0) * k) / 2, oy = M + 26
  const P2 = (x, y, d = 0) => { const [a, b] = pr(x, y, d); return [ox + (a - x0) * k, oy + (b - y0) * k] }
  const pts = (arr) => arr.map(([x, y, d]) => P2(x, y, d || 0).map(n2).join(',')).join(' ')
  const fs = (n) => (dxf ? n * 1.6 : n)

  // zonas sobre otro estrato
  if (res.escenario === 'zonas') for (const z of zonas.filter((x) => x.tipo === 'rect')) {
    const c = [[+z.x0, +z.y0], [+z.x1, +z.y0], [+z.x1, +z.y1], [+z.x0, +z.y1]]
    out.push(`<polygon points="${pts(c)}" fill="rgba(146,64,14,0.06)" stroke="#b45309" stroke-width="1" stroke-dasharray="6 4"/>`)
    const [tx, ty] = P2(+z.x0, +z.y1)
    out.push(`<text x="${n2(tx + 4)}" y="${n2(ty - 4)}" font-size="${fs(10)}" fill="#b45309">${esc(z.nombre)}</text>`)
  }
  // la malla: sin deformar (en 3D, de referencia) y con su color
  const orden = iso ? [...res.paneles].sort((a, b) => { const [, ya] = pr(a.x, a.y); const [, yb] = pr(b.x, b.y); return ya - yb }) : res.paneles
  if (iso) for (const P of res.paneles) out.push(`<polygon points="${pts(esquinas(P, false))}" fill="none" stroke="#c9c3b8" stroke-width="0.6" stroke-dasharray="3 3"/>`)
  for (const P of orden) {
    out.push(`<polygon data-panel="${P.i}" points="${pts(esquinas(P, iso))}" fill="${colorDe(P.d, res.dMin, res.dMax)}" stroke="#ffffff" stroke-width="${dxf ? 1 : 0.35}"><title>${esc(`${P.f.z.nombre}, eje ${P.f.k + 1}, s = ${P.sc.toFixed(2)} m: δ = ${fmm(P.d)} mm · q = ${P.q.toFixed(2)} t/m²`)}</title></polygon>`)
  }
  // el contorno de cada franja y, en planta, la deformada sobre su eje
  for (const f of res.franjas) {
    const B = f.B / 2, at = (s, t) => [f.ini[0] + s * f.u[0] + t * f.n[0], f.ini[1] + s * f.u[1] + t * f.n[1]]
    if (!iso) {
      out.push(`<polygon points="${pts([at(0, -B), at(f.L, -B), at(f.L, B), at(0, B)])}" fill="none" stroke="${TINTA}" stroke-width="${dxf ? 2 : 0.9}"/>`)
      out.push(`<polyline points="${pts([at(0, 0), at(f.L, 0)])}" fill="none" stroke="${TENUE}" stroke-width="0.8" stroke-dasharray="5 3"/>`)
      const ps = res.paneles.filter((P) => P.f === f)
      out.push(`<polyline data-deformada="1" points="${pts(ps.map((P) => deformado(P, E)))}" fill="none" stroke="#3f3a34" stroke-width="${dxf ? 2.5 : 1.4}"/>`)
    }
  }
  // tramos entre apoyos: distorsión en verde o rojo
  for (const t of res.tramos) {
    const a = P2(t.p.x, t.p.y, iso ? t.p.d : 0), b = P2(t.q.x, t.q.y, iso ? t.q.d : 0)
    const c = t.ok ? OK : MAL
    out.push(`<line data-tramo="${esc(`${t.p.nudo}-${t.q.nudo}`)}" x1="${n2(a[0])}" y1="${n2(a[1])}" x2="${n2(b[0])}" y2="${n2(b[1])}" stroke="${c}" stroke-width="${dxf ? 6 : 3}" stroke-linecap="round" opacity="0.85"><title>${esc(`${t.f.z.nombre} ${t.p.nudo}–${t.q.nudo}: Δ = ${fmm(t.D)} mm en ${t.L.toFixed(2)} m → ${t.dist.toFixed(5)} ${t.ok ? '≤' : '>'} límite`)}</title></line>`)
    const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2
    out.push(`<text x="${n2(mx)}" y="${n2(my - 6)}" font-size="${fs(9.5)}" text-anchor="middle" fill="${c}" font-weight="700">${t.dist.toFixed(4)}</text>`)
  }
  // trabes de liga (3.13): de un extremo al otro, con la fuerza que toman en servicio
  for (const l of res.ligas || []) {
    const a = P2(l.A.x, l.A.y, iso ? dEnViga(res, l.A) : 0), b = P2(l.B.x, l.B.y, iso ? dEnViga(res, l.B) : 0)
    const c = l.inactiva ? TENUE : l.okM && l.okV ? OK : MAL
    out.push(`<line data-liga="${esc(l.nombre)}" x1="${n2(a[0])}" y1="${n2(a[1])}" x2="${n2(b[0])}" y2="${n2(b[1])}" stroke="${c}" stroke-width="${dxf ? 10 : 5}" stroke-dasharray="${dxf ? '24 10' : '9 4'}" opacity="0.9"><title>${esc(`${l.nombre}: ${l.inactiva ? 'no transmite nada' : `F = ${Math.abs(l.S.F).toFixed(2)} t en servicio, ${Math.abs(l.U.F).toFixed(2)} t en U1 · M ${l.Mmax.toFixed(2)} t·m`}`)}</title></line>`)
    if (!l.inactiva) out.push(`<text x="${n2((a[0] + b[0]) / 2)}" y="${n2((a[1] + b[1]) / 2 + (dxf ? 30 : 14))}" font-size="${fs(9.5)}" text-anchor="middle" fill="${c}" font-weight="700">${esc(`${l.nombre} · ${Math.abs(l.S.F).toFixed(2)} t`)}</text>`)
  }
  // apoyos con su asentamiento
  for (const f of res.franjas) for (const p of f.apoyos) {
    const [x, y] = P2(p.x, p.y, iso ? p.d : 0)
    out.push(`<circle cx="${n2(x)}" cy="${n2(y)}" r="${dxf ? 8 : 3.6}" fill="#fff" stroke="${TINTA}" stroke-width="1.2"/>`)
    out.push(`<text x="${n2(x + 6)}" y="${n2(y + 13)}" font-size="${fs(9.5)}" fill="${TINTA}">${esc(`${p.nudo} · ${fmm(p.d)} mm`)}</text>`)
  }
  // título y escala de color
  out.push(`<text x="${M}" y="${n2(dxf ? 60 : 20)}" font-size="${fs(13)}" font-weight="700" fill="${TINTA}" font-family="Instrument Sans, sans-serif">${esc(`Asentamientos ${iso ? 'en 3D (isométrica)' : 'en planta'}${res.metodo === 'viga' ? ' · viga sobre resortes' : ''} · deformada × ${Math.round(E)}`)}</text>`)
  const lx = W - M - (dxf ? 600 : 220), ly = dxf ? 40 : 12, lw = dxf ? 520 : 170
  for (let i = 0; i < 20; i++) out.push(`<rect x="${n2(lx + (i * lw) / 20)}" y="${ly}" width="${n2(lw / 20 + 0.5)}" height="${dxf ? 22 : 9}" fill="${colorDe(res.dMin + ((res.dMax - res.dMin) * (i + 0.5)) / 20, res.dMin, res.dMax)}"/>`)
  out.push(`<text x="${n2(lx)}" y="${n2(ly + (dxf ? 50 : 21))}" font-size="${fs(9)}" fill="${TENUE}">${fmm(res.dMin)} mm</text>`)
  out.push(`<text x="${n2(lx + lw)}" y="${n2(ly + (dxf ? 50 : 21))}" font-size="${fs(9)}" fill="${TENUE}" text-anchor="end">${fmm(res.dMax)} mm</text>`)
  return { inner: out.join(''), W, H, k: dxf ? 1 : null, E }
}

/** El asentamiento de un punto de una viga (extremo de liga) */
function dEnViga(res, e) {
  const v = (res.vigas || []).find((x) => x.f === e.f)
  if (!v) return 0
  let j = 0
  for (let i = 1; i < v.nodos.length; i++) if (Math.abs(v.nodos[i].s - e.s) < Math.abs(v.nodos[j].s - e.s)) j = i
  return v.nodos[j].w
}

// ── diagramas de la viga sobre resortes (3.13) ─────────────────
/**
 * Una gráfica de una variable a lo largo de s.
 * @param ys       valores en cada s (o, con `escalon`, uno por elemento entre s[i] y s[i+1])
 * @param lims     líneas de límite [{ y, t }]
 * @param abajo    el valor positivo se dibuja hacia abajo (la deformada)
 */
function grafica({ x0, y0, w, h, s, ys, titulo, unidad, lims = [], escalon = false, abajo = false, marcas = [], color = '#2b5f9e', dec = 2 }) {
  const out = []
  const L = s[s.length - 1] - s[0] || 1
  const vals = [...ys, ...lims.map((l) => l.y), 0]
  let lo = Math.min(...vals), hi = Math.max(...vals)
  if (hi - lo < 1e-12) { hi += 1; lo -= 1 }
  const pad = (hi - lo) * 0.08
  lo -= pad; hi += pad
  const X = (v) => x0 + ((v - s[0]) / L) * w
  const Y = (v) => (abajo ? y0 + ((v - lo) / (hi - lo)) * h : y0 + h - ((v - lo) / (hi - lo)) * h)
  out.push(`<rect x="${n2(x0)}" y="${n2(y0)}" width="${n2(w)}" height="${n2(h)}" fill="#fbfaf7" stroke="#e2ddd3"/>`)
  out.push(`<line x1="${n2(x0)}" y1="${n2(Y(0))}" x2="${n2(x0 + w)}" y2="${n2(Y(0))}" stroke="${TENUE}" stroke-width="0.8"/>`)
  for (const l of lims) {
    out.push(`<line x1="${n2(x0)}" y1="${n2(Y(l.y))}" x2="${n2(x0 + w)}" y2="${n2(Y(l.y))}" stroke="${MAL}" stroke-width="0.8" stroke-dasharray="5 3"/>`)
    out.push(`<text x="${n2(x0 + w - 4)}" y="${n2(Y(l.y) - 3)}" font-size="8.5" fill="${MAL}" text-anchor="end">${esc(l.t)}</text>`)
  }
  let pts
  if (escalon) {
    pts = []
    ys.forEach((v, i) => { pts.push([X(s[i]), Y(v)], [X(s[i + 1]), Y(v)]) })
  } else pts = ys.map((v, i) => [X(s[i]), Y(v)])
  const poly = pts.map((p) => p.map(n2).join(',')).join(' ')
  out.push(`<polygon points="${n2(pts[0][0])},${n2(Y(0))} ${poly} ${n2(pts[pts.length - 1][0])},${n2(Y(0))}" fill="${color}" opacity="0.13"/>`)
  out.push(`<polyline points="${poly}" fill="none" stroke="${color}" stroke-width="1.5"/>`)
  for (const m of marcas) {
    out.push(`<line x1="${n2(X(m.s))}" y1="${n2(y0)}" x2="${n2(X(m.s))}" y2="${n2(y0 + h)}" stroke="#c9c3b8" stroke-width="0.6" stroke-dasharray="2 3"/>`)
    if (m.t) out.push(`<text x="${n2(X(m.s) + 3)}" y="${n2(y0 + h - 4)}" font-size="8.5" fill="${TENUE}">${esc(m.t)}</text>`)
  }
  // el máximo y el mínimo
  const iMax = ys.reduce((b, v, i) => (v > ys[b] ? i : b), 0), iMin = ys.reduce((b, v, i) => (v < ys[b] ? i : b), 0)
  for (const i of new Set([iMax, iMin])) {
    const sx = escalon ? (s[i] + s[i + 1]) / 2 : s[i]
    out.push(`<text x="${n2(Math.min(x0 + w - 30, Math.max(x0 + 30, X(sx))))}" y="${n2(Y(ys[i]) + ((ys[i] >= 0) !== abajo ? -4 : 11))}" font-size="9" text-anchor="middle" fill="${TINTA}" font-weight="700">${ys[i].toFixed(dec)}</text>`)
  }
  out.push(`<text x="${n2(x0)}" y="${n2(y0 - 5)}" font-size="10.5" font-weight="700" fill="${TINTA}">${esc(titulo)} <tspan font-weight="400" fill="${TENUE}">(${esc(unidad)})</tspan></text>`)
  return out.join('')
}

/** Deformada (servicio), M y V (U1) de una viga sobre resortes, con sus límites */
export function diagramaViga(v, { W = 900, limD = null } = {}) {
  const s = v.nodos.map((n) => n.s), M = 50, gw = W - 2 * M, gh = 120, sep = 34
  const marcas = v.f.apoyos.map((p) => ({ s: p.s, t: p.nudo }))
  const out = []
  out.push(`<text x="${M}" y="20" font-size="13" font-weight="700" fill="${TINTA}" font-family="Instrument Sans, sans-serif">${esc(`${v.f.z.nombre}, eje ${v.f.k + 1} · ${v.flexible ? 'sin sección rígida (flexible)' : v.sec.nombre} · L = ${v.f.L.toFixed(2)} m`)}</text>`)
  let y = 46
  out.push(`<g data-diag="deformada">${grafica({ x0: M, y0: y, w: gw, h: gh, s, ys: v.w.map((w) => w * 1000), titulo: 'Deformada en servicio, CM + CV media', unidad: 'mm, hacia abajo', abajo: true, marcas, color: '#3f3a34' })}</g>`)
  // la distorsión de cada tramo, arriba de la deformada
  const L = s[s.length - 1] || 1
  for (let i = 0; i < v.f.apoyos.length - 1; i++) {
    const p = v.f.apoyos[i], q = v.f.apoyos[i + 1], d = Math.abs(q.d - p.d) / (q.s - p.s)
    const ok = limD == null || d <= limD + 1e-12
    out.push(`<text x="${n2(M + ((p.s + q.s) / 2 / L) * gw)}" y="${n2(y + 12)}" font-size="9" text-anchor="middle" fill="${ok ? OK : MAL}" font-weight="700">${d.toFixed(4)}</text>`)
  }
  y += gh + sep
  if (!v.flexible) {
    out.push(`<g data-diag="M">${grafica({ x0: M, y0: y, w: gw, h: gh, s, ys: v.M, titulo: 'Momento U1 (+ tensión abajo)', unidad: 't·m', lims: [{ y: v.R.MRinf, t: `MR abajo ${v.R.MRinf.toFixed(2)}` }, { y: -v.R.MRsup, t: `MR arriba −${v.R.MRsup.toFixed(2)}` }], marcas, color: '#9a3412' })}</g>`)
    y += gh + sep
    out.push(`<g data-diag="V">${grafica({ x0: M, y0: y, w: gw, h: gh, s, ys: v.V, escalon: true, titulo: 'Cortante U1', unidad: 't', lims: [{ y: v.R.VR, t: `VR ${v.R.VR.toFixed(2)}` }, { y: -v.R.VR, t: '−VR' }], marcas, color: '#1a7a5e' })}</g>`)
    y += gh + 14
  }
  return { inner: out.join(''), W, H: y + 10 }
}

/** El diagrama de una trabe de liga: su M (lineal) y su V (constante) en U1 */
export function diagramaLiga(l, { W = 900 } = {}) {
  const M = 50, gw = W - 2 * M, gh = 90, sep = 34
  const out = []
  const ext = (e, n) => `${n} (${e === 'empotrada' ? 'empotrada' : 'articulada'})`
  out.push(`<text x="${M}" y="20" font-size="13" font-weight="700" fill="${TINTA}" font-family="Instrument Sans, sans-serif">${esc(`${l.nombre} · ${l.sec.nombre} · L = ${l.L.toFixed(2)} m · toma ${Math.abs(l.S.F).toFixed(2)} t en servicio, ${Math.abs(l.U.F).toFixed(2)} t en U1`)}</text>`)
  const s = [0, l.L]
  const marcas = [{ s: 0, t: ext(l.extA, l.A.nudo ? `nudo ${l.A.nudo}` : 'eje') }]
  let y = 46
  out.push(`<text x="${n2(W - M - 4)}" y="${n2(y + gh - 4)}" font-size="8.5" fill="${TENUE}" text-anchor="end">${esc(ext(l.extB, l.B.nudo ? `nudo ${l.B.nudo}` : `eje de ${l.B.f.z.nombre}`))}</text>`)
  out.push(`<g data-diag="M">${grafica({ x0: M, y0: y, w: gw, h: gh, s, ys: [l.U.Ma, l.U.Mb], titulo: 'Momento U1 (+ tensión abajo)', unidad: 't·m', lims: [{ y: l.R.MRinf, t: `MR abajo ${l.R.MRinf.toFixed(2)}` }, { y: -l.R.MRsup, t: `MR arriba −${l.R.MRsup.toFixed(2)}` }], marcas, color: '#9a3412' })}</g>`)
  y += gh + sep
  out.push(`<g data-diag="V">${grafica({ x0: M, y0: y, w: gw, h: gh, s, ys: [l.U.F], escalon: true, titulo: 'Cortante U1 (la fuerza de la liga)', unidad: 't', lims: [{ y: l.R.VR, t: `VR ${l.R.VR.toFixed(2)}` }, { y: -l.R.VR, t: '−VR' }], marcas, color: '#1a7a5e' })}</g>`)
  y += gh + 14
  return { inner: out.join(''), W, H: y + 10 }
}

/** El punto de la deformada de un panel en planta: corrido hacia un lado de su eje δ·E */
function deformado(P, E) {
  return [P.x - P.f.n[0] * P.d * E, P.y - P.f.n[1] * P.d * E]
}

/** El SVG completo, con fondo blanco */
export function svgAsent(d, { fuente = 'DM Mono, monospace' } = {}) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${n2(d.W)} ${n2(d.H)}" width="${n2(d.W)}" height="${n2(d.H)}" font-family="${fuente}"><rect width="100%" height="100%" fill="#fff"/>${d.inner}</svg>`
}
