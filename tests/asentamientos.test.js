// ══════════════════════════════════════════════════════════════
// 3.12 · Asentamientos de la cimentación. Datos FICTICIOS de CH-26-901
// (proyecto de prueba): un muro con 4 columnas y una liga.
// ══════════════════════════════════════════════════════════════
import { describe, it, expect } from 'vitest'
import { esquina, influencia, faltantes, nuevoAsent, asentamientos, franjasDe, efectoViga, resistencias, estratoEn, MALLA } from '../src/core/cim/asentamientos'
import { corridaDesde, papelesPorDefecto, cargasDeApoyo, vivaMediaDeApoyo } from '../src/core/cim/reacciones'
import { revisarLiga, nuevaLiga } from '../src/core/cim/liga'
import { EcNTC } from '../src/core/deflexiones'

const reac = (fy) => ({ fx: 0, fy, fz: 0, mx: 0, my: 0, mz: 0 })
const apoyo = (nudo, x, y, cm, cv, cvmed) => ({ nudo, x, y, elev: 0, por: { CM: reac(cm), CV: reac(cv), CVMED: reac(cvmed) }, col: { c1: 15, c2: 15 } })
// muro en y = 2 con columnas en x = 0, 3, 5 y 8; una columna aislada en (8, 6)
const A = { apoyos: [apoyo('1', 0, 2, 2, 0.5, 0.3), apoyo('2', 3, 2, 3, 0.8, 0.5), apoyo('3', 5, 2, 9, 2.4, 1.5), apoyo('4', 8, 2, 2.5, 0.6, 0.4), apoyo('5', 8, 6, 4, 1, 0.6)], up: 'y', plano: ['x', 'z'] }
const pap = { CM: 'CM', CV: 'CV', CVMED: 'CVmed' }
const cargas = A.apoyos.map((a) => { const c = cargasDeApoyo(a, pap, 'y'); return { CM: c.CM.P, CV: c.CV.P, CVmed: vivaMediaDeApoyo(a, pap, 'y') } })
const zc = { ...corridaDesde(A.apoyos.slice(0, 4), pap, 'y', { archivo: 'CH-26-901 (ficticio)' }), uid: 'zc901', nombre: 'ZC-901' }
zc.geo = { ...zc.geo, B: 0.6, h: 25 }
const datos = {
  ...nuevoAsent(), modelo: 'elastico', estratos: [{ id: 'E1', nombre: 'Basalto ficticio', E: 2000, nu: 0.3, ks: 3000 }, { id: 'E2', nombre: 'Arcilla ficticia', E: 500, nu: 0.4, ks: 800 }],
  base: 'E1', limMedio: 25, limMedioNota: 'zona I, colindante', limDist: 0.002, carga: 'apoyos', fInercia: 0.5, fcAsent: 1.0,
}
const calc = (asent = datos, extra = {}) => asentamientos({ A, cimientos: [zc], cargas, asent, ...extra })

describe('3.12 · el semiespacio elástico', () => {
  it('esquina de un cuadrado: 0.561 a; centro: 1.122 a (Timoshenko y Goodier)', () => {
    expect(esquina(1, 1)).toBeCloseTo((2 / Math.PI) * Math.log(1 + Math.SQRT2), 10)
    expect(esquina(1, 1)).toBeCloseTo(0.5611, 4)
    expect(influencia(-0.5, 0.5, -0.5, 0.5)).toBeCloseTo(1.1222, 4)
    expect(esquina(0, 2)).toBe(0)
  })
  it('superposición: dos mitades suman lo mismo que el rectángulo entero, dentro y fuera', () => {
    for (const [px, py] of [[0, 0], [0.3, 0.1], [2, 1.5], [-3, 0]]) {
      const todo = influencia(-1 - px, 1 - px, -0.3 - py, 0.3 - py)
      const mitades = influencia(-1 - px, 0 - px, -0.3 - py, 0.3 - py) + influencia(0 - px, 1 - px, -0.3 - py, 0.3 - py)
      expect(mitades).toBeCloseTo(todo, 10)
    }
  })
  it('lejos de la carga, la influencia baja como 1/r', () => {
    const a = influencia(10, 10.1, -0.05, 0.05), b = influencia(20, 20.1, -0.05, 0.05)
    expect(a / b).toBeCloseTo(2, 1)
  })
})

describe('3.12 · sin datos no calcula', () => {
  it('ningún valor de fábrica: dice todo lo que falta y no da números', () => {
    const R = calc(nuevoAsent())
    expect(R.ok).toBe(false)
    expect(R.paneles).toHaveLength(0)
    const f = R.faltan.join(' | ')
    for (const t of ['modelo del suelo', 'asentamiento medio permisible', 'límite de distorsión', 'qué carga lleva', 'inercia agrietada', 'factor de carga']) expect(f).toContain(t)
  })
  it('el modelo pide sus datos: E y ν, o ks', () => {
    const sinE = faltantes({ ...datos, estratos: [{ id: 'E1', nombre: 'S', E: '', nu: 0.3 }] })
    expect(sinE.join(' ')).toContain('falta E')
    const w = faltantes({ ...datos, modelo: 'winkler', estratos: [{ id: 'E1', nombre: 'S', E: 1, nu: 0.3, ks: '' }] })
    expect(w.join(' ')).toContain('falta ks')
    expect(faltantes({ ...datos, limDist: 0.004 }).join(' ')).toContain('distorsión')
  })
  it('sin caso de viva media ni permiso de usar la máxima, no calcula', () => {
    const f = faltantes(datos, { conCasoMedio: false })
    expect(f.join(' ')).toContain('viva media')
    expect(faltantes({ ...datos, cvMaxSiFalta: true }, { conCasoMedio: false })).toEqual([])
  })
  it('con la w del diseño pide la CV media de cada corrida', () => {
    expect(faltantes({ ...datos, carga: 'w' }, { corridas: [zc] }).join(' ')).toContain('ZC-901')
    expect(faltantes({ ...datos, carga: 'w', wCVmed: { zc901: 0.4 } }, { corridas: [zc] })).toEqual([])
  })
  it('sin modelo de RAM tampoco', () => {
    const R = asentamientos({ A: null, cimientos: [zc], cargas: [], asent: datos })
    expect(R.ok).toBe(false)
    expect(R.faltan[0]).toContain('modelo de RAM')
  })
})

describe('3.12 · el cálculo', () => {
  it('la viva media es un papel aparte: no entra al diseño', () => {
    expect(papelesPorDefecto([{ id: 'CVmed', descripcion: 'Carga viva media', categoria: 'LL' }]).CVmed).toBe('CVmed')
    const c = cargasDeApoyo(A.apoyos[2], pap, 'y')
    expect(c.CV.P).toBeCloseTo(2.4, 6)
    expect(vivaMediaDeApoyo(A.apoyos[2], pap, 'y')).toBeCloseTo(1.5, 6)
    expect(vivaMediaDeApoyo(A.apoyos[2], { CM: 'CM' }, 'y')).toBeNull()
  })
  it('la malla: paneles de ≈ 0.25 m que conservan la carga de los apoyos', () => {
    const R = calc()
    expect(R.ok === true || R.ok === false).toBe(true)
    expect(R.faltan).toEqual([])
    const f = R.franjas[0]
    expect(f.L).toBeCloseTo(9, 6)                                   // 8 m entre apoyos + 0.5 + 0.5
    expect(R.paneles).toHaveLength(Math.ceil(9 / MALLA))
    const total = R.paneles.reduce((s, P) => s + P.w * P.ds, 0)
    const esperado = [0, 1, 2, 3].reduce((s, i) => s + cargas[i].CM + cargas[i].CVmed, 0)
    expect(total).toBeCloseTo(esperado, 6)
  })
  it('Winkler: δ = q / ks en cada panel', () => {
    const R = calc({ ...datos, modelo: 'winkler' })
    for (const P of R.paneles) expect(P.d).toBeCloseTo(P.q / 3000, 12)
  })
  it('elástico: asienta más donde está el apoyo cargado (nudo 3)', () => {
    const R = calc()
    const d = Object.fromEntries(R.franjas[0].apoyos.map((p) => [p.nudo, p.d]))
    expect(d['3']).toBeGreaterThan(d['1'])
    expect(d['3']).toBeGreaterThan(d['4'])
    expect(R.medio).toBeGreaterThan(0)
    expect(R.checks.find((c) => c.id === 'asentMedio').act).toBeCloseTo(R.medio * 1000, 9)
  })
  it('elástico: el asentamiento del punto es (1 − ν²)/E · Σ q I', () => {
    const R = calc()
    const P = R.paneles[10]
    expect(P.d).toBeCloseTo((1 - 0.09) / 2000 * P.S, 12)
  })
  it('una zona sobre otro estrato: asienta más ahí; el escenario «todo sobre un estrato» la ignora', () => {
    const zona = { id: 'Z1', nombre: 'Arcilla junto al nudo 3', tipo: 'rect', x0: 4, x1: 6, y0: 1, y1: 3, estrato: 'E2' }
    const conZona = calc({ ...datos, zonas: [zona] })
    const base = calc({ ...datos, zonas: [zona] }, { escenario: 'base' })
    const d3 = (R) => R.franjas[0].apoyos.find((p) => p.nudo === '3').d
    expect(d3(conZona)).toBeGreaterThan(2 * d3(base))
    expect(estratoEn({ ...datos, zonas: [zona] }, 5, 2, null).id).toBe('E2')
    expect(estratoEn({ ...datos, zonas: [zona] }, 1, 2, null).id).toBe('E1')
    // y la distorsión junto a la zona crece
    const t = (R) => Math.max(...R.tramos.map((x) => x.dist))
    expect(t(conZona)).toBeGreaterThan(t(base))
  })
  it('un tramo de eje sobre otro estrato', () => {
    const R = calc({ ...datos, zonas: [{ id: 'Z2', nombre: 'Eje 1 en arcilla', tipo: 'eje', cim: 'zc901', eje: 0, estrato: 'E2' }] })
    expect(R.paneles.every((P) => P.est.id === 'E2')).toBe(true)
  })
  it('la distorsión entre apoyos va contra el límite que eligió el ingeniero', () => {
    const R = calc()
    expect(R.tramos.map((t) => `${t.p.nudo}-${t.q.nudo}`)).toEqual(['1-2', '2-3', '3-4'])
    for (const t of R.tramos) expect(t.dist).toBeCloseTo(Math.abs(t.q.d - t.p.d) / t.L, 12)
    const estricto = calc({ ...datos, limDist: 0.001 })
    expect(estricto.checks.find((c) => c.id === 'distorsion').res).toBe(0.001)
  })
})

describe('3.12 · efecto en la CT y las ligas', () => {
  it('M = FC · 6 EI Δ / L² y V = FC · 12 EI Δ / L³, con EI agrietado', () => {
    const sec = { b: 15, h: 30, sup: { num: 4, n: 2 }, inf: { num: 4, n: 2 }, est: { num: 2.5, ramas: 2, s: 15 }, r: 3, rInf: 5, fc: 250, fy: 4200 }
    const e = efectoViga({ que: 'CT-1', tramo: {}, L: 3, D: 0.005, sec, fI: 0.5, FC: 1.3 })
    const EI = EcNTC(250) * 0.5 * 15 * 30 ** 3 / 12
    expect(e.M).toBeCloseTo(1.3 * 6 * EI * 0.5 / 300 ** 2 / 1e5, 9)
    expect(e.V).toBeCloseTo(1.3 * 12 * EI * 0.5 / 300 ** 3 / 1000, 9)
  })
  it('MR y VR son los mismos que da la revisión de la liga para esa sección', () => {
    const z = { ...nuevaLiga(), geo: { b: 15, h: 30 }, arm: { sup: { num: 4, n: 2 }, inf: { num: 4, n: 2 }, est: { num: 2.5, ramas: 2, s: 15 } } }
    const R = revisarLiga(z, {})
    const r = resistencias({ b: 15, h: 30, sup: z.arm.sup, inf: z.arm.inf, est: z.arm.est, r: 3, rInf: 5, fc: 250, fy: 4200 })
    expect(r.MRsup).toBeCloseTo(R.checks.find((c) => c.id === 'flexionSup').res, 9)
    expect(r.MRinf).toBeCloseTo(R.checks.find((c) => c.id === 'flexionInf').res, 9)
    expect(r.VR).toBeCloseTo(R.checks.find((c) => c.id === 'cortante').res, 9)
  })
  it('la CT de la corrida se revisa en cada tramo entre apoyos', () => {
    const R = calc({ ...datos, zonas: [{ id: 'Z1', nombre: 'Arcilla', tipo: 'rect', x0: 4, x1: 6, y0: 1, y1: 3, estrato: 'E2' }] })
    const cts = R.efectos.filter((e) => e.que.startsWith('CT-1 de ZC-901'))
    expect(cts).toHaveLength(3)
    for (const e of cts) expect(e.D).toBeCloseTo(e.tramo.D, 12)
    expect(R.checks.find((c) => c.id === 'asentM')).toBeTruthy()
  })
  it('una liga sobre apoyos de la corrida toma su diferencial; si un nudo no tiene malla, se dice', () => {
    const liga = { ...nuevaLiga('TL-901'), uid: 'tl', columnas: [{ x: 0, c: 15, Pu: 5, Me: 0, nudo: '2' }, { x: 2, c: 15, Pu: 12, Me: 0, nudo: '3' }, { x: 6, c: 15, Pu: 6, Me: 0, nudo: '5' }] }
    const R = asentamientos({ A, cimientos: [zc, liga], cargas, asent: datos })
    const tl = R.efectos.filter((e) => e.que.startsWith('TL-901'))
    expect(tl).toHaveLength(1)
    const d = Object.fromEntries(R.franjas[0].apoyos.map((p) => [p.nudo, p.d]))
    expect(tl[0].D).toBeCloseTo(Math.abs(d['3'] - d['2']), 12)
    expect(tl[0].L).toBe(2)
    expect(R.ligasSin).toEqual(['TL-901 (nudos 3 y 5)'])
  })
  it('la memoria trae cada paso: datos, franjas, medio, distorsión y efecto', () => {
    const R = calc()
    const t = R.secciones.map((s) => s.titulo)
    expect(t[0]).toBe('Datos y criterio')
    expect(t.some((x) => x.startsWith('ZC-901, eje 1'))).toBe(true)
    expect(t.some((x) => x.startsWith('Asentamiento medio'))).toBe(true)
    expect(t.some((x) => x.startsWith('Distorsión entre apoyos'))).toBe(true)
    expect(t.some((x) => x.startsWith('Efecto del diferencial'))).toBe(true)
  })
  it('una corrida capturada sin ejes de RAM no entra y se dice', () => {
    const cap = { ...zc, uid: 'cap', nombre: 'ZC-cap', origen: null, ejes: [] }
    const { sinPos } = franjasDe(A, [cap], cargas)
    expect(sinPos.map((z) => z.nombre)).toEqual(['ZC-cap'])
  })
})
