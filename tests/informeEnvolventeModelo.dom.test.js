import { describe, it, expect, beforeEach } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import { parseModeloRam, seccionSugerida } from '../src/core/ramModel'
import { proponerTrabe } from '../src/core/propuesta'
import { analyzeGroup, perfilCompleto } from '../src/core/longitudinal'
import { generateDetailedReport } from '../src/core/generateDetailedHTML.js'
import { generateReport } from '../src/core/generateReport.js'
import useBeamStore from '../src/store/useBeamStore.js'

// Las trabes como las deja «crear las secciones con su armado» del Centro de
// carga: sin Mu ni Vu capturados (la demanda es la envolvente y el perfil) y
// sin pasar por la calculadora. Los informes tienen que leer el Vr de los
// estribos del detalle, no tomarlo por cero.
const R = parseModeloRam(readFileSync(resolve(process.cwd(), 'agente/ejemplos/modelo.json'), 'utf8'))

function crearTrabes() {
  const S = useBeamStore.getState()
  S.setModel(R.model)
  const idxs = []
  for (const g of R.grupos) {
    const s = seccionSugerida(g)
    if (s.esColumna) continue
    const idx = S.addSection({ nombre: s.nombre, ...(s.ancho ? { ancho: s.ancho, peralte: s.peralte } : {}) })
    S.setPerfilAt(idx, g.perfil)
    S.setEnvelopeAt(idx, { archivo: g.perfil.archivo, combo: g.perfil.combo, invertir: false, points: g.points })
    const B = useBeamStore.getState()
    const p = proponerTrabe(B.sections[idx], B.model)
    if (p && Object.keys(p.patch).length) S.patchSectionAt(idx, p.patch)
    idxs.push({ idx, p })
  }
  const { sections, model } = useBeamStore.getState()
  return idxs.map(({ idx, p }) => ({ t: sections[idx], p, model }))
}

let escrito = ''
beforeEach(() => {
  escrito = ''
  window.open = () => ({ document: { write: (s) => { escrito += s }, close: () => {} }, focus: () => {} })
})

describe('informes de las trabes creadas desde el modelo de RAM', () => {
  const trabes = crearTrabes()

  it('hay trabes propuestas que pasan, sin Vu capturado', () => {
    expect(trabes.length).toBeGreaterThan(0)
    for (const { t, p } of trabes) {
      expect(p.estado).toBe('ok')
      expect(+(t.calc.VuTon || t.vu || 0)).toBe(0)
    }
  })

  it('detallado: Vr real, sin Infinity, y la cuenta de Longitudinal', () => {
    const sections = trabes.map((x) => x.t)
    generateDetailedReport(sections, 'P', [])
    expect(escrito).not.toMatch(/Infinity/)
    for (const { t, model } of trabes) {
      const G = analyzeGroup(t, perfilCompleto(t, model))
      const n = new Set(t.envelope.points.map((p) => p.member)).size
      // todos los ejemplares quedan cubiertos (corridas o bastón puntual)
      expect(escrito).toContain(`Envolvente del modelo — ${n}/${n} miembros pasan`)
      if (G.nBast) expect(escrito).toMatch(new RegExp(`${n}/${n} miembros pasan \\(\\d+ con bastón puntual\\)`))
    }
    // el Vr de la tabla no sale vacío
    expect(escrito).not.toMatch(/<span class="l">Vr:<\/span> <span class="v">[–—-]<\/span>/)
    expect(escrito).not.toContain('NO quedan cubiertos')
  })

  it('resumido: sin «inf» y sin información incompleta', () => {
    const sections = trabes.map((x) => x.t)
    const pdf = generateReport(sections, 'P', []).output()
    expect(pdf).not.toMatch(/\(inf\)/)
    expect(pdf).not.toMatch(/Informaci.n incompleta/)
    expect(pdf).not.toMatch(/NO CUMPLE/)
    for (const { t } of trabes) {
      const n = new Set(t.envelope.points.map((p) => p.member)).size
      expect(pdf).toContain(`Envolvente: ${n}/${n} ejemplares pasan`)
    }
  })
})
