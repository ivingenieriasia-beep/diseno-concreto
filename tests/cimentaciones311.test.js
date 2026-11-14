// ══════════════════════════════════════════════════════════════
// 3.11 · Cimentaciones: peralte mínimo d ≥ 15 cm (NTC-C 9.4.6.1) y
// «＋ en este eje» de «Desde RAM» que sólo liga, con cada apoyo revisado
// contra su reacción. Datos FICTICIOS de CH-26-901 (proyecto de prueba).
// ══════════════════════════════════════════════════════════════
import { describe, it, expect } from 'vitest'
import { nuevaCorrida, revisarCorrida, proponerCorrida } from '../src/core/cim/corrida'
import { nuevaAislada, revisarAislada, proponerAislada } from '../src/core/cim/aislada'
import { nuevaContratrabe, revisarContratrabe, proponerContratrabe } from '../src/core/cim/contratrabe'
import { CRITERIOS, peralteMinimo, hParaD, varilla } from '../src/core/cim/comun'
import { corridaDesde, ejeDesde, apoyosAlDia } from '../src/core/cim/reacciones'
import { tipoCim, ligarEje, revisarCim } from '../src/core/cim'
import { cimentacionEnPlanta } from '../src/core/cim/planta'

const chk = (R, id) => R.checks.find((c) => c.id === id)
const sec = (R, t) => R.secciones.find((s) => s.titulo.startsWith(t))

// CH-26-901 (ficticio): suelo de 18 t/m² a 1.0 m y muro de block de 15 cm
const obra = { suelo: { qadm: 18, Df: 1.0 }, criterios: { calibres: [3, 4, 5, 6, 8] } }
const zc901 = {
  ...nuevaCorrida('ZC-901'),
  geo: { B: 0.6, h: 25, t: 15, muro: 'mamposteria', pos: 'centro', liga: true, Lz: 12 },
  cargas: { CM: { w: 4.2, M: 0 }, CV: { w: 1.1, M: 0 }, S: { w: 0, M: 0 } },
  arm: { t: { num: 3, s: 15 }, l: { num: 3, n: 4, modo: 'n' } },
}

describe('3.11 · peralte mínimo d ≥ 15 cm (NTC-C 9.4.6.1)', () => {
  it('el criterio es d, no h: dMin 15 cm de fábrica y ya no hay hMin', () => {
    expect(CRITERIOS.dMin).toBe(15)
    expect(CRITERIOS.hMin).toBeUndefined()
    const p = peralteMinimo(CRITERIOS, 14.99)
    expect(p.check.ok).toBe(false)
    expect(p.check.nota).toBe('d ≥ 15 cm')
    expect(p.paso.t).toContain('NTC-C 9.4.6.1')
    expect(p.paso.f).toBe('d ≥ 15 cm')
    expect(peralteMinimo(CRITERIOS, 15).check.ok).toBe(true)
  })
  it('hParaD: el primer h en pasos de 5 cm que da d ≥ 15 (con 5 cm y #3: 20.5 → 25)', () => {
    expect(hParaD(CRITERIOS, 5, 3)).toBe(25)
    expect(hParaD(CRITERIOS, 5, 4)).toBe(25)
    expect(hParaD({ dMin: 10 }, 5, 3)).toBe(20)
  })
  it('corrida: h 15 y 20 no cumplen; h 25 sí, con d = h − r − ½ db en pantalla y en la memoria', () => {
    const db = varilla(3).diam
    for (const [h, ok] of [[15, false], [20, false], [21, true], [25, true]]) {
      const R = revisarCorrida({ ...zc901, geo: { ...zc901.geo, h } }, obra)
      const c = chk(R, 'peralte')
      expect(c.res, `h ${h}`).toBeCloseTo(h - 5 - db / 2, 6)
      expect(c.ok, `h ${h}`).toBe(ok)
      expect(c.nota).toBe('d ≥ 15 cm')
      const p = sec(R, 'Anclaje y mínimos').pasos.find((x) => x.t.startsWith('Peralte mínimo'))
      expect(p.f).toBe('d ≥ 15 cm')
      expect(p.n).toContain('h − r − ½ db')
    }
  })
  it('la ZC-901 con h 25 cumple todo (d 19.5 cm)', () => {
    const R = revisarCorrida(zc901, obra)
    expect(R.ok).toBe(true)
    expect(R.datos.d).toBeCloseTo(25 - 5 - varilla(3).diam / 2, 6)
  })
  it('aislada: el d mínimo es el de la capa de arriba', () => {
    const z = { ...nuevaAislada(), geo: { ...nuevaAislada().geo, B: 1.2, L: 1.2, h: 20 }, cargas: { CM: { P: 12 }, CV: { P: 4 } }, arm: { x: { num: 4, s: 20 }, y: { num: 4, s: 20 } } }
    const R = revisarAislada(z, obra)
    const db = varilla(4).diam
    expect(chk(R, 'peralte').res).toBeCloseTo(20 - 5 - db - db / 2, 6)
    expect(chk(R, 'peralte').ok).toBe(false)
    expect(chk(revisarAislada({ ...z, geo: { ...z.geo, h: 25 } }, obra), 'peralte').ok).toBe(true)
  })
  it('losa de la contratrabe: también d ≥ 15', () => {
    const z = { ...nuevaContratrabe(), geo: { ...nuevaContratrabe().geo, h: 20 } }
    const R = revisarContratrabe(z, obra)
    const c = chk(R, 'peralte')
    expect(c.nota).toBe('d ≥ 15 cm')
    expect(c.res).toBeCloseTo(20 - 5 - varilla(z.arm.alero.num).diam / 2, 6)
    expect(c.ok).toBe(false)
  })
  it('⚡ Proponer nunca deja d < 15, en un barrido de cargas y suelos', () => {
    for (const qadm of [8, 15, 25]) for (const k of [0.3, 1, 3]) {
      const ob = { ...obra, suelo: { ...obra.suelo, qadm } }
      const zc = { ...zc901, cargas: { CM: { w: 4.2 * k, M: 0 }, CV: { w: 1.1 * k, M: 0 }, S: { w: 0, M: 0 } } }
      const pc = proponerCorrida(zc, ob)
      const Rc = revisarCorrida({ ...zc, ...pc, geo: pc.geo }, ob)
      expect(Rc.datos.d, `corrida qadm ${qadm} ×${k}`).toBeGreaterThanOrEqual(15)
      expect(chk(Rc, 'peralte').ok).toBe(true)
      const za = { ...nuevaAislada(), cargas: { CM: { P: 15 * k }, CV: { P: 5 * k } } }
      const pa = proponerAislada(za, ob)
      const Ra = revisarAislada({ ...za, ...pa, geo: pa.geo }, ob)
      expect(Math.min(Ra.datos.dX, Ra.datos.dY), `aislada qadm ${qadm} ×${k}`).toBeGreaterThanOrEqual(15)
      const zt = nuevaContratrabe()
      const pt = proponerContratrabe({ ...zt, columnas: zt.columnas.map((c) => ({ ...c, CM: { ...c.CM, P: c.CM.P * k }, CV: { ...c.CV, P: c.CV.P * k } })) }, ob)
      const Rt = revisarContratrabe({ ...zt, ...pt, geo: pt.geo }, ob)
      expect(chk(Rt, 'peralte').ok, `contratrabe qadm ${qadm} ×${k}`).toBe(true)
    }
  })
  it('la propuesta de la ZC-901 ya no baja a h 15 (la 3.10 daba h 15, d 9.5)', () => {
    const p = proponerCorrida(zc901, obra)
    expect(p.geo.h).toBe(25)
  })
})

// Un muro ficticio de CH-26-901 con 4 columnas en x = 0, 3, 5 y 8 m (z = 2):
// el apoyo de x = 5 es el más cargado
const reac = (fy) => ({ fx: 0, fy, fz: 0, mx: 0, my: 0, mz: 0 })
const apoyo = (nudo, x, cm, cv) => ({ nudo, x, y: 2, elev: 0, por: { CM: reac(cm), CV: reac(cv) }, col: { c1: 15, c2: 15 } })
const A = { apoyos: [apoyo('1', 0, 2, 0.5), apoyo('2', 3, 3, 0.8), apoyo('3', 5, 9, 2.4), apoyo('4', 8, 2.5, 0.6)], up: 'y', plano: ['x', 'z'] }
const pap = { CM: 'CM', CV: 'CV' }

describe('3.11 · «Desde RAM»: cada apoyo con su reacción', () => {
  const z = corridaDesde(A.apoyos, pap, 'y', { archivo: 'CH-26-901 (ficticio)' })
  const apo = z.origen.ram.apoyos
  it('cada apoyo guarda su reacción y su largo tributario; los largos suman Lz', () => {
    expect(apo.map((p) => p.nudo)).toEqual(['1', '2', '3', '4'])
    expect(apo.map((p) => p.Lt)).toEqual([2, 2.5, 2.5, 2])          // 0.5 + 1.5 · 1.5 + 1 · 1 + 1.5 · 1.5 + 0.5
    expect(apo.reduce((s, p) => s + p.Lt, 0)).toBeCloseTo(z.geo.Lz, 6)
    expect(apo.reduce((s, p) => s + p.CM, 0)).toBeCloseTo(z.cargas.CM.w * z.geo.Lz, 2)
  })
  it('la revisión trae «Cada apoyo con su reacción» y la rige el más cargado', () => {
    const R = revisarCorrida({ ...z, geo: { ...z.geo, B: 0.6, h: 25 } }, obra)
    const c = chk(R, 'apoyos')
    expect(c.nota).toBe('rige el nudo 3')
    const s = sec(R, 'Cada apoyo con su reacción')
    expect(s.pasos.map((p) => p.t)).toEqual(['Criterio', 'Nudo 1', 'Nudo 2', 'Nudo 3', 'Nudo 4'])
    const n3 = R.datos.porApoyo.find((p) => p.nudo === '3')
    expect(n3.w).toBeCloseTo((9 + 2.4) / 2.5, 6)
    // la franja con la w del nudo 3 aprovecha lo mismo que dice su renglón
    const R3 = revisarCorrida({ ...z, geo: { ...z.geo, B: 0.6, h: 25 }, cargas: { CM: { w: 9 / 2.5 }, CV: { w: 2.4 / 2.5 }, S: { w: 0 } }, apoyosRam: [] }, obra)
    expect(n3.u).toBeCloseTo(Math.max(...['suelo', 'cortante', 'flexion', 'anclaje'].map((id) => chk(R3, id).u)), 6)
  })
  it('el promedio pasa y el apoyo cargado no: la revisión por apoyo lo detecta', () => {
    // B justa para el promedio (Σ/Lz) pero no para el nudo 3
    const prom = revisarCorrida({ ...z, geo: { ...z.geo, B: 0.6, h: 25 }, apoyosRam: [] }, { suelo: { qadm: 6, Df: 1.0 } })
    expect(chk(prom, 'suelo').ok).toBe(true)
    const R = revisarCorrida({ ...z, geo: { ...z.geo, B: 0.6, h: 25 } }, { suelo: { qadm: 6, Df: 1.0 } })
    expect(chk(R, 'apoyos').ok).toBe(false)
    expect(R.ok).toBe(false)
  })
  it('⚡ Proponer con apoyos cumple también apoyo por apoyo', () => {
    const ob = { suelo: { qadm: 6, Df: 1.0 } }
    const p = proponerCorrida(z, ob)
    const R = revisarCorrida({ ...z, ...p, geo: p.geo }, ob)
    expect(chk(R, 'apoyos').ok).toBe(true)
    expect(R.ok).toBe(true)
  })
  it('las cargas dicen de dónde salen: capturadas o de RAM, con el aviso de los muros', () => {
    const cap = revisarCorrida(zc901, obra)
    expect(sec(cap, 'Cargas del muro').pasos[0].f).toBe('w por metro capturado')
    expect(sec(cap, 'Cargas del muro').pasos[0].v).toBe('no se revisa contra reacciones de apoyos')
    expect(cap.avisos.some((a) => /malla de placas/.test(a))).toBe(false)
    const ram = revisarCorrida(z, obra)
    expect(sec(ram, 'Cargas del muro').pasos[0].f).toBe('w = Σ P de los apoyos / Lz')
    expect(ram.avisos.some((a) => /malla de placas/.test(a))).toBe(true)
  })
  it('apoyosAlDia toma la reacción de hoy de cada nudo', () => {
    const cargas = A.apoyos.map((a, i) => ({ CM: { P: i === 2 ? 12 : 1 }, CV: { P: 0 }, S: { P: 0 } }))
    const hoy = apoyosAlDia(apo, A, cargas)
    expect(hoy.find((p) => p.nudo === '3').CM).toBe(12)
    expect(hoy.find((p) => p.nudo === '3').Lt).toBe(2.5)
  })
})

describe('3.11 · «＋ en este eje» sólo liga', () => {
  const e = ejeDesde('corrida', A.apoyos, pap, 'y', {})
  it('el eje trae sus apoyos con su reacción', () => {
    expect(e.apoyos.map((p) => p.nudo)).toEqual(['1', '2', '3', '4'])
  })
  it('no cambia la sección ni el armado de un diseño capturado, y lo revisa en sus ejes', () => {
    const L = ligarEje(zc901, e, obra)
    expect(Object.keys(L.cambios)).toEqual(['ejes'])
    expect(L.cambios.ejes).toHaveLength(1)
    const z2 = { ...zc901, ...L.cambios }
    expect(z2.geo).toEqual(zc901.geo)
    expect(z2.arm).toEqual(zc901.arm)
    expect(L.mensaje).toContain('la sección y el armado no cambiaron')
    expect(L.mensaje).toContain('nudos 1, 2, 3, 4')
    // la 3.10 lo volvía a proponer: con las mismas cargas bajaba a h 15
    expect(L.R.porEje).toHaveLength(2)
  })
  it('si un eje ligado no cumple, lo dice y manda a ⚡ Proponer, sin tocar nada', () => {
    const ob = { suelo: { qadm: 6, Df: 1.0 } }
    const L = ligarEje(zc901, e, ob)
    expect(L.ok).toBe(false)
    expect(L.mensaje).toMatch(/No cumple en .*⚡ Proponer/)
    expect(Object.keys(L.cambios)).toEqual(['ejes'])
  })
  it('el eje ligado se revisa con la w de sus apoyos y cada apoyo con su reacción; el eje 1 con su w capturado', () => {
    const z2 = { ...zc901, ...ligarEje(zc901, e, obra).cambios }
    const R = revisarCim(z2, obra)
    expect(R.secciones[0].titulo).toBe('En sus 2 ejes')
    // la revisión por apoyo del eje ligado sale aunque el eje 1 (capturado) no la tenga
    const ap = chk(R, 'apoyos')
    expect(ap.titulo).toBe('Cada apoyo con su reacción')
    expect(ap.nota).toMatch(/rige el nudo 3 · eje de 1, 2, 3, 4/)
    const Re = tipoCim('corrida').revisar({ ...z2, ejes: [] }, obra)
    expect(sec(Re, 'Cargas del muro').pasos[0].f).toBe('w por metro capturado')
  })
  it('cantidades: un diseño capturado va con su largo de planos; los ejes ligados no se suman', () => {
    const solo = revisarCim(zc901, obra)
    const z2 = { ...zc901, ...ligarEje(zc901, e, obra).cambios }
    const z3 = { ...z2, ...ligarEje(z2, { ...e, nudos: ['5', '6'] }, obra).cambios }
    const R = revisarCim(z3, obra)
    // 0.60 × 0.25 × 12 m = 1.80 m³, con o sin ejes ligados (la 3.11 sumaba 12 + 9 + 9 m)
    expect(solo.cant.concreto).toBeCloseTo(0.6 * 0.25 * 12, 6)
    expect(R.cant.concreto).toBeCloseTo(solo.cant.concreto, 6)
    expect(R.cant.acero).toBeCloseTo(solo.cant.acero, 6)
    expect(R.cantNota).toMatch(/largo de planos.*2 eje\(s\) ligado\(s\) sólo se revisan/)
  })
  it('cantidades: un diseño que salió de RAM suma sus ejes, cada uno con su largo', () => {
    const z = { ...corridaDesde(A.apoyos, pap, 'y', {}), nombre: 'ZC-902', geo: { ...corridaDesde(A.apoyos, pap, 'y', {}).geo, B: 0.6, h: 25 } }
    const base = revisarCim(z, obra)
    const z2 = { ...z, ...ligarEje(z, e, obra).cambios }
    const R = revisarCim(z2, obra)
    expect(R.cant.concreto).toBeCloseTo(2 * base.cant.concreto, 6)
    expect(R.cantNota).toBe('suma de sus 2 ejes')
  })
  it('en la planta, cada apoyo ligado lleva su propio aprovechamiento', () => {
    const z2 = { ...zc901, uid: 'u1', ...ligarEje(zc901, e, obra).cambios }
    const cargas = A.apoyos.map((a) => ({ CM: { P: a.por.CM.fy, Mx: 0, My: 0, Vx: 0, Vy: 0 }, CV: { P: a.por.CV.fy, Mx: 0, My: 0, Vx: 0, Vy: 0 }, S: { P: 0, Mx: 0, My: 0, Vx: 0, Vy: 0 } }))
    // con un suelo de 8 t/m² rige el suelo y se nota el apoyo cargado (con el acero mínimo empatan)
    const P = cimentacionEnPlanta(A, [z2], cargas, { suelo: { qadm: 8, Df: 1.0 } }, null, {})
    const n3 = P.porNudo.get('3')[0], n1 = P.porNudo.get('1')[0]
    expect(n3.apoyo.nudo).toBe('3')
    expect(n3.apoyo.Lt).toBe(2.5)
    expect(n3.u).toBeGreaterThan(n1.u)
    // y la franja del eje ligado se dibuja aunque el diseño sea capturado
    expect(P.items.filter((it) => it.franja)).toHaveLength(1)
  })
})

describe('3.11 · el cuadro «Desde RAM» no se cierra al elegir apoyos', () => {
  it('un cimiento de la planta se abre con doble clic, no con un clic sencillo', async () => {
    const { readFileSync } = await import('fs')
    const { resolve } = await import('path')
    const src = readFileSync(resolve(process.cwd(), 'src/components/cim/CimRam.jsx'), 'utf8')
    const item = src.slice(src.indexOf('className="cim-plan-item"'), src.indexOf('<polygon data-cim'))
    expect(item).toContain('onDoubleClick={() => abrir(it.z)}')
    expect(item).not.toMatch(/onClick=\{\(\) => abrir/)
    expect(src).toContain('doble clic en un cimiento para abrirlo')
  })
})
