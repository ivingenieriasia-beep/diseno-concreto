import { describe, it, expect } from 'vitest'
import {
  pesoCapa, cargaMuerta, cargaViva, resumenLosa, resumenMuro, cargaLinealMuro,
  repartoTablero, analizarTablero, filasRam, tablaRamCSV, num,
} from '../src/core/loads'
import { PLANTILLAS_LOSA, PLANTILLAS_MURO, buscarCargaViva } from '../src/core/loadsCatalog'

const plantilla = (id) => PLANTILLAS_LOSA.find((p) => p.id === id)
const muro = (id) => PLANTILLAS_MURO.find((p) => p.id === id)
const conCV = (id, uso) => ({ ...plantilla(id), cv: { uso: uso ?? plantilla(id).uso } })

describe('pesoCapa', () => {
  it('capa por espesor: t × γ', () => {
    expect(pesoCapa({ modo: 'espesor', t: 0.15, gamma: 2400 })).toBeCloseTo(360, 6)
  })
  it('capa de peso directo', () => {
    expect(pesoCapa({ modo: 'directo', W: 10 })).toBe(10)
  })
  it('capa lineal: long × peso/m ÷ área (largeros de la nave)', () => {
    expect(pesoCapa({ modo: 'lineal', long: 52, pesoML: 5.57, area: 50.5 })).toBeCloseTo(5.735445544554455, 9)
  })
  it('área cero no divide entre cero', () => {
    expect(pesoCapa({ modo: 'lineal', long: 52, pesoML: 5.57, area: 0 })).toBe(0)
  })
  it('una capa desactivada no pesa, pero sigue ahí', () => {
    expect(pesoCapa({ modo: 'espesor', t: 0.15, gamma: 2400, activa: false })).toBe(0)
  })
  it('acepta los strings que vienen de los campos', () => {
    expect(pesoCapa({ modo: 'espesor', t: '0,15', gamma: '2400' })).toBeCloseTo(360, 6)
    expect(num('')).toBe(0)
    expect(num('abc')).toBe(0)
  })
})

describe('carga muerta de las plantillas — valores del libro de Excel', () => {
  const esperado = {
    'azotea-maciza': 579.5,
    'charola-banos': 640,
    'entrepiso-maciza': 422.5,
    'losacero-ternium25': 323.06,
    'azotea-qualypanel': 405.75,
    'entrepiso-vigueta': 269.5,
    'azotea-vigueta': 299.5,
    'entrepiso-losacero22': 245,
    'losa-nervada': 300.5,
    'cubierta-naves': 30.009108910891086,
    'cubierta-lamina': 20,
  }
  for (const [id, cm] of Object.entries(esperado)) {
    it(`${id} → ${cm} kg/m²`, () => {
      expect(cargaMuerta(plantilla(id).capas).total).toBeCloseTo(cm, 6)
    })
  }
  it('el desglose trae una entrada por capa con su fórmula', () => {
    const { detalle } = cargaMuerta(plantilla('entrepiso-maciza').capas)
    expect(detalle).toHaveLength(5)
    expect(detalle[0].formula).toBe('0.15 m × 2400 kg/m³')
    expect(detalle[0].Wcalc).toBeCloseTo(360, 6)
  })
})

describe('carga viva', () => {
  it('toma los tres valores del catálogo', () => {
    expect(cargaViva({ uso: 'Oficinas' })).toMatchObject({ W: 100, Wa: 180, Wm: 250 })
    expect(cargaViva({ uso: 'Azoteas < 5%' })).toMatchObject({ W: 15, Wa: 70, Wm: 100 })
    expect(cargaViva({ uso: 'Azoteas ≥ 5%' })).toMatchObject({ W: 5, Wa: 20, Wm: 40 })
  })
  it('comercios y bodegas derivan W y Wa del Wm capturado', () => {
    const cv = cargaViva({ uso: 'Comercios', wm: 500 })
    expect(cv.libre).toBe(true)
    expect(cv.Wm).toBe(500)
    expect(cv.W).toBeCloseTo(400, 6)
    expect(cv.Wa).toBeCloseTo(450, 6)
  })
  it('sin Wm capturado usa el sugerido', () => {
    expect(cargaViva({ uso: 'Fábricas', wm: '' }).Wm).toBe(350)
  })
  it('el modo manual manda sobre el catálogo', () => {
    expect(cargaViva({ manual: true, W: 11, Wa: 22, Wm: 33 })).toMatchObject({ W: 11, Wa: 22, Wm: 33 })
  })
  it('un uso desconocido no rompe: marca faltante', () => {
    expect(cargaViva({ uso: 'Invento' })).toMatchObject({ W: 0, Wa: 0, Wm: 0, faltante: true })
  })
  it('el catálogo se consulta por nombre exacto', () => {
    expect(buscarCargaViva('Bibliotecas').Wm).toBe(350)
    expect(buscarCargaViva('no existe')).toBe(null)
  })
})

describe('resumenLosa', () => {
  it('suma carga muerta + cada caso de carga viva', () => {
    const r = resumenLosa(conCV('entrepiso-maciza', 'Oficinas'))
    expect(r.cm).toBeCloseTo(422.5, 6)
    expect(r.total.Wm).toBeCloseTo(672.5, 6)
    expect(r.total.W).toBeCloseTo(522.5, 6)
  })
})

describe('muros', () => {
  it('block macizo de 15: 312.9 + 0.02×2100 = 354.9 kg/m²', () => {
    expect(resumenMuro(muro('block-macizo-15')).W).toBeCloseTo(354.9, 6)
  })
  it('block macizo de 12 → 291.4 kg/m²', () => {
    expect(resumenMuro(muro('block-macizo-12')).W).toBeCloseTo(291.4, 6)
  })
  it('pretil de aircrete: 117 kg/m² y 70.2 kg/m a 0.60 m', () => {
    const r = resumenMuro(muro('aircrete-pretil'))
    expect(r.W).toBeCloseTo(117, 6)
    expect(r.alturas[0].wML).toBeCloseTo(70.2, 6)
    expect(r.alturas[1].wML).toBeCloseTo(93.6, 6)
    expect(r.alturas[2].wML).toBeCloseTo(105.3, 6)
  })
  it('muro de block 40×60 a 3 m → 666 kg/m', () => {
    expect(cargaLinealMuro(muro('block-40x60-muro'), 3)).toBeCloseTo(666, 6)
  })
})

describe('reparto por tablero — área tributaria (el del libro)', () => {
  // Tablero 1 de la hoja: a1 = 3.87, a2 = 6.15
  it('carga muerta del entrepiso: WLC y WLL del Excel', () => {
    const r = repartoTablero({ a1: 3.87, a2: 6.15, w: 422.5 })
    expect(r.m).toBeCloseTo(0.6292682926829268, 12)
    expect(r.dosDirecciones).toBe(true)
    expect(r.wCorto).toBeCloseTo(408.76875, 9)
    expect(r.wLargo).toBeCloseTo(560.3122865853658, 9)
  })
  it('carga viva máxima del mismo tablero', () => {
    const r = repartoTablero({ a1: 3.87, a2: 6.15, w: 350 })
    expect(r.wCorto).toBeCloseTo(338.625, 9)
    expect(r.wLargo).toBeCloseTo(464.16402439024387, 9)
  })
  it('da igual el orden en que se capturen los lados', () => {
    const a = repartoTablero({ a1: 3.87, a2: 6.15, w: 422.5 })
    const b = repartoTablero({ a1: 6.15, a2: 3.87, w: 422.5 })
    expect(b.wCorto).toBeCloseTo(a.wCorto, 12)
    expect(b.wLargo).toBeCloseTo(a.wLargo, 12)
    expect(b.corto).toBe(3.87)
  })
  it('m ≤ 0.5 → una dirección: todo baja a las trabes largas', () => {
    const r = repartoTablero({ a1: 3, a2: 9, w: 500 })
    expect(r.dosDirecciones).toBe(false)
    expect(r.wCorto).toBe(0)
    expect(r.wLargo).toBeCloseTo(750, 9)
  })
  it('tablero cuadrado: los dos lados reciben lo mismo', () => {
    const r = repartoTablero({ a1: 5, a2: 5, w: 400 })
    expect(r.m).toBe(1)
    expect(r.wCorto).toBeCloseTo(500, 9)
    expect(r.wLargo).toBeCloseTo(500, 9)
  })
  it('lados en cero no rompen el cálculo', () => {
    expect(repartoTablero({ a1: 0, a2: 6, w: 400 })).toMatchObject({ wCorto: 0, wLargo: 0 })
  })
})

describe('reparto por tablero — equivalente por momento', () => {
  it('dos direcciones: w·a1/3 y su trapecio', () => {
    const r = repartoTablero({ a1: 4, a2: 6, w: 600, metodo: 'equivalente' })
    const m = 4 / 6
    expect(r.wCorto).toBeCloseTo((600 * 4) / 3, 9)
    expect(r.wLargo).toBeCloseTo(((600 * 4) / 3) * ((3 - m * m) / 2), 9)
  })
  it('una dirección: mismo resultado que por área tributaria', () => {
    const a = repartoTablero({ a1: 3, a2: 9, w: 500, metodo: 'equivalente' })
    const b = repartoTablero({ a1: 3, a2: 9, w: 500, metodo: 'tributaria' })
    expect(a.wLargo).toBeCloseTo(b.wLargo, 12)
  })
  it('reparte más que el área tributaria en el lado corto', () => {
    const a = repartoTablero({ a1: 4, a2: 6, w: 600, metodo: 'equivalente' })
    const b = repartoTablero({ a1: 4, a2: 6, w: 600, metodo: 'tributaria' })
    expect(a.wCorto).toBeGreaterThan(b.wCorto)
  })
})

describe('dirección forzada', () => {
  it('forzar una dirección en un tablero que saldría en dos', () => {
    const r = repartoTablero({ a1: 4, a2: 6, w: 600, direccion: 'una' })
    expect(r.dosDirecciones).toBe(false)
    expect(r.wLargo).toBeCloseTo(1200, 9)
  })
  it('forzar dos direcciones en un tablero alargado', () => {
    const r = repartoTablero({ a1: 3, a2: 9, w: 500, direccion: 'dos' })
    expect(r.dosDirecciones).toBe(true)
    expect(r.wCorto).toBeCloseTo(375, 9)
  })
})

describe('analizarTablero', () => {
  const losa = { ...conCV('entrepiso-maciza', 'Oficinas'), id: 'L1' }
  it('devuelve un caso de carga muerta y uno de carga viva', () => {
    const a = analizarTablero({ a1: 3.87, a2: 6.15, losaId: 'L1', casoCV: 'Wm' }, losa)
    expect(a.casos.map((c) => c.clave)).toEqual(['CM', 'CV'])
    expect(a.casos[0].wCorto).toBeCloseTo(408.76875, 9)
    expect(a.casos[1].w).toBe(250)
  })
  it('el caso de carga viva sigue al que se elija', () => {
    const a = analizarTablero({ a1: 4, a2: 6, losaId: 'L1', casoCV: 'W' }, losa)
    expect(a.casos[1].w).toBe(100)
  })
  it('el muro de borde entra como carga lineal, sin repartirse por área', () => {
    const a = analizarTablero(
      { a1: 4, a2: 6, losaId: 'L1', casoCV: 'Wm', muroId: 'M1', muroH: 3, muroLado: 'largo' },
      losa, { ...muro('block-40x60-muro'), id: 'M1' },
    )
    const mc = a.casos.find((c) => c.clave === 'CM-muro')
    expect(mc.wLargo).toBeCloseTo(666, 6)
    expect(mc.wCorto).toBe(0)
    expect(a.totalLargo).toBeCloseTo(a.casos[0].wLargo + a.casos[1].wLargo + 666, 6)
  })
  it('un muro en ambos bordes carga los dos lados', () => {
    const a = analizarTablero(
      { a1: 4, a2: 6, losaId: 'L1', muroId: 'M1', muroH: 0.6, muroLado: 'ambos' },
      losa, { ...muro('aircrete-pretil'), id: 'M1' },
    )
    const mc = a.casos.find((c) => c.clave === 'CM-muro')
    expect(mc.wCorto).toBeCloseTo(70.2, 6)
    expect(mc.wLargo).toBeCloseTo(70.2, 6)
  })
  it('sin losa asignada no revienta', () => {
    expect(analizarTablero({ a1: 4, a2: 6 }, null).casos).toEqual([])
  })
})

describe('salida para RAM', () => {
  const losas = [{ ...conCV('entrepiso-maciza', 'Oficinas'), id: 'L1' }]
  const tableros = [{ id: 'T1', nombre: 'Tablero 1', nivel: 'N+3.00', losaId: 'L1', a1: 3.87, a2: 6.15, casoCV: 'Wm' }]

  it('una fila por caso, en kg/m', () => {
    const filas = filasRam(tableros, losas, [])
    expect(filas).toHaveLength(2)
    expect(filas[0]).toMatchObject({ tablero: 'Tablero 1', losa: 'Losa de entrepiso horizontal (Maciza)', direccion: '2 direcciones' })
    expect(filas[0].wCorto).toBeCloseTo(408.76875, 9)
  })
  it('en toneladas divide entre 1000', () => {
    const filas = filasRam(tableros, losas, [], { unidad: 'ton' })
    expect(filas[0].wCorto).toBeCloseTo(0.40876875, 12)
  })
  it('el CSV trae encabezado con la unidad y una línea por fila', () => {
    const csv = tablaRamCSV(filasRam(tableros, losas, []), { unidad: 'kg' })
    const lineas = csv.split('\n')
    expect(lineas).toHaveLength(3)
    expect(lineas[0]).toContain('WLC lado corto (kg/m)')
    expect(lineas[1]).toContain('Tablero 1')
  })
  it('el TSV separa con tabuladores para pegar en una hoja', () => {
    const tsv = tablaRamCSV(filasRam(tableros, losas, []), { sep: '\t' })
    expect(tsv.split('\n')[0].split('\t')).toHaveLength(12)
  })
  it('entrecomilla lo que trae el separador dentro', () => {
    const csv = tablaRamCSV(filasRam([{ ...tableros[0], nombre: 'Eje A, B' }], losas, []))
    expect(csv).toContain('"Eje A, B"')
  })
})
