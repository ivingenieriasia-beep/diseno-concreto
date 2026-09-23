import { describe, it, expect, beforeEach } from 'vitest'
import { generateMemoria } from '../src/core/generateMemoria.js'
import { generateDetailedReport } from '../src/core/generateDetailedHTML.js'
import { buildDcheck } from '../src/core/dcheckExport.js'
import { columnSectionGroup } from '../src/core/columnsSvg.js'

// Una columna de siempre (sin zonas) y la misma con zonas
const base = {
  nombre: 'C-1', b: 36, h: 36, r: 3, fc: 250, fy: 4200, E: 2e6, epsC: 0.003,
  nLechos: 3, lechos: [{ n: 3, num: '5' }, { n: 2, num: '5' }, { n: 3, num: '5' }],
  estriboNum: '2.5', Pu: 40, MuX: 3, MuY: 1, envelope: null,
}
const conZonas = { ...base, sepExt: 9, sepCen: 18, longExt: 60 }

let escrito = ''
beforeEach(() => {
  escrito = ''
  window.open = () => ({ document: { write: (s) => { escrito += s }, close: () => {} }, focus: () => {} })
})

describe('los estribos de columna en cada salida', () => {
  it('memoria: sin zonas, el texto de siempre', () => {
    generateMemoria({ columns: [base] })
    expect(escrito).toContain('E#2.5@7')
    expect(escrito).toMatch(/Acero transversal: <b>E#2\.5 @ 7 cm<\/b>/)
  })

  it('memoria: con zonas, extremos y centro', () => {
    generateMemoria({ columns: [conZonas] })
    expect(escrito).toContain('E#2.5@9/18')
    expect(escrito).toContain('E#2.5 @ 9 cm en extremos (60 cm) · @ 18 cm al centro')
  })

  it('informe detallado: las filas de extremos y centro, y la hoja de referencia', () => {
    generateDetailedReport([], 'P', [conZonas])
    expect(escrito).toMatch(/<b>Extremos<\/b>.*@ 9 cm/s)
    expect(escrito).toMatch(/<b>Centro<\/b>.*@ 18 cm/s)
    expect(escrito).toContain('Separación de la hoja (referencia)')
  })

  it('el dibujo lo rotula', () => {
    expect(columnSectionGroup(base, 0, 0)).toContain('E #2.5 @ 7 cm')
    expect(columnSectionGroup(conZonas, 0, 0)).toContain('E #2.5 @ 9 / 18 cm')
  })

  it('.dcheck', () => {
    const d = buildDcheck({ columns: [conZonas] })
    const fila = JSON.stringify(d)
    expect(fila).toContain('E#2.5 @9/18')
  })
})
