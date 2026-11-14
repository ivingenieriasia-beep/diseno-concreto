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
  // apoyos con su asentamiento
  for (const f of res.franjas) for (const p of f.apoyos) {
    const [x, y] = P2(p.x, p.y, iso ? p.d : 0)
    out.push(`<circle cx="${n2(x)}" cy="${n2(y)}" r="${dxf ? 8 : 3.6}" fill="#fff" stroke="${TINTA}" stroke-width="1.2"/>`)
    out.push(`<text x="${n2(x + 6)}" y="${n2(y + 13)}" font-size="${fs(9.5)}" fill="${TINTA}">${esc(`${p.nudo} · ${fmm(p.d)} mm`)}</text>`)
  }
  // título y escala de color
  out.push(`<text x="${M}" y="${n2(dxf ? 60 : 20)}" font-size="${fs(13)}" font-weight="700" fill="${TINTA}" font-family="Instrument Sans, sans-serif">${esc(`Asentamientos ${iso ? 'en 3D (isométrica)' : 'en planta'} · deformada × ${Math.round(E)}`)}</text>`)
  const lx = W - M - (dxf ? 600 : 220), ly = dxf ? 40 : 12, lw = dxf ? 520 : 170
  for (let i = 0; i < 20; i++) out.push(`<rect x="${n2(lx + (i * lw) / 20)}" y="${ly}" width="${n2(lw / 20 + 0.5)}" height="${dxf ? 22 : 9}" fill="${colorDe(res.dMin + ((res.dMax - res.dMin) * (i + 0.5)) / 20, res.dMin, res.dMax)}"/>`)
  out.push(`<text x="${n2(lx)}" y="${n2(ly + (dxf ? 50 : 21))}" font-size="${fs(9)}" fill="${TENUE}">${fmm(res.dMin)} mm</text>`)
  out.push(`<text x="${n2(lx + lw)}" y="${n2(ly + (dxf ? 50 : 21))}" font-size="${fs(9)}" fill="${TENUE}" text-anchor="end">${fmm(res.dMax)} mm</text>`)
  return { inner: out.join(''), W, H, k: dxf ? 1 : null, E }
}

/** El punto de la deformada de un panel en planta: corrido hacia un lado de su eje δ·E */
function deformado(P, E) {
  return [P.x - P.f.n[0] * P.d * E, P.y - P.f.n[1] * P.d * E]
}

/** El SVG completo, con fondo blanco */
export function svgAsent(d, { fuente = 'DM Mono, monospace' } = {}) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${n2(d.W)} ${n2(d.H)}" width="${n2(d.W)}" height="${n2(d.H)}" font-family="${fuente}"><rect width="100%" height="100%" fill="#fff"/>${d.inner}</svg>`
}
