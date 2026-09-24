// ══════════════════════════════════════════════════════════════
// Lienzo para los dibujos de cimentación
//
// Coordenadas del modelo en cm, con y hacia arriba; el lienzo las pasa a px
// con su escala k (px/cm) y un origen por vista. Además del SVG guarda las
// MANIJAS (lo que se arrastra en el detallador) y las ZONAS de clic (las
// varillas que abren su selector). Los colores son los de BeamCanvas: el
// convertidor a DXF asigna la capa por color, así que concreto, varillas y
// cotas caen en las mismas capas que las trabes.
// ══════════════════════════════════════════════════════════════

export const COL = {
  concreto: '#c4517a', abajo: '#2563a8', arriba: '#c94f2a', estribo: '#1a7a5e',
  cota: '#9a958c', tinta: '#1a1814', tenue: '#6b6760', suelo: '#a27b5c', piedra: '#8a8580',
  plantilla: '#b9b3a9', ok: '#15803d', mal: '#c62828', presion: '#e8830a', critica: '#9333ea',
}

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const n = (v) => (Math.round(v * 100) / 100).toString()

export function lienzo(k = 2, ky = k) {
  const out = []
  const handles = [], hits = []
  let ox = 0, oy = 0
  const X = (x) => ox + x * k
  const Y = (y) => oy - y * ky
  const est = ({ c = COL.tinta, w = 1, dash = null, fill = 'none', op = null, cap = null } = {}) =>
    `stroke="${c}" stroke-width="${w}" fill="${fill}"${dash ? ` stroke-dasharray="${dash}"` : ''}${op != null ? ` opacity="${op}"` : ''}${cap ? ` stroke-linecap="${cap}"` : ''}`
  const L = {
    get k() { return k },
    X, Y,
    vista(x0, y0) { ox = x0; oy = y0 },
    raw(s) { out.push(s) },
    line(x1, y1, x2, y2, o) { out.push(`<line x1="${n(X(x1))}" y1="${n(Y(y1))}" x2="${n(X(x2))}" y2="${n(Y(y2))}" ${est(o)}/>`) },
    rect(x, y, w, h, o) { out.push(`<rect x="${n(X(x))}" y="${n(Y(y + h))}" width="${n(w * k)}" height="${n(h * ky)}" ${est(o)}/>`) },
    poly(pts, o, cerrado = true) {
      const p = pts.map(([x, y]) => `${n(X(x))},${n(Y(y))}`).join(' ')
      out.push(`<${cerrado ? 'polygon' : 'polyline'} points="${p}" ${est(o)}/>`)
    },
    dot(x, y, r, c) { out.push(`<circle cx="${n(X(x))}" cy="${n(Y(y))}" r="${n(r)}" fill="${c}" stroke="${c}" stroke-width="0.5"/>`) },
    /** texto en coordenadas del modelo (dx, dy en px) */
    text(x, y, t, { size = 11, anchor = 'middle', c = COL.tinta, weight = 400, dx = 0, dy = 0, rot = 0, mono = true } = {}) {
      const px = X(x) + dx, py = Y(y) + dy
      out.push(`<text x="${n(px)}" y="${n(py)}" font-size="${size}" text-anchor="${anchor}" fill="${c}" font-weight="${weight}"${mono ? '' : ` font-family="Instrument Sans, sans-serif"`}${rot ? ` transform="rotate(${rot} ${n(px)} ${n(py)})"` : ''}>${esc(t)}</text>`)
    },
    /** texto en px absolutos */
    textPx(px, py, t, { size = 11, anchor = 'start', c = COL.tinta, weight = 400, mono = false } = {}) {
      out.push(`<text x="${n(px)}" y="${n(py)}" font-size="${size}" text-anchor="${anchor}" fill="${c}" font-weight="${weight}"${mono ? '' : ` font-family="Instrument Sans, sans-serif"`}>${esc(t)}</text>`)
    },
    /** cota horizontal entre x1 y x2 a la altura y, corrida `off` px (− arriba) */
    dimH(x1, x2, y, off, label, { c = COL.cota, size = 10.5 } = {}) {
      if (Math.abs(x2 - x1) < 1e-6) return
      const py = Y(y) + off, a = X(x1), b = X(x2)
      out.push(`<line x1="${n(a)}" y1="${n(Y(y))}" x2="${n(a)}" y2="${n(py + Math.sign(off) * 4)}" stroke="${c}" stroke-width="0.6"/>`)
      out.push(`<line x1="${n(b)}" y1="${n(Y(y))}" x2="${n(b)}" y2="${n(py + Math.sign(off) * 4)}" stroke="${c}" stroke-width="0.6"/>`)
      out.push(`<line x1="${n(a)}" y1="${n(py)}" x2="${n(b)}" y2="${n(py)}" stroke="${c}" stroke-width="0.8"/>`)
      for (const x of [a, b]) out.push(`<line x1="${n(x - 3)}" y1="${n(py + 3)}" x2="${n(x + 3)}" y2="${n(py - 3)}" stroke="${c}" stroke-width="1.1"/>`)
      out.push(`<text x="${n((a + b) / 2)}" y="${n(py - 3)}" font-size="${size}" text-anchor="middle" fill="${COL.tenue}">${esc(label)}</text>`)
    },
    /** cota vertical entre y1 y y2 en x, corrida `off` px (− izquierda) */
    dimV(y1, y2, x, off, label, { c = COL.cota, size = 10.5 } = {}) {
      if (Math.abs(y2 - y1) < 1e-6) return
      const px = X(x) + off, a = Y(y1), b = Y(y2)
      out.push(`<line x1="${n(X(x))}" y1="${n(a)}" x2="${n(px + Math.sign(off) * 4)}" y2="${n(a)}" stroke="${c}" stroke-width="0.6"/>`)
      out.push(`<line x1="${n(X(x))}" y1="${n(b)}" x2="${n(px + Math.sign(off) * 4)}" y2="${n(b)}" stroke="${c}" stroke-width="0.6"/>`)
      out.push(`<line x1="${n(px)}" y1="${n(a)}" x2="${n(px)}" y2="${n(b)}" stroke="${c}" stroke-width="0.8"/>`)
      for (const y of [a, b]) out.push(`<line x1="${n(px - 3)}" y1="${n(y + 3)}" x2="${n(px + 3)}" y2="${n(y - 3)}" stroke="${c}" stroke-width="1.1"/>`)
      const tx = px - Math.sign(off || -1) * -4
      out.push(`<text x="${n(tx - 3)}" y="${n((a + b) / 2)}" font-size="${size}" text-anchor="middle" fill="${COL.tenue}" transform="rotate(-90 ${n(tx - 3)} ${n((a + b) / 2)})">${esc(label)}</text>`)
    },
    /** relleno de tierra: contorno y rayado a 45° dentro de un rectángulo */
    tierra(x0, y0, x1, y1, { paso = 12, c = COL.suelo } = {}) {
      const a = X(Math.min(x0, x1)), b = X(Math.max(x0, x1)), t = Y(Math.max(y0, y1)), u = Y(Math.min(y0, y1))
      const id = `t${out.length}`
      out.push(`<clipPath id="${id}"><rect x="${n(a)}" y="${n(t)}" width="${n(b - a)}" height="${n(u - t)}"/></clipPath><g clip-path="url(#${id})" data-sin-dxf="1">`)
      for (let s = -(u - t); s < b - a; s += paso) out.push(`<line x1="${n(a + s)}" y1="${n(u)}" x2="${n(a + s + (u - t))}" y2="${n(t)}" stroke="${c}" stroke-width="0.5" opacity="0.45"/>`)
      out.push('</g>')
    },
    /** tierra dentro de un polígono cualquiera */
    tierraPoli(pts, { paso = 12, c = COL.suelo } = {}) {
      const id = `p${out.length}`
      const p = pts.map(([x, y]) => `${n(X(x))},${n(Y(y))}`).join(' ')
      const xs = pts.map(([x]) => X(x)), ys = pts.map(([, y]) => Y(y))
      const a = Math.min(...xs), b = Math.max(...xs), t = Math.min(...ys), u = Math.max(...ys)
      out.push(`<clipPath id="${id}"><polygon points="${p}"/></clipPath><g clip-path="url(#${id})" data-sin-dxf="1">`)
      for (let s = -(u - t); s < b - a; s += paso) out.push(`<line x1="${n(a + s)}" y1="${n(u)}" x2="${n(a + s + (u - t))}" y2="${n(t)}" stroke="${c}" stroke-width="0.5" opacity="0.45"/>`)
      out.push('</g>')
    },
    /** textura de piedra braza dentro de un polígono */
    piedra(pts, semilla = 1) {
      const id = `s${out.length}`
      const p = pts.map(([x, y]) => `${n(X(x))},${n(Y(y))}`).join(' ')
      const xs = pts.map(([x]) => X(x)), ys = pts.map(([, y]) => Y(y))
      const a = Math.min(...xs), b = Math.max(...xs), t = Math.min(...ys), u = Math.max(...ys)
      let r = semilla * 9301 + 49297
      const rnd = () => { r = (r * 9301 + 49297) % 233280; return r / 233280 }
      out.push(`<clipPath id="${id}"><polygon points="${p}"/></clipPath><g clip-path="url(#${id})" data-sin-dxf="1">`)
      const paso = 16
      for (let y = t; y < u + paso; y += paso * 0.8) {
        for (let x = a - paso; x < b + paso; x += paso * 1.3) {
          const cx = x + rnd() * 6, cy = y + rnd() * 5, rx = paso * (0.45 + rnd() * 0.2), ry = paso * (0.3 + rnd() * 0.15)
          out.push(`<ellipse cx="${n(cx)}" cy="${n(cy)}" rx="${n(rx)}" ry="${n(ry)}" fill="#d9d3c8" stroke="${COL.piedra}" stroke-width="0.6" opacity="0.8"/>`)
        }
      }
      out.push('</g>')
    },
    /** una manija de arrastre (en coordenadas del modelo) */
    manija(id, x, y, { eje = 'x', campo, factor = 1, pasoCm = 5, min = null, max = null, titulo = '', forma = 'barra' }) {
      handles.push({ id, x: X(x), y: Y(y), eje, campo, factor, paso: pasoCm, min, max, titulo, forma, k: eje === 'y' ? ky : k })
    },
    /** zona que abre el selector de una varilla */
    zona(id, x, y, w, h, titulo = '') { hits.push({ id, x, y, w, h, titulo }) },
    zonaModelo(id, x0, y0, x1, y1, titulo = '') {
      hits.push({ id, x: Math.min(X(x0), X(x1)), y: Math.min(Y(y0), Y(y1)), w: Math.abs(X(x1) - X(x0)), h: Math.abs(Y(y1) - Y(y0)), titulo })
    },
    /** etiqueta de varilla, que además es zona de clic */
    etiqueta(id, x, y, t, { c = COL.abajo, anchor = 'middle', dx = 0, dy = 0, size = 11.5, titulo = '' } = {}) {
      const px = X(x) + dx, py = Y(y) + dy
      const w = t.length * size * 0.62 + 10
      const x0 = anchor === 'middle' ? px - w / 2 : anchor === 'end' ? px - w + 5 : px - 5
      out.push(`<rect x="${n(x0)}" y="${n(py - size - 2)}" width="${n(w)}" height="${n(size + 7)}" rx="4" fill="#ffffff" fill-opacity="0.85" stroke="${c}" stroke-width="0.8" data-sin-dxf="1"/>`)
      out.push(`<text x="${n(px)}" y="${n(py)}" font-size="${size}" text-anchor="${anchor}" fill="${c}" font-weight="600">${esc(t)}</text>`)
      hits.push({ id, x: x0, y: py - size - 2, w, h: size + 7, titulo })
    },
    titulo(x, y, t, sub = '') {
      out.push(`<text x="${n(x)}" y="${n(y)}" font-size="12.5" font-weight="700" fill="${COL.tinta}" font-family="Instrument Sans, sans-serif">${esc(t)}</text>`)
      if (sub) out.push(`<text x="${n(x)}" y="${n(y + 14)}" font-size="10.5" fill="${COL.tenue}" font-family="Instrument Sans, sans-serif">${esc(sub)}</text>`)
    },
    resultado(W, H, extra = {}) {
      const inner = out.join('')
      return {
        inner, W, H, k, handles, hits, ...extra,
        svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${n(W)} ${n(H)}" width="${n(W)}" height="${n(H)}" font-family="DM Mono, monospace">${inner}</svg>`,
      }
    },
  }
  return L
}

/** El SVG con medidas físicas para svgToDxf: 1 cm del modelo = 1 cm del dibujo × escala */
export function svgParaDxf(d) {
  const wCm = (d.W / d.k).toFixed(4), hCm = (d.H / d.k).toFixed(4)
  // la textura (tierra, piedra, fondos de etiqueta) no va al DXF
  const inner = d.inner
    .replace(/<clipPath id="[^"]+">[\s\S]*?<\/clipPath>/g, '')
    .replace(/<g clip-path="url\(#[^"]+\)" data-sin-dxf="1">[\s\S]*?<\/g>/g, '')
    .replace(/<rect[^>]*data-sin-dxf="1"\/>/g, '')
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${d.W} ${d.H}" width="${wCm}cm" height="${hCm}cm" data-real-width-cm="${wCm}" data-real-height-cm="${hCm}" style="font-family:'DM Mono',monospace">${inner}</svg>`
}
