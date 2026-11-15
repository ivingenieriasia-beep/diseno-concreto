// ══════════════════════════════════════════════════════════════
// 3.13 · Asentamientos con la cimentación como viga sobre resortes y las
// trabes de liga. El solver contra soluciones cerradas (Hetényi, viga
// rígida, resorte entre dos vigas) y el modelo armado desde el proyecto, con
// datos FICTICIOS de CH-26-901.
// ══════════════════════════════════════════════════════════════
import { describe, it, expect } from 'vitest'
import { resolverVigas, rigidezLiga, mallaViga, DS_VIGA } from '../src/core/cim/vigaResortes'
import { asentamientos, nuevoAsent } from '../src/core/cim/asentamientos'
import { ligasDelModelo, seccionViga } from '../src/core/cim/asentViga'
import { dibujoAsent, diagramaViga, diagramaLiga } from '../src/core/cim/asentDibujo'
import { memoriaAsentPdf } from '../src/core/cim/salidas'
import { corridaDesde, contratrabeDesde, ligaDesde, cargasDeApoyo, vivaMediaDeApoyo } from '../src/core/cim/reacciones'
import { EcNTC } from '../src/core/deflexiones'

// ── el solver ─────────────────────────────────────────────────
/** Una viga uniforme de largo L, con ks·B, carga uniforme w y puntuales [{ s, P }] */
function vigaUniforme({ L, kB, EI, w = 0, puntos = [], ds = DS_VIGA }) {
  const ss = mallaViga(L, puntos.map((p) => p.s), ds)
  const n = ss.length - 1
  const nodos = ss.map((s, i) => {
    const trib = ((i < n ? ss[i + 1] - s : 0) + (i > 0 ? s - ss[i - 1] : 0)) / 2
    return { s, k: kB * trib, P: [w * trib] }
  })
  for (const p of puntos) nodos[ss.findIndex((s) => Math.abs(s - p.s) < 1e-9)].P[0] += p.P
  return { EI, nodos }
}

describe('3.13 · el solver de la viga sobre resortes', () => {
  it('Hetényi: viga larga con una carga al centro, w₀ = Pλ/2k y M₀ = P/4λ', () => {
    const kB = 2000 * 0.6, EI = 500, P = 10, L = 30
    const lam = (kB / (4 * EI)) ** 0.25
    const v = vigaUniforme({ L, kB, EI, puntos: [{ s: L / 2, P }] })
    const R = resolverVigas([v], [], 1)
    const i = v.nodos.findIndex((n) => Math.abs(n.s - L / 2) < 1e-9)
    expect(R.vigas[0].w[0][i]).toBeCloseTo((P * lam) / (2 * kB), 5)
    expect(R.vigas[0].M[0][i] / (P / (4 * lam))).toBeCloseTo(1, 3)
    // el suelo toma toda la carga
    expect(v.nodos.reduce((s, n, j) => s + n.k * R.vigas[0].w[0][j], 0)).toBeCloseTo(P, 6)
  })
  it('carga pareja sobre resortes parejos: baja parejo w/(ks B) y no flexiona, sea cual sea EI', () => {
    const v = vigaUniforme({ L: 6, kB: 1200, EI: 9000, w: 3 })
    const R = resolverVigas([v], [], 1)
    for (const w of R.vigas[0].w[0]) expect(w).toBeCloseTo(3 / 1200, 9)
    expect(Math.max(...R.vigas[0].M[0].map(Math.abs))).toBeLessThan(1e-6)
  })
  it('sin rigidez (EI = 0) cada nudo baja por su cuenta: P/k', () => {
    const v = vigaUniforme({ L: 2, kB: 1000, EI: 0, w: 2 })
    const R = resolverVigas([v], [], 1)
    R.vigas[0].w[0].forEach((w, i) => expect(w).toBeCloseTo(v.nodos[i].P[0] / v.nodos[i].k, 12))
  })
  it('la liga: 12 EI/L³ empotrada-empotrada, 3 EI/L³ con un extremo articulado, nada si las dos lo están', () => {
    expect(rigidezLiga(100, 2, 'empotrada', 'empotrada').k).toBeCloseTo(150, 9)
    expect(rigidezLiga(100, 2, 'articulada', 'empotrada').k).toBeCloseTo(37.5, 9)
    expect(rigidezLiga(100, 2, 'empotrada', 'articulada').k).toBeCloseTo(37.5, 9)
    expect(rigidezLiga(100, 2, 'articulada', 'articulada').k).toBe(0)
    // los momentos: M = F L en el empotrado de una articulada; ± F L/2 en la doble
    const R1 = rigidezLiga(100, 2, 'articulada', 'empotrada'), m1 = R1.M(0.01)
    expect(m1.Ma).toBe(0); expect(-m1.Mb).toBeCloseTo(R1.k * 0.01 * 2, 9)
    const R2 = rigidezLiga(100, 2, 'empotrada', 'empotrada'), m2 = R2.M(0.01)
    expect(m2.Ma).toBeCloseTo(R2.k * 0.01, 9); expect(m2.Mb).toBeCloseTo(-m2.Ma, 9)
  })
  it('una liga entre dos vigas: Woodbury da lo mismo que dos resortes en serie', () => {
    // dos vigas rígidas, una cargada; la liga las une: cada una baja como un resorte
    const A = vigaUniforme({ L: 2, kB: 1000, EI: 9000, w: 5 }), B = vigaUniforme({ L: 2, kB: 1000, EI: 9000 })
    const kl = 300
    const R = resolverVigas([A, B], [{ a: { v: 0, i: A.nodos.length - 1 }, b: { v: 1, i: 0 }, k: kl }], 1)
    // equilibrio global: el suelo de las dos toma los 10 t
    const reac = (v, w) => v.nodos.reduce((s, n, j) => s + n.k * w[j], 0)
    expect(reac(A, R.vigas[0].w[0]) + reac(B, R.vigas[1].w[0])).toBeCloseTo(10, 6)
    // la fuerza de la liga es la reacción del suelo bajo la viga B
    expect(R.enlaces[0].F[0]).toBeCloseTo(reac(B, R.vigas[1].w[0]), 6)
    // la unión rígida: los dos nudos bajan lo mismo
    const U = resolverVigas([A, B], [{ a: { v: 0, i: A.nodos.length - 1 }, b: { v: 1, i: 0 }, k: Infinity }], 1)
    expect(U.vigas[0].w[0][A.nodos.length - 1]).toBeCloseTo(U.vigas[1].w[0][0], 10)
  })
  it('la malla pone un nudo en cada punto obligado y no pasa de DS_VIGA', () => {
    const ss = mallaViga(5.03, [0.5, 2.111, 4.9])
    for (const p of [0, 0.5, 2.111, 4.9, 5.03]) expect(ss.some((s) => Math.abs(s - p) < 1e-9)).toBe(true)
    for (let i = 1; i < ss.length; i++) expect(ss[i] - ss[i - 1]).toBeLessThanOrEqual(DS_VIGA + 1e-9)
  })
})

// ── el modelo desde el proyecto (CH-26-901, ficticio) ─────────
const reac = (fy) => ({ fx: 0, fy, fz: 0, mx: 0, my: 0, mz: 0 })
const apoyo = (nudo, x, y, cm, cv) => ({ nudo, x, y, elev: 0, por: { CM: reac(cm), CV: reac(cv) } })
const ap = {
  1: apoyo('1', 0, 2, 2, 0.5), 2: apoyo('2', 3, 2, 3, 0.8), 3: apoyo('3', 5, 2, 9, 2.4), 4: apoyo('4', 8, 2, 2.5, 0.6),
  5: apoyo('5', 0, 6, 2.2, 0.5), 6: apoyo('6', 4, 6, 4, 1), 7: apoyo('7', 8, 6, 2.4, 0.6),
}
const A = { apoyos: Object.values(ap), up: 'y', plano: ['x', 'z'] }
const pap = { CM: 'CM', CV: 'CV' }
const cargas = A.apoyos.map((a) => { const c = cargasDeApoyo(a, pap, 'y'); return { CM: c.CM.P, CV: c.CV.P, CVmed: vivaMediaDeApoyo(a, pap, 'y') } })
const corrida = (uid, nombre, ns) => { const z = { ...corridaDesde(ns.map((n) => ap[n]), pap, 'y', {}), uid, nombre }; z.geo = { ...z.geo, B: 0.6, h: 25 }; return z }
const zA = corrida('zcA', 'ZC-901', [1, 2, 3, 4])
const zB = corrida('zcB', 'ZC-902', [5, 6, 7])
const tl = { ...ligaDesde([ap[4], ap[7]], pap, 'y', {}), uid: 'tl1', nombre: 'TL-901' }
tl.geo = { ...tl.geo, b: 25, h: 60 }
tl.arm = { sup: { num: 5, n: 4 }, inf: { num: 5, n: 4 }, est: { num: 3, ramas: 2, s: 15 } }
const blando = { id: 'E2', nombre: 'Arcilla ficticia', E: '', nu: '', ks: 800 }
const base = {
  ...nuevoAsent(), metodo: 'viga', modelo: 'winkler',
  estratos: [{ id: 'E1', nombre: 'Firme ficticio', E: '', nu: '', ks: 20000 }, blando],
  zonas: [{ id: 'Z1', nombre: 'Bolsa blanda', tipo: 'rect', estrato: 'E2', x0: 6, x1: 9, y0: 1, y1: 3 }],
  limMedio: 25, limDist: 0.002, carga: 'apoyos', cvMaxSiFalta: true, fInercia: 1, pesoViga: 'no',
}
const calc = (cims, asent, extra = {}) => asentamientos({ A, cimientos: cims, cargas, asent, conCasoMedio: false, ...extra })

describe('3.13 · los datos de la viga sobre resortes', () => {
  it('sin elegir el modo se queda la corrida flexible de la 3.12, igual que antes', () => {
    const d = { ...base, metodo: '', fcAsent: 1 }
    const r = calc([zA], d)
    expect(r.metodo).toBeUndefined()
    expect(r.checks.map((c) => c.id)).toEqual(['asentMedio', 'distorsion', 'asentM', 'asentV'])
  })
  it('en la viga: pide Winkler, el peso, cómo llega cada liga y, si hay cruces, si van unidos', () => {
    const zC = corrida('zcC', 'ZC-903', [1, 5])
    const r = calc([zA, zB, zC, tl], { ...base, modelo: 'elastico', pesoViga: '', estratos: base.estratos.map((e) => ({ ...e, E: 2000, nu: 0.3 })) })
    expect(r.ok).toBe(false)
    const t = r.faltan.join(' | ')
    expect(t).toMatch(/Winkler/)
    expect(t).toMatch(/peso de la zapata/)
    expect(t).toMatch(/TL-901: elige cómo llega cada extremo/)
    expect(t).toMatch(/cruces/)
    // el factor de carga del hundimiento no se pide: el M y el V salen de U1
    expect(t).not.toMatch(/hundimiento diferencial/)
  })
  it('la liga agregada pide su sección, su nudo y a dónde llega', () => {
    const d = { ...base, ligas: [{ id: 'L1', nombre: 'Liga 1', tl: '', de: '', hasta: { tipo: 'nudo', nudo: '' }, extA: '', extB: '' }] }
    const t = calc([zA, zB], d).faltan.join(' | ')
    expect(t).toMatch(/Liga 1: elige su sección/)
    expect(t).toMatch(/Liga 1: elige el nudo de donde sale/)
    expect(t).toMatch(/Liga 1: elige a dónde llega/)
  })
  it('las TL del proyecto entre nudos de RAM entran solas, con sus extremos por elegir', () => {
    const ls = ligasDelModelo([zA, zB, tl], base)
    expect(ls).toHaveLength(1)
    expect(ls[0]).toMatchObject({ auto: true, de: '4', hasta: { tipo: 'nudo', nudo: '7' }, extA: '', extB: '' })
  })
})

describe('3.13 · el modelo armado desde el proyecto', () => {
  const sinLiga = calc([zA, zB], base)
  const conLiga = calc([zA, zB, tl], { ...base, extLigas: { 'tl1:0': { a: 'articulada', b: 'empotrada' } } })

  it('calcula con los datos completos: medio, distorsión y M y V de cada viga en U1', () => {
    expect(sinLiga.faltan).toEqual([])
    expect(sinLiga.checks.map((c) => c.id)).toEqual(['asentMedio', 'distorsion', 'vigaM', 'vigaV'])
    expect(sinLiga.vigas).toHaveLength(2)
    expect(sinLiga.paneles.length).toBeGreaterThan(0)
  })
  it('equilibrio: el suelo de cada viga toma sus cargas, en servicio y en U1', () => {
    for (const v of sinLiga.vigas) {
      const PS = v.nodos.reduce((s, n) => s + n.P[0], 0), PU = v.nodos.reduce((s, n) => s + n.P[1], 0)
      expect(v.nodos.reduce((s, n, j) => s + n.k * v.w[j], 0)).toBeCloseTo(PS, 6)
      expect(v.nodos.reduce((s, n, j) => s + n.k * v.wU[j], 0)).toBeCloseTo(PU, 6)
    }
    // servicio: CM + CV media (sin caso medio: la máxima, como pidió el ingeniero); U1: 1.3 CM + 1.5 CV
    const v = sinLiga.vigas[0]
    expect(v.nodos.reduce((s, n) => s + n.P[0], 0)).toBeCloseTo(2 + 0.5 + 3 + 0.8 + 9 + 2.4 + 2.5 + 0.6, 9)
    expect(v.nodos.reduce((s, n) => s + n.P[1], 0)).toBeCloseTo(1.3 * 16.5 + 1.5 * 4.3, 9)
  })
  it('la rigidez de la viga es la de su CT con Ie/Ig del ingeniero', () => {
    const v = sinLiga.vigas[0]
    expect(v.sec.b).toBe(15); expect(v.sec.h).toBe(30)
    expect(v.EI).toBeCloseTo(EcNTC(250) * 1 * (15 * 30 ** 3) / 12 / 1e7, 9)
    const v2 = calc([zA], { ...base, fInercia: 0.35 }).vigas[0]
    expect(v2.EI / v.EI).toBeCloseTo(0.35, 12)
  })
  it('la viga reparte: con una CT más peraltada la distorsión sobre la bolsa blanda baja', () => {
    const rigida = { ...zA, ct: { nombre: 'CT-2', b: 25, h: 60, sup: { num: 5, n: 4 }, inf: { num: 5, n: 4 } } }
    const dist = (r) => r.tramos.find((t) => t.p.nudo === '3' && t.q.nudo === '4').dist
    const ct1 = calc([zA], base), ct2 = calc([rigida], base)
    expect(ct2.vigas[0].sec.h).toBe(60)
    expect(dist(ct2)).toBeLessThan(0.6 * dist(ct1))
    // y en la corrida flexible la CT no cambia nada
    const f1 = calc([zA], { ...base, metodo: '', fcAsent: 1 }), f2 = calc([rigida], { ...base, metodo: '', fcAsent: 1 })
    expect(dist(f2)).toBeCloseTo(dist(f1), 12)
  })
  it('con la liga a la otra corrida, el extremo blando baja menos y la liga toma la diferencia', () => {
    const d4 = (r) => r.franjas.find((f) => f.z.uid === 'zcA').apoyos.find((p) => p.nudo === '4').d
    expect(d4(conLiga)).toBeLessThan(d4(sinLiga))
    expect(conLiga.ligas).toHaveLength(1)
    const l = conLiga.ligas[0]
    expect(l.L).toBeCloseTo(4, 9)
    const EI = EcNTC(250) * (25 * 60 ** 3) / 12 / 1e7
    expect(l.RL.k).toBeCloseTo((3 * EI) / 4 ** 3, 6)
    // F = k (w4 − w7) y M = F L en el empotrado
    const w7 = conLiga.franjas.find((f) => f.z.uid === 'zcB').apoyos.find((p) => p.nudo === '7').d
    expect(l.S.F).toBeCloseTo(l.RL.k * (d4(conLiga) - w7), 9)
    expect(Math.abs(l.U.Mb)).toBeCloseTo(Math.abs(l.U.F) * 4, 9)
    expect(l.U.Ma).toBe(0)
    expect(conLiga.checks.map((c) => c.id)).toEqual(['asentMedio', 'distorsion', 'vigaM', 'vigaV', 'ligaM', 'ligaV'])
    expect(conLiga.checks.find((c) => c.id === 'ligaV').nota).toMatch(/toma .* t en servicio/)
    // el equilibrio de todo: suelo = cargas
    const P = conLiga.vigas.reduce((s, v) => s + v.nodos.reduce((t, n) => t + n.P[0], 0), 0)
    const Rs = conLiga.vigas.reduce((s, v) => s + v.nodos.reduce((t, n, j) => t + n.k * v.w[j], 0), 0)
    expect(Rs).toBeCloseTo(P, 6)
  })
  it('la liga de un nudo al eje de otra viga llega al pie de la perpendicular', () => {
    const d = { ...base, ligas: [{ id: 'L1', nombre: 'Liga al eje', tl: 'tl1', de: '3', hasta: { tipo: 'eje', cim: 'zcB', eje: 0 }, extA: 'empotrada', extB: 'empotrada' }] }
    const r = calc([zA, zB, tl], { ...d, extLigas: { 'tl1:0': { a: 'articulada', b: 'articulada' } } })
    expect(r.faltan).toEqual([])
    const l = r.ligas.find((x) => x.key === 'L1')
    expect(l.B.x).toBeCloseTo(5, 9); expect(l.B.y).toBeCloseTo(6, 9); expect(l.L).toBeCloseTo(4, 9)
    expect(l.RL.k).toBeCloseTo(12 * l.EI / 64, 6)
    // la TL articulada en los dos extremos no transmite nada y lo dice
    expect(r.ligas.find((x) => x.key === 'tl1:0').inactiva).toBe(true)
    expect(r.avisos.join(' ')).toMatch(/no transmite nada/)
  })
  it('cruces unidos: las dos vigas bajan lo mismo en el nudo común y su carga entra una vez', () => {
    const zC = corrida('zcC', 'ZC-903', [1, 5])
    const r = calc([zA, zB, zC], { ...base, cruces: 'unidos' })
    expect(r.faltan).toEqual([])
    const d1 = r.franjas.filter((f) => f.apoyos.some((p) => p.nudo === '1')).map((f) => f.apoyos.find((p) => p.nudo === '1').d)
    expect(d1).toHaveLength(2)
    expect(d1[0]).toBeCloseTo(d1[1], 12)
    const P = r.vigas.reduce((s, v) => s + v.nodos.reduce((t, n) => t + n.P[0], 0), 0)
    expect(P).toBeCloseTo(A.apoyos.reduce((s, a, i) => s + cargas[i].CM + cargas[i].CV, 0), 9)
    const sep = calc([zA, zB, zC], { ...base, cruces: 'separados' })
    expect(sep.vigas.reduce((s, v) => s + v.nodos.reduce((t, n) => t + n.P[0], 0), 0)).toBeGreaterThan(P)
  })
  it('las contratrabes también son vigas, con su sección bw × H (sólo en este modo)', () => {
    const ct = { ...contratrabeDesde([ap[5], ap[6], ap[7]], pap, 'y', {}), uid: 'zt1', nombre: 'ZT-901' }
    expect(seccionViga(ct)).toMatchObject({ b: 25, h: 70 })
    const r = calc([zA, ct], base)
    expect(r.faltan).toEqual([])
    expect(r.vigas.map((v) => v.f.z.nombre)).toEqual(['ZC-901', 'ZT-901'])
    expect(calc([zA, ct], { ...base, metodo: '', fcAsent: 1 }).franjas.map((f) => f.z.nombre)).toEqual(['ZC-901'])
  })
  it('el peso del diseño y el capturado se suman a la viga (con fcm en U1)', () => {
    const r = calc([zA], { ...base, pesoViga: 'capturado', wPeso: { zcA: 1.2 } })
    const v = r.vigas[0]
    const L = v.f.L
    expect(v.nodos.reduce((s, n) => s + n.P[0], 0)).toBeCloseTo(20.8 + 1.2 * L, 9)
    expect(v.nodos.reduce((s, n) => s + n.P[1], 0)).toBeCloseTo(1.3 * 16.5 + 1.5 * 4.3 + 1.3 * 1.2 * L, 9)
    const rd = calc([zA], { ...base, pesoViga: 'diseno' })
    expect(rd.vigas[0].wP).toBeCloseTo(0.6 * (2.4 * 0.25 + 1.6 * (1 - 0.25)), 9)
    expect(calc([zA], { ...base, pesoViga: 'capturado' }).faltan.join(' ')).toMatch(/Falta el peso capturado .* ZC-901/)
  })
  it('U1 sale de los factores de la obra', () => {
    const r = calc([zA], base, { criterios: { fcm: 1.4, fcv: 1.7 } })
    expect(r.vigas[0].nodos.reduce((s, n) => s + n.P[1], 0)).toBeCloseTo(1.4 * 16.5 + 1.7 * 4.3, 9)
  })
  it('sin el modelo de RAM no calcula y lo dice', () => {
    const r = asentamientos({ A: null, cimientos: [zA], cargas: [], asent: base })
    expect(r.ok).toBe(false)
    expect(r.faltan[0]).toMatch(/modelo de RAM/)
  })
})

describe('3.13 · lo que se ve y la memoria', () => {
  const r = calc([zA, zB, tl], { ...base, extLigas: { 'tl1:0': { a: 'articulada', b: 'empotrada' } } })
  it('la planta dibuja la liga con su fuerza', () => {
    const d = dibujoAsent(r, { vista: 'planta' })
    expect(d.inner).toContain('data-liga="TL-901"')
    expect(d.inner).toContain('viga sobre resortes')
  })
  it('los diagramas de cada viga traen la deformada, el M y el V con sus límites', () => {
    const d = diagramaViga(r.vigas[0], { limD: r.limD })
    for (const k of ['deformada', 'M', 'V']) expect(d.inner).toContain(`data-diag="${k}"`)
    expect(d.inner).toContain('MR abajo')
    expect(d.inner).toContain('VR')
    const dl = diagramaLiga(r.ligas[0])
    expect(dl.inner).toContain('data-diag="M"')
    expect(dl.inner).toContain('empotrada')
  })
  it('la memoria tiene una sección por viga y la de las ligas', () => {
    const t = r.secciones.map((s) => s.titulo)
    expect(t).toContain('Trabes de liga (fuerza que toma cada una)')
    expect(t.filter((x) => /^ZC-90[12], eje 1/.test(x))).toHaveLength(2)
  })
  it('la memoria PDF se arma con los diagramas', async () => {
    const doc = await memoriaAsentPdf(r, { projectName: 'CH-26-901 (ficticio)' })
    expect(doc.getNumberOfPages()).toBeGreaterThanOrEqual(3)
  })
})
