import { describe, it, expect, beforeEach } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import useCimStore from '../src/store/useCimStore'
import { packProject, isEmptyProject } from '../src/core/autosave'
import { MODULOS, conFijos, cargarAbiertos } from '../src/core/modules'
import { crearCim } from '../src/core/cim'
import { planosSvg } from '../src/core/cim/planos'
import { svgParaDxf } from '../src/core/cim/lienzo'
import { svgToDxf } from '../src/core/svgToDxf'
import { datosDeCargas, datosDeModelo, prellenado } from '../src/core/memoriaDatos'
import { parseModeloRam } from '../src/core/ramModel'

describe('pestaña fija', () => {
  it('Cimentaciones va siempre primero del lado de módulos y no se cierra', () => {
    expect(MODULOS[0].id).toBe('cimentaciones')
    expect(MODULOS[0].fijo).toBe(true)
    expect(conFijos(['pesos', 'longitudinal'])).toEqual(['cimentaciones', 'pesos', 'longitudinal'])
    expect(conFijos(['pesos', 'cimentaciones'])).toEqual(['cimentaciones', 'pesos'])
    localStorage.setItem('iv_modulos_abiertos_v1', JSON.stringify(['pesos']))
    expect(cargarAbiertos()[0]).toBe('cimentaciones')
  })
})

describe('store de cimentaciones', () => {
  beforeEach(() => useCimStore.getState().cargar({}))
  it('agregar, actualizar por nivel y deshacer', () => {
    const S = useCimStore.getState
    const z = S().agregar('aislada')
    expect(S().cimientos).toHaveLength(1)
    S().actualizar(z.uid, { geo: { B: 2 } })
    expect(S().cimientos[0].geo.B).toBe(2)
    expect(S().cimientos[0].geo.h).toBe(z.geo.h)         // el resto de geo se queda
    S().deshacer()
    expect(S().cimientos[0].geo.B).toBe(z.geo.B)
    S().deshacer()
    expect(S().cimientos).toHaveLength(0)
  })
  it('duplicar da un nombre nuevo; borrar selecciona el vecino', () => {
    const S = useCimStore.getState
    const a = S().agregar('aislada'); const b = S().duplicar(a.uid)
    expect(b.nombre).toBe('Z-2')
    S().borrar(b.uid)
    expect(S().selUid).toBe(a.uid)
  })
  it('viaja en el proyecto y cuenta para no darlo por vacío', () => {
    const S = useCimStore.getState
    S().agregar('corrida'); S().setSuelo({ qadm: 12 })
    const p = packProject({ cimentacion: S().empacar() })
    expect(p.cimentacion.cimientos).toHaveLength(1)
    expect(p.cimentacion.suelo.qadm).toBe(12)
    expect(isEmptyProject(p)).toBe(false)
    S().cargar({})
    S().cargar(p.cimentacion)
    expect(S().cimientos[0].tipo).toBe('corrida')
  })
})

describe('planos a DXF', () => {
  it('todos los tipos apilados, a escala real (1 cm del modelo = 1 cm del dibujo)', () => {
    const lista = ['aislada', 'corrida', 'contratrabe', 'contencion', 'gravedad', 'mamposteria', 'liga'].map((t) => crearCim(t, [], {}))
    const P = planosSvg(lista, {})
    const svg = svgParaDxf(P)
    expect(svg).toMatch(/width="[\d.]+cm"/)
    expect(svg).not.toContain('clipPath')
    const dxf = svgToDxf(svg, { scaleFactor: 1 })
    expect(dxf).toContain('SECTION')
    expect((dxf.match(/\nLINE\n/g) || []).length).toBeGreaterThan(100)
    // los textos con acentos y «·» ya no salen como «?»
    expect(dxf).not.toMatch(/\?/)
    expect(/^[\x00-\x7F]*$/.test(dxf)).toBe(true)
    expect(dxf).toMatch(/c\\U\+00E9ntrica|\\U\+00F3n/)
  })
})

describe('datos de la memoria', () => {
  it('de Pesos Unitarios: cargas de losa y muro y el área de los tableros', () => {
    const losas = [
      { tipo: 'entrepiso', capas: [{ modo: 'directo', W: 236.5, activa: true }], cv: { uso: 'Habitacional', manual: true, W: 190, Wa: 100, Wm: 190 } },
      { tipo: 'azotea', capas: [{ modo: 'directo', W: 300, activa: true }], cv: { manual: true, W: 100, Wa: 70, Wm: 100 } },
    ]
    const muros = [{ capas: [{ modo: 'directo', W: 249.4, activa: true }] }]
    const tableros = [{ a1: 4, a2: 5, nivel: 'N1' }, { a1: 3, a2: 5, nivel: 'N2' }]
    const r = datosDeCargas({ losas, muros, tableros })
    expect(r.valores).toMatchObject({ cmEntrepiso: '236.5', cvEntrepiso: '190', cvAzotea: '100', cmMuro: '249.4', area: '35', niveles: '2' })
  })
  it('del modelo de RAM: niveles y altura de entrepiso', () => {
    const R = parseModeloRam(readFileSync(resolve(process.cwd(), 'tests/fixtures/modelo_cimentacion.json'), 'utf8'), 'modelo.json')
    const m = datosDeModelo(R)
    expect(m.valores.niveles).toBe('3')
    expect(m.valores.hEntrepiso).toBe('3.00')
    expect(+m.valores.area).toBeGreaterThan(100)
    const p = prellenado({ losas: [], muros: [], tableros: [] }, R)
    expect(p.fuente.niveles).toBe('modelo de RAM')
  })
})
