import { describe, it, expect } from 'vitest'
import { MARCA, MARCAS, deMarca, rgbDe, enPdf, firmante } from '../src/core/marca'

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
    expect(t).toBe('# Generado por SOGRUB Concreto para Grupo Constructor SOGRUB · PROCESO\\SOGRUB Concreto · "formato": "auxiliar-iv/ram"')
    expect(deMarca('IV INGENIERÍAS', s)).toBe(s.empresaMayus)
  })

  it('la marca SOGRUB es la aprobada el 25-oct: nombre, colores, pie y firma', () => {
    const s = MARCAS.sogrub
    expect(s.app).toBe('SOGRUB Concreto')
    expect(s.nombreCorto).toBe('Concreto')
    expect(s.empresa).toBe('Grupo Constructor SOGRUB')
    expect(s.carpeta).toBe('SOGRUB Concreto')
    expect(s.acento).toBe('#1A9DD9')
    expect(s.acentoTexto).toBe('#0F6E9C')
    expect(s.tinta).toBe('#29235C')
    expect(s.pie).toBe('Grupo Constructor SOGRUB, S.A.S. de C.V. · Tel. 442 385 5912')
    expect(s.responsable).toBe('Ing. Fernando Burgos')
    // el logo es el del kit (azul claro y marino), no el café de antes
    expect(s.logo).toContain('#1A9DD9')
    expect(s.logo).toContain('#29235C')
    expect(JSON.stringify(s)).not.toMatch(/b0643f|IV Ingenier/i)
    // al menos 30 mm (≈113 px) en las memorias
    expect(s.logoAncho).toBeGreaterThanOrEqual(113)
    expect(s.logoCorto).toMatch(/^<svg /)
  })

  it('el logo de IV sigue siendo el de siempre', () => {
    expect(MARCAS.iv.logo).toMatch(/^<svg [^>]*viewBox="0 0 200 170"/)
    expect(MARCAS.iv.logoAncho).toBe(48)
    expect(MARCAS.iv.pie).toBe(MARCAS.iv.empresa)
  })

  it('firmante: el capturado con «Ing.»; si no, el de la marca o un renglón en blanco', () => {
    expect(firmante('Ana Pérez', MARCAS.sogrub)).toBe('Ing. Ana Pérez')
    expect(firmante('', MARCAS.sogrub)).toBe('Ing. Fernando Burgos')
    expect(firmante('', MARCAS.iv)).toBe('Ing. ________________________')
  })

  it('ayudas para jsPDF', () => {
    expect(rgbDe('#1A9DD9')).toEqual([26, 157, 217])
    expect(enPdf('Ingenierías · NTC')).toBe('Ingenierias - NTC')
  })
})
