import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  initLoadsLibrary, resetLoadsLibrary, getLibrary, onLibraryChange,
  guardarMaterial, guardarComponente, borrarMaterial, borrarComponente,
  guardarPlantillaLosa, guardarPlantillaMuro, borrarPlantilla, restaurar,
  instanciarLosa, instanciarMuro, duplicarLosa, losaVacia, muroVacio, capaVacia, tableroVacio,
  exportLibrary, importLibrary,
} from '../src/core/loadsLibrary'
import { PLANTILLAS_LOSA, MATERIALES } from '../src/core/loadsCatalog'
import { cargaMuerta } from '../src/core/loads'

function memStorage() {
  let m = new Map()
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => { m.set(k, String(v)) },
    removeItem: (k) => { m.delete(k) },
    clear: () => { m = new Map() },
  }
}

beforeEach(() => {
  vi.stubGlobal('localStorage', memStorage())
  resetLoadsLibrary()
})

describe('biblioteca de fábrica', () => {
  it('arranca con el catálogo completo', () => {
    const lib = getLibrary()
    expect(lib.plantillasLosa).toHaveLength(PLANTILLAS_LOSA.length)
    expect(lib.materiales).toHaveLength(MATERIALES.length)
    expect(lib.plantillasLosa.every((p) => p.origen === 'fabrica')).toBe(true)
  })
  it('lo guardado se recupera al volver a arrancar', () => {
    guardarMaterial({ nombre: 'Tezontle', gamma: 1250 })
    initLoadsLibrary()
    expect(getLibrary().materiales.find((m) => m.nombre === 'Tezontle')?.gamma).toBe(1250)
  })
  it('un localStorage ilegible no tumba el arranque', () => {
    localStorage.setItem('iv_loads_lib_v1', '{roto')
    expect(() => initLoadsLibrary()).not.toThrow()
    expect(getLibrary().plantillasLosa.length).toBeGreaterThan(0)
  })
  it('avisa a quien esté escuchando', () => {
    const espia = vi.fn()
    const off = onLibraryChange(espia)
    guardarMaterial({ nombre: 'Tepetate', gamma: 1600 })
    expect(espia).toHaveBeenCalled()
    off()
    guardarMaterial({ nombre: 'Otro', gamma: 1 })
    expect(espia).toHaveBeenCalledTimes(1)
  })
})

describe('materiales y componentes', () => {
  it('un material tuyo con el nombre de uno de fábrica lo corrige', () => {
    guardarMaterial({ nombre: 'Concreto', gamma: 2500 })
    const mats = getLibrary().materiales.filter((m) => m.nombre === 'Concreto')
    expect(mats).toHaveLength(1)
    expect(mats[0]).toMatchObject({ gamma: 2500, origen: 'usuario' })
  })
  it('sin nombre no se guarda', () => {
    expect(guardarMaterial({ nombre: '  ', gamma: 100 })).toBe(false)
    expect(guardarComponente({ nombre: '', W: 10 })).toBe(false)
  })
  it('borrar uno tuyo lo quita; borrar uno de fábrica lo oculta', () => {
    guardarMaterial({ nombre: 'Tezontle', gamma: 1250 })
    borrarMaterial('Tezontle')
    expect(getLibrary().materiales.some((m) => m.nombre === 'Tezontle')).toBe(false)

    borrarMaterial('Yeso')
    expect(getLibrary().materiales.some((m) => m.nombre === 'Yeso')).toBe(false)
    expect(getLibrary().ocultas).toContain('Yeso')
    restaurar('Yeso')
    expect(getLibrary().materiales.some((m) => m.nombre === 'Yeso')).toBe(true)
  })
  it('lo mismo con los componentes de peso directo', () => {
    guardarComponente({ nombre: 'Panel solar', W: 18 })
    expect(getLibrary().componentes.find((c) => c.nombre === 'Panel solar')?.W).toBe(18)
    borrarComponente('Panel solar')
    expect(getLibrary().componentes.some((c) => c.nombre === 'Panel solar')).toBe(false)
  })
})

describe('plantillas', () => {
  it('una losa del proyecto se guarda como plantilla con sus capas', () => {
    const losa = instanciarLosa(PLANTILLAS_LOSA[0])
    losa.nombre = 'Azotea del proyecto X'
    const p = guardarPlantillaLosa(losa)
    const guardada = getLibrary().plantillasLosa.find((x) => x.id === p.id)
    expect(guardada.nombre).toBe('Azotea del proyecto X')
    expect(guardada.origen).toBe('usuario')
    expect(cargaMuerta(guardada.capas).total).toBeCloseTo(579.5, 6)
  })
  it('guardar con el mismo id sustituye, no duplica', () => {
    const losa = instanciarLosa(PLANTILLAS_LOSA[0])
    const p = guardarPlantillaLosa(losa)
    guardarPlantillaLosa({ ...losa, nombre: 'Corregida' }, { id: p.id })
    const iguales = getLibrary().plantillasLosa.filter((x) => x.id === p.id)
    expect(iguales).toHaveLength(1)
    expect(iguales[0].nombre).toBe('Corregida')
  })
  it('borrar una de fábrica sólo la oculta y se puede restaurar', () => {
    const id = PLANTILLAS_LOSA[0].id
    borrarPlantilla(id)
    expect(getLibrary().plantillasLosa.some((p) => p.id === id)).toBe(false)
    restaurar(id)
    expect(getLibrary().plantillasLosa.some((p) => p.id === id)).toBe(true)
  })
  it('los muros también se guardan con sus alturas', () => {
    const m = muroVacio('Muro de prueba')
    m.alturas = [{ id: 'h1', nombre: 'Pretil', h: 0.9 }]
    const p = guardarPlantillaMuro(m)
    expect(getLibrary().plantillasMuro.find((x) => x.id === p.id).alturas[0].h).toBe(0.9)
  })
})

describe('instanciar en el proyecto', () => {
  it('la copia trae ids propios y no comparte capas con la plantilla', () => {
    const plantilla = PLANTILLAS_LOSA[0]
    const a = instanciarLosa(plantilla)
    const b = instanciarLosa(plantilla)
    expect(a.id).not.toBe(b.id)
    expect(a.capas[0].id).not.toBe(b.capas[0].id)
    a.capas[0].t = 0.99
    expect(plantilla.capas[0].t).toBe(0.15)
    expect(b.capas[0].t).toBe(0.15)
  })
  it('la copia apunta a su plantilla y arranca con todas las capas contando', () => {
    const a = instanciarLosa(PLANTILLAS_LOSA[0])
    expect(a.plantillaId).toBe(PLANTILLAS_LOSA[0].id)
    expect(a.capas.every((c) => c.activa)).toBe(true)
    expect(a.cv.uso).toBe(PLANTILLAS_LOSA[0].uso)
  })
  it('duplicar una losa da otra igual con nombre distinto', () => {
    const a = instanciarLosa(PLANTILLAS_LOSA[2])
    const b = duplicarLosa(a)
    expect(b.id).not.toBe(a.id)
    expect(b.nombre).toBe(`${a.nombre} (variante)`)
    expect(cargaMuerta(b.capas).total).toBeCloseTo(cargaMuerta(a.capas).total, 9)
    b.capas[0].t = 0.5
    expect(a.capas[0].t).toBe(0.15)
  })
  it('los muros se copian igual de aislados', () => {
    const m = instanciarMuro({ id: 'x', nombre: 'M', capas: [{ nombre: 'a', modo: 'directo', W: 10 }], alturas: [{ nombre: 'h', h: 3 }] })
    expect(m.capas[0].id).toBeTruthy()
    expect(m.alturas[0].id).toBeTruthy()
  })
  it('las piezas en blanco salen con lo mínimo', () => {
    expect(losaVacia().capas).toEqual([])
    expect(capaVacia('espesor')).toMatchObject({ modo: 'espesor', activa: true })
    expect(capaVacia('lineal')).toMatchObject({ modo: 'lineal' })
    expect(capaVacia('directo')).toMatchObject({ modo: 'directo' })
    expect(tableroVacio()).toMatchObject({ metodo: 'tributaria', direccion: 'auto', casoCV: 'Wm' })
  })
})

describe('import / export', () => {
  it('lo exportado se vuelve a importar tal cual', () => {
    guardarMaterial({ nombre: 'Tezontle', gamma: 1250 })
    guardarPlantillaLosa(instanciarLosa(PLANTILLAS_LOSA[0]))
    const json = exportLibrary()

    resetLoadsLibrary()
    expect(getLibrary().materiales.some((m) => m.nombre === 'Tezontle')).toBe(false)

    const res = importLibrary(json)
    expect(res.ok).toBe(true)
    expect(res.contadas.materiales).toBe(1)
    expect(getLibrary().materiales.find((m) => m.nombre === 'Tezontle')?.gamma).toBe(1250)
  })
  it('al unir, lo que llega pisa lo que ya había', () => {
    guardarMaterial({ nombre: 'Concreto', gamma: 2400 })
    importLibrary(JSON.stringify({ tipo: 'auxiliar-iv-biblioteca-cargas', materiales: [{ nombre: 'Concreto', gamma: 2500 }] }))
    const c = getLibrary().materiales.filter((m) => m.nombre === 'Concreto')
    expect(c).toHaveLength(1)
    expect(c[0].gamma).toBe(2500)
  })
  it('en modo reemplazo se tira lo anterior', () => {
    guardarMaterial({ nombre: 'Tezontle', gamma: 1250 })
    importLibrary(JSON.stringify({ tipo: 'auxiliar-iv-biblioteca-cargas', materiales: [{ nombre: 'Arenilla', gamma: 1600 }] }), { modo: 'replace' })
    expect(getLibrary().materiales.some((m) => m.nombre === 'Tezontle')).toBe(false)
    expect(getLibrary().materiales.some((m) => m.nombre === 'Arenilla')).toBe(true)
  })
  it('rechaza lo que no es una biblioteca', () => {
    expect(importLibrary('no es json').ok).toBe(false)
    expect(importLibrary(JSON.stringify({ tipo: 'otra-cosa' })).ok).toBe(false)
    expect(importLibrary(JSON.stringify({ tipo: 'otra-cosa' })).error).toMatch(/no es una biblioteca/)
  })
  it('un json sin listas no rompe nada', () => {
    const res = importLibrary(JSON.stringify({ tipo: 'auxiliar-iv-biblioteca-cargas', materiales: 'x' }))
    expect(res.ok).toBe(true)
    expect(getLibrary().materiales.length).toBe(MATERIALES.length)
  })
})
