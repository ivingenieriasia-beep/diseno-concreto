// ══════════════════════════════════════════════════════════════
// Planos de Cimentaciones: el detallado de cada cimiento a escala fija
// (2 px/cm) para el DXF, el SVG, el PDF y el Word
// ══════════════════════════════════════════════════════════════

import { revisarCim, tipoCim } from './index'
import { dibujarCim } from './dibujo'
import { SUELO } from './comun'

export const K_PLANO = 2                  // px por cm en los planos exportados
export const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
export const sello = () => new Date().toISOString().slice(0, 10)
export const baseNombre = (projectName, extra) => `cimentacion${projectName?.trim() ? `-${projectName.trim().replace(/\s+/g, '-')}` : ''}${extra ? `-${extra}` : ''}`

export const DfDe = (z, obra) => Number(z?.suelo?.Df ?? obra?.suelo?.Df ?? SUELO.Df)

/** El dibujo de un cimiento para exportar (escala fija, sin exagerar alturas) */
export function dibujoParaExportar(z, obra, R = revisarCim(z, obra)) {
  return dibujarCim(z, R, { ancho: 1400, Df: DfDe(z, obra), k: K_PLANO, exportar: true, escalas: { kx: K_PLANO, ks: K_PLANO, kz: K_PLANO } })
}

/**
 * El dibujo para la memoria (PDF, Word, HTML): el mismo acomodo que en
 * pantalla, ajustado a un ancho de hoja. A escala real una contratrabe de
 * 16 m sale 5:1 y en la hoja su corte no se lee.
 */
export function dibujoParaDocumento(z, obra, R = revisarCim(z, obra)) {
  return dibujarCim(z, R, { ancho: 1000, Df: DfDe(z, obra) })
}

/** Todos los cimientos apilados, con su título, en un solo SVG a escala */
export function planosSvg(lista, obra) {
  let y = 0, W = 0
  const partes = []
  for (const z of lista) {
    const R = revisarCim(z, obra)
    const d = dibujoParaExportar(z, obra, R)
    if (!d) continue
    partes.push(`<g transform="translate(0,${y})"><text x="20" y="18" font-size="16" font-weight="700" fill="#1a1814" font-family="Instrument Sans, sans-serif">${esc(z.nombre)} · ${esc(tipoCim(z.tipo).nombre)}</text>`
      + `<text x="20" y="36" font-size="11" fill="#6b6760" font-family="Instrument Sans, sans-serif">${esc(R.resumen)}</text>`
      + `<g transform="translate(0,40)">${d.inner}</g></g>`)
    y += d.H + 70
    W = Math.max(W, d.W)
  }
  return { inner: partes.join(''), W: Math.max(W, 400), H: Math.max(y, 100), k: K_PLANO }
}

