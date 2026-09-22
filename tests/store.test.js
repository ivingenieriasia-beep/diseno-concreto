import { describe, it, expect, beforeEach } from 'vitest'
import useBeamStore from '../src/store/useBeamStore.js'

const st = () => useBeamStore.getState()
const nombres = () => st().sections.map((s) => s.nombre)

describe('orden de las secciones', () => {
  beforeEach(() => {
    useBeamStore.setState({ sections: [], selectedIdx: -1 })
    st().loadProject([{ nombre: 'T-1' }, { nombre: 'T-2' }, { nombre: 'T-3' }, { nombre: 'T-4' }])
  })

  it('cada sección nace con un uid propio, y los proyectos viejos lo heredan al abrirse', () => {
    const uids = st().sections.map((s) => s.uid)
    expect(uids.every(Boolean)).toBe(true)
    expect(new Set(uids).size).toBe(4)
    st().createSection()
    expect(st().sections.at(-1).uid).toBeTruthy()
    expect(new Set(st().sections.map((s) => s.uid)).size).toBe(5)
  })

  it('mover una sección la reacomoda sin perder ninguna', () => {
    st().moveSection(0, 2)
    expect(nombres()).toEqual(['T-2', 'T-3', 'T-1', 'T-4'])
    st().moveSection(3, 0)
    expect(nombres()).toEqual(['T-4', 'T-2', 'T-3', 'T-1'])
    expect(st().sections).toHaveLength(4)
  })

  it('el uid viaja con la sección: es la identidad que usa el dibujo para animarse', () => {
    const uid = st().sections[1].uid
    st().moveSection(1, 3)
    expect(st().sections[3].uid).toBe(uid)
    expect(st().sections[3].nombre).toBe('T-2')
  })

  it('la selección sigue apuntando a la misma trabe, esté donde esté', () => {
    st().selectSection(1)                       // T-2
    st().moveSection(1, 3)                      // la arrastro al final
    expect(st().selectedIdx).toBe(3)
    expect(st().sections[st().selectedIdx].nombre).toBe('T-2')

    st().selectSection(2)                       // T-4 (tras el movimiento: T-1,T-3,T-4,T-2)
    const antes = st().sections[2].nombre
    st().moveSection(0, 3)                      // muevo otra por encima
    expect(st().sections[st().selectedIdx].nombre).toBe(antes)

    st().selectSection(3)
    const n3 = st().sections[3].nombre
    st().moveSection(3, 0)                      // muevo la seleccionada al inicio
    expect(st().selectedIdx).toBe(0)
    expect(st().sections[0].nombre).toBe(n3)
  })

  it('ignora movimientos imposibles', () => {
    const antes = nombres()
    st().moveSection(1, 1)
    st().moveSection(-1, 2)
    st().moveSection(0, 9)
    expect(nombres()).toEqual(antes)
  })
})
