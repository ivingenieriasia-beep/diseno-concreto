import { describe, it, expect, beforeEach, vi } from 'vitest'
import useLoadsStore from '../src/store/useLoadsStore'
import { PLANTILLAS_LOSA, PLANTILLAS_MURO } from '../src/core/loadsCatalog'
import { cargaMuerta, resumenLosa, analizarTablero } from '../src/core/loads'

const S = () => useLoadsStore.getState()

beforeEach(() => {
  vi.stubGlobal('localStorage', {
    getItem: () => null, setItem: () => {}, removeItem: () => {},
  })
  S().loadCargas({})
})

describe('losas del proyecto', () => {
  it('una plantilla se copia al proyecto y queda seleccionada', () => {
    S().addLosa(PLANTILLAS_LOSA[0])
    expect(S().losas).toHaveLength(1)
    expect(S().losaSel).toBe(S().losas[0].id)
    expect(cargaMuerta(S().losas[0].capas).total).toBeCloseTo(579.5, 6)
  })
  it('editar la copia no toca la plantilla', () => {
    S().addLosa(PLANTILLAS_LOSA[2])
    const l = S().losas[0]
    S().updateCapa(l.id, l.capas[0].id, { t: 0.25 })
    expect(cargaMuerta(S().losas[0].capas).total).toBeCloseTo(662.5, 6)
    expect(PLANTILLAS_LOSA[2].capas[0].t).toBe(0.15)
  })
  it('dos losas del mismo tipo llevan componentes distintos sin estorbarse', () => {
    S().addLosa(PLANTILLAS_LOSA[2])
    S().addLosa(PLANTILLAS_LOSA[2])
    const [a, b] = S().losas
    S().addCapa(a.id, { modo: 'directo', nombre: 'Muro divisorio', W: 100 })
    S().removeCapa(b.id, b.capas[1].id) // le quitamos el yeso a la segunda
    expect(cargaMuerta(S().losas[0].capas).total).toBeCloseTo(522.5, 6)
    expect(cargaMuerta(S().losas[1].capas).total).toBeCloseTo(400, 6)
  })
  it('una capa apagada deja de contar pero sigue en la lista', () => {
    S().addLosa(PLANTILLAS_LOSA[2])
    const l = S().losas[0]
    S().updateCapa(l.id, l.capas[0].id, { activa: false })
    expect(S().losas[0].capas).toHaveLength(5)
    expect(cargaMuerta(S().losas[0].capas).total).toBeCloseTo(62.5, 6)
  })
  it('las capas se reordenan y no se salen del arreglo', () => {
    S().addLosa(PLANTILLAS_LOSA[2])
    const l = S().losas[0]
    const segunda = l.capas[1].id
    S().moverCapa(l.id, segunda, -1)
    expect(S().losas[0].capas[0].id).toBe(segunda)
    S().moverCapa(l.id, segunda, -1)   // ya está arriba: no pasa nada
    expect(S().losas[0].capas[0].id).toBe(segunda)
    const ultima = S().losas[0].capas.at(-1).id
    S().moverCapa(l.id, ultima, 1)
    expect(S().losas[0].capas.at(-1).id).toBe(ultima)
  })
  it('duplicar deja la variante justo después de la original', () => {
    S().addLosa(PLANTILLAS_LOSA[0])
    S().addLosa(PLANTILLAS_LOSA[2])
    const primera = S().losas[0]
    S().duplicarLosa(primera.id)
    expect(S().losas).toHaveLength(3)
    expect(S().losas[1].nombre).toBe(`${primera.nombre} (variante)`)
    expect(S().losaSel).toBe(S().losas[1].id)
  })
  it('la carga viva se cambia sin tocar las capas', () => {
    S().addLosa(PLANTILLAS_LOSA[2])
    const l = S().losas[0]
    S().updateCV(l.id, { uso: 'Comercios', wm: 500 })
    const r = resumenLosa(S().losas[0])
    expect(r.cv.Wm).toBe(500)
    expect(r.cv.W).toBeCloseTo(400, 6)
    expect(r.cm).toBeCloseTo(422.5, 6)
  })
})

describe('tableros', () => {
  it('el tablero nuevo toma la primera losa y se calcula solo', () => {
    S().addLosa(PLANTILLAS_LOSA[2])
    S().addTablero({ a1: 3.87, a2: 6.15 })
    const t = S().tableros[0]
    expect(t.losaId).toBe(S().losas[0].id)
    const a = analizarTablero(t, S().losas[0])
    expect(a.casos[0].wCorto).toBeCloseTo(408.76875, 9)
  })
  it('borrar la losa deja el tablero sin losa, no lo borra', () => {
    S().addLosa(PLANTILLAS_LOSA[2])
    S().addTablero({ a1: 4, a2: 6 })
    S().removeLosa(S().losas[0].id)
    expect(S().tableros).toHaveLength(1)
    expect(S().tableros[0].losaId).toBe(null)
  })
  it('borrar el muro sólo lo despega del tablero', () => {
    S().addMuro(PLANTILLAS_MURO[0])
    S().addTablero({ a1: 4, a2: 6, muroId: S().muros[0].id, muroH: 3 })
    S().removeMuro(S().muros[0].id)
    expect(S().tableros[0].muroId).toBe(null)
  })
  it('se duplican y se reordenan', () => {
    S().addLosa(PLANTILLAS_LOSA[2])
    S().addTablero({ nombre: 'A', a1: 4, a2: 6 })
    S().addTablero({ nombre: 'B', a1: 3, a2: 9 })
    S().duplicarTablero(S().tableros[0].id)
    expect(S().tableros.map((t) => t.nombre)).toEqual(['A', 'A (copia)', 'B'])
    S().moverTablero(S().tableros[2].id, -2)
    expect(S().tableros.map((t) => t.nombre)).toEqual(['B', 'A', 'A (copia)'])
  })
})

describe('muros', () => {
  it('se copian del catálogo con sus alturas', () => {
    S().addMuro(PLANTILLAS_MURO[2])
    expect(S().muros[0].alturas).toHaveLength(3)
    expect(S().muroSel).toBe(S().muros[0].id)
  })
  it('las alturas se añaden, se editan y se quitan', () => {
    S().addMuro(PLANTILLAS_MURO[0])
    const m = S().muros[0]
    S().addAltura(m.id)
    expect(S().muros[0].alturas).toHaveLength(2)
    const nueva = S().muros[0].alturas[1]
    S().updateAltura(m.id, nueva.id, { h: 2.5 })
    expect(S().muros[0].alturas[1].h).toBe(2.5)
    S().removeAltura(m.id, nueva.id)
    expect(S().muros[0].alturas).toHaveLength(1)
  })
  it('las capas del muro también se reordenan', () => {
    S().addMuro(PLANTILLAS_MURO[0])
    const m = S().muros[0]
    const segunda = m.capas[1].id
    S().moverCapaMuro(m.id, segunda, -1)
    expect(S().muros[0].capas[0].id).toBe(segunda)
  })
})

describe('proyecto', () => {
  it('lo empaquetado se vuelve a cargar igual', () => {
    S().addLosa(PLANTILLAS_LOSA[0])
    S().addMuro(PLANTILLAS_MURO[0])
    S().addTablero({ a1: 4, a2: 6 })
    S().setUnidad('ton')
    const pack = S().packCargas()

    S().limpiar()
    expect(S().losas).toHaveLength(0)

    S().loadCargas(pack)
    expect(S().losas).toHaveLength(1)
    expect(S().muros).toHaveLength(1)
    expect(S().tableros).toHaveLength(1)
    expect(S().unidad).toBe('ton')
    expect(S().losaSel).toBe(S().losas[0].id)
  })
  it('cargar un proyecto viejo sin cargas deja todo vacío', () => {
    S().addLosa(PLANTILLAS_LOSA[0])
    S().loadCargas({})
    expect(S().packCargas()).toEqual({ losas: [], muros: [], tableros: [], unidad: 'kg' })
  })
  it('a lo que venga sin id se le pone uno', () => {
    S().loadCargas({ losas: [{ nombre: 'De un json a mano', capas: [] }] })
    expect(S().losas[0].id).toBeTruthy()
  })
})
