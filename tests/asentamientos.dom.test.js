// ══════════════════════════════════════════════════════════════
// 3.12 · Asentamientos: el dibujo (planta, 3D), el DXF a escala real, la
// memoria PDF y que los datos viajen en el proyecto. Datos FICTICIOS de
// CH-26-901.
// ══════════════════════════════════════════════════════════════
import { describe, it, expect } from 'vitest'
import { asentamientos, nuevoAsent } from '../src/core/cim/asentamientos'
import { dibujoAsent, svgAsent } from '../src/core/cim/asentDibujo'
import { memoriaAsentPdf } from '../src/core/cim/salidas'
import { svgParaDxf } from '../src/core/cim/lienzo'
import { svgToDxf } from '../src/core/svgToDxf'
import { corridaDesde, cargasDeApoyo, vivaMediaDeApoyo } from '../src/core/cim/reacciones'
import useCimStore from '../src/store/useCimStore'

const reac = (fy) => ({ fx: 0, fy, fz: 0, mx: 0, my: 0, mz: 0 })
const apoyo = (nudo, x, y, cm, cv) => ({ nudo, x, y, elev: 0, por: { CM: reac(cm), CV: reac(cv) } })
const A = { apoyos: [apoyo('1', 0, 2, 2, 0.5), apoyo('2', 3, 2, 3, 0.8), apoyo('3', 5, 2, 9, 2.4), apoyo('4', 8, 2, 2.5, 0.6)], up: 'y', plano: ['x', 'z'] }
const pap = { CM: 'CM', CV: 'CV' }
const cargas = A.apoyos.map((a) => { const c = cargasDeApoyo(a, pap, 'y'); return { CM: c.CM.P, CV: c.CV.P, CVmed: vivaMediaDeApoyo(a, pap, 'y') } })
const zc = { ...corridaDesde(A.apoyos, pap, 'y', {}), uid: 'zc901', nombre: 'ZC-901' }
zc.geo = { ...zc.geo, B: 0.6, h: 25 }
const datos = { ...nuevoAsent(), modelo: 'elastico', estratos: [{ id: 'E1', nombre: 'Suelo ficticio', E: 2000, nu: 0.3, ks: '' }], limMedio: 25, limDist: 0.002, carga: 'apoyos', cvMaxSiFalta: true, fInercia: 0.5, fcAsent: 1 }
const res = asentamientos({ A, cimientos: [zc], cargas, asent: datos, conCasoMedio: false })

describe('3.12 · el dibujo de los asentamientos', () => {
  it('planta: un polígono por panel con su color, la deformada, los tramos y los apoyos', () => {
    const d = dibujoAsent(res, { vista: 'planta' })
    expect((d.inner.match(/data-panel=/g) || []).length).toBe(res.paneles.length)
    expect(d.inner).toContain('data-deformada="1"')
    expect((d.inner.match(/data-tramo=/g) || []).length).toBe(3)
    expect(d.inner).toContain('3 · ')
    expect(d.E).toBeGreaterThan(0)
  })
  it('3D: la misma malla hundida, con la de referencia sin deformar', () => {
    const d = dibujoAsent(res, { vista: '3d' })
    expect((d.inner.match(/data-panel=/g) || []).length).toBe(res.paneles.length)
    expect(d.inner).toContain('stroke-dasharray="3 3"')
    expect(d.inner).toContain('en 3D')
  })
  it('la deformada se exagera con el control', () => {
    expect(dibujoAsent(res, { exag: 2 }).E).toBeCloseTo(2 * dibujoAsent(res, { exag: 1 }).E, 9)
  })
  it('DXF de la planta a escala real: 1 cm del modelo = 1 cm del dibujo', () => {
    const d = dibujoAsent(res, { dxf: true })
    expect(d.k).toBe(1)
    const svg = svgParaDxf(d)
    const ancho = parseFloat(svg.match(/width="([\d.]+)cm"/)[1])
    // 9 m de franja (girada en la planta, va a lo alto) + los márgenes
    const alto = parseFloat(svg.match(/height="([\d.]+)cm"/)[1])
    expect(Math.max(ancho, alto)).toBeGreaterThan(900)
    const dxf = svgToDxf(svg, { scaleFactor: 1 })
    expect(dxf).toContain('SECTION')
    expect(/^[\x00-\x7F]*$/.test(dxf)).toBe(true)
  })
  it('la imagen es un SVG completo con fondo blanco', () => {
    const s = svgAsent(dibujoAsent(res, {}))
    expect(s.startsWith('<svg')).toBe(true)
    expect(s).toContain('fill="#fff"')
  })
})

describe('3.12 · memoria PDF y proyecto', () => {
  it('la memoria PDF se arma con las revisiones y cada sección', async () => {
    const doc = await memoriaAsentPdf(res, { projectName: 'CH-26-901 (ficticio)' })
    expect(doc.getNumberOfPages()).toBeGreaterThanOrEqual(2)
  })
  it('los datos viajan en el proyecto y vuelven igual', () => {
    const st = useCimStore.getState()
    st.cargar({ cimientos: [zc] })
    st.setAsent(datos)
    const p = st.empacar()
    expect(p.asent.modelo).toBe('elastico')
    st.cargar({})
    expect(useCimStore.getState().asent).toEqual({})
    st.cargar(p)
    expect(useCimStore.getState().asent).toEqual(datos)
  })
  it('un proyecto sin datos de asentamientos no cambia al guardarse', () => {
    useCimStore.getState().cargar({ cimientos: [zc] })
    expect(Object.keys(useCimStore.getState().empacar())).toEqual(['cimientos', 'suelo', 'criterios', 'linderos'])
  })
})
