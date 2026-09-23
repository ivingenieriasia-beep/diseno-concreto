import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import {
  formulaServicio, tramosDeFlecha, flechaRelativa, revisarTramo, revisarModelo, rolesPorDefecto,
  inerciaAgrietada, inerciaEfectiva, aceroDe, EcNTC, ffNTC,
} from '../src/core/deflexiones.js'
import { parseModeloRam } from '../src/core/ramModel.js'

const here = dirname(fileURLToPath(import.meta.url))
const E = 221359 * 10          // t/m²
const I = (15 * 20 ** 3) / 12 / 1e8   // m⁴ de un 15×20

/**
 * Modelo mínimo: trabes horizontales en y = 3 partidas en `tramos` miembros
 * por claro, columnas en los apoyos, carga uniforme w (t/m) por caso.
 * Cada claro se comporta empotrado-empotrado; `asiento` baja cada columna.
 */
function modelo({ claros = [6], partes = 4, w = { CM: 1.0, CV: 0.5 }, asiento = (k) => 0, libre = null } = {}) {
  const nudos = {}, miembros = []
  let nid = 1, mid = 1
  const xs = [0]; for (const L of claros) xs.push(xs[xs.length - 1] + L)
  const nodoEn = {}
  const nudo = (x, y, extra = {}) => { const k = `${x.toFixed(4)},${y}`; if (!nodoEn[k]) { nodoEn[k] = String(nid); nudos[nid++] = { x, y, z: 0, ...extra } } return nodoEn[k] }
  // columnas donde hay apoyo (no en el extremo libre de un voladizo)
  xs.forEach((x, k) => {
    if (libre === 'b' && k === xs.length - 1) return
    if (libre === 'a' && k === 0) return
    const base = nudo(x, 0, { apoyo: 'dxdydzrxryrz' }), arriba = nudo(x, 3)
    miembros.push({ id: mid++, grupo: 'C1', seccion: 'COL 30 X 30', ni: +base, nj: +arriba, L: 3, est: [[0, 0, 0, 0, 0, 0, 0], [3, 0, 0, 0, 0, 0, 0]] })
  })
  claros.forEach((Lc, k) => {
    const x0 = xs[k]
    const vol = (libre === 'b' && k === claros.length - 1) || (libre === 'a' && k === 0)
    for (let j = 0; j < partes; j++) {
      const a = x0 + (Lc * j) / partes, b = x0 + (Lc * (j + 1)) / partes, Lm = Lc / partes
      const xsm = Array.from({ length: 11 }, (_, i) => (Lm * i) / 10)
      const dy = {}, m = {}
      for (const [c, wc] of Object.entries(w)) {
        dy[c] = xsm.map((xl) => {
          const X = a - x0 + xl
          let v
          if (vol) { const t = libre === 'b' ? X : Lc - X; v = (wc * t * t * (6 * Lc * Lc - 4 * Lc * t + t * t)) / (24 * E * I) } // voladizo
          else v = (wc * X * X * (Lc - X) ** 2) / (24 * E * I)
          const sa = asiento(k), sb = asiento(k + 1)
          return (-v + sa + ((sb - sa) * X) / Lc) * 100         // cm
        })
        m[c] = xsm.map((xl) => {
          const X = a - x0 + xl
          if (vol) { const t = libre === 'b' ? Lc - X : X; return -(wc * t * t) / 2 }
          return (wc * X * (Lc - X)) / 2 - (wc * Lc * Lc) / 12
        })
      }
      miembros.push({
        id: mid++, grupo: 'T1', seccion: '15 X 20', ni: +nudo(a, 3), nj: +nudo(b, 3), L: Lm,
        est: [[0, 0, 0, 0, 0, 0, 0], [Lm, 0, 0, 0, 0, 0, 0]],
        def: { x: xsm, dy, m },
      })
    }
  })
  // unos nudos sueltos repartidos en z para que la vertical se detecte como Y, igual que en un edificio
  for (let k = 1; k <= 8; k++) nudos[nid++] = { x: -1, y: 0, z: k }
  return parseModeloRam({
    formato: 'auxiliar-iv/ram', modelo: { unidades: 'Ton-m' }, envueltas: ['CD'], nudos, miembros,
    secciones: { '15 X 20': { b: 15, h: 20, s: 3, tipo: 'viga' } },
    deflexiones: { casos: [{ id: 'CM', categoria: 'DEAD' }, { id: 'CV', categoria: 'LIVE' }], unidad: 'cm', desde: 'm', comprobada: true },
  })
}

const SEC = { nombre: 'T-1', ancho: 15, peralte: 20, recub: 3, fc: 250, calInf: '3', cantInf: 2, calSup: '3', cantSup: 2 }
const ROLES = { CM: 'muerta', CV: 'viva' }

describe('tramos y flecha relativa', () => {
  it('un claro entre columnas: flecha de empotrada wL⁴/384EI, sin el asentamiento de las columnas', () => {
    const R = modelo({ claros: [6], asiento: (k) => -0.003 * (k + 1) })
    const T = tramosDeFlecha(R)
    expect(T).toHaveLength(1)
    expect(T[0]).toMatchObject({ tipo: 'interior', grupo: 'T1' })
    expect(T[0].L).toBeCloseTo(6, 6)
    const f = flechaRelativa(T[0], T[0].dy.CM)
    expect(f.max).toBeCloseTo(((1.0 * 6 ** 4) / (384 * E * I)) * 100, 3)
    expect(f.x).toBeCloseTo(3, 1)
  })

  it('una trabe continua sobre tres columnas son dos tramos', () => {
    const T = tramosDeFlecha(modelo({ claros: [5, 4] }))
    expect(T.map((t) => [t.tipo, +t.L.toFixed(3)])).toEqual([['interior', 5], ['interior', 4]])
  })

  it('un extremo sin nada que lo sostenga es un voladizo, con el doble de límite', () => {
    const R = modelo({ claros: [5, 2], libre: 'b' })
    const T = tramosDeFlecha(R)
    expect(T.map((t) => t.tipo)).toEqual(['interior', 'voladizo'])
    const v = T[1]
    expect(flechaRelativa(v, v.dy.CM).max).toBeCloseTo(((1.0 * 2 ** 4) / (8 * E * I)) * 100, 3)
    const r = revisarTramo(v, SEC, { b: 15, h: 20 }, { roles: ROLES })
    expect(r.lim.total).toBeCloseTo(2 * (200 / 240 + 0.5), 9)
  })
})

describe('la sección agrietada', () => {
  it('Iag sin acero de compresión: b·c²/2 = n·As·(d − c)', () => {
    const b = 20, d = 37, As = 5.07, n = 9
    const Iag = inerciaAgrietada({ b, d, dc: 3, As, Asc: 0, n })
    const c = (-n * As + Math.sqrt((n * As) ** 2 + 2 * b * n * As * d)) / b
    expect(Iag).toBeCloseTo((b * c ** 3) / 3 + n * As * (d - c) ** 2, 6)
  })

  it('Branson: Ig si no se agrieta, entre Iag e Ig si sí', () => {
    expect(inerciaEfectiva({ Ig: 1000, Iag: 300, Mag: 2, Ma: 1.5 })).toBe(1000)
    const Ie = inerciaEfectiva({ Ig: 1000, Iag: 300, Mag: 2, Ma: 4 })
    expect(Ie).toBeCloseTo(0.125 * 1000 + 0.875 * 300, 9)
  })

  it('el acero: corridas y puntuales abajo al centro, arriba en los apoyos', () => {
    const a = aceroDe({ ...SEC, calBastonInf: '4', cantBastonPuntInf: 1, calBastonSup: '3', cantBastonPuntSup: 2 })
    expect(a.centro.As).toBeCloseTo(2 * 0.71 + 1.27, 9)
    expect(a.centro.Asc).toBeCloseTo(2 * 0.71, 9)
    expect(a.apoyo.As).toBeCloseTo(4 * 0.71, 9)
  })

  it('NTC: Ec y módulo de rotura por clase de concreto', () => {
    expect(EcNTC(250)).toBeCloseTo(14000 * Math.sqrt(250), 6)
    expect(EcNTC(200)).toBeCloseTo(8000 * Math.sqrt(200), 6)
    expect(ffNTC(250)).toBeCloseTo(2 * Math.sqrt(250), 9)
  })
})

describe('la revisión', () => {
  const R = modelo({ claros: [6] })
  const [t] = tramosDeFlecha(R)

  it('agrietada flecha más que la elástica; la diferida con 2/(1 + 50ρ′)', () => {
    const r = revisarTramo(t, SEC, { b: 15, h: 20 }, { roles: ROLES, fSost: 0.4 })
    expect(r.sinArmado).toBe(false)
    expect(r.inmediata.tot).toBeGreaterThanOrEqual(r.elastico.tot - 1e-12)
    const rho = (2 * 0.71) / (15 * 17)
    expect(r.lambda).toBeCloseTo(2 / (1 + 50 * rho), 9)
    // sostenida = CM + 40 % de CV
    expect(r.elastico.sost).toBeCloseTo(r.elastico.cm + 0.4 * (r.elastico.tot - r.elastico.cm), 9)
    expect(r.total).toBeCloseTo(r.inmediata.tot + r.lambda * r.inmediata.sost, 9)
    expect(r.post).toBeCloseTo(r.inmediata.tot - r.inmediata.cm + r.lambda * r.inmediata.sost, 9)
    expect(r.lim).toEqual({ total: 600 / 240 + 0.5, post: 600 / 480 + 0.3 })
    expect(r.estado).toBe(r.u.total <= 1 && r.u.post <= 1 ? 'ok' : 'no')
  })

  it('de fábrica, todo con la carga de servicio CS = 1·CM + 1·CV: también la sostenida', () => {
    const r = revisarTramo(t, SEC, { b: 15, h: 20 }, { roles: ROLES })
    expect(r.elastico.sost).toBeCloseTo(r.elastico.tot, 12)
    expect(r.diferida).toBeCloseTo(r.lambda * r.inmediata.tot, 9)
    expect(r.total).toBeCloseTo((1 + r.lambda) * r.inmediata.tot, 9)
    expect(formulaServicio(ROLES)).toBe('CS = 1·CM + 1·CV')
  })

  it('con un caso de viva media, ése es el sostenido', () => {
    const r = revisarTramo(t, SEC, { b: 15, h: 20 }, { roles: { CM: 'muerta', CV: 'viva-media' } })
    expect(r.elastico.sost).toBeCloseTo(r.elastico.tot, 9)
  })

  it('más acero, menos flecha', () => {
    const poco = revisarTramo(t, SEC, { b: 15, h: 20 }, { roles: ROLES })
    const mucho = revisarTramo(t, { ...SEC, cantInf: 4, cantSup: 4 }, { b: 15, h: 20 }, { roles: ROLES })
    expect(mucho.total).toBeLessThan(poco.total)
  })

  it('sin sección en el proyecto no hay armado: sólo la elástica, marcada', () => {
    const r = revisarTramo(t, null, { b: 15, h: 20 }, { roles: ROLES })
    expect(r).toMatchObject({ sinArmado: true, estado: 'sin-armado' })
    expect(r.total).toBeCloseTo(r.elastico.tot, 9)
  })

  it('revisarModelo empareja por nombre (T1 ↔ T-1)', () => {
    const [r] = revisarModelo(R, [SEC], { roles: ROLES })
    expect(r.sinArmado).toBe(false)
  })
})

describe('los papeles de los casos', () => {
  it('muerta, viva, media y accidental; el sismo no', () => {
    expect(rolesPorDefecto([
      { id: 'CM', categoria: 'DEAD' }, { id: 'CV', categoria: 'LIVE', descripcion: 'Carga viva máxima' },
      { id: 'CVA', categoria: 'LIVE', descripcion: 'Carga viva accidental' }, { id: 'CVM', categoria: 'LIVE', descripcion: 'Viva media' },
      { id: 'SX', categoria: 'EARTHQUAKE' }, { id: 'PP', categoria: '' },
    ])).toEqual({ CM: 'muerta', CV: 'viva', CVA: 'no', CVM: 'no', SX: 'no', PP: 'muerta' })
  })
})

// Lo escribió sincronizar.py contra un RAM falso con física: el edificio de
// prueba con trabes empotradas por crujía, asentamiento de columnas y giros
// congruentes con las flechas.
const SINC = join(here, 'fixtures', 'modelo_flechas.json')
describe.skipIf(!existsSync(SINC))('con lo que escribe sincronizar.py (RAM falso con física)', () => {
  it('51 tramos, y cada flecha elástica es la de empotrada con su momento de extremo', () => {
    const R = parseModeloRam(readFileSync(SINC, 'utf-8'))
    const T = tramosDeFlecha(R)
    expect(T).toHaveLength(9 * 3 + 12 * 2)
    for (const t of T) {
      const Mend = Math.abs(t.m.CM[0])
      const esperado = ((Mend * t.L ** 2) / (32 * E * I)) * 100      // wL⁴/384EI con w = 12·M/L²
      expect(flechaRelativa(t, t.dy.CM).max).toBeCloseTo(esperado, 3)   // el .json redondea a 1e-5 cm
    }
  })
})
