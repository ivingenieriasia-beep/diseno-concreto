// ══════════════════════════════════════════════════════════════
// Salidas de Cimentaciones: planos (DXF / SVG a escala real) y memoria PDF
//
// Los planos apilan el detallado de cada cimiento a 2 px/cm; el SVG lleva su
// tamaño físico en cm, así svgToDxf lo deja a escala real × el factor del
// proyecto, con las capas por color de siempre. La memoria PDF usa DejaVu
// (subconjunto con √, ≤, φ, ², ⅔…): las fuentes de fábrica de jsPDF no
// traen esos signos.
// ══════════════════════════════════════════════════════════════

import { jsPDF } from 'jspdf'
import { revisarCim, tipoCim } from './index'
import { planosSvg, dibujoParaExportar, dibujoParaDocumento, baseNombre, sello } from './planos'
import { svgParaDxf } from './lienzo'
import { SUELO, f2 } from './comun'
export { dibujoParaExportar, dibujoParaDocumento, planosSvg } from './planos'
import { svgToDxf } from '../svgToDxf'
import { svgToPng } from '../generateMemoria'
import { guardarSalida, dondeQuedo } from '../carpeta'
import { APP_VERSION } from '../constants'
import { MARCA, rgbDe } from '../marca'
import fuenteNormal from '../../assets/fuentes/DejaVuSans.ttf?inline'
import fuenteNegrita from '../../assets/fuentes/DejaVuSans-Bold.ttf?inline'
import fuenteMono from '../../assets/fuentes/DejaVuSansMono.ttf?inline'

export async function exportarPlanos(lista, obra, { formato = 'dxf', dxfScale = 1, projectName = '' } = {}) {
  const P = planosSvg(lista, obra)
  const una = lista.length === 1
  const base = baseNombre(projectName, una ? lista[0].nombre : 'todos')
  if (formato === 'svg') {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${P.W} ${P.H}" width="${P.W}" height="${P.H}" font-family="DM Mono, monospace"><rect width="100%" height="100%" fill="#fff"/>${P.inner}</svg>`
    const r = await guardarSalida(`${base}.svg`, svg, { sub: 'planos', mime: 'image/svg+xml' })
    return `SVG ${r.donde === 'carpeta' ? dondeQuedo(r) : 'descargado'}`
  }
  const dxf = svgToDxf(svgParaDxf(P), { scaleFactor: dxfScale })
  const r = await guardarSalida(`${base}.dxf`, dxf, { sub: 'planos', mime: 'application/dxf' })
  return `DXF de ${una ? lista[0].nombre : `${lista.length} cimientos`} a escala real${dxfScale !== 1 ? ` × ${dxfScale}` : ''} · ${r.donde === 'carpeta' ? dondeQuedo(r) : 'descargado'}`
}

// ── Memoria PDF ──────────────────────────────────────────────

const b64 = (dataUrl) => String(dataUrl).replace(/^data:[^,]*,/, '')

function prepararFuentes(doc) {
  doc.addFileToVFS('DejaVuSans.ttf', b64(fuenteNormal))
  doc.addFont('DejaVuSans.ttf', 'DejaVu', 'normal')
  doc.addFileToVFS('DejaVuSans-Bold.ttf', b64(fuenteNegrita))
  doc.addFont('DejaVuSans-Bold.ttf', 'DejaVu', 'bold')
  doc.addFileToVFS('DejaVuSansMono.ttf', b64(fuenteMono))
  doc.addFont('DejaVuSansMono.ttf', 'DejaVuMono', 'normal')
  doc.setFont('DejaVu', 'normal')
}

const fmtV = (v, u) => {
  if (typeof v !== 'number') return `${v ?? ''}`
  if (!Number.isFinite(v)) return '∞'
  const a = Math.abs(v)
  const d = a >= 1000 ? 0 : a >= 100 ? 1 : a >= 1 ? 2 : 3
  return `${v.toFixed(d)}${u ? ` ${u}` : ''}`
}

/**
 * Tabla con ajuste de renglones y salto de página.
 * cols: [{ t, w, font, align }]; filas: [[celdas], { color, fondo }]
 */
function tabla(doc, ctx, cols, filas, { cab = true, tam = 7.6, zebra = true } = {}) {
  const x0 = ctx.m, lh = tam * 0.42
  const pintar = (celdas, estilo = {}) => {
    const lineas = celdas.map((c, i) => {
      doc.setFont(cols[i].font || 'DejaVu', estilo.negrita ? 'bold' : 'normal')
      doc.setFontSize(tam)
      return doc.splitTextToSize(String(c ?? ''), cols[i].w - 2.4)
    })
    const alto = Math.max(...lineas.map((l) => l.length)) * lh + 2.2
    if (ctx.y + alto > ctx.alto - ctx.m) { nuevaPagina(doc, ctx); if (cab && !estilo.cab) pintar(cols.map((c) => c.t), { cab: true, negrita: true, fondo: [236, 232, 225] }) }
    let x = x0
    if (estilo.fondo) { doc.setFillColor(...estilo.fondo); doc.rect(x0, ctx.y, cols.reduce((s, c) => s + c.w, 0), alto, 'F') }
    lineas.forEach((l, i) => {
      doc.setFont(cols[i].font || 'DejaVu', estilo.negrita ? 'bold' : 'normal')
      doc.setFontSize(tam)
      doc.setTextColor(...(estilo.colores?.[i] || estilo.color || [26, 24, 20]))
      const al = cols[i].align || 'left'
      const tx = al === 'right' ? x + cols[i].w - 1.2 : x + 1.2
      doc.text(l, tx, ctx.y + lh + 0.4, { align: al })
      x += cols[i].w
    })
    doc.setDrawColor(222, 216, 206)
    doc.line(x0, ctx.y + alto, x0 + cols.reduce((s, c) => s + c.w, 0), ctx.y + alto)
    ctx.y += alto
  }
  if (cab) pintar(cols.map((c) => c.t), { cab: true, negrita: true, fondo: [236, 232, 225] })
  filas.forEach((f, i) => {
    const [celdas, est = {}] = Array.isArray(f[0]) ? f : [f, {}]
    pintar(celdas, { ...est, fondo: est.fondo || (zebra && i % 2 ? [250, 248, 244] : null) })
  })
  doc.setTextColor(26, 24, 20)
}

function nuevaPagina(doc, ctx) {
  doc.addPage()
  ctx.pag++
  ctx.y = ctx.m + 8
  encabezado(doc, ctx)
}

function encabezado(doc, ctx) {
  doc.setFont('DejaVu', 'normal'); doc.setFontSize(7.5); doc.setTextColor(135, 145, 139)
  doc.text(`${MARCA.empresa} · ${MARCA.app} v${APP_VERSION} · Cimentaciones${ctx.proyecto ? ` · ${ctx.proyecto}` : ''}`, ctx.m, ctx.m - 3)
  doc.text(`${ctx.fecha}`, ctx.ancho - ctx.m, ctx.m - 3, { align: 'right' })
  doc.setDrawColor(...rgbDe(MARCA.acento)); doc.setLineWidth(0.5)
  doc.line(ctx.m, ctx.m - 1.5, ctx.ancho - ctx.m, ctx.m - 1.5)
  doc.setLineWidth(0.2); doc.setTextColor(26, 24, 20)
}

function parrafo(doc, ctx, texto, { tam = 9, negrita = false, color = [26, 24, 20], antes = 0, despues = 2 } = {}) {
  ctx.y += antes
  doc.setFont('DejaVu', negrita ? 'bold' : 'normal'); doc.setFontSize(tam); doc.setTextColor(...color)
  const l = doc.splitTextToSize(texto, ctx.ancho - 2 * ctx.m)
  const alto = l.length * tam * 0.42
  if (ctx.y + alto > ctx.alto - ctx.m) nuevaPagina(doc, ctx)
  doc.text(l, ctx.m, ctx.y + tam * 0.35)
  ctx.y += alto + despues
  doc.setTextColor(26, 24, 20)
}

/**
 * El dibujo va rasterizado a ~200 ppp sobre el ancho útil de la hoja (no más
 * de 1600 px) y comprimido: sin 'FAST', jsPDF guarda los píxeles crudos del
 * PNG con transparencia y cada lámina pesa decenas de MB.
 */
async function imagen(doc, ctx, svg, W, H, maxAlto = 120) {
  let png = null
  const s = Math.min(2, 1600 / Math.max(W, 1), 1600 / Math.max(H, 1))
  try { png = await svgToPng(svg.replace(/width="[^"]*" height="[^"]*"/, `width="${Math.round(W * s)}" height="${Math.round(H * s)}"`), W * s, H * s, 1) } catch { return }
  const anchoMm = ctx.ancho - 2 * ctx.m
  let w = anchoMm, h = (H / W) * w
  if (h > maxAlto) { h = maxAlto; w = (W / H) * h }
  if (ctx.y + h > ctx.alto - ctx.m) nuevaPagina(doc, ctx)
  doc.addImage(png, 'PNG', ctx.m + (anchoMm - w) / 2, ctx.y, w, h, undefined, 'FAST')
  ctx.y += h + 3
}

/** Filas de la tabla de revisiones */
export const filasRevision = (R) => R.checks.map((c) => [[
  `${c.ok ? '✓' : '✗'} ${c.titulo}`, c.unidad === 'FS' ? c.nota : `${fmtV(c.act)} ${c.unidad}`, c.unidad === 'FS' ? `≥ ${fmtV(c.act)}` : `${fmtV(c.res)} ${c.unidad}`,
  !c.sinU && Number.isFinite(c.u) ? `${Math.round(c.u * 100)} %` : '—',
], { colores: [c.ok ? [21, 128, 61] : [198, 40, 40]] }])

export async function memoriaPdf(lista, obra, { projectName = '' } = {}) {
  const doc = new jsPDF({ unit: 'mm', format: 'letter', compress: true })
  prepararFuentes(doc)
  const ctx = { m: 16, ancho: doc.internal.pageSize.getWidth(), alto: doc.internal.pageSize.getHeight(), y: 0, pag: 1, proyecto: projectName, fecha: new Date().toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' }) }
  ctx.y = ctx.m + 8
  encabezado(doc, ctx)
  const S = { ...SUELO, ...(obra.suelo || {}) }
  const revs = lista.map((z) => ({ z, R: revisarCim(z, obra) }))

  parrafo(doc, ctx, 'Memoria de cálculo de la cimentación', { tam: 16, negrita: true, despues: 1 })
  parrafo(doc, ctx, projectName || 'Proyecto sin nombre', { tam: 10, color: [107, 103, 96], despues: 4 })
  parrafo(doc, ctx, `Criterio: el suelo se revisa con cargas de servicio (CM + CV y CM + CV ± S, el sismo cargando y descargando) contra la capacidad efectiva qe = qadm − W/A, con W el peso de la zapata y el relleno; con excentricidad, e = (M + V h)/(N + W) y el área efectiva de Meyerhof B′ = B − 2e; el concreto con cargas factorizadas 1.3 CM + 1.5 CV (y 1.1 (CM + CV + S) con sismo) conforme a las NTC-Concreto: FR = 0.9 en flexión y 0.75 en cortante. Los muros de contención con empuje de Rankine y los cimientos de piedra conforme a NTC-Mampostería 8.4.`, { tam: 8.6, despues: 3 })
  tabla(doc, ctx, [
    { t: 'Suelo de la obra', w: 60 }, { t: 'Valor', w: 30, align: 'right' },
    { t: 'Suelo de la obra', w: 64 }, { t: 'Valor', w: 29.9, align: 'right' },
  ], [
    ['Capacidad admisible qadm', `${f2(S.qadm)} t/m²`, 'Fricción del relleno φ', `${S.phi}°`],
    ['Peso volumétrico γs', `${f2(S.gs)} t/m³`, 'Fricción del suelo de apoyo φ', `${S.phiB ?? S.phi}°`],
    ['Desplante Df', `${f2(S.Df)} m`, 'Cohesión del suelo de apoyo c', `${f2(S.c)} t/m²`],
  ], { zebra: false })
  ctx.y += 4
  if (lista.length > 1) {
    parrafo(doc, ctx, 'Resumen', { tam: 11, negrita: true, antes: 2 })
    tabla(doc, ctx, [
      { t: 'Cimiento', w: 22 }, { t: 'Tipo', w: 38 }, { t: 'Solución', w: 104 }, { t: 'Estado', w: 19.9 },
    ], revs.map(({ z, R }) => [[z.nombre, tipoCim(z.tipo).nombre, R.resumen, R.ok ? 'CUMPLE' : 'NO CUMPLE'], { colores: [null, null, null, R.ok ? [21, 128, 61] : [198, 40, 40]] }]))
  }

  for (const { z, R } of revs) {
    nuevaPagina(doc, ctx)
    parrafo(doc, ctx, `${z.nombre} · ${tipoCim(z.tipo).nombre}`, { tam: 13, negrita: true, despues: 1 })
    parrafo(doc, ctx, R.resumen, { tam: 8.8, color: [74, 70, 64], despues: 2 })
    parrafo(doc, ctx, R.ok ? '✓ Cumple todas las revisiones' : `✗ No cumple: ${R.checks.filter((c) => !c.ok).map((c) => c.titulo.toLowerCase()).join(', ')}`, { tam: 9.5, negrita: true, color: R.ok ? [21, 128, 61] : [198, 40, 40], despues: 2 })
    for (const a of R.avisos || []) parrafo(doc, ctx, `• ${a}`, { tam: 8.2, color: [146, 64, 14], despues: 1 })
    const d = dibujoParaDocumento(z, obra, R)
    if (d) await imagen(doc, ctx, `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${d.W} ${d.H}" width="${d.W}" height="${d.H}" font-family="DejaVu Sans Mono, monospace"><rect width="100%" height="100%" fill="#fff"/>${d.inner}</svg>`, d.W, d.H, 118)
    parrafo(doc, ctx, 'Revisiones', { tam: 10.5, negrita: true, antes: 1 })
    tabla(doc, ctx, [{ t: 'Revisión', w: 72 }, { t: 'Actuante', w: 40, align: 'right' }, { t: 'Resistente / límite', w: 50, align: 'right' }, { t: 'Aprov.', w: 21.9, align: 'right' }], filasRevision(R))
    for (const s of R.secciones) {
      parrafo(doc, ctx, s.titulo, { tam: 9.8, negrita: true, antes: 3, despues: 1 })
      tabla(doc, ctx, [
        { t: 'Concepto', w: 44 }, { t: 'Fórmula', w: 56, font: 'DejaVuMono' }, { t: 'Sustitución', w: 50, font: 'DejaVuMono' }, { t: 'Resultado', w: 33.9, align: 'right' },
      ], s.pasos.map((p) => [[p.t, p.f, p.n, `${fmtV(p.v, p.u)}${p.ok != null ? (p.ok ? ' ✓' : ' ✗') : ''}${p.lim ? `\n${p.lim}` : ''}${p.nota ? `\n${p.nota}` : ''}`],
        { colores: [null, [74, 70, 64], [107, 103, 96], p.ok === false ? [198, 40, 40] : p.ok ? [21, 128, 61] : [26, 24, 20]] }]), { tam: 7.2 })
    }
  }
  const n = doc.getNumberOfPages()
  for (let i = 1; i <= n; i++) {
    doc.setPage(i); doc.setFont('DejaVu', 'normal'); doc.setFontSize(7.5); doc.setTextColor(135, 145, 139)
    doc.text(`${i} / ${n}`, ctx.ancho - ctx.m, ctx.alto - 8, { align: 'right' })
  }
  return doc
}

export async function exportarMemoriaPdf(lista, obra, { projectName = '' } = {}) {
  const doc = await memoriaPdf(lista, obra, { projectName })
  const una = lista.length === 1
  const nombre = `${baseNombre(projectName, una ? lista[0].nombre : 'todos')}-memoria-${sello()}.pdf`
  const r = await guardarSalida(nombre, doc.output('blob'), { sub: 'memoria', mime: 'application/pdf' })
  return `Memoria de ${una ? lista[0].nombre : `${lista.length} cimientos`} (${doc.getNumberOfPages()} págs.) ${r.donde === 'carpeta' ? dondeQuedo(r) : 'descargada'}`
}
