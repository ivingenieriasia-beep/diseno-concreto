import { describe, it, expect } from 'vitest'
import { MARCA, MARCAS, deMarca, rgbDe, enPdf } from '../src/core/marca'

describe('marca', () => {
  it('sin VITE_MARCA la app es la de IV, como siempre', () => {
    expect(MARCA.id).toBe('iv')
    expect(MARCA.app).toBe('Auxiliar IV')
    expect(MARCA.carpeta).toBe('Auxiliar IV')
  })

  it('con IV los textos no se tocan', () => {
    const t = 'Auxiliar IV · IV Ingenierías · crear-proyectoiv.bat'
    expect(deMarca(t)).toBe(t)
  })

  it('con SOGRUB se cambian nombre, empresa y carpeta, no los formatos', () => {
    const s = MARCAS.sogrub
    const t = deMarca('# Generado por Auxiliar IV para IV Ingenierías · PROCESO\\Auxiliar IV · "formato": "auxiliar-iv/ram"', s)
    expect(t).toBe('# Generado por Auxiliar SOGRUB para SOGRUB Grupo Constructor · PROCESO\\Auxiliar SOGRUB · "formato": "auxiliar-iv/ram"')
    expect(deMarca('IV INGENIERÍAS', s)).toBe(s.empresaMayus)
  })

  it('el logo de SOGRUB es un SVG del mismo marco que el de IV', () => {
    for (const m of Object.values(MARCAS)) expect(m.logo).toMatch(/^<svg [^>]*viewBox="0 0 200 170"/)
  })

  it('ayudas para jsPDF', () => {
    expect(rgbDe('#b0643f')).toEqual([176, 100, 63])
    expect(enPdf('Ingenierías · NTC')).toBe('Ingenierias - NTC')
  })
})
