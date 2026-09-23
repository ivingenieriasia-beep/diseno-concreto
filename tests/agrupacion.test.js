import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { parseModeloRam } from '../src/core/ramModel.js'
import {
  inventario, elementos, candidatas, capacidad, aprovechamiento, seccionMinima,
  proponerAgrupacion, verificarGrupo, UMBRALES,
} from '../src/core/agrupacion.js'
import { generarAplicarAgrupacion } from '../src/core/ramScript.js'
import { SECCIONES_RAM } from '../src/core/catalogoRam.js'

const here = dirname(fileURLToPath(import.meta.url))
const R = parseModeloRam(readFileSync(join(here, 'fixtures', 'modelo_ram.json'), 'utf-8'))

describe('qué agrupar', () => {
  it('sugiere las trabes y deja fuera las columnas', () => {
    const inv = inventario(R)
    const por = Object.fromEntries(inv.map((g) => [g.nombre, g]))
    for (const t of ['T5', 'T6', 'T4', 'T7']) expect(por[t]).toMatchObject({ tipo: 'trabe', sugerido: true })
    expect(por.C1).toMatchObject({ tipo: 'columna', sugerido: false })
  })

  it('una trabe continua es un solo elemento, aunque sus tramos sean varios miembros', () => {
    const els = elementos(R, ['T5', 'T6', 'T4', 'T7'])
    expect(els.length).toBeGreaterThan(0)
    expect(els.some((e) => e.miembros.length > 1)).toBe(true)
    for (const e of els) expect(e.Mu).toBeGreaterThan(0)
  })
})

describe('dimensionar', () => {
  it('más peralte, más momento', () => {
    expect(capacidad(20, 40).MR).toBeGreaterThan(capacidad(20, 30).MR)
    expect(capacidad(20, 30).MR).toBeGreaterThan(capacidad(15, 30).MR * 0.99)
  })

  it('en poco peralte, d/4 limita el cortante que se arma con estribos cómodos', () => {
    // 15×25: d/4 = 5.5 cm < 8 → no puede pasar de 1.1·√f'c·b·d en acero
    const bajo = capacidad(15, 25).Vr
    const alto = capacidad(15, 40).Vr
    expect(alto).toBeGreaterThan(bajo * 1.5)
  })

  it('la sección mínima pasa y la anterior del catálogo no', () => {
    const cands = candidatas()
    for (const e of elementos(R, ['T5', 'T6', 'T4', 'T7'])) {
      const { sec, fuera } = seccionMinima(e, cands)
      if (fuera) continue
      expect(aprovechamiento(e, sec)).toBeLessThanOrEqual(1 + 1e-9)
      const i = cands.indexOf(sec)
      for (const previa of cands.slice(0, i)) expect(aprovechamiento(e, previa)).toBeGreaterThan(1)
    }
  })

  it('sólo propone vigas del catálogo, y en los anchos permitidos', () => {
    expect(candidatas([20, 25]).every((s) => s.tipo === 'viga' && [20, 25].includes(s.b))).toBe(true)
    expect(candidatas().some((s) => s.b === 10)).toBe(false)
  })
})

describe('las tres propuestas', () => {
  const A = proponerAgrupacion(R, ['T5', 'T6', 'T4', 'T7'])
  const todos = A.elementos.flatMap((e) => e.miembros)

  it('bajar el umbral nunca da más grupos', () => {
    const n = A.propuestas.map((p) => p.grupos.length)
    expect(UMBRALES.map((u) => u.tau)).toEqual([0.5, 0.65, 0.8])
    expect(n[0]).toBeLessThanOrEqual(n[1])
    expect(n[1]).toBeLessThanOrEqual(n[2])
    expect(n[2]).toBeLessThanOrEqual(A.natural.grupos.length)
  })

  it('cada trabe cabe en la sección de su grupo, y cada miembro está una sola vez', () => {
    for (const P of A.propuestas) {
      for (const g of P.grupos) for (const e of g.elems) expect(aprovechamiento(e, g.sec)).toBeLessThanOrEqual(1 + 1e-9)
      const ms = P.grupos.flatMap((g) => g.miembros)
      expect(ms.length).toBe(todos.length)
      expect(new Set(ms).size).toBe(todos.length)
    }
  })

  it('juntar cuesta concreto: nunca menos que sin juntar nada', () => {
    for (const P of A.propuestas) expect(P.concreto).toBeGreaterThanOrEqual(A.natural.concreto - 1e-9)
  })

  it('lo que propone lo aprueba la Fase 1', () => {
    for (const P of A.propuestas) {
      for (const g of P.grupos) {
        const v = verificarGrupo(R, g)
        expect(v).not.toBeNull()
        expect(v.estado).toBe('ok')
      }
    }
  })

  it('el aplicar_agrupacion.py lleva cada miembro, con ids enteros y secciones del catálogo', () => {
    const P = A.propuestas[1]
    const r = generarAplicarAgrupacion(P)
    expect(r.ok).toBe(true)
    const datos = JSON.parse(r.texto.match(/^AGRUPACION = (\{[\s\S]*?\n\})\n/m)[1])
    expect(datos.propuesta).toBe('Equilibrada')
    expect(datos.grupos.map((g) => g.descripcion)).toEqual(P.grupos.map((_, i) => `T${i + 1}`))
    const nombres = new Set(SECCIONES_RAM.map((s) => s.nombre))
    expect(datos.grupos.every((g) => nombres.has(g.seccion))).toBe(true)
    const ids = datos.grupos.flatMap((g) => g.miembros)
    expect(ids.every(Number.isInteger)).toBe(true)
    expect(ids.length).toBe(todos.length)
  })
})
