import { describe, it, expect, beforeEach } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import { generateDetailedReport } from '../src/core/generateDetailedHTML.js'
import { parseModeloRam } from '../src/core/ramModel'

// Una columna con la envolvente que ahora trae sincronizar.py: P, M22 y M33
// de cada combinación, en el pie y la cabeza de cada miembro.
const R = parseModeloRam(readFileSync(resolve(process.cwd(), 'tests/fixtures/modelo_columnas.json'), 'utf8'))
const C1 = R.grupos.find((g) => g.nombre === 'C1')
const col = {
  nombre: 'C-1', b: 30, h: 30, r: 3, fc: 250, fy: 4200, E: 2e6, epsC: 0.003,
  nLechos: 3, lechos: [{ n: 3, num: '6' }, { n: 2, num: '6' }, { n: 3, num: '6' }],
  estriboNum: '2.5', Pu: 0, MuX: 0, MuY: 0,
  envelope: { archivo: 'modelo.json', combo: C1.perfil.combo, mapping: 'M33X', points: C1.points },
}

let escrito = ''
beforeEach(() => {
  escrito = ''
  window.open = () => ({ document: { write: (s) => { escrito += s }, close: () => {} }, focus: () => {} })
})

describe('informe detallado con fuerzas simultáneas', () => {
  it('revisa todos los puntos y lista el que rige de cada miembro', () => {
    generateDetailedReport([], 'P', [col])
    expect(escrito).toContain(`Se revisaron ${C1.points.length} puntos`)
    expect(escrito).toContain('se lista el que rige de cada uno de los 36 miembros')
    // una fila por miembro, con la combinación y el extremo que rige
    const filas = escrito.match(/<td>\d+<\/td><td>(CD|CSXN?|CSZN?) (pie|cabeza)<\/td>/g) || []
    expect(filas).toHaveLength(36)
  })
})
