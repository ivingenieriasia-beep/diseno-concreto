import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import { meyerhof, rankine } from '../src/core/cim/suelo'
import { capacidadEfectiva, presiones, flexion, penetracion, parrilla, proponerParrilla, anclaje, arriba } from '../src/core/cim/comun'
import { revisarAislada, nuevaAislada, proponerAislada, centroColumna } from '../src/core/cim/aislada'
import { revisarCorrida, nuevaCorrida } from '../src/core/cim/corrida'
import { revisarContratrabe, nuevaContratrabe, presionRigida, diagramas, centrarResultante, combinacionesContratrabe } from '../src/core/cim/contratrabe'
import { revisarContencion, nuevaContencion, fuerzasMuro } from '../src/core/cim/contencion'
import { revisarGravedad, nuevaGravedad } from '../src/core/cim/gravedad'
import { revisarMamposteria, nuevaMamposteria, tabla84 } from '../src/core/cim/mamposteria'
import { TIPOS_CIM, crearCim, revisarCim, nombreLibre, estadoCim } from '../src/core/cim'
import { dibujarCim } from '../src/core/cim/dibujo'
import { parseModeloRam } from '../src/core/ramModel'
import { apoyosDe, papelesPorDefecto, cargasDeApoyo, agruparPorLado, aisladasDesde, contratrabeDesde, corridaDesde, envolvente } from '../src/core/cim/reacciones'

const valor = (R, titulo) => R.secciones.flatMap((s) => s.pasos).find((p) => p.t === titulo)?.v
const chk = (R, id) => R.checks.find((c) => c.id === id)

// Los números de las hojas de la oficina (Cimentaciones1-V2.xlsm y el Excel de
// mampostería) con sus datos de entrada: donde la hoja tenía bien las unidades
// el resultado tiene que salir igual.
describe('capacidad de carga (hoja «Capacidad Suelo»)', () => {
  it('Meyerhof da el qu de la hoja: c = 1.5 t/m², φ = 20°, B = L = Df = 2 m', () => {
    const m = meyerhof({ c: 1.5, phi: 20, gs: 1.5, Df: 2, B: 2, L: 2, FS: 3 })
    expect(m.Nq).toBeCloseTo(6.3994, 3)
    expect(m.Nc).toBeCloseTo(14.8347, 3)
    expect(m.Ng).toBeCloseTo(5.3863, 3)
    expect(m.qu).toBeCloseTo(83.034, 2)          // 83 034 kg/m² en la hoja
    expect(m.qadm).toBeCloseTo(27.678, 2)
  })
  it('con Df/B > 1 usa tan⁻¹(Df/B) (la hoja ponía la cotangente) y con excentricidad el ancho efectivo', () => {
    const a = meyerhof({ c: 0, phi: 30, gs: 1.6, Df: 3, B: 1.5, L: 1.5 })
    const k = Math.atan(2)
    expect(a.Fqd).toBeCloseTo(1 + 2 * Math.tan(Math.PI / 6) * (1 - 0.5) ** 2 * k, 6)
    const e = meyerhof({ c: 0, phi: 30, gs: 1.6, Df: 1, B: 2, L: 2, e: 0.25 })
    expect(e.Bp).toBeCloseTo(1.5, 9)
  })
  it('Rankine: Ka y Kp', () => {
    expect(rankine(22).Ka).toBeCloseTo(0.45496, 4)
    expect(rankine(25).Kp).toBeCloseTo(2.46391, 4)
    expect(rankine(30, 10).Ka).toBeGreaterThan(rankine(30).Ka)
  })
})

describe('núcleo de concreto', () => {
  it('capacidad efectiva en t/m² (la hoja restaba t/m³ a kg/m²)', () => {
    const q = capacidadEfectiva({ qadm: 11.3, gs: 1.5, Df: 0.8, h: 20 })
    expect(q.qe).toBeCloseTo(11.3 - 1.5 * 0.6 - 2.4 * 0.2, 9)
  })
  it('área efectiva de Meyerhof y la región con presión del lado de la resultante', () => {
    const p = presiones(10, 2, 2, 0.25, 0)
    expect(p.Bp).toBeCloseTo(1.5, 9)
    expect(p.q).toBeCloseTo(10 / 3, 9)
    expect(p.region.x0).toBeCloseTo(-0.5, 9)
    expect(p.region.x1).toBeCloseTo(1, 9)
  })
  it('flexión con la regla de la hoja: 4/3 del calculado sin bajar de temperatura', () => {
    const f = flexion({ Mu: 0.36, b: 70, d: 15, h: 20, fc: 250, fy: 4200 })
    expect(f.AsReq).toBeCloseTo(0.638, 2)                    // P7 de la hoja céntrica
    expect(f.As).toBeCloseTo(0.0018 * 70 * 20, 6)            // rige temperatura
    expect(f.rige).toBe('temperatura')
  })
  it('penetración: 4 lados al centro, 3 de lindero y 2 de esquina', () => {
    const carga = () => 0
    const base = { Pu: 20, c1: 30, c2: 30, B: 1.5, L: 1.5, d: 25, fc: 250, carga }
    expect(penetracion(base).b0).toBeCloseTo(4 * 55, 6)
    const lind = penetracion({ ...base, xc: -0.6 })
    expect(lind.posicion).toBe('borde')
    expect(lind.b0).toBeCloseTo(55 + 2 * (15 + 12.5 + 15) , 0)
    expect(penetracion({ ...base, xc: -0.6, yc: -0.6 }).posicion).toBe('esquina')
  })
  it('parrilla: las varillas a r de cada orilla y la separación real no pasa de la pedida', () => {
    const g = parrilla({ num: 4, s: 20, W: 120, r: 5 })
    expect(g.sReal).toBeLessThanOrEqual(20 + 1e-9)
    expect(g.n).toBe(7)
    expect(parrilla({ num: 3, s: 25, porMetro: true }).As).toBeCloseTo(0.71 * 4, 6)
    const p = proponerParrilla({ As: 6, W: 100, r: 5 })
    expect(p.As).toBeGreaterThanOrEqual(6)
  })
  it('el anclaje se reduce por el esfuerzo real y, si no alcanza recto, pide gancho', () => {
    const a = anclaje({ num: 4, s: 20, disponible: 20, fc: 250, fy: 4200, r: 5, AsReq: 3, AsProv: 6 })
    expect(a.k).toBeCloseTo(0.5, 9)
    expect(a.gancho).toBe(true)
    expect(anclaje({ num: 6, s: 20, disponible: 10, fc: 250, fy: 4200, r: 5 }).ok).toBe(false)
  })
  it('redondeos limpios', () => {
    expect(arriba(0.6000000001, 0.05)).toBe(0.6)
    expect(arriba(0.61, 0.05)).toBe(0.65)
  })
})

describe('zapata aislada', () => {
  const obra = { suelo: { qadm: 11.3, gs: 1.5, Df: 0.8 } }
  const excel = { ...nuevaAislada(), geo: { ...nuevaAislada().geo, B: 0.7, L: 0.7, h: 20, c1: 20, c2: 20 }, cargas: { CM: { P: 3.29, Mx: 0, My: 0 }, CV: { P: 0.91, Mx: 0, My: 0 } }, arm: { x: { num: 3, s: 23 }, y: { num: 3, s: 23 } } }
  it('la céntrica de la hoja cumple con su armado (0.70 × 0.70, #3 @ 23)', () => {
    const R = revisarAislada(excel, obra)
    expect(chk(R, 'suelo').act).toBeCloseTo(4.2 / 0.49, 6)
    expect(chk(R, 'suelo').res).toBeCloseTo(9.92, 6)          // qe de la hoja (9 920 kg/m²)
    expect(R.ok).toBe(true)
  })
  it('lindero: con trabe de liga el suelo trabaja parejo; sin liga el área efectiva se desploma', () => {
    const z = { ...nuevaAislada(), geo: { ...nuevaAislada().geo, px: 'min', B: 1.5, L: 1.5 }, cargas: { CM: { P: 20 }, CV: { P: 8 } } }
    const con = revisarAislada(z, obra), sin = revisarAislada({ ...z, geo: { ...z.geo, liga: false } }, obra)
    expect(chk(con, 'suelo').act).toBeCloseTo(28 / 2.25, 6)
    expect(chk(sin, 'suelo').act).toBeGreaterThan(4 * chk(con, 'suelo').act)
    expect(con.secciones.some((s) => /liga/.test(s.titulo))).toBe(true)
    expect(chk(con, 'penetracion').nota).toBe('borde')
  })
  it('momentos: la resultante se corre y la presión sube', () => {
    const z = { ...excel, geo: { ...excel.geo, B: 1.5, L: 1.5 }, cargas: { CM: { P: 10, Mx: 0, My: 1 }, CV: { P: 2, Mx: 0, My: 0.5 } } }
    const R = revisarAislada(z, obra)
    expect(chk(R, 'suelo').act).toBeCloseTo(12 / ((1.5 - 2 * 0.125) * 1.5), 6)
  })
  it('la columna se coloca al centro, al lindero o en la esquina', () => {
    const c = centroColumna({ B: 1.2, L: 1.2, c1: 30, c2: 30, px: 'min', py: 'max' })
    expect(c.xc).toBeCloseTo(-0.45, 9)
    expect(c.yc).toBeCloseTo(0.45, 9)
  })
  it('proponer deja una zapata que cumple todo, también la excéntrica de la hoja', () => {
    for (const z of [excel, { ...excel, geo: { ...excel.geo, h: 40 }, mat: { fc: 200, fy: 4200, r: 5 }, cargas: { CM: { P: 2.84, Mx: 0.29, My: 1.24 }, CV: { P: 2.26, Mx: 0.24, My: 0.99 } } }]) {
      const p = proponerAislada(z, obra)
      expect(revisarAislada({ ...z, ...p }, obra).ok).toBe(true)
    }
  })
})

describe('zapata corrida bajo muro', () => {
  it('la de la hoja: q = w / B y la capacidad efectiva bien restada', () => {
    const z = { ...nuevaCorrida(), geo: { ...nuevaCorrida().geo, B: 0.8, h: 20, t: 15, muro: 'concreto' }, mat: { fc: 300, fy: 4200, r: 5 } }
    const R = revisarCorrida(z, { suelo: { qadm: 13.52, gs: 1.739, Df: 0.8 } })
    expect(chk(R, 'suelo').act).toBeCloseTo(5.95 / 0.8, 6)
    expect(chk(R, 'suelo').res).toBeCloseTo(13.52 - 1.739 * 0.6 - 2.4 * 0.2, 6)
  })
  it('muro de mampostería: la flexión va a t/4 dentro del muro (más momento que en la cara)', () => {
    const base = { ...nuevaCorrida(), geo: { ...nuevaCorrida().geo, B: 1.2, t: 30 } }
    const m = revisarCorrida({ ...base, geo: { ...base.geo, muro: 'mamposteria' } }, {})
    const c = revisarCorrida({ ...base, geo: { ...base.geo, muro: 'concreto' } }, {})
    expect(valor(m, 'Momento último por metro (transversal)')).toBeGreaterThan(valor(c, 'Momento último por metro (transversal)'))
  })
})

describe('corrida con contratrabe (método rígido)', () => {
  const cargas = [{ x: 0.3, c: 30, P: 20, M: 0 }, { x: 4.3, c: 30, P: 30, M: 0 }, { x: 8.3, c: 30, P: 18, M: 0 }]
  it('equilibrio: el cortante y el momento cierran en cero al final', () => {
    const P = presionRigida(cargas, 8.6)
    const d = diagramas(cargas, 8.6, P.w)
    expect(P.R).toBeCloseTo(68, 9)
    expect(Math.abs(d.V.at(-1))).toBeLessThan(1e-6)
    expect(Math.abs(d.M.at(-1))).toBeLessThan(1e-3)            // la integración numérica deja décimas de kg·m
    // entre columnas tracciona arriba: el momento es negativo
    expect(Math.min(...d.M)).toBeLessThan(-5)
  })
  it('resultante al centro: presión uniforme', () => {
    const P = presionRigida([{ x: 1, c: 30, P: 10, M: 0 }, { x: 5, c: 30, P: 10, M: 0 }], 6)
    expect(P.w(0)).toBeCloseTo(P.w(6), 9)
  })
  it('centrar la resultante ajusta los voladizos', () => {
    const z = { ...nuevaContratrabe(), columnas: nuevaContratrabe().columnas.map((c, i) => (i === 0 ? { ...c, CM: { P: 40, M: 0 } } : c)) }
    const c = centrarResultante(z)
    const s = combinacionesContratrabe(c.columnas, { fcm: 1.3, fcv: 1.5 }).servicio[0].cargas
    expect(Math.abs(presionRigida(s, c.geo.L).e)).toBeLessThan(0.05)
  })
  it('el sismo entra en los dos sentidos', () => {
    const cols = nuevaContratrabe().columnas.map((c) => ({ ...c, S: { P: 5, M: 0 } }))
    expect(combinacionesContratrabe(cols, { fcm: 1.3, fcv: 1.5, facc: 1.1, kS: 1.33 }).ultimas).toHaveLength(3)
  })
})

describe('muro de contención (hoja «Muro Contención»)', () => {
  const z = { ...nuevaContencion(), geo: { H: 6, tc: 0.25, tb: 0.45, punta: 0.6, talon: 2.55, hz: 0.35, hk: 0, bk: 0.3, Df: 0.7, beta: 0, q: 0, pasivo: true, Lz: 1 } }
  const obra = { suelo: { gs: 1.51, phi: 22, phiB: 25, c: 2.1, gsB: 1.6, qadm: 46 } }
  it('empujes, pesos y estabilidad iguales a la hoja', () => {
    const F = fuerzasMuro(z, obra)
    expect(F.Ka).toBeCloseTo(0.45496, 4)
    expect(F.Pa).toBeCloseTo(12.36586, 4)
    expect(F.Pp).toBeCloseTo(5.58073, 4)
    const R = revisarContencion(z, obra)
    expect(valor(R, 'Suma de pesos')).toBeCloseTo(29.52533, 4)
    expect(valor(R, 'Momento resistente')).toBeCloseTo(60.15448, 4)
    expect(valor(R, 'Momento de volteo')).toBeCloseTo(24.73172, 4)
    expect(valor(R, 'Volteo')).toBeCloseTo(2.43228, 4)
    expect(valor(R, 'Fuerza resistente')).toBeCloseTo(19.46003, 3)
    expect(valor(R, 'Deslizamiento')).toBeCloseTo(1.57369, 4)
    expect(valor(R, 'Excentricidad')).toBeCloseTo(0.60026, 4)
    expect(chk(R, 'suelo').act).toBeCloseTo(16.40649, 4)
    // como en la hoja: la resultante sale del tercio medio por 0.3 mm
    expect(chk(R, 'excentricidad').ok).toBe(false)
    expect(R.datos.MuP).toBeCloseTo(30.97684, 4)            // Q7 de la hoja
  })
  it('el nuevo arranca propuesto y cumple', () => {
    expect(revisarCim(crearCim('contencion'), {}).ok).toBe(true)
  })
})

describe('mampostería', () => {
  it('cimiento de lindero de la hoja: volteo, deslizamiento, excentricidad y perpendiculares', () => {
    const obra = { suelo: { qadm: 22.5, Df: 0.95, gs: 1.08, phi: 7.8, mu: 0.5 } }
    const z = { ...nuevaMamposteria(), geo: { ...nuevaMamposteria().geo, B: 0.6, H: 0.75, autoB: false, autoH: false } }
    const R = revisarMamposteria(z, obra)
    expect(chk(R, 'suelo').act).toBeCloseTo(8.15, 9)
    expect(valor(R, 'Altura por cortante')).toBeCloseTo(0.4075, 9)
    expect(valor(R, 'Esfuerzo actuante')).toBeCloseTo(1.63, 9)
    expect(valor(R, 'Momento estabilizador')).toBeCloseTo(2.8395, 4)
    expect(valor(R, 'Volteo')).toBeCloseTo(165.833, 2)
    expect(valor(R, 'Deslizamiento')).toBeCloseTo(27.4126, 3)
    expect(valor(R, 'Excentricidad total')).toBeCloseTo(0.19838, 4)
    expect(tabla84(0.815)).toBe(10)
    expect(R.ok).toBe(true)                                  // «CIMIENTO VIABLE»
  })
  it('muro de piedra: juntas sin tensión y resultante en el tercio medio', () => {
    const R = revisarGravedad(nuevaGravedad(), {})
    expect(R.ok).toBe(true)
    expect(R.datos.juntas).toHaveLength(4)
    expect(R.datos.juntas.every((j) => j.okE)).toBe(true)
  })
})

describe('los seis tipos', () => {
  it('cada tipo nuevo arranca propuesto, cumple y tiene su dibujo con manijas', () => {
    for (const T of TIPOS_CIM) {
      const z = crearCim(T.id, [], {})
      const R = revisarCim(z, {})
      expect(R.ok, `${T.id}: ${R.checks.filter((c) => !c.ok).map((c) => c.id)}`).toBe(true)
      expect(R.secciones.length).toBeGreaterThan(1)
      const d = dibujarCim(z, R, { ancho: 1000, Df: 1 })
      expect(d.svg.startsWith('<svg')).toBe(true)
      expect(d.handles.length).toBeGreaterThan(1)
      expect(estadoCim(R).tono).not.toBe('mal')
    }
  })
  it('nombres libres por tipo', () => {
    expect(nombreLibre('aislada', [{ nombre: 'Z-1' }, { nombre: 'Z-3' }])).toBe('Z-2')
    expect(nombreLibre('contencion', [])).toBe('MC-1')
  })
})

describe('desde las reacciones de RAM', () => {
  const R = parseModeloRam(readFileSync(resolve(process.cwd(), 'tests/fixtures/modelo_cimentacion.json'), 'utf8'), 'modelo.json')
  const A = apoyosDe(R)
  const pap = papelesPorDefecto(R.casos)
  it('lee los apoyos por caso: muerta, viva y sismo', () => {
    expect(A.apoyos).toHaveLength(12)
    expect(A.conCasos).toBe(true)
    expect(pap).toEqual({ CM: 'CM', CV: 'CV', SX: 'S', SXN: 'S', SZ: 'S', SZN: 'S' })
    const c = cargasDeApoyo(A.apoyos.find((a) => a.nudo === '1'), pap, A.up)
    expect(c.CM.P).toBeCloseTo(9.625, 6)
    expect(c.CV.P).toBeCloseTo(2.64, 6)
    expect(c.S.P).toBeCloseTo(8.8096, 4)
  })
  it('la envolvente toma la muerta y la viva del apoyo más cargado', () => {
    const cs = A.apoyos.map((a) => cargasDeApoyo(a, pap, A.up))
    const e = envolvente(cs)
    const max = Math.max(...cs.map((c) => c.CM.P + c.CV.P))
    expect(e.CM.P + e.CV.P).toBeCloseTo(max, 2)
  })
  it('agrupar por lado: programación dinámica = la mejor partición', () => {
    const lados = [0.8, 0.9, 1.0, 1.5, 1.55, 2.2]
    const g = agruparPorLado(lados, 3)
    expect(g.map((x) => x.idx.length).sort()).toEqual([1, 2, 3])
    // fuerza bruta de las particiones contiguas
    const ord = [...lados].sort((a, b) => a - b)
    let mejor = Infinity
    for (let i = 1; i < 5; i++) for (let j = i + 1; j < 6; j++) {
      const c = i * ord[i - 1] ** 2 + (j - i) * ord[j - 1] ** 2 + (6 - j) * ord[5] ** 2
      mejor = Math.min(mejor, c)
    }
    const costo = g.reduce((s, x) => s + x.idx.length * x.B ** 2, 0)
    expect(costo).toBeCloseTo(mejor, 9)
  })
  it('zapatas aisladas agrupadas: cubren todos los apoyos y cumplen al proponerse', () => {
    const zs = aisladasDesde(A.apoyos, pap, A.up, { tipos: 3 })
    expect(zs.flatMap((z) => z.origen.ram.nudos).sort()).toEqual(A.apoyos.map((a) => a.nudo).sort())
    for (const z of zs) {
      const p = TIPOS_CIM[0].proponer(z, {})
      expect(revisarCim({ ...z, ...p }, {}).ok).toBe(true)
    }
  })
  it('contratrabe de un eje: columnas en su lugar y el sismo del eje con su signo', () => {
    const fila = A.apoyos.filter((a) => Math.abs(a.y) < 0.01)
    const z = contratrabeDesde(fila, pap, A.up)
    expect(z.columnas.map((c) => c.x)).toEqual([0.5, 4.5, 11, 15.5])
    const signos = z.columnas.map((c) => Math.sign(c.S.P))
    expect(signos[0]).toBe(-signos[signos.length - 1])        // un extremo sube, el otro baja
    const p = TIPOS_CIM[2].proponer(z, {})
    expect(revisarCim({ ...z, ...p }, {}).ok).toBe(true)
    const zc = corridaDesde(fila, pap, A.up)
    expect(zc.cargas.CM.w).toBeGreaterThan(0)
  })
})

// Robustez: con suelos, cargas y alturas de todo tipo, ⚡ Proponer entrega algo
// que cumple o, si no hay manera (suelo muy pobre, columna chica, la resultante
// fuera de la base), la revisión dice por qué. Nunca NaN escondidos.
describe('robustez de las propuestas', () => {
  it('la resultante fuera de la base no deja área (antes dos negativos daban área positiva)', () => {
    const p = presiones(5, 0.6, 0.6, 2, 4)
    expect(p.sinArea).toBe(true)
    expect(p.Ap).toBe(0)
    expect(p.q).toBe(Infinity)
  })

  it('cada tipo, en un barrido de suelos y cargas, cumple o avisa', () => {
    const casos = []
    for (const qadm of [6, 15, 30]) {
      const obra = { suelo: { qadm, Df: 1 } }
      for (const P of [8, 40, 120]) for (const [px, py] of [['centro', 'centro'], ['min', 'centro'], ['min', 'min']]) for (const M of [0, 8]) {
        const z = nuevaAislada('Z-1')
        z.geo = { ...z.geo, px, py, c1: 40, c2: 40 }
        z.cargas = { CM: { P: 0.7 * P, Mx: M, My: M / 2 }, CV: { P: 0.3 * P, Mx: 0, My: 0 }, S: { P: 0, Mx: M, My: M } }
        casos.push([`aislada q${qadm} P${P} ${px}/${py} M${M}`, z, obra])
      }
      for (const w of [4, 12, 25]) for (const pos of ['centro', 'lindero']) {
        const z = nuevaCorrida('ZC-1'); z.geo = { ...z.geo, pos }; z.cargas = { ...z.cargas, CM: { w: 0.7 * w, M: 0 }, CV: { w: 0.3 * w, M: 0 } }
        casos.push([`corrida q${qadm} w${w} ${pos}`, z, obra])
      }
      for (const H of [1.5, 3, 5]) for (const q of [0, 1.5]) {
        const z = nuevaContencion('MC-1'); z.geo = { ...z.geo, H, q }
        casos.push([`contencion q${qadm} H${H} q${q}`, z, obra])
      }
      for (const H of [1.5, 3]) { const z = nuevaGravedad('MM-1'); z.geo = { ...z.geo, H }; casos.push([`gravedad q${qadm} H${H}`, z, obra]) }
      for (const w of [3, 8]) for (const pos of ['centro', 'lindero']) {
        const z = nuevaMamposteria('CP-1'); z.geo = { ...z.geo, pos }; z.cargas = { CM: { w: 0.7 * w }, CV: { w: 0.3 * w } }
        casos.push([`mamposteria q${qadm} w${w} ${pos}`, z, obra])
      }
      for (const f of [0.5, 1, 2]) {
        const z = nuevaContratrabe('ZT-1')
        z.columnas = z.columnas.map((c) => ({ ...c, CM: { ...c.CM, P: c.CM.P * f }, CV: { ...c.CV, P: c.CV.P * f } }))
        casos.push([`contratrabe q${qadm} f${f}`, z, obra])
      }
    }
    const mudos = [], conNaN = []
    let cumplen = 0
    for (const [etq, z, obra] of casos) {
      const zz = crearCim(z.tipo, [], obra, z)
      const R = revisarCim(zz, obra)
      expect(R.error, etq).toBeFalsy()
      if (R.ok) cumplen++
      else if (!R.avisos?.length) mudos.push(`${etq}: ${R.checks.filter((c) => !c.ok).map((c) => c.id).join(', ')}`)
      if (R.checks.some((c) => c.ok && !Number.isFinite(c.u))) conNaN.push(etq)
    }
    expect(mudos).toEqual([])
    expect(conNaN).toEqual([])
    expect(cumplen / casos.length).toBeGreaterThan(0.85)
  }, 120000)

  it('con suelo de 15 t/m² y cargas comunes todo cumple', () => {
    const obra = { suelo: { qadm: 15, Df: 1 } }
    for (const t of TIPOS_CIM) expect(revisarCim(crearCim(t.id, [], obra), obra).ok, t.id).toBe(true)
  })
})
