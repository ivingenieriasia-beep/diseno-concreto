import { describe, it, expect, beforeEach } from 'vitest'
import * as React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { analyzeColumn, checkBiaxial } from '../src/core/columnCalculator.js'
import { generateMemoria } from '../src/core/generateMemoria.js'
import { generateDetailedReport } from '../src/core/generateDetailedHTML.js'
import { buildDcheck } from '../src/core/dcheckExport.js'

// El caso real de FB: 15×15 4#4, f'c 250, Pu 0.373 t, Mux 0.02, Muy 1.051 t·m
const col = {
  nombre: 'C-1', b: 15, h: 15, r: 3, fc: 250, fy: 4200, E: 2e6, epsC: 0.003,
  nLechos: 2, lechos: [{ n: 2, num: '4' }, { n: 2, num: '4' }],
  estriboNum: '2.5', Pu: 0.373, MuX: 0.02, MuY: 1.051, envelope: null,
}

let escrito = ''
beforeEach(() => {
  escrito = ''
  window.open = () => ({ document: { write: (s) => { escrito += s }, close: () => {} }, focus: () => {} })
})

describe('la revisión NTC se ve y se puede revisar', () => {
  const an = analyzeColumn(col)
  const bi = checkBiaxial(an.dirX, an.dirY, col.Pu, col.MuX, col.MuY)

  it('pestaña Columnas: los dos métodos, cuál gobierna, FR y εt, y el contorno Mx–My', async () => {
    // vitest compila el JSX con el runtime clásico (sin el plugin de React de vite)
    globalThis.React = React
    const { default: RevisionNTC } = await import('../src/components/RevisionNTC.jsx')
    const html = renderToStaticMarkup(React.createElement(RevisionNTC, { an, bi, titulo: 'punto capturado manualmente' }))
    expect(html).toContain('data-testid="revision-ntc"')
    expect(html).toContain('data-testid="contorno-mxmy"')
    expect(html).toContain('NTC 5.4.1.1')
    expect(html).toContain('5.4.1.2.b')
    expect(html).toContain('GOBIERNA')
    expect(html).toMatch(/FR 0\.900 · εt 0\.007\d+ · tensión/)
    expect(html).toContain(bi.dc.toFixed(3))
    expect(html).not.toMatch(/el[ií]ptic/i)          // la elipse α = 2 de antes ya no se usa
    expect(html).toContain('✗ no pasa')
  })

  it('memoria y detallado dicen los dos D/C y de qué ecuación sale', () => {
    generateMemoria({ columns: [col] })
    expect(escrito).toContain('método general (5.4.1.1, eje neutro inclinado)')
    expect(escrito).toContain('la ec. 5.4.1.2.b')
    expect(escrito).toContain('NTC-Concreto 2023, 3.8.2.2')
    escrito = ''
    generateDetailedReport([], '', [col])
    expect(escrito).toContain('Biaxial · método general')
    expect(escrito).toContain('Biaxial · método aproximado (NTC ec. 5.4.1.2.b')
    expect(escrito).toContain('GOBIERNA')
    expect(escrito).toContain('<th>FR</th>')
  })

  it('Double Check: la observación trae el resumen NTC', () => {
    const d = buildDcheck({ sections: [], columns: [col] })
    const c = (d.sections || d.data?.sections || []).find((s) => s.name === 'C-1')
    expect(c.obs).toMatch(/NTC-Concreto 2023 · D\/C 1\.06\d, gobierna ec\. 5\.4\.1\.2\.b/)
    expect(c.mark).toBe('bad')
  })
})
