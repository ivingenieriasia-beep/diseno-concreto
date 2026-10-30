import { describe, it, expect } from 'vitest'
import { MARCA, MARCAS, rgbDe, enPdf, firmante } from '../src/core/marca'

describe('marca', () => {
  it('la app es la de IV', () => {
    expect(Object.keys(MARCAS)).toEqual(['iv'])
    expect(MARCA.id).toBe('iv')
    expect(MARCA.app).toBe('Auxiliar IV')
    expect(MARCA.carpeta).toBe('Auxiliar IV')
  })

  it('el logo de IV sigue siendo el de siempre', () => {
    expect(MARCA.logo).toMatch(/^<svg [^>]*viewBox="0 0 200 170"/)
    expect(MARCA.logoAncho).toBe(48)
    expect(MARCA.pie).toBe(MARCA.empresa)
  })

  it('firmante: el capturado con «Ing.»; si no, un renglón en blanco', () => {
    expect(firmante('Ana Pérez')).toBe('Ing. Ana Pérez')
    expect(firmante('  ')).toBe('Ing. ________________________')
    expect(firmante(undefined)).toBe('Ing. ________________________')
  })

  it('ayudas para jsPDF', () => {
    expect(rgbDe('#1A9DD9')).toEqual([26, 157, 217])
    expect(enPdf('Ingenierías · NTC')).toBe('Ingenierias - NTC')
  })
})
