import { describe, it, expect } from 'vitest'
import { seccionEnRam, generarAplicarAgrupacion } from '../src/core/ramScript.js'
import { SECCIONES_RAM } from '../src/core/catalogoRam.js'

// Las secciones de una obra que usa los nombres del grupo IV, como las trae
// modelo.json → secciones (las escribe sincronizar.py desde las tablas de RAM).
const IV = {
  'IVCol 15x15cm': { b: 15, h: 15, s: 3, tipo: 'columna' },
  'IVTrabe 15x20cm': { b: 15, h: 20, s: 3, tipo: 'viga' },
  'IVCad 15x15cm': { b: 15, h: 15, s: 3, tipo: 'viga' },
  'IVTrabe 15x15cm': { b: 15, h: 15, s: 3, tipo: 'viga' },
}
const sec = (b, h, tipo = 'viga') => SECCIONES_RAM.find((s) => s.b === b && s.h === h && s.tipo === tipo)
const datosDe = (r) => JSON.parse(r.texto.match(/^AGRUPACION = (\{[\s\S]*?\n\})\n/m)[1])

describe('nombres de sección del RAM de la obra', () => {
  it('toma la sección de RAM con las mismas medidas y el mismo tipo', () => {
    expect(seccionEnRam(sec(15, 20), IV)).toEqual({ nombre: 'IVTrabe 15x20cm', enRam: true })
    expect(seccionEnRam(sec(15, 15, 'columna'), IV)).toEqual({ nombre: 'IVCol 15x15cm', enRam: true })
  })

  it('con dos de las mismas medidas, la que ya usa la mayoría del grupo: una cadena sigue siendo cadena', () => {
    expect(seccionEnRam(sec(15, 15), IV, ['IVCad 15x15cm', 'IVCad 15x15cm', 'IVTrabe 15x15cm']).nombre).toBe('IVCad 15x15cm')
    expect(seccionEnRam(sec(15, 15), IV, ['IVTrabe 15x15cm']).nombre).toBe('IVTrabe 15x15cm')
  })

  it('si RAM no tiene esas medidas, deja el nombre de la app y avisa', () => {
    expect(seccionEnRam(sec(20, 40), IV)).toEqual({ nombre: '20 X 40', enRam: false })
  })

  it('sin tabla de secciones (modelo.json de antes) no cambia nada', () => {
    expect(seccionEnRam(sec(15, 20), {})).toEqual({ nombre: '15 X 20', enRam: true })
  })

  it('el aplicar_agrupacion.py escribe los nombres de la obra', () => {
    const P = {
      nombre: 'Manual',
      grupos: [
        { nombre: 'T-1', sec: sec(15, 20), miembros: ['1', '2'] },
        { nombre: 'D-1', sec: sec(15, 15), miembros: ['3', '4'] },
        { nombre: 'C-1', sec: sec(15, 15, 'columna'), miembros: ['5'] },
      ],
    }
    const seccionDe = { 1: 'IVTrabe 15x20cm', 2: 'IVTrabe 15x20cm', 3: 'IVCad 15x15cm', 4: 'IVCad 15x15cm', 5: 'IVCol 15x15cm' }
    const r = generarAplicarAgrupacion(P, { seccionesRam: IV, seccionDe })
    expect(r.ok).toBe(true)
    expect(r.aviso).toBe('')
    expect(datosDe(r).grupos.map((g) => g.seccion)).toEqual(['IVTrabe 15x20cm', 'IVCad 15x15cm', 'IVCol 15x15cm'])

    const falta = generarAplicarAgrupacion({ nombre: 'x', grupos: [{ nombre: 'T-9', sec: sec(20, 40), miembros: ['9'] }] }, { seccionesRam: IV })
    expect(falta.faltan).toEqual(['T-9 (20×40)'])
    expect(falta.aviso).toMatch(/se detendrá sin tocar nada/)
    expect(datosDe(falta).grupos[0].seccion).toBe('20 X 40')
  })
})
