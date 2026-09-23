import { describe, it, expect } from 'vitest'
import { estribosColumna, estribosDe, calcEstribos } from '../src/core/columnCalculator.js'

const L = (n, num) => ({ n, num })

describe('estribos de columna por zonas', () => {
  it('C-1 36×36 con 8#5: 18 al centro, 9 en extremos, 60 cm', () => {
    const e = estribosColumna({ b: 36, h: 36, estriboNum: '2.5', lechos: [L(3, '5'), L(2, '5'), L(3, '5')], H: 2.7 })
    // 850/√4200·1.59 = 20.9 · 48·0.794 = 38.1 · 36/2 = 18 → gobierna t/2
    expect(e.castillo).toBe(false)
    expect(e.sCen).toBe(18)
    expect(e.sExt).toBe(9)
    expect(e.lExt).toBe(60)
  })

  it('con varilla delgada gobierna 850/√fy·db', () => {
    // 40×40 con #4: 13.1·1.27 = 16.7 < 20 = t/2
    const e = estribosColumna({ b: 40, h: 40, estriboNum: '2.5', lechos: [L(3, '4'), L(2, '4'), L(3, '4')] })
    expect(e.sCen).toBe(16)
    expect(e.sExt).toBe(8)
  })

  it('una columna alta alarga la zona de extremo por H/6', () => {
    expect(estribosColumna({ b: 36, h: 36, estriboNum: '2.5', lechos: [L(2, '5'), L(2, '5')], H: 4.2 }).lExt).toBe(70)
    // sin altura no puede usar H/6: el mínimo de 60 cm o el lado mayor
    expect(estribosColumna({ b: 30, h: 70, estriboNum: '2.5', lechos: [L(2, '5'), L(2, '5')] }).lExt).toBe(70)
  })

  it('un castillo de 15×15 no se trata como columna de marco', () => {
    const e = estribosColumna({ b: 15, h: 15, estriboNum: '2.5', lechos: [L(2, '3'), L(2, '3')], H: 2.7 })
    // 1.5·15 = 22.5 y 20 cm → 20; con la regla de columna saldrían 7 y 3 cm
    expect(e.castillo).toBe(true)
    expect(e.sCen).toBe(20)
    expect(e.sExt).toBe(10)
  })
})

describe('los proyectos viejos no cambian', () => {
  it('sin zonas capturadas, la separación única de la hoja', () => {
    const col = { b: 36, h: 36, estriboNum: '2.5', lechos: [L(2, '4'), L(2, '4')] }
    const e = estribosDe(col)
    expect(e.zonas).toBe(false)
    expect(e.s).toBe(calcEstribos({ estriboNum: '2.5', longNum: '4', h: 36, b: 36 }).s)
    expect(e.texto).toBe(`E#2.5 @ ${e.s} cm`)
  })

  it('con zonas, las dos separaciones y la longitud', () => {
    const e = estribosDe({ b: 36, h: 36, estriboNum: '2.5', lechos: [], sepExt: 9, sepCen: 18, longExt: 60 })
    expect(e.zonas).toBe(true)
    expect(e.texto).toBe('E#2.5 @ 9 cm en extremos (60 cm) · @ 18 cm al centro')
    expect(e.corto).toBe('E#2.5 @9/18')
  })
})
