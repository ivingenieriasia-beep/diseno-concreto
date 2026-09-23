import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { parseGeometryReport } from '../src/core/geometry.js'
import { detectUpAxis, planAxes, levels, memberKind, projectPoint, projectModel, modelStats, memberToChain } from '../src/core/modelView.js'

const here = dirname(fileURLToPath(import.meta.url))
const JOF = parseGeometryReport(readFileSync(join(here, 'fixtures', 'geometria_jofrito.txt'), 'utf-8'))

describe('reconstrucción del modelo', () => {
  it('detecta el eje vertical por los niveles del edificio (Y en RAM Elements)', () => {
    expect(detectUpAxis(JOF.nodes)).toBe('y')
    expect(planAxes('y')).toEqual(['x', 'z'])
    // un modelo con Z vertical se detecta igual
    const zUp = new Map([['1', { x: 0, y: 0, z: 0 }], ['2', { x: 5, y: 3, z: 0 }], ['3', { x: 9, y: 7, z: 0 }], ['4', { x: 1, y: 2, z: 0 }]])
    expect(detectUpAxis(zUp)).toBe('z')
  })
  it('agrupa los nudos en niveles', () => {
    expect(levels(JOF.nodes, 'y').map((l) => l.v)).toEqual([0, 3, 5.8, 8.6, 11.4])
  })
  it('clasifica columnas, trabes y diagonales', () => {
    const a = { x: 0, y: 0, z: 0 }
    expect(memberKind(a, { x: 0, y: 3, z: 0 }, 'y')).toBe('columna')
    expect(memberKind(a, { x: 4, y: 0, z: 0 }, 'y')).toBe('trabe')
    expect(memberKind(a, { x: 4, y: 3, z: 0 }, 'y')).toBe('diagonal')
    expect(memberKind(a, { x: 0, y: 0, z: 0 }, 'y')).toBe('nulo')
  })
  it('cuenta lo que entendió del modelo real', () => {
    const st = modelStats(JOF.nodes, JOF.rows)
    expect(st).toMatchObject({ up: 'y', nNodos: 887, nMiembros: 1448, sinNudos: 0 })
    expect(st.porTipo.columna).toBe(96)
    expect(st.porTipo.trabe).toBe(1312)
    expect(st.secciones[0]).toEqual(['RcBeam 10x25', 1153])
  })
  it('proyecta en planta, elevación e isométrica de forma consistente', () => {
    const n = { x: 2, y: 3, z: 5 }
    expect(projectPoint(n, 'planta', 'y')).toEqual([-5, 2])     // Z a la izquierda, X hacia abajo: como RAM
    expect(projectPoint(n, 'frente', 'y')).toEqual([2, -3])
    expect(projectPoint(n, 'lado', 'y')).toEqual([5, -3])
    const [ix, iy] = projectPoint(n, 'iso', 'y')
    expect(ix).toBeCloseTo((2 - 5) * Math.cos(Math.PI / 6), 6)
    expect(iy).toBeCloseTo((2 + 5) * 0.5 - 3, 6)
  })
  it('proyecta el modelo completo y acota el dibujo', () => {
    const p = projectModel(JOF.nodes, JOF.rows, { vista: 'planta' })
    expect(p.segs).toHaveLength(1448)
    expect(p.up).toBe('y')
    expect(p.bounds.w).toBeCloseTo(10.56, 1)
    expect(p.bounds.h).toBeCloseTo(18.61, 1)
    const s = p.segs[0]
    expect(s).toMatchObject({ id: '10', seccion: 'RcBeam 15X25', kind: 'trabe' })
    expect(s.len).toBeCloseTo(5.92, 2)
  })
  it('filtra por nivel', () => {
    const todo = projectModel(JOF.nodes, JOF.rows, { vista: 'planta' }).segs.length
    const n3 = projectModel(JOF.nodes, JOF.rows, { vista: 'planta', nivel: 3 }).segs.length
    const n11 = projectModel(JOF.nodes, JOF.rows, { vista: 'planta', nivel: 11.4 }).segs.length
    expect(n3).toBeLessThan(todo)
    expect(n3).toBeGreaterThan(n11)
    expect(n3 + n11).toBeLessThanOrEqual(todo + n3) // los niveles comparten columnas
  })
  it('sin nudos no truena: devuelve un encuadre válido', () => {
    const p = projectModel(new Map(), JOF.rows, { vista: 'iso' })
    expect(p.segs).toHaveLength(0)
    expect(p.bounds.w).toBeGreaterThan(0)
  })
  it('memberToChain mapea cada tramo a su elemento', () => {
    const m = memberToChain([{ id: 'A', members: [{ id: 1 }, { id: 2 }] }, { id: 'B', members: [{ id: 3 }] }])
    expect(m.get('1')).toBe('A')
    expect(m.get('3')).toBe('B')
    expect(m.size).toBe(3)
  })
})
